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

if ($action === 'business-rules' && $method === 'GET') {
    require_user();
    $rates = $db->query('SELECT effective_month,rate_percent FROM monthly_usury_rates ORDER BY effective_month DESC')->fetchAll();
    $currentMonth = (new DateTimeImmutable('now', new DateTimeZone('America/Bogota')))->format('Y-m'); $currentRate = null;
    foreach ($rates as $rateRow) if ($rateRow['effective_month'] === $currentMonth) { $currentRate = (float) $rateRow['rate_percent']; break; }
    json_response(['rules' => [
        'savings' => ['at_sight_percent' => 30, 'contributions_percent' => 70, 'at_sight_availability' => 'inmediata', 'credit_base' => 'aportes'],
        'credit' => ['product' => 'Libre inversión', 'fixed_monthly_rate_percent' => 2, 'interest_basis' => 'saldo pendiente', 'min_term_months' => 1, 'max_term_months' => 60, 'credit_multiplier_options' => [3,4,5], 'multiplier_decision' => 'superadmin_por_solicitud', 'payroll_requirements' => ['dos últimos desprendibles de pago', 'certificación laboral'], 'independent_requirements' => ['declaración de renta', 'un codeudor o dos según monto']],
        'late_interest' => ['formula' => 'capital_de_cuota × (tasa_de_usura_vigente ÷ 100) ÷ 360 × días_en_mora', 'day_basis' => 360, 'effective_month' => $currentMonth, 'usury_rate_percent' => $currentRate, 'history' => $rates],
        'collections' => ['associate_frequency' => ['quincenal','mensual'], 'channels' => ['WhatsApp'], 'payroll_days' => [10,20], 'concepts' => ['aportes','cuotas de crédito','convenios']],
        'documents' => ['approximate_count' => 7, 'custody' => 'FEGCON', 'storage' => 'carpeta digital por asociado', 'document_names_confirmed' => false],
        'permissions' => ['roles' => ['superadmin','operador'], 'operator_writes_require_approval' => true],
    ]]);
}

if ($action === 'business-rules' && $method === 'POST') {
    $current = require_user(['superadmin']); verify_csrf(); $v = body();
    $month = clean($v['effective_month'] ?? ''); $rate = $v['usury_rate_percent'] ?? null;
    if (!preg_match('/^\\d{4}-(0[1-9]|1[0-2])$/', $month) || !is_numeric($rate) || (float) $rate <= 0 || (float) $rate > 100) json_response(['error' => 'Indica el mes y la tasa de usura vigente aplicable.'], 422);
    $save = $db->prepare('INSERT INTO monthly_usury_rates(effective_month,rate_percent,updated_by) VALUES(?,?,?) ON DUPLICATE KEY UPDATE rate_percent=VALUES(rate_percent),updated_by=VALUES(updated_by)');
    $save->execute([$month, (float) $rate, $current['id']]);
    audit($db, $current['id'], 'regla_financiera', 0, 'actualizar', 'Tasa de usura vigente ' . $month);
    json_response(['ok' => true]);
}

if ($action === 'approval-requests' && $method === 'GET') {
    $current = require_user();
    if ($current['role'] === 'superadmin') {
        $rows = $db->query('SELECT r.id,r.operation,r.summary,r.payload_json,r.status,r.created_at,r.reviewed_at,u.full_name AS requested_by_name FROM approval_requests r JOIN internal_users u ON u.id=r.requested_by ORDER BY (r.status="pendiente") DESC,r.created_at DESC LIMIT 200')->fetchAll();
    } else {
        $q = $db->prepare('SELECT id,operation,summary,status,created_at,reviewed_at FROM approval_requests WHERE requested_by=? ORDER BY created_at DESC LIMIT 100'); $q->execute([$current['id']]); $rows = $q->fetchAll();
    }
    foreach ($rows as &$row) if (isset($row['payload_json'])) $row['payload'] = json_decode($row['payload_json'], true) ?: [];
    json_response(['requests' => $rows]);
}

if ($action === 'approval-requests' && $method === 'PATCH') {
    $current = require_user(['superadmin']); verify_csrf(); $v = body();
    $id = (int) ($v['id'] ?? 0); $decision = clean($v['decision'] ?? '');
    if (!$id || !in_array($decision, ['aprobada','rechazada'], true)) json_response(['error' => 'Decisión de aprobación inválida.'], 422);
    try {
        $db->beginTransaction();
        $q = $db->prepare('SELECT * FROM approval_requests WHERE id=? FOR UPDATE'); $q->execute([$id]); $request = $q->fetch();
        if (!$request || $request['status'] !== 'pendiente') throw new RuntimeException('La solicitud ya fue atendida.');
        if ($decision === 'aprobada') {
            $result = apply_approved_change($db, (int) $request['requested_by'], $current['id'], $request['operation'], json_decode($request['payload_json'], true) ?: []);
        } elseif ($request['operation'] === 'promissory_document_create') {
            $payload = json_decode($request['payload_json'], true) ?: [];
            $q = $db->prepare('UPDATE promissory_documents SET status="rechazado",reviewed_by=?,reviewed_at=NOW() WHERE id=? AND status="pendiente"');
            $q->execute([$current['id'], (int)($payload['document_id'] ?? 0)]);
            if (!$q->rowCount()) throw new RuntimeException('El documento ya fue atendido o no existe.');
            audit($db, $current['id'], 'documento_pagare', (int)$payload['document_id'], 'rechazar_custodia', substr(clean($payload['label'] ?? ''), 0, 120));
        }
        $q = $db->prepare('UPDATE approval_requests SET status=?,reviewed_by=?,reviewed_at=NOW() WHERE id=?'); $q->execute([$decision, $current['id'], $id]);
        audit($db, $current['id'], 'solicitud_cambio', $id, $decision, $request['summary']);
        $db->commit(); json_response(['ok' => true, 'message' => $decision === 'aprobada' ? 'Cambio aprobado y aplicado.' : 'Solicitud rechazada.']);
    } catch (Throwable $error) {
        if ($db->inTransaction()) $db->rollBack();
        json_response(['error' => $error instanceof RuntimeException ? $error->getMessage() : 'No fue posible procesar la solicitud.'], 422);
    }
}

if ($action === 'associates' && $method === 'GET') {
    require_user();
    $q = '%' . clean($_GET['q'] ?? '') . '%';
    $stmt = $db->prepare('SELECT a.id, a.document_type, a.document_number, a.first_name, a.last_name, a.email, a.phone, a.company_id, a.status, a.created_at, c.name AS company FROM associates a LEFT JOIN companies c ON c.id = a.company_id WHERE a.first_name LIKE ? OR a.last_name LIKE ? OR a.document_number LIKE ? ORDER BY a.created_at DESC LIMIT 100');
    $stmt->execute([$q, $q, $q]);
    json_response(['associates' => $stmt->fetchAll()]);
}

if ($action === 'associates' && $method === 'POST') {
    $current = require_user(['superadmin', 'operador']);
    verify_csrf();
    $input = body();
    $first = clean($input['firstName'] ?? ''); $last = clean($input['lastName'] ?? ''); $document = clean($input['documentNumber'] ?? '');
    if (!$first || !$last || !$document) json_response(['error' => 'Nombres, apellidos y documento son obligatorios.'], 422);
    queue_operator_change($db, $current, 'associate_create', 'Crear asociado ' . $document, $input);
    $companyName = clean($input['company'] ?? '');
    try {
        $db->beginTransaction();
        $companyId = null;
        if ($companyName !== '') {
            $company = $db->prepare('SELECT id FROM companies WHERE name = ? LIMIT 1'); $company->execute([$companyName]);
            $companyId = $company->fetchColumn();
            if (!$companyId) { $newCompany = $db->prepare('INSERT INTO companies (name) VALUES (?)'); $newCompany->execute([$companyName]); $companyId = (int) $db->lastInsertId(); }
        }
        $insert = $db->prepare('INSERT INTO associates (document_type, document_number, first_name, last_name, email, phone, company_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, "activo")');
        $insert->execute([clean($input['documentType'] ?? '') ?: 'CC', $document, $first, $last, clean($input['email'] ?? '') ?: null, clean($input['phone'] ?? '') ?: null, $companyId ?: null]);
        $id = (int) $db->lastInsertId();
        $event = $db->prepare('INSERT INTO associate_events (associate_id, event_type, title, description, created_by) VALUES (?, "registro", "Registro aprobado", "El registro fue autorizado por la Superadmin.", ?)');
        $event->execute([$id, $current['id']]);
        audit($db, $current['id'], 'asociado', $id, 'crear', $document);
        $db->commit();
        json_response(['associate' => ['id' => $id, 'firstName' => $first, 'lastName' => $last, 'documentNumber' => $document, 'company' => $companyName, 'email' => clean($input['email'] ?? ''), 'phone' => clean($input['phone'] ?? ''), 'status' => 'activo']], 201);
    } catch (Throwable $error) {
        if ($db->inTransaction()) $db->rollBack();
        json_response(['error' => 'No fue posible guardar el asociado.'], 500);
    }
}

if ($action === 'associates' && $method === 'PATCH') {
    $current = require_user(['superadmin', 'operador']); verify_csrf(); $v = body();
    $id=(int)($v['id']??0);$first=clean($v['firstName']??'');$last=clean($v['lastName']??'');$document=clean($v['documentNumber']??'');$email=clean($v['email']??'');
    if(!$id||!$first||!$last||!$document)json_response(['error'=>'Nombres, apellidos y documento son obligatorios.'],422);
    if($email!==''&&!filter_var($email,FILTER_VALIDATE_EMAIL))json_response(['error'=>'El correo electrónico no es válido.'],422);
    queue_operator_change($db,$current,'associate_update','Actualizar datos del asociado '.$document,$v);
    try {
        $db->beginTransaction();$exists=$db->prepare('SELECT id FROM associates WHERE id=? FOR UPDATE');$exists->execute([$id]);if(!$exists->fetchColumn())throw new RuntimeException('El asociado no existe.');
        $companyId=null;$companyName=clean($v['company']??'');if($companyName!==''){$q=$db->prepare('SELECT id FROM companies WHERE name=? LIMIT 1');$q->execute([$companyName]);$companyId=$q->fetchColumn();if(!$companyId){$q=$db->prepare('INSERT INTO companies(name) VALUES(?)');$q->execute([$companyName]);$companyId=(int)$db->lastInsertId();}}
        $q=$db->prepare('UPDATE associates SET document_type=?,document_number=?,first_name=?,last_name=?,email=?,phone=?,company_id=? WHERE id=?');$q->execute([clean($v['documentType']??'')?:'CC',$document,$first,$last,$email?:null,clean($v['phone']??'')?:null,$companyId?:null,$id]);
        $q=$db->prepare('INSERT INTO associate_events(associate_id,event_type,title,description,created_by) VALUES (?,"actualizacion","Datos actualizados","La Superadmin actualizó los datos del asociado.",?)');$q->execute([$id,$current['id']]);audit($db,$current['id'],'asociado',$id,'actualizar',$document);$db->commit();json_response(['ok'=>true,'message'=>'Datos del asociado actualizados.']);
    } catch (Throwable $error) { if($db->inTransaction())$db->rollBack();json_response(['error'=>$error instanceof RuntimeException?$error->getMessage():'No fue posible actualizar el asociado.'],422); }
}

if ($action === 'associates' && $method === 'DELETE') {
    $current=require_user(['superadmin','operador']);verify_csrf();$id=(int)($_GET['id']??0);if(!$id)json_response(['error'=>'Selecciona el asociado que deseas retirar.'],422);
    $lookup=$db->prepare('SELECT first_name,last_name,document_number FROM associates WHERE id=? AND status="activo"');$lookup->execute([$id]);$person=$lookup->fetch();if(!$person)json_response(['error'=>'El asociado ya fue retirado o no existe.'],422);
    queue_operator_change($db,$current,'associate_retire','Retirar a '.$person['first_name'].' '.$person['last_name'],['id'=>$id,'name'=>$person['first_name'].' '.$person['last_name'],'documentNumber'=>$person['document_number']]);
    try {$db->beginTransaction();$q=$db->prepare('UPDATE associates SET status="retirado" WHERE id=? AND status="activo"');$q->execute([$id]);if(!$q->rowCount())throw new RuntimeException('El asociado ya fue retirado o no existe.');$q=$db->prepare('INSERT INTO associate_events(associate_id,event_type,title,description,created_by) VALUES (?,"retiro","Asociado retirado","La Superadmin autorizó el retiro del asociado.",?)');$q->execute([$id,$current['id']]);audit($db,$current['id'],'asociado',$id,'retirar','');$db->commit();json_response(['ok'=>true,'message'=>'Asociado retirado. El historial financiero se conservó.']);}
    catch (Throwable $error) {if($db->inTransaction())$db->rollBack();json_response(['error'=>$error instanceof RuntimeException?$error->getMessage():'No fue posible retirar el asociado.'],422);}
}

if ($action === 'settings' && $method === 'GET') {
    require_user(['superadmin']);
    $rows = $db->query('SELECT setting_key, setting_value FROM app_settings')->fetchAll();
    $settings = [];
    foreach ($rows as $row) $settings[$row['setting_key']] = json_decode($row['setting_value'], true);
    json_response(['settings' => $settings]);
}

if ($action === 'settings' && $method === 'POST') {
    $current = require_user(['superadmin']); verify_csrf();
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
    require_user();
    $type = clean($_GET['type'] ?? '');
    $stmt = $db->prepare('SELECT id, product_type, name, code, parameters_json, active FROM financial_products WHERE (? = "" OR product_type = ?) AND code IN ("APORTES-FEGCON","LIBRE-INVERSION") ORDER BY product_type, name');
    $stmt->execute([$type, $type]);
    $products = $stmt->fetchAll();
    foreach ($products as &$product) $product['parameters'] = json_decode($product['parameters_json'], true) ?: [];
    json_response(['products' => $products]);
}

if ($action === 'products' && $method === 'POST') {
    $current = require_user(['superadmin']); verify_csrf(); $input = body();
    $type = clean($input['type'] ?? ''); $name = substr(clean($input['name'] ?? ''), 0, 150); $code = strtoupper(substr(clean($input['code'] ?? ''), 0, 40));
    $canonical = ['ahorro' => ['name' => 'Aportes FEGCON', 'code' => 'APORTES-FEGCON'], 'credito' => ['name' => 'Libre inversión', 'code' => 'LIBRE-INVERSION']];
    if (!isset($canonical[$type]) || $name !== $canonical[$type]['name'] || $code !== $canonical[$type]['code']) json_response(['error' => 'FEGCON tiene una única línea de libre inversión y un único producto de aportes.'], 422);
    $parameters = $type === 'ahorro' ? ['ahorros_a_la_vista_pct' => 30, 'aportes_pct' => 70, 'disponibilidad' => 'inmediata'] : ['tasa_fija_mensual_pct' => 2, 'base_interes' => 'saldo_pendiente', 'plazo_minimo_meses' => 1, 'plazo_maximo_meses' => 60, 'multiplicadores_cupo' => [3,4,5]];
    $save = $db->prepare('INSERT INTO financial_products (product_type, name, code, parameters_json, created_by) VALUES (?, ?, ?, ?, ?)');
    try { $save->execute([$type, $name, $code, json_encode($parameters, JSON_UNESCAPED_UNICODE), $current['id']]); audit($db, $current['id'], 'producto', (int)$db->lastInsertId(), 'crear', $code); json_response(['ok' => true], 201); } catch (Throwable $e) { json_response(['error' => 'El código del producto ya existe.'], 422); }
}

if ($action === 'savings-transactions' && $method === 'GET') {
    require_user();
    $rows = $db->query('SELECT t.*, a.first_name, a.last_name, p.name AS product_name FROM savings_transactions t JOIN associates a ON a.id=t.associate_id JOIN financial_products p ON p.id=t.product_id ORDER BY t.created_at DESC LIMIT 100')->fetchAll();
    json_response(['transactions' => $rows]);
}
if ($action === 'savings-transactions' && $method === 'POST') {
    $user = require_user(['superadmin','operador']); verify_csrf(); $v = body();
    $associate = (int)($v['associate_id'] ?? 0); $product = (int)($v['product_id'] ?? 0); $amount = (float)($v['amount'] ?? 0); $type = clean($v['movement_type'] ?? '');
    if (!$associate || !$product || $amount <= 0 || !in_array($type, ['aporte','retiro'], true)) json_response(['error' => 'Completa asociado, producto, tipo y valor.'], 422);
    try { require_core_product($db, $product, 'ahorro'); } catch (RuntimeException $error) { json_response(['error' => $error->getMessage()], 422); }
    queue_operator_change($db, $user, 'savings_transaction', 'Registrar ' . $type . ' de ahorro', $v);
    try {
        $db->beginTransaction();
        $balance = active_savings_balance($db, $associate, true);
        if ($type === 'retiro' && $amount > $balance) throw new RuntimeException('El retiro supera el saldo de ahorro disponible.');
        $q=$db->prepare('INSERT INTO savings_transactions (associate_id,product_id,movement_type,amount,reference,recorded_by) VALUES (?,?,?,?,?,?)'); $q->execute([$associate,$product,$type,$amount,substr(clean($v['reference'] ?? ''),0,100),$user['id']]);
        $id = (int) $db->lastInsertId(); audit($db,$user['id'],'ahorro',$id,'registrar',$type); $db->commit(); json_response(['ok'=>true],201);
    } catch (Throwable $error) {
        if ($db->inTransaction()) $db->rollBack();
        json_response(['error' => $error instanceof RuntimeException ? $error->getMessage() : 'No fue posible guardar el movimiento.'], 422);
    }
}
if ($action === 'credit-capacity' && $method === 'GET') { require_user();$associate=(int)($_GET['associate_id']??0);if(!$associate)json_response(['error'=>'Selecciona un asociado.'],422);try{$total=active_savings_balance($db,$associate);}catch(RuntimeException $error){json_response(['error'=>$error->getMessage()],422);}$base=$total*.70;json_response(['total_savings'=>$total,'vista_balance'=>$total*.30,'contributions_balance'=>$base,'credit_limits'=>['3'=>$base*3,'4'=>$base*4,'5'=>$base*5]]); }
if ($action === 'credit-applications' && $method === 'GET') { require_user(); $rows=$db->query("SELECT c.*,a.first_name,a.last_name,p.name AS product_name,COALESCE((SELECT SUM(CASE WHEN s.movement_type='aporte' THEN s.amount ELSE -s.amount END) FROM savings_transactions s WHERE s.associate_id=c.associate_id AND s.status='aplicado'),0) AS savings_balance FROM credit_applications c JOIN associates a ON a.id=c.associate_id JOIN financial_products p ON p.id=c.product_id ORDER BY c.created_at DESC LIMIT 100")->fetchAll(); json_response(['applications'=>$rows]); }
if ($action === 'credit-applications' && $method === 'POST') { $user=require_user(['superadmin','operador']); verify_csrf(); $v=body(); $a=(int)($v['associate_id']??0);$p=(int)($v['product_id']??0);$amount=(float)($v['amount']??0);$term=(int)($v['term_months']??0); if(!$a||!$p||$amount<=0||$term<1||$term>60) json_response(['error'=>'Completa asociado, línea, monto y un plazo de 1 a 60 meses.'],422);try{require_core_product($db,$p,'credito');$balance=active_savings_balance($db,$a); }catch(RuntimeException $error){json_response(['error'=>$error->getMessage()],422);} $base=$balance*.70;if($amount>$base*5)json_response(['error'=>'El monto supera el cupo máximo de cinco veces el 70% de los aportes registrados.'],422);queue_operator_change($db,$user,'credit_application','Crear solicitud de crédito',$v); $q=$db->prepare('INSERT INTO credit_applications (associate_id,product_id,requested_amount,requested_term_months,purpose,created_by) VALUES (?,?,?,?,?,?)');$q->execute([$a,$p,$amount,$term,substr(clean($v['purpose']??''),0,255),$user['id']]);audit($db,$user['id'],'credito',(int)$db->lastInsertId(),'solicitar','Solicitud');json_response(['ok'=>true],201); }
if ($action === 'credit-applications' && $method === 'PATCH') {
    $user=require_user(['superadmin']);verify_csrf();$v=body();$id=(int)($v['id']??0);$status=clean($v['status']??'');
    if(!$id||!in_array($status,['aprobada','rechazada'],true))json_response(['error'=>'Decisión inválida.'],422);
    try {
        $db->beginTransaction();
        $q=$db->prepare('SELECT associate_id,requested_amount,requested_term_months FROM credit_applications WHERE id=? AND status="en_revision" FOR UPDATE');$q->execute([$id]);$application=$q->fetch();
        if(!$application)throw new RuntimeException('La solicitud ya fue procesada o no existe.');
        $multiplier=(int)($v['multiplier']??0);$monthly=null;
        if($status==='aprobada'){
            if(!in_array($multiplier,[3,4,5],true))throw new RuntimeException('Selecciona el cupo aprobado: 3, 4 o 5 veces los aportes.');
            $balance=active_savings_balance($db,(int)$application['associate_id'],true);$base=$balance*.70;
            if((float)$application['requested_amount']>$base*$multiplier)throw new RuntimeException('El monto solicitado supera el cupo del multiplicador elegido.');
            $term=(int)$application['requested_term_months'];$principal=(float)$application['requested_amount'];$monthly=$principal*.02/(1-pow(1.02,-$term));
        }
        $q=$db->prepare('UPDATE credit_applications SET status=?, reviewed_by=?, reviewed_at=NOW(), decision_note=?, approved_multiplier=?, monthly_installment=? WHERE id=? AND status="en_revision"');$q->execute([$status,$user['id'],substr(clean($v['note']??''),0,255),$status==='aprobada'?$multiplier:null,$monthly,$id]);
        if(!$q->rowCount())throw new RuntimeException('La solicitud ya fue procesada.');
        audit($db,$user['id'],'credito',$id,$status,$status==='aprobada'?'Multiplicador x'.$multiplier.' · Cuota '.number_format((float)$monthly,2,'.',''):'Decisión');
        $db->commit();json_response(['ok'=>true,'monthly_installment'=>$monthly]);
    } catch (Throwable $error) {
        if($db->inTransaction())$db->rollBack();
        json_response(['error'=>$error instanceof RuntimeException?$error->getMessage():'No fue posible procesar la solicitud.'],422);
    }
}

if ($action === 'affiliations' && $method === 'GET') { require_user(); json_response(['requests'=>$db->query('SELECT * FROM affiliation_requests ORDER BY created_at DESC LIMIT 100')->fetchAll()]); }
if ($action === 'affiliations' && $method === 'POST') { $user=require_user(['superadmin','operador']); verify_csrf(); $v=body(); $doc=substr(clean($v['document_number']??''),0,50);$first=substr(clean($v['first_name']??''),0,100);$last=substr(clean($v['last_name']??''),0,100);if(!$doc||!$first||!$last)json_response(['error'=>'Documento, nombres y apellidos son obligatorios.'],422);queue_operator_change($db,$user,'affiliation_create','Crear solicitud de afiliación ' . $doc,$v);try{$q=$db->prepare('INSERT INTO affiliation_requests (document_number,first_name,last_name,email,phone,company_name,documents_status,created_by) VALUES (?,?,?,?,?,?,?,?)');$q->execute([$doc,$first,$last,substr(clean($v['email']??''),0,190),substr(clean($v['phone']??''),0,50),substr(clean($v['company']??''),0,190),clean($v['documents_status']??'pendientes')==='completos'?'completos':'pendientes',$user['id']]);audit($db,$user['id'],'afiliacion',(int)$db->lastInsertId(),'crear',$doc);json_response(['ok'=>true],201);}catch(Throwable $e){json_response(['error'=>'Ya existe una solicitud para este documento.'],422);}}
if ($action === 'affiliations' && $method === 'PATCH') { $user=require_user(['superadmin','operador']);verify_csrf();$v=body();$id=(int)($v['id']??0);$status=clean($v['status']??'');if(!$id||!in_array($status,['aprobada','rechazada'],true))json_response(['error'=>'Solicitud inválida.'],422);queue_operator_change($db,$user,'affiliation_decision','Decidir afiliación #' . $id,$v);$db->beginTransaction();try{$q=$db->prepare('SELECT * FROM affiliation_requests WHERE id=? FOR UPDATE');$q->execute([$id]);$r=$q->fetch();if(!$r||$r['status']!=='en_revision')throw new RuntimeException();if($status==='aprobada'){$companyId=null;if($r['company_name']){$c=$db->prepare('SELECT id FROM companies WHERE name=?');$c->execute([$r['company_name']]);$companyId=$c->fetchColumn();if(!$companyId){$c=$db->prepare('INSERT INTO companies (name) VALUES (?)');$c->execute([$r['company_name']]);$companyId=(int)$db->lastInsertId();}}$a=$db->prepare('INSERT INTO associates (document_number,first_name,last_name,email,phone,company_id,status,affiliation_date) VALUES (?,?,?,?,?,? ,"activo",CURDATE())');$a->execute([$r['document_number'],$r['first_name'],$r['last_name'],$r['email']?:null,$r['phone']?:null,$companyId?:null]);}$u=$db->prepare('UPDATE affiliation_requests SET status=?,reviewed_by=?,reviewed_at=NOW() WHERE id=?');$u->execute([$status,$user['id'],$id]);$db->commit();audit($db,$user['id'],'afiliacion',$id,$status,'Decisión');json_response(['ok'=>true]);}catch(Throwable $e){if($db->inTransaction())$db->rollBack();json_response(['error'=>'No fue posible procesar la solicitud.'],422);}}

if ($action === 'catalog' && $method === 'GET') { $user=require_user();$category=clean($_GET['category']??'');if($user['role']!=='superadmin'&&$category!=='convenio')json_response(['error'=>'No tienes permisos para esta acción.'],403);$q=$db->prepare('SELECT id,category,label,payload,active FROM configuration_catalog WHERE (?="" OR category=?) AND active=1 ORDER BY category,label');$q->execute([$category,$category]);$rows=$q->fetchAll();foreach($rows as &$row)$row['payload']=json_decode($row['payload'],true)?:[];json_response(['items'=>$rows]); }
if ($action === 'catalog' && $method === 'POST') { $v=body();$category=substr(clean($v['category']??''),0,80);$user=$category==='convenio'?require_user(['superadmin','operador']):require_user(['superadmin']);verify_csrf();$label=substr(clean($v['label']??''),0,190);$allowed=['documento_afiliacion','periodo_cobro','medio_pago','flujo_aprobacion','rol_operativo','plantilla_documento','convenio'];if(!$category||!$label||!in_array($category,$allowed,true))json_response(['error'=>'Categoría o nombre inválido.'],422);queue_operator_change($db,$user,'catalog_item_create','Crear convenio '.$label,$v);$q=$db->prepare('INSERT INTO configuration_catalog(category,label,payload,created_by) VALUES (?,?,?,?)');try{$payload=is_array($v['payload']??null)?$v['payload']:[];$q->execute([$category,$label,json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),$user['id']]);audit($db,$user['id'],'catalogo',(int)$db->lastInsertId(),'crear',$category);json_response(['ok'=>true],201);}catch(Throwable $e){json_response(['error'=>'Ya existe un elemento con ese nombre.'],422);}}
if ($action === 'payments' && $method === 'GET') { require_user();$rows=$db->query('SELECT p.*,a.first_name,a.last_name,c.label AS payment_method FROM payments p JOIN associates a ON a.id=p.associate_id LEFT JOIN configuration_catalog c ON c.id=p.payment_method_id ORDER BY p.received_on DESC,p.id DESC LIMIT 100')->fetchAll();json_response(['payments'=>$rows]); }
if ($action === 'payments' && $method === 'POST') { $user=require_user(['superadmin','operador']);verify_csrf();$v=body();$a=(int)($v['associate_id']??0);$amount=(float)($v['amount']??0);$concept=substr(clean($v['concept']??''),0,150);if(!$a||$amount<=0||!$concept)json_response(['error'=>'Completa asociado, concepto y valor.'],422);queue_operator_change($db,$user,'payment_create','Registrar pago ' . $concept,$v);$q=$db->prepare('INSERT INTO payments(associate_id,payment_method_id,concept,amount,reference,received_on,recorded_by)VALUES(?,?,?,?,?,?,?)');$q->execute([$a,(int)($v['payment_method_id']??0)?:null,$concept,$amount,substr(clean($v['reference']??''),0,100),clean($v['received_on']??'')?:date('Y-m-d'),$user['id']]);audit($db,$user['id'],'pago',(int)$db->lastInsertId(),'registrar',$concept);json_response(['ok'=>true],201); }
if ($action === 'companies' && $method === 'GET') { require_user();json_response(['companies'=>$db->query('SELECT id,name FROM companies WHERE active=1 ORDER BY name')->fetchAll()]); }
if ($action === 'payroll-collections' && $method === 'GET') {
    require_user();
    $rows=$db->query('SELECT p.*,c.name AS company_name,(SELECT COUNT(*) FROM payroll_collection_items i WHERE i.payroll_collection_id=p.id AND i.status<>"anulado") AS item_count FROM payroll_collections p LEFT JOIN companies c ON c.id=p.company_id ORDER BY p.collection_date DESC,p.id DESC LIMIT 100')->fetchAll();
    json_response(['collections'=>$rows]);
}
if ($action === 'payroll-collections' && $method === 'POST') {
    $current=require_user(['superadmin','operador']);verify_csrf();$payload=body();$company=(int)($payload['company_id']??0);$date=clean($payload['collection_date']??'');$parsed=DateTimeImmutable::createFromFormat('!Y-m-d',$date);$validDate=$parsed&&$parsed->format('Y-m-d')===$date;
    if(!$company||!$validDate||!in_array((int)$parsed->format('d'),[10,20],true))json_response(['error'=>'Selecciona una empresa y una fecha de cobro que sea día 10 o 20.'],422);
    queue_operator_change($db,$current,'payroll_collection_create','Crear relación de nómina '.$date,$payload);
    try{$db->beginTransaction();$result=apply_approved_change($db,$current['id'],$current['id'],'payroll_collection_create',$payload);$db->commit();json_response(['ok'=>true,'id'=>$result['id'],'message'=>'Relación creada en borrador.']);}
    catch(Throwable $error){if($db->inTransaction())$db->rollBack();json_response(['error'=>$error instanceof RuntimeException?$error->getMessage():'No fue posible crear la relación.'],422);}
}
if ($action === 'payroll-items' && $method === 'GET') {
    require_user();$collection=(int)($_GET['collection_id']??0);if(!$collection)json_response(['error'=>'Selecciona una relación de nómina.'],422);
    $q=$db->prepare('SELECT i.*,a.first_name,a.last_name,a.document_number,ca.monthly_installment FROM payroll_collection_items i JOIN associates a ON a.id=i.associate_id LEFT JOIN credit_applications ca ON ca.id=i.credit_application_id WHERE i.payroll_collection_id=? ORDER BY a.last_name,a.first_name,i.id');$q->execute([$collection]);json_response(['items'=>$q->fetchAll()]);
}
if ($action === 'payroll-items' && $method === 'POST') {
    $current=require_user(['superadmin','operador']);verify_csrf();$payload=body();$collection=(int)($payload['payroll_collection_id']??0);$associate=(int)($payload['associate_id']??0);$type=clean($payload['charge_type']??'');$amount=(float)($payload['amount']??0);$reference=clean($payload['reference']??'');
    if(!$collection||!$associate||!in_array($type,['aporte','cuota_credito','convenio'],true)||$amount<=0||$reference==='')json_response(['error'=>'Completa asociado, tipo de cobro, concepto y valor.'],422);
    queue_operator_change($db,$current,'payroll_item_create','Agregar concepto a relación de nómina',$payload);
    try{$db->beginTransaction();$result=apply_approved_change($db,$current['id'],$current['id'],'payroll_item_create',$payload);$db->commit();json_response(['ok'=>true,'id'=>$result['id']]);}
    catch(Throwable $error){if($db->inTransaction())$db->rollBack();json_response(['error'=>$error instanceof RuntimeException?$error->getMessage():'No fue posible agregar el concepto.'],422);}
}
if ($action === 'payroll-items' && $method === 'DELETE') {
    $current=require_user(['superadmin','operador']);verify_csrf();$payload=['id'=>(int)($_GET['id']??0)];if(!$payload['id'])json_response(['error'=>'Selecciona el concepto que deseas retirar.'],422);
    queue_operator_change($db,$current,'payroll_item_void','Retirar concepto de relación de nómina',$payload);
    try{$db->beginTransaction();apply_approved_change($db,$current['id'],$current['id'],'payroll_item_void',$payload);$db->commit();json_response(['ok'=>true]);}
    catch(Throwable $error){if($db->inTransaction())$db->rollBack();json_response(['error'=>$error instanceof RuntimeException?$error->getMessage():'No fue posible retirar el concepto.'],422);}
}
if ($action === 'payroll-items' && $method === 'PATCH') {
    $current=require_user(['superadmin','operador']);verify_csrf();$payload=body();$payload['id']=(int)($payload['id']??0);$payload['collected_amount']=$payload['collected_amount']??null;
    if(!$payload['id']||!is_numeric($payload['collected_amount'])||(float)$payload['collected_amount']<0)json_response(['error'=>'Indica el valor recaudado para este concepto.'],422);
    queue_operator_change($db,$current,'payroll_item_reconcile','Conciliar concepto de nómina',$payload);
    try{$db->beginTransaction();apply_approved_change($db,$current['id'],$current['id'],'payroll_item_reconcile',$payload);$db->commit();json_response(['ok'=>true]);}
    catch(Throwable $error){if($db->inTransaction())$db->rollBack();json_response(['error'=>$error instanceof RuntimeException?$error->getMessage():'No fue posible actualizar el recaudo.'],422);}
}
if ($action === 'payroll-collections' && $method === 'PATCH') {
    $current=require_user(['superadmin','operador']);verify_csrf();$payload=body();$payload['id']=(int)($payload['id']??0);$payload['status']=clean($payload['status']??'');
    if(!$payload['id']||!in_array($payload['status'],['enviado','recibido','conciliado'],true))json_response(['error'=>'Selecciona la siguiente etapa de la relación.'],422);
    queue_operator_change($db,$current,'payroll_collection_status','Cambiar estado de relación de nómina',$payload);
    try{$db->beginTransaction();apply_approved_change($db,$current['id'],$current['id'],'payroll_collection_status',$payload);$db->commit();json_response(['ok'=>true]);}
    catch(Throwable $error){if($db->inTransaction())$db->rollBack();json_response(['error'=>$error instanceof RuntimeException?$error->getMessage():'No fue posible cambiar el estado.'],422);}
}
if ($action === 'promissory-documents' && $method === 'GET') {
    $current=require_user();$noteId=(int)($_GET['note_id']??0);if(!$noteId)json_response(['error'=>'Selecciona un pagaré.'],422);
    $condition=$current['role']==='superadmin'?'status<>"retirado"':'status="custodiado"';$q=$db->prepare('SELECT id,promissory_note_id,label,original_name,mime_type,byte_size,status,created_at,reviewed_at FROM promissory_documents WHERE promissory_note_id=? AND '.$condition.' ORDER BY created_at DESC');$q->execute([$noteId]);json_response(['documents'=>$q->fetchAll()]);
}

if ($action === 'promissory-documents' && $method === 'POST') {
    $current=require_user(['superadmin','operador']);verify_csrf();$noteId=(int)($_POST['note_id']??0);$label=substr(clean($_POST['label']??''),0,120);$upload=$_FILES['file']??null;
    if(!$noteId||!$label||!is_array($upload))json_response(['error'=>'Completa el nombre del documento y selecciona un archivo.'],422);
    if((int)($upload['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_OK)json_response(['error'=>'No se pudo recibir el archivo. Vuelve a seleccionarlo.'],422);
    $size=(int)($upload['size']??0);if($size<1||$size>15*1024*1024)json_response(['error'=>'El archivo debe pesar menos de 15 MB.'],422);
    $note=$db->prepare('SELECT id,note_number FROM promissory_notes WHERE id=? AND status<>"anulado"');$note->execute([$noteId]);$noteRow=$note->fetch();if(!$noteRow)json_response(['error'=>'El pagaré no existe o está anulado.'],422);
    if(!is_uploaded_file((string)($upload['tmp_name']??'')))json_response(['error'=>'El archivo recibido no es válido.'],422);
    if(!class_exists('finfo'))json_response(['error'=>'El servidor no puede verificar el tipo del archivo.'],503);
    $mime=(new finfo(FILEINFO_MIME_TYPE))->file($upload['tmp_name']);$types=['application/pdf'=>'pdf','image/jpeg'=>'jpg','image/png'=>'png'];if(!isset($types[$mime]))json_response(['error'=>'Solo se permiten documentos PDF o escaneos JPG y PNG.'],422);
    $original=substr(preg_replace('/[\x00-\x1F\x7F]/','',basename((string)($upload['name']??'documento'))),0,255);$storageKey=bin2hex(random_bytes(24)).'.'.$types[$mime];$storedPath=null;
    try {
        $storedPath=private_document_path($storageKey);if(!move_uploaded_file($upload['tmp_name'],$storedPath))throw new RuntimeException('No fue posible guardar el archivo privado.');@chmod($storedPath,0600);
        $db->beginTransaction();$status=$current['role']==='superadmin'?'custodiado':'pendiente';$reviewedBy=$status==='custodiado'?$current['id']:null;$reviewedAt=$status==='custodiado'?date('Y-m-d H:i:s'):null;$q=$db->prepare('INSERT INTO promissory_documents(promissory_note_id,label,original_name,storage_key,mime_type,byte_size,status,created_by,reviewed_by,reviewed_at) VALUES(?,?,?,?,?,?,?,?,?,?)');$q->execute([$noteId,$label,$original,$storageKey,$mime,$size,$status,$current['id'],$reviewedBy,$reviewedAt]);$documentId=(int)$db->lastInsertId();
        if($status==='pendiente'){$summary='Custodiar documento '.$label.' del pagaré '.$noteRow['note_number'];$payload=['document_id'=>$documentId,'note_id'=>$noteId,'label'=>$label,'original_name'=>$original,'mime_type'=>$mime,'byte_size'=>$size];$q=$db->prepare('INSERT INTO approval_requests(requested_by,operation,summary,payload_json) VALUES(?,?,?,?)');$q->execute([$current['id'],'promissory_document_create',substr($summary,0,255),json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);audit($db,$current['id'],'solicitud_cambio',(int)$db->lastInsertId(),'solicitar',$summary);}
        else audit($db,$current['id'],'documento_pagare',$documentId,'custodiar',$label);
        $db->commit();json_response(['ok'=>true,'pending_approval'=>$status==='pendiente','message'=>$status==='pendiente'?'El archivo quedó en carpeta privada y espera aprobación.':'Documento guardado bajo custodia privada.'],201);
    } catch(Throwable $error){if($db->inTransaction())$db->rollBack();if($storedPath&&is_file($storedPath))@unlink($storedPath);json_response(['error'=>$error instanceof RuntimeException?$error->getMessage():'No fue posible guardar el documento.'],422);}
}

if ($action === 'promissory-notes' && $method === 'GET') { $current=require_user();$visibleStatuses=$current['role']==='superadmin'?"('custodiado','pendiente')":"('custodiado')";$rows=$db->query('SELECT n.*,a.first_name,a.last_name,(SELECT COUNT(*) FROM promissory_documents d WHERE d.promissory_note_id=n.id AND d.status IN '.$visibleStatuses.') AS document_count FROM promissory_notes n JOIN associates a ON a.id=n.associate_id ORDER BY n.created_at DESC LIMIT 100')->fetchAll();json_response(['notes'=>$rows]); }
if ($action === 'promissory-documents' && $method === 'DELETE') {
    $current=require_user(['superadmin','operador']);verify_csrf();$id=(int)($_GET['id']??0);if(!$id)json_response(['error'=>'Selecciona el documento.'],422);
    $q=$db->prepare('SELECT id,promissory_note_id,label,status FROM promissory_documents WHERE id=?');$q->execute([$id]);$document=$q->fetch();if(!$document||$document['status']!=='custodiado')json_response(['error'=>'El documento ya fue retirado o no existe.'],422);
    if($current['role']==='operador'){$summary='Retirar documento '.$document['label'].' del pagaré #'.$document['promissory_note_id'];$payload=['document_id'=>$id,'note_id'=>(int)$document['promissory_note_id'],'label'=>$document['label']];$q=$db->prepare('INSERT INTO approval_requests(requested_by,operation,summary,payload_json) VALUES(?,?,?,?)');$q->execute([$current['id'],'promissory_document_delete',substr($summary,0,255),json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);audit($db,$current['id'],'solicitud_cambio',(int)$db->lastInsertId(),'solicitar',$summary);json_response(['ok'=>true,'pending_approval'=>true,'message'=>'La solicitud de retiro fue enviada a la Superadmin.'],202);}
    $q=$db->prepare('UPDATE promissory_documents SET status="retirado",reviewed_by=?,reviewed_at=NOW() WHERE id=? AND status="custodiado"');$q->execute([$current['id'],$id]);if(!$q->rowCount())json_response(['error'=>'El documento ya fue retirado.'],422);audit($db,$current['id'],'documento_pagare',$id,'retirar',$document['label']);json_response(['ok'=>true,'message'=>'Documento retirado de la vista operativa; se conserva bajo custodia privada.']);
}

if ($action === 'promissory-document-file' && $method === 'GET') {
    $current=require_user();$id=(int)($_GET['id']??0);$q=$db->prepare('SELECT original_name,storage_key,mime_type,status FROM promissory_documents WHERE id=?');$q->execute([$id]);$document=$q->fetch();if(!$document||!in_array($document['status'],['custodiado','pendiente','rechazado'],true))json_response(['error'=>'El documento no está disponible.'],404);if($document['status']!=='custodiado'&&$current['role']!=='superadmin')json_response(['error'=>'No tienes permiso para abrir este documento.'],403);
    try{$path=private_document_path($document['storage_key']);}catch(Throwable $error){json_response(['error'=>'Archivo privado no válido.'],404);}if(!is_file($path))json_response(['error'=>'El archivo no se encuentra en la carpeta privada.'],404);
    $fallback=preg_replace('/[^A-Za-z0-9._-]/','_',basename($document['original_name']));header('Content-Type: '.$document['mime_type']);header('Content-Length: '.filesize($path));header('Content-Disposition: attachment; filename="'.$fallback.'"; filename*=UTF-8\'\''.rawurlencode($document['original_name']));header('X-Content-Type-Options: nosniff');header('Cache-Control: no-store, private');readfile($path);exit;
}

if ($action === 'promissory-notes' && $method === 'POST') { $u=require_user(['superadmin','operador']);verify_csrf();$v=body();$a=(int)($v['associate_id']??0);$credit=(int)($v['credit_application_id']??0);$number=substr(clean($v['note_number']??''),0,100);if(!$a||!$credit||!$number)json_response(['error'=>'Asociado, crédito aprobado y número de pagaré son obligatorios.'],422);$check=$db->prepare('SELECT id FROM credit_applications WHERE id=? AND associate_id=? AND status IN ("aprobada","desembolsada")');$check->execute([$credit,$a]);if(!$check->fetchColumn())json_response(['error'=>'Selecciona un crédito aprobado que pertenezca a este asociado.'],422);queue_operator_change($db,$u,'promissory_note_create','Registrar pagaré ' . $number,$v);try{$q=$db->prepare('INSERT INTO promissory_notes(associate_id,credit_application_id,note_number,status,notes,created_by)VALUES(?,?,?,?,?,?)');$q->execute([$a,$credit,$number,'borrador',substr(clean($v['notes']??''),0,255),$u['id']]);audit($db,$u['id'],'pagare',(int)$db->lastInsertId(),'crear',$number);json_response(['ok'=>true],201);}catch(Throwable $e){json_response(['error'=>'Ese número de pagaré ya existe.'],422);}}
if ($action === 'dashboard' && $method === 'GET') { require_user();json_response(['metrics'=>['asociados'=>(int)$db->query('SELECT COUNT(*) FROM associates WHERE status="activo"')->fetchColumn(),'afiliaciones_pendientes'=>(int)$db->query('SELECT COUNT(*) FROM affiliation_requests WHERE status="en_revision"')->fetchColumn(),'pagos_aplicados'=>(float)$db->query('SELECT COALESCE(SUM(amount),0) FROM payments WHERE status="aplicado"')->fetchColumn(),'cartera_abierta'=>(float)$db->query('SELECT COALESCE(SUM(amount),0) FROM receivables WHERE status IN ("por_vencer","vencida")')->fetchColumn()]]); }
if ($action === 'users' && $method === 'GET') { require_user(['superadmin']);json_response(['users'=>$db->query('SELECT id,full_name,email,role,active,created_at FROM internal_users ORDER BY full_name')->fetchAll()]); }
if ($action === 'users' && $method === 'POST') { $u=require_user(['superadmin']);verify_csrf();$v=body();$name=substr(clean($v['full_name']??''),0,160);$email=strtolower(substr(clean($v['email']??''),0,190));$role=clean($v['role']??'');$password=(string)($v['password']??'');if(!$name||!filter_var($email,FILTER_VALIDATE_EMAIL)||!in_array($role,FEGCON_ROLES,true)||strlen($password)<12)json_response(['error'=>'Completa nombre, correo, rol y una contraseña de mínimo 12 caracteres.'],422);if($role==='superadmin'&&(int)$db->query('SELECT COUNT(*) FROM internal_users WHERE role="superadmin" AND active=1')->fetchColumn()>0)json_response(['error'=>'La cuenta Superadmin es única. Solo se pueden crear cuentas Operador.'],422);try{$q=$db->prepare('INSERT INTO internal_users(full_name,email,password_hash,role)VALUES(?,?,?,?)');$q->execute([$name,$email,password_hash($password,PASSWORD_DEFAULT),$role]);audit($db,$u['id'],'usuario',(int)$db->lastInsertId(),'crear',$email);json_response(['ok'=>true],201);}catch(Throwable $e){json_response(['error'=>'Ese correo ya está registrado.'],422);}}
if ($action === 'audit-log' && $method === 'GET') { require_user(['superadmin']);$rows=$db->query('SELECT l.id,l.entity,l.entity_id,l.action,l.detail,l.created_at,u.full_name AS user_name FROM audit_log l LEFT JOIN internal_users u ON u.id=l.user_id ORDER BY l.created_at DESC,l.id DESC LIMIT 200')->fetchAll();json_response(['entries'=>$rows]); }
if ($action === 'receivables' && $method === 'GET') {
    require_user();
    $rate=$db->query("SELECT rate_percent FROM monthly_usury_rates WHERE effective_month=DATE_FORMAT(CURDATE(),'%Y-%m')")->fetchColumn();
    $rows=$db->query('SELECT r.*,a.first_name,a.last_name,GREATEST(DATEDIFF(CURDATE(),r.due_date),0) AS days_overdue FROM receivables r JOIN associates a ON a.id=r.associate_id ORDER BY r.due_date,r.id LIMIT 100')->fetchAll();
    foreach($rows as &$row){$days=(int)$row['days_overdue'];$open=!in_array($row['status'],['pagada','anulada'],true);$row['status']=$open&&$days>0?'vencida':($open?'por_vencer':$row['status']);$row['late_interest']=$open&&$days>0&&$rate!==false?(float)$row['amount']*((float)$rate/100)/360*$days:null;$row['usury_rate_percent']=$rate===false?null:(float)$rate;}
    unset($row);json_response(['receivables'=>$rows]);
}
if ($action === 'receivables' && $method === 'POST') { $u=require_user(['superadmin','operador']);verify_csrf();$v=body();$a=(int)($v['associate_id']??0);$amount=(float)($v['amount']??0);$ref=substr(clean($v['reference']??''),0,100);$date=clean($v['due_date']??'');if(!$a||!$ref||$amount<=0||!$date)json_response(['error'=>'Completa asociado, referencia, vencimiento y valor.'],422);queue_operator_change($db,$u,'receivable_create','Registrar obligación ' . $ref,$v);$q=$db->prepare('INSERT INTO receivables(associate_id,reference,due_date,amount,created_by)VALUES(?,?,?,?,?)');$q->execute([$a,$ref,$date,$amount,$u['id']]);audit($db,$u['id'],'cartera',(int)$db->lastInsertId(),'crear',$ref);json_response(['ok'=>true],201); }
json_response(['error' => 'Ruta no encontrada.'], 404);
