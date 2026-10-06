<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$action = clean($_GET['action'] ?? '');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$db = db();

if ($action === 'login' && $method === 'POST') {
    start_session();
    $now = time();
    if (isset($_SESSION['login_locked_until']) && $_SESSION['login_locked_until'] > $now) {
        json_response(['error' => 'Demasiados intentos. Intenta de nuevo en unos minutos.'], 429);
    }
    $input = body();
    $email = strtolower(clean($input['email'] ?? ''));
    $password = (string) ($input['password'] ?? '');
    $stmt = $db->prepare('SELECT id, full_name, email, role, password_hash FROM internal_users WHERE email = ? AND active = 1 LIMIT 1');
    $stmt->execute([$email]);
    $account = $stmt->fetch();
    if (!$account || !password_verify($password, $account['password_hash'])) {
        $_SESSION['login_attempts'] = (int) ($_SESSION['login_attempts'] ?? 0) + 1;
        if ($_SESSION['login_attempts'] >= 5) $_SESSION['login_locked_until'] = $now + 300;
        json_response(['error' => 'Correo o contraseña incorrectos.'], 401);
    }
    session_regenerate_id(true);
    $_SESSION['login_attempts'] = 0;
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
    $_SESSION['user'] = ['id' => (int) $account['id'], 'name' => $account['full_name'], 'email' => $account['email'], 'role' => $account['role']];
    audit($db, (int) $account['id'], 'sesion', (int) $account['id'], 'inicio');
    json_response(['user' => $_SESSION['user'], 'csrf' => $_SESSION['csrf']]);
}

if ($action === 'logout' && $method === 'POST') {
    verify_csrf();
    $current = require_user();
    audit($db, $current['id'], 'sesion', $current['id'], 'cierre');
    $_SESSION = [];
    session_destroy();
    json_response(['ok' => true]);
}

if ($action === 'me' && $method === 'GET') {
    $current = user();
    if (!$current) json_response(['user' => null]);
    start_session();
    json_response(['user' => $current, 'csrf' => $_SESSION['csrf'] ?? '']);
}

if ($action === 'associates' && $method === 'GET') {
    require_user();
    $q = '%' . clean($_GET['q'] ?? '') . '%';
    $stmt = $db->prepare('SELECT a.id, a.document_type, a.document_number, a.first_name, a.last_name, a.email, a.phone, a.status, a.created_at, c.name AS company FROM associates a LEFT JOIN companies c ON c.id = a.company_id WHERE a.first_name LIKE ? OR a.last_name LIKE ? OR a.document_number LIKE ? ORDER BY a.created_at DESC LIMIT 100');
    $stmt->execute([$q, $q, $q]);
    json_response(['associates' => $stmt->fetchAll()]);
}

if ($action === 'associates' && $method === 'POST') {
    $current = require_user(['administrador', 'afiliaciones']);
    verify_csrf();
    $input = body();
    $first = clean($input['firstName'] ?? ''); $last = clean($input['lastName'] ?? ''); $document = clean($input['documentNumber'] ?? '');
    if (!$first || !$last || !$document) json_response(['error' => 'Nombres, apellidos y documento son obligatorios.'], 422);
    $companyName = clean($input['company'] ?? '');
    try {
        $db->beginTransaction();
        $companyId = null;
        if ($companyName !== '') {
            $company = $db->prepare('SELECT id FROM companies WHERE name = ? LIMIT 1'); $company->execute([$companyName]);
            $companyId = $company->fetchColumn();
            if (!$companyId) { $newCompany = $db->prepare('INSERT INTO companies (name) VALUES (?)'); $newCompany->execute([$companyName]); $companyId = (int) $db->lastInsertId(); }
        }
        $insert = $db->prepare('INSERT INTO associates (document_type, document_number, first_name, last_name, email, phone, company_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, "pendiente")');
        $insert->execute([clean($input['documentType'] ?? '') ?: 'CC', $document, $first, $last, clean($input['email'] ?? '') ?: null, clean($input['phone'] ?? '') ?: null, $companyId ?: null]);
        $id = (int) $db->lastInsertId();
        $event = $db->prepare('INSERT INTO associate_events (associate_id, event_type, title, description, created_by) VALUES (?, "registro", "Registro creado", "El asociado fue registrado con estado pendiente.", ?)');
        $event->execute([$id, $current['id']]);
        audit($db, $current['id'], 'asociado', $id, 'crear', $document);
        $db->commit();
        json_response(['associate' => ['id' => $id, 'firstName' => $first, 'lastName' => $last, 'documentNumber' => $document, 'company' => $companyName, 'status' => 'pendiente']], 201);
    } catch (Throwable $error) {
        if ($db->inTransaction()) $db->rollBack();
        json_response(['error' => 'No fue posible guardar el asociado.'], 500);
    }
}

if ($action === 'settings' && $method === 'GET') {
    require_user(['administrador']);
    $rows = $db->query('SELECT setting_key, setting_value FROM app_settings')->fetchAll();
    $settings = [];
    foreach ($rows as $row) $settings[$row['setting_key']] = json_decode($row['setting_value'], true);
    json_response(['settings' => $settings]);
}

if ($action === 'settings' && $method === 'POST') {
    $current = require_user(['administrador']); verify_csrf();
    $input = body();
    $organization = is_array($input['organization'] ?? null) ? $input['organization'] : [];
    $modules = is_array($input['modules'] ?? null) ? $input['modules'] : [];
    $organization = ['name' => substr(clean($organization['name'] ?? ''), 0, 190), 'nit' => substr(clean($organization['nit'] ?? ''), 0, 50), 'email' => substr(clean($organization['email'] ?? ''), 0, 190), 'currency' => 'COP'];
    $allowed = ['afiliaciones', 'ahorros', 'creditos', 'cobros', 'pagos'];
    $modules = array_fill_keys($allowed, false);
    foreach ($allowed as $key) $modules[$key] = !empty($input['modules'][$key]);
    $save = $db->prepare('INSERT INTO app_settings (setting_key, setting_value, updated_by) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value), updated_by=VALUES(updated_by)');
    $save->execute(['organization', json_encode($organization, JSON_UNESCAPED_UNICODE), $current['id']]);
    $save->execute(['modules', json_encode($modules, JSON_UNESCAPED_UNICODE), $current['id']]);
    audit($db, $current['id'], 'configuracion', 0, 'actualizar', 'Configuración general');
    json_response(['organization' => $organization, 'modules' => $modules]);
}

if ($action === 'products' && $method === 'GET') {
    require_user(['administrador']);
    $type = clean($_GET['type'] ?? '');
    $stmt = $db->prepare('SELECT id, product_type, name, code, parameters_json, active FROM financial_products WHERE (? = "" OR product_type = ?) ORDER BY product_type, name');
    $stmt->execute([$type, $type]);
    $products = $stmt->fetchAll();
    foreach ($products as &$product) $product['parameters'] = json_decode($product['parameters_json'], true) ?: [];
    json_response(['products' => $products]);
}

if ($action === 'products' && $method === 'POST') {
    $current = require_user(['administrador']); verify_csrf(); $input = body();
    $type = clean($input['type'] ?? ''); $name = substr(clean($input['name'] ?? ''), 0, 150); $code = strtoupper(substr(clean($input['code'] ?? ''), 0, 40));
    if (!in_array($type, ['ahorro', 'credito'], true) || !$name || !$code) json_response(['error' => 'Tipo, nombre y código son obligatorios.'], 422);
    $parameters = is_array($input['parameters'] ?? null) ? $input['parameters'] : [];
    $save = $db->prepare('INSERT INTO financial_products (product_type, name, code, parameters_json, created_by) VALUES (?, ?, ?, ?, ?)');
    try { $save->execute([$type, $name, $code, json_encode($parameters, JSON_UNESCAPED_UNICODE), $current['id']]); audit($db, $current['id'], 'producto', (int)$db->lastInsertId(), 'crear', $code); json_response(['ok' => true], 201); } catch (Throwable $e) { json_response(['error' => 'El código del producto ya existe.'], 422); }
}

if ($action === 'savings-transactions' && $method === 'GET') {
    require_user();
    $rows = $db->query('SELECT t.*, a.first_name, a.last_name, p.name AS product_name FROM savings_transactions t JOIN associates a ON a.id=t.associate_id JOIN financial_products p ON p.id=t.product_id ORDER BY t.created_at DESC LIMIT 100')->fetchAll();
    json_response(['transactions' => $rows]);
}
if ($action === 'savings-transactions' && $method === 'POST') {
    $user = require_user(['administrador','tesoreria']); verify_csrf(); $v = body();
    $associate = (int)($v['associate_id'] ?? 0); $product = (int)($v['product_id'] ?? 0); $amount = (float)($v['amount'] ?? 0); $type = clean($v['movement_type'] ?? '');
    if (!$associate || !$product || $amount <= 0 || !in_array($type, ['aporte','retiro'], true)) json_response(['error' => 'Completa asociado, producto, tipo y valor.'], 422);
    $q=$db->prepare('INSERT INTO savings_transactions (associate_id,product_id,movement_type,amount,reference,recorded_by) VALUES (?,?,?,?,?,?)'); $q->execute([$associate,$product,$type,$amount,substr(clean($v['reference'] ?? ''),0,100),$user['id']]); audit($db,$user['id'],'ahorro',(int)$db->lastInsertId(),'registrar',$type); json_response(['ok'=>true],201);
}
if ($action === 'credit-applications' && $method === 'GET') { require_user(); $rows=$db->query('SELECT c.*,a.first_name,a.last_name,p.name AS product_name FROM credit_applications c JOIN associates a ON a.id=c.associate_id JOIN financial_products p ON p.id=c.product_id ORDER BY c.created_at DESC LIMIT 100')->fetchAll(); json_response(['applications'=>$rows]); }
if ($action === 'credit-applications' && $method === 'POST') { $user=require_user(['administrador','creditos']); verify_csrf(); $v=body(); $a=(int)($v['associate_id']??0);$p=(int)($v['product_id']??0);$amount=(float)($v['amount']??0);$term=(int)($v['term_months']??0); if(!$a||!$p||$amount<=0||$term<1) json_response(['error'=>'Completa asociado, línea, monto y plazo.'],422); $q=$db->prepare('INSERT INTO credit_applications (associate_id,product_id,requested_amount,requested_term_months,purpose,created_by) VALUES (?,?,?,?,?,?)');$q->execute([$a,$p,$amount,$term,substr(clean($v['purpose']??''),0,255),$user['id']]);audit($db,$user['id'],'credito',(int)$db->lastInsertId(),'solicitar','Solicitud');json_response(['ok'=>true],201); }
if ($action === 'credit-applications' && $method === 'PATCH') { $user=require_user(['administrador','creditos']);verify_csrf();$v=body();$id=(int)($v['id']??0);$status=clean($v['status']??'');if(!$id||!in_array($status,['aprobada','rechazada'],true))json_response(['error'=>'Decisión inválida.'],422);$q=$db->prepare('UPDATE credit_applications SET status=?, reviewed_by=?, reviewed_at=NOW(), decision_note=? WHERE id=? AND status="en_revision"');$q->execute([$status,$user['id'],substr(clean($v['note']??''),0,255),$id]);if(!$q->rowCount())json_response(['error'=>'La solicitud ya fue procesada.'],422);audit($db,$user['id'],'credito',$id,$status,'Decisión');json_response(['ok'=>true]); }

if ($action === 'affiliations' && $method === 'GET') { require_user(); json_response(['requests'=>$db->query('SELECT * FROM affiliation_requests ORDER BY created_at DESC LIMIT 100')->fetchAll()]); }
if ($action === 'affiliations' && $method === 'POST') { $user=require_user(['administrador','afiliaciones']); verify_csrf(); $v=body(); $doc=substr(clean($v['document_number']??''),0,50);$first=substr(clean($v['first_name']??''),0,100);$last=substr(clean($v['last_name']??''),0,100);if(!$doc||!$first||!$last)json_response(['error'=>'Documento, nombres y apellidos son obligatorios.'],422);try{$q=$db->prepare('INSERT INTO affiliation_requests (document_number,first_name,last_name,email,phone,company_name,documents_status,created_by) VALUES (?,?,?,?,?,?,?,?)');$q->execute([$doc,$first,$last,substr(clean($v['email']??''),0,190),substr(clean($v['phone']??''),0,50),substr(clean($v['company']??''),0,190),clean($v['documents_status']??'pendientes')==='completos'?'completos':'pendientes',$user['id']]);audit($db,$user['id'],'afiliacion',(int)$db->lastInsertId(),'crear',$doc);json_response(['ok'=>true],201);}catch(Throwable $e){json_response(['error'=>'Ya existe una solicitud para este documento.'],422);}}
if ($action === 'affiliations' && $method === 'PATCH') { $user=require_user(['administrador','afiliaciones']);verify_csrf();$v=body();$id=(int)($v['id']??0);$status=clean($v['status']??'');if(!$id||!in_array($status,['aprobada','rechazada'],true))json_response(['error'=>'Solicitud inválida.'],422);$db->beginTransaction();try{$q=$db->prepare('SELECT * FROM affiliation_requests WHERE id=? FOR UPDATE');$q->execute([$id]);$r=$q->fetch();if(!$r||$r['status']!=='en_revision')throw new RuntimeException();if($status==='aprobada'){$companyId=null;if($r['company_name']){$c=$db->prepare('SELECT id FROM companies WHERE name=?');$c->execute([$r['company_name']]);$companyId=$c->fetchColumn();if(!$companyId){$c=$db->prepare('INSERT INTO companies (name) VALUES (?)');$c->execute([$r['company_name']]);$companyId=(int)$db->lastInsertId();}}$a=$db->prepare('INSERT INTO associates (document_number,first_name,last_name,email,phone,company_id,status,affiliation_date) VALUES (?,?,?,?,?,?,"activo",CURDATE())');$a->execute([$r['document_number'],$r['first_name'],$r['last_name'],$r['email']?:null,$r['phone']?:null,$companyId?:null]);}$u=$db->prepare('UPDATE affiliation_requests SET status=?,reviewed_by=?,reviewed_at=NOW() WHERE id=?');$u->execute([$status,$user['id'],$id]);$db->commit();audit($db,$user['id'],'afiliacion',$id,$status,'Decisión');json_response(['ok'=>true]);}catch(Throwable $e){if($db->inTransaction())$db->rollBack();json_response(['error'=>'No fue posible procesar la solicitud.'],422);}}

if ($action === 'catalog' && $method === 'GET') { require_user(['administrador']); $category=clean($_GET['category']??''); $q=$db->prepare('SELECT id,category,label,payload,active FROM configuration_catalog WHERE (?="" OR category=?) ORDER BY category,label');$q->execute([$category,$category]);$rows=$q->fetchAll();foreach($rows as &$row)$row['payload']=json_decode($row['payload'],true)?:[];json_response(['items'=>$rows]); }
if ($action === 'catalog' && $method === 'POST') { $user=require_user(['administrador']);verify_csrf();$v=body();$category=substr(clean($v['category']??''),0,80);$label=substr(clean($v['label']??''),0,190);$allowed=['documento_afiliacion','periodo_cobro','medio_pago','flujo_aprobacion','rol_operativo','plantilla_documento'];if(!$category||!$label||!in_array($category,$allowed,true))json_response(['error'=>'Categoría o nombre inválido.'],422);$q=$db->prepare('INSERT INTO configuration_catalog(category,label,payload,created_by) VALUES (?,?,?,?)');try{$q->execute([$category,$label,json_encode(is_array($v['payload']??null)?$v['payload']:[],JSON_UNESCAPED_UNICODE),$user['id']]);audit($db,$user['id'],'catalogo',(int)$db->lastInsertId(),'crear',$category);json_response(['ok'=>true],201);}catch(Throwable $e){json_response(['error'=>'Ya existe un elemento con ese nombre.'],422);}}
if ($action === 'payments' && $method === 'GET') { require_user();$rows=$db->query('SELECT p.*,a.first_name,a.last_name,c.label AS payment_method FROM payments p JOIN associates a ON a.id=p.associate_id LEFT JOIN configuration_catalog c ON c.id=p.payment_method_id ORDER BY p.received_on DESC,p.id DESC LIMIT 100')->fetchAll();json_response(['payments'=>$rows]); }
if ($action === 'payments' && $method === 'POST') { $user=require_user(['administrador','tesoreria']);verify_csrf();$v=body();$a=(int)($v['associate_id']??0);$amount=(float)($v['amount']??0);$concept=substr(clean($v['concept']??''),0,150);if(!$a||$amount<=0||!$concept)json_response(['error'=>'Completa asociado, concepto y valor.'],422);$q=$db->prepare('INSERT INTO payments(associate_id,payment_method_id,concept,amount,reference,received_on,recorded_by)VALUES(?,?,?,?,?,?,?)');$q->execute([$a,(int)($v['payment_method_id']??0)?:null,$concept,$amount,substr(clean($v['reference']??''),0,100),clean($v['received_on']??'')?:date('Y-m-d'),$user['id']]);audit($db,$user['id'],'pago',(int)$db->lastInsertId(),'registrar',$concept);json_response(['ok'=>true],201); }
if ($action === 'receivables' && $method === 'GET') { require_user();$rows=$db->query('SELECT r.*,a.first_name,a.last_name FROM receivables r JOIN associates a ON a.id=r.associate_id ORDER BY r.due_date LIMIT 100')->fetchAll();json_response(['receivables'=>$rows]); }
if ($action === 'receivables' && $method === 'POST') { $u=require_user(['administrador','cartera']);verify_csrf();$v=body();$a=(int)($v['associate_id']??0);$amount=(float)($v['amount']??0);$ref=substr(clean($v['reference']??''),0,100);$date=clean($v['due_date']??'');if(!$a||!$ref||$amount<=0||!$date)json_response(['error'=>'Completa asociado, referencia, vencimiento y valor.'],422);$q=$db->prepare('INSERT INTO receivables(associate_id,reference,due_date,amount,created_by)VALUES(?,?,?,?,?)');$q->execute([$a,$ref,$date,$amount,$u['id']]);audit($db,$u['id'],'cartera',(int)$db->lastInsertId(),'crear',$ref);json_response(['ok'=>true],201); }
json_response(['error' => 'Ruta no encontrada.'], 404);
