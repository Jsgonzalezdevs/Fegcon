<?php
declare(strict_types=1);

/** Shared hosting API bootstrap. Compatible with PHP 7.4+. */
const FEGCON_ROLES = ['superadmin', 'operador'];

function config(): array {
    $path = dirname($_SERVER['DOCUMENT_ROOT'], 2) . '/.fegcon-admin.php';
    if (!is_file($path)) {
        json_response(['error' => 'La aplicación aún no fue configurada.'], 503);
    }
    $config = require $path;
    if (!is_array($config)) json_response(['error' => 'Configuración inválida.'], 503);
    return $config;
}

function db(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;
    $c = config();
    $pdo = new PDO(
        'mysql:host=' . $c['db_host'] . ';dbname=' . $c['db_name'] . ';charset=utf8mb4',
        $c['db_user'],
        $c['db_password'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false]
    );
    $pdo->exec("CREATE TABLE IF NOT EXISTS app_settings (setting_key VARCHAR(100) PRIMARY KEY, setting_value LONGTEXT NOT NULL, updated_by INT UNSIGNED NULL, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("CREATE TABLE IF NOT EXISTS admin_migrations (migration_key VARCHAR(100) PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $roleMigration = $pdo->query("SELECT migration_key FROM admin_migrations WHERE migration_key='two_user_roles_v1'")->fetchColumn();
    if (!$roleMigration) {
        $pdo->exec("ALTER TABLE internal_users MODIFY role ENUM('administrador','afiliaciones','creditos','cartera','tesoreria','consulta','superadmin','operador') NOT NULL DEFAULT 'operador'");
        $primaryAdmin = $pdo->query("SELECT id FROM internal_users WHERE role IN ('administrador','superadmin') ORDER BY id ASC LIMIT 1")->fetchColumn();
        $q = $pdo->prepare("UPDATE internal_users SET role=CASE WHEN id=? THEN 'superadmin' ELSE 'operador' END");
        $q->execute([$primaryAdmin ? (int) $primaryAdmin : 0]);
        $pdo->exec("ALTER TABLE internal_users MODIFY role ENUM('superadmin','operador') NOT NULL DEFAULT 'operador'");
        $pdo->exec("INSERT INTO admin_migrations (migration_key) VALUES ('two_user_roles_v1')");
    }
    $pdo->exec("CREATE TABLE IF NOT EXISTS approval_requests (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, requested_by INT UNSIGNED NOT NULL, operation VARCHAR(80) NOT NULL, summary VARCHAR(255) NOT NULL, payload_json LONGTEXT NOT NULL, status ENUM('pendiente','aprobada','rechazada') NOT NULL DEFAULT 'pendiente', reviewed_by INT UNSIGNED NULL, reviewed_at TIMESTAMP NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (requested_by) REFERENCES internal_users(id), FOREIGN KEY (reviewed_by) REFERENCES internal_users(id), KEY approval_requests_status_date_idx (status, created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("CREATE TABLE IF NOT EXISTS monthly_usury_rates (effective_month CHAR(7) PRIMARY KEY, rate_percent DECIMAL(6,3) NOT NULL, updated_by INT UNSIGNED NOT NULL, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (updated_by) REFERENCES internal_users(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("CREATE TABLE IF NOT EXISTS financial_products (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, product_type ENUM('ahorro','credito') NOT NULL, name VARCHAR(150) NOT NULL, code VARCHAR(40) NOT NULL, parameters_json LONGTEXT NOT NULL, active TINYINT(1) NOT NULL DEFAULT 1, created_by INT UNSIGNED NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY product_type_code (product_type, code)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $seed = $pdo->prepare('INSERT INTO financial_products(product_type,name,code,parameters_json,active) VALUES(?,?,?,?,1) ON DUPLICATE KEY UPDATE name=VALUES(name),parameters_json=VALUES(parameters_json),active=1');
    $seed->execute(['ahorro','Aportes FEGCON','APORTES-FEGCON',json_encode(['ahorros_a_la_vista_pct'=>30,'aportes_pct'=>70,'disponibilidad'=>'inmediata'],JSON_UNESCAPED_UNICODE)]);
    $seed->execute(['credito','Libre inversión','LIBRE-INVERSION',json_encode(['tasa_fija_mensual_pct'=>2,'base_interes'=>'saldo_pendiente','plazo_minimo_meses'=>1,'plazo_maximo_meses'=>60,'multiplicadores_cupo'=>[3,4,5]],JSON_UNESCAPED_UNICODE)]);
    $pdo->exec("CREATE TABLE IF NOT EXISTS savings_transactions (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, associate_id INT UNSIGNED NOT NULL, product_id INT UNSIGNED NOT NULL, movement_type ENUM('aporte','retiro') NOT NULL, amount DECIMAL(14,2) NOT NULL, status ENUM('pendiente','aplicado','anulado') NOT NULL DEFAULT 'aplicado', reference VARCHAR(100) NULL, recorded_by INT UNSIGNED NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (associate_id) REFERENCES associates(id), FOREIGN KEY (product_id) REFERENCES financial_products(id), FOREIGN KEY (recorded_by) REFERENCES internal_users(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("CREATE TABLE IF NOT EXISTS credit_applications (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, associate_id INT UNSIGNED NOT NULL, product_id INT UNSIGNED NOT NULL, requested_amount DECIMAL(14,2) NOT NULL, requested_term_months INT UNSIGNED NOT NULL, purpose VARCHAR(255) NULL, status ENUM('borrador','en_revision','aprobada','rechazada','desembolsada') NOT NULL DEFAULT 'en_revision', created_by INT UNSIGNED NOT NULL, reviewed_by INT UNSIGNED NULL, reviewed_at TIMESTAMP NULL, decision_note VARCHAR(255) NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (associate_id) REFERENCES associates(id), FOREIGN KEY (product_id) REFERENCES financial_products(id), FOREIGN KEY (created_by) REFERENCES internal_users(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    try { $pdo->exec('ALTER TABLE credit_applications ADD COLUMN reviewed_by INT UNSIGNED NULL, ADD COLUMN reviewed_at TIMESTAMP NULL, ADD COLUMN decision_note VARCHAR(255) NULL'); } catch (Throwable $ignored) {}
    $pdo->exec("CREATE TABLE IF NOT EXISTS affiliation_requests (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, document_number VARCHAR(50) NOT NULL UNIQUE, first_name VARCHAR(100) NOT NULL, last_name VARCHAR(100) NOT NULL, email VARCHAR(190) NULL, phone VARCHAR(50) NULL, company_name VARCHAR(190) NULL, documents_status ENUM('pendientes','completos') NOT NULL DEFAULT 'pendientes', status ENUM('en_revision','aprobada','rechazada') NOT NULL DEFAULT 'en_revision', created_by INT UNSIGNED NOT NULL, reviewed_by INT UNSIGNED NULL, reviewed_at TIMESTAMP NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (created_by) REFERENCES internal_users(id), FOREIGN KEY (reviewed_by) REFERENCES internal_users(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("CREATE TABLE IF NOT EXISTS configuration_catalog (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, category VARCHAR(80) NOT NULL, label VARCHAR(190) NOT NULL, payload LONGTEXT NOT NULL, active TINYINT(1) NOT NULL DEFAULT 1, created_by INT UNSIGNED NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY category_label (category,label)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("CREATE TABLE IF NOT EXISTS payments (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, associate_id INT UNSIGNED NOT NULL, payment_method_id INT UNSIGNED NULL, concept VARCHAR(150) NOT NULL, amount DECIMAL(14,2) NOT NULL, reference VARCHAR(100) NULL, status ENUM('pendiente','aplicado','anulado') NOT NULL DEFAULT 'aplicado', received_on DATE NOT NULL, recorded_by INT UNSIGNED NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (associate_id) REFERENCES associates(id), FOREIGN KEY (payment_method_id) REFERENCES configuration_catalog(id), FOREIGN KEY (recorded_by) REFERENCES internal_users(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("CREATE TABLE IF NOT EXISTS receivables (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, associate_id INT UNSIGNED NOT NULL, reference VARCHAR(100) NOT NULL, due_date DATE NOT NULL, amount DECIMAL(14,2) NOT NULL, status ENUM('por_vencer','vencida','pagada','anulada') NOT NULL DEFAULT 'por_vencer', created_by INT UNSIGNED NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (associate_id) REFERENCES associates(id), FOREIGN KEY (created_by) REFERENCES internal_users(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("CREATE TABLE IF NOT EXISTS payroll_collections (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, period_label VARCHAR(100) NOT NULL, expected_amount DECIMAL(14,2) NOT NULL DEFAULT 0, collected_amount DECIMAL(14,2) NOT NULL DEFAULT 0, status ENUM('borrador','enviado','recibido','conciliado') NOT NULL DEFAULT 'borrador', created_by INT UNSIGNED NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (created_by) REFERENCES internal_users(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("CREATE TABLE IF NOT EXISTS promissory_notes (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, associate_id INT UNSIGNED NOT NULL, credit_application_id BIGINT UNSIGNED NULL, note_number VARCHAR(100) NOT NULL UNIQUE, status ENUM('borrador','pendiente_firma','firmado','custodiado','anulado') NOT NULL DEFAULT 'borrador', notes VARCHAR(255) NULL, created_by INT UNSIGNED NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (associate_id) REFERENCES associates(id), FOREIGN KEY (credit_application_id) REFERENCES credit_applications(id), FOREIGN KEY (created_by) REFERENCES internal_users(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    return $pdo;
}

function start_session(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    session_name('fegcon_admin');
    session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => true, 'httponly' => true, 'samesite' => 'Strict']);
    session_start();
}

function json_response(array $body, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, private');
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

function body(): array {
    $input = json_decode((string) file_get_contents('php://input'), true);
    return is_array($input) ? $input : [];
}

function clean($value): string { return is_string($value) ? trim($value) : ''; }

function user(): ?array {
    start_session();
    return isset($_SESSION['user']) && is_array($_SESSION['user']) ? $_SESSION['user'] : null;
}

function require_user(array $roles = []): array {
    $current = user();
    if (!$current) json_response(['error' => 'Sesión requerida.'], 401);
    if ($roles && !in_array($current['role'], $roles, true)) json_response(['error' => 'No tienes permisos para esta acción.'], 403);
    return $current;
}

function queue_operator_change(PDO $db, array $current, string $operation, string $summary, array $payload): void {
    if ($current['role'] !== 'operador') return;
    $stmt = $db->prepare('INSERT INTO approval_requests (requested_by, operation, summary, payload_json) VALUES (?, ?, ?, ?)');
    $stmt->execute([$current['id'], $operation, substr($summary, 0, 255), json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)]);
    audit($db, $current['id'], 'solicitud_cambio', (int) $db->lastInsertId(), 'solicitar', $summary);
    json_response(['ok' => true, 'pending_approval' => true, 'message' => 'Solicitud enviada a la Superadmin para aprobación.'], 202);
}

function require_core_product(PDO $db, int $productId, string $type): void {
    $code = $type === 'ahorro' ? 'APORTES-FEGCON' : 'LIBRE-INVERSION';
    $stmt = $db->prepare('SELECT id FROM financial_products WHERE id=? AND product_type=? AND code=? AND active=1 LIMIT 1');
    $stmt->execute([$productId, $type, $code]);
    if (!$stmt->fetchColumn()) throw new RuntimeException('El producto no corresponde a las reglas vigentes de FEGCON.');
}

function verify_csrf(): void {
    start_session();
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!is_string($token) || !isset($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], $token)) {
        json_response(['error' => 'Solicitud no válida.'], 419);
    }
}

function audit(PDO $db, int $userId, string $entity, int $entityId, string $action, string $detail = ''): void {
    $stmt = $db->prepare('INSERT INTO audit_log (user_id, entity, entity_id, action, detail, ip_address) VALUES (?, ?, ?, ?, ?, ?)');
    $stmt->execute([$userId, $entity, $entityId, $action, $detail, substr((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45)]);
}

function apply_approved_change(PDO $db, int $requesterId, int $reviewerId, string $operation, array $v): array {
    switch ($operation) {
        case 'associate_create':
            $first = clean($v['firstName'] ?? ''); $last = clean($v['lastName'] ?? ''); $document = clean($v['documentNumber'] ?? '');
            if (!$first || !$last || !$document) throw new RuntimeException('Datos del asociado incompletos.');
            $companyId = null; $companyName = clean($v['company'] ?? '');
            if ($companyName !== '') {
                $q = $db->prepare('SELECT id FROM companies WHERE name=? LIMIT 1'); $q->execute([$companyName]); $companyId = $q->fetchColumn();
                if (!$companyId) { $q = $db->prepare('INSERT INTO companies(name) VALUES (?)'); $q->execute([$companyName]); $companyId = (int) $db->lastInsertId(); }
            }
            $q = $db->prepare('INSERT INTO associates(document_type,document_number,first_name,last_name,email,phone,company_id,status) VALUES(?,?,?,?,?,?,?,"activo")');
            $q->execute([clean($v['documentType'] ?? '') ?: 'CC', $document, $first, $last, clean($v['email'] ?? '') ?: null, clean($v['phone'] ?? '') ?: null, $companyId ?: null]);
            $id = (int) $db->lastInsertId();
            $q = $db->prepare('INSERT INTO associate_events(associate_id,event_type,title,description,created_by) VALUES (?,"registro","Registro aprobado","El registro fue revisado y aprobado por la Superadmin.",?)'); $q->execute([$id, $reviewerId]);
            audit($db, $reviewerId, 'asociado', $id, 'crear_aprobado', $document); return ['entity' => 'asociado', 'id' => $id];
        case 'savings_transaction':
            $associate = (int) ($v['associate_id'] ?? 0); $product = (int) ($v['product_id'] ?? 0); $amount = (float) ($v['amount'] ?? 0); $type = clean($v['movement_type'] ?? '');
            if (!$associate || !$product || $amount <= 0 || !in_array($type, ['aporte','retiro'], true)) throw new RuntimeException('Movimiento de ahorro inválido.');
            require_core_product($db, $product, 'ahorro');
            $q = $db->prepare('INSERT INTO savings_transactions(associate_id,product_id,movement_type,amount,reference,recorded_by) VALUES(?,?,?,?,?,?)'); $q->execute([$associate,$product,$type,$amount,substr(clean($v['reference'] ?? ''),0,100),$requesterId]);
            $id = (int) $db->lastInsertId(); audit($db,$reviewerId,'ahorro',$id,'registrar_aprobado',$type); return ['entity'=>'ahorro','id'=>$id];
        case 'credit_application':
            $associate = (int) ($v['associate_id'] ?? 0); $product = (int) ($v['product_id'] ?? 0); $amount = (float) ($v['amount'] ?? 0); $term = (int) ($v['term_months'] ?? 0);
            if (!$associate || !$product || $amount <= 0 || $term < 1 || $term > 60) throw new RuntimeException('Solicitud de crédito inválida.');
            require_core_product($db, $product, 'credito');
            $q = $db->prepare('INSERT INTO credit_applications(associate_id,product_id,requested_amount,requested_term_months,purpose,created_by) VALUES(?,?,?,?,?,?)'); $q->execute([$associate,$product,$amount,$term,substr(clean($v['purpose'] ?? ''),0,255),$requesterId]);
            $id = (int) $db->lastInsertId(); audit($db,$reviewerId,'credito',$id,'solicitar_aprobado','Solicitud'); return ['entity'=>'credito','id'=>$id];
        case 'credit_decision':
            $id=(int)($v['id']??0); $status=clean($v['status']??''); if (!$id || !in_array($status,['aprobada','rechazada'],true)) throw new RuntimeException('Decisión de crédito inválida.');
            $q=$db->prepare('UPDATE credit_applications SET status=?,reviewed_by=?,reviewed_at=NOW(),decision_note=? WHERE id=? AND status="en_revision"');$q->execute([$status,$reviewerId,substr(clean($v['note']??''),0,255),$id]);if(!$q->rowCount())throw new RuntimeException('La solicitud ya fue procesada.');
            audit($db,$reviewerId,'credito',$id,$status,'Decisión aprobada'); return ['entity'=>'credito','id'=>$id];
        case 'affiliation_create':
            $doc=substr(clean($v['document_number']??''),0,50);$first=substr(clean($v['first_name']??''),0,100);$last=substr(clean($v['last_name']??''),0,100);if(!$doc||!$first||!$last)throw new RuntimeException('Datos de afiliación incompletos.');
            $q=$db->prepare('INSERT INTO affiliation_requests(document_number,first_name,last_name,email,phone,company_name,documents_status,created_by) VALUES(?,?,?,?,?,?,?,?)');$q->execute([$doc,$first,$last,substr(clean($v['email']??''),0,190),substr(clean($v['phone']??''),0,50),substr(clean($v['company']??''),0,190),clean($v['documents_status']??'pendientes')==='completos'?'completos':'pendientes',$requesterId]);
            $id=(int)$db->lastInsertId();audit($db,$reviewerId,'afiliacion',$id,'crear_aprobado',$doc);return ['entity'=>'afiliacion','id'=>$id];
        case 'affiliation_decision':
            $id=(int)($v['id']??0);$status=clean($v['status']??'');if(!$id||!in_array($status,['aprobada','rechazada'],true))throw new RuntimeException('Decisión de afiliación inválida.');
            $q=$db->prepare('SELECT * FROM affiliation_requests WHERE id=? FOR UPDATE');$q->execute([$id]);$r=$q->fetch();if(!$r||$r['status']!=='en_revision')throw new RuntimeException('La solicitud ya fue procesada.');
            if($status==='aprobada'){$companyId=null;if($r['company_name']){$q=$db->prepare('SELECT id FROM companies WHERE name=?');$q->execute([$r['company_name']]);$companyId=$q->fetchColumn();if(!$companyId){$q=$db->prepare('INSERT INTO companies(name) VALUES(?)');$q->execute([$r['company_name']]);$companyId=(int)$db->lastInsertId();}}$q=$db->prepare('INSERT INTO associates(document_number,first_name,last_name,email,phone,company_id,status,affiliation_date) VALUES(?,?,?,?,?,?,"activo",CURDATE())');$q->execute([$r['document_number'],$r['first_name'],$r['last_name'],$r['email']?:null,$r['phone']?:null,$companyId?:null]);}
            $q=$db->prepare('UPDATE affiliation_requests SET status=?,reviewed_by=?,reviewed_at=NOW() WHERE id=?');$q->execute([$status,$reviewerId,$id]);audit($db,$reviewerId,'afiliacion',$id,$status,'Decisión aprobada');return ['entity'=>'afiliacion','id'=>$id];
        case 'payment_create':
            $associate=(int)($v['associate_id']??0);$amount=(float)($v['amount']??0);$concept=substr(clean($v['concept']??''),0,150);if(!$associate||$amount<=0||!$concept)throw new RuntimeException('Datos de pago incompletos.');
            $q=$db->prepare('INSERT INTO payments(associate_id,payment_method_id,concept,amount,reference,received_on,recorded_by) VALUES(?,?,?,?,?,?,?)');$q->execute([$associate,(int)($v['payment_method_id']??0)?:null,$concept,$amount,substr(clean($v['reference']??''),0,100),clean($v['received_on']??'')?:date('Y-m-d'),$requesterId]);$id=(int)$db->lastInsertId();audit($db,$reviewerId,'pago',$id,'registrar_aprobado',$concept);return ['entity'=>'pago','id'=>$id];
        case 'payroll_collection_create':
            $period=substr(clean($v['period_label']??''),0,100);if(!$period)throw new RuntimeException('El período es obligatorio.');$q=$db->prepare('INSERT INTO payroll_collections(period_label,expected_amount,created_by) VALUES(?,?,?)');$q->execute([$period,max(0,(float)($v['expected_amount']??0)),$requesterId]);$id=(int)$db->lastInsertId();audit($db,$reviewerId,'cobro_nomina',$id,'crear_aprobado',$period);return ['entity'=>'cobro_nomina','id'=>$id];
        case 'promissory_note_create':
            $associate=(int)($v['associate_id']??0);$number=substr(clean($v['note_number']??''),0,100);if(!$associate||!$number)throw new RuntimeException('Asociado y número de pagaré son obligatorios.');$q=$db->prepare('INSERT INTO promissory_notes(associate_id,credit_application_id,note_number,status,notes,created_by) VALUES(?,?,?,?,?,?)');$q->execute([$associate,(int)($v['credit_application_id']??0)?:null,$number,'borrador',substr(clean($v['notes']??''),0,255),$requesterId]);$id=(int)$db->lastInsertId();audit($db,$reviewerId,'pagare',$id,'crear_aprobado',$number);return ['entity'=>'pagare','id'=>$id];
        case 'receivable_create':
            $associate=(int)($v['associate_id']??0);$amount=(float)($v['amount']??0);$ref=substr(clean($v['reference']??''),0,100);$date=clean($v['due_date']??'');if(!$associate||$amount<=0||!$ref||!$date)throw new RuntimeException('Datos de cartera incompletos.');$q=$db->prepare('INSERT INTO receivables(associate_id,reference,due_date,amount,created_by) VALUES(?,?,?,?,?)');$q->execute([$associate,$ref,$date,$amount,$requesterId]);$id=(int)$db->lastInsertId();audit($db,$reviewerId,'cartera',$id,'crear_aprobado',$ref);return ['entity'=>'cartera','id'=>$id];
        case 'catalog_item_create':
            $category=clean($v['category']??'');$label=substr(clean($v['label']??''),0,190);if($category!=='convenio'||!$label)throw new RuntimeException('Datos del convenio incompletos.');$payload=is_array($v['payload']??null)?$v['payload']:[];$q=$db->prepare('INSERT INTO configuration_catalog(category,label,payload,created_by) VALUES(?,?,?,?)');$q->execute([$category,$label,json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),$requesterId]);$id=(int)$db->lastInsertId();audit($db,$reviewerId,'convenio',$id,'crear_aprobado',$label);return ['entity'=>'convenio','id'=>$id];
        default: throw new RuntimeException('Tipo de cambio no autorizado.');
    }
}
