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

json_response(['error' => 'Ruta no encontrada.'], 404);
