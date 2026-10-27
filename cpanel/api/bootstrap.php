<?php
declare(strict_types=1);

/** Shared hosting API bootstrap. Compatible with PHP 7.4+. */
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
    $savingsSplitMigration = $pdo->query("SELECT migration_key FROM admin_migrations WHERE migration_key='savings_split_30_70_v1'")->fetchColumn();
    if (!$savingsSplitMigration) {
        foreach (['vista_amount' => 'DECIMAL(14,2) NOT NULL DEFAULT 0', 'contributions_amount' => 'DECIMAL(14,2) NOT NULL DEFAULT 0'] as $column => $definition) {
            $check = $pdo->prepare('SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=?');
            $check->execute(['savings_transactions', $column]);
            if (!(int) $check->fetchColumn()) $pdo->exec('ALTER TABLE savings_transactions ADD COLUMN ' . $column . ' ' . $definition);
        }
        $updateSplit = $pdo->prepare('UPDATE savings_transactions SET vista_amount=?,contributions_amount=? WHERE id=?');
        $associateIds = $pdo->query("SELECT DISTINCT associate_id FROM savings_transactions WHERE status='aplicado' ORDER BY associate_id")->fetchAll(PDO::FETCH_COLUMN);
        foreach ($associateIds as $associateId) {
            $vista = 0.0; $contributions = 0.0;
            $movements = $pdo->prepare("SELECT id,movement_type,amount FROM savings_transactions WHERE associate_id=? AND status='aplicado' ORDER BY created_at,id");
            $movements->execute([(int)$associateId]);
            foreach ($movements as $movement) {
                $amount = (float)$movement['amount']; $vistaPart = 0.0; $contributionPart = 0.0;
                if ($movement['movement_type'] === 'aporte') {
                    $vistaPart = round($amount * 0.30, 2); $contributionPart = $amount - $vistaPart;
                    $vista += $vistaPart; $contributions += $contributionPart;
                } else {
                    $fromVista = min(max(0.0, $vista), $amount); $vistaPart = -$fromVista; $vista -= $fromVista;
                    $contributionPart = -($amount - $fromVista); $contributions += $contributionPart;
                }
                $updateSplit->execute([$vistaPart,$contributionPart,(int)$movement['id']]);
            }
        }
        $pdo->exec("INSERT INTO admin_migrations(migration_key) VALUES('savings_split_30_70_v1')");
    }
    $pdo->exec("CREATE TABLE IF NOT EXISTS credit_applications (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, associate_id INT UNSIGNED NOT NULL, product_id INT UNSIGNED NOT NULL, requested_amount DECIMAL(14,2) NOT NULL, requested_term_months INT UNSIGNED NOT NULL, purpose VARCHAR(255) NULL, status ENUM('borrador','en_revision','aprobada','rechazada','desembolsada') NOT NULL DEFAULT 'en_revision', created_by INT UNSIGNED NOT NULL, reviewed_by INT UNSIGNED NULL, reviewed_at TIMESTAMP NULL, decision_note VARCHAR(255) NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (associate_id) REFERENCES associates(id), FOREIGN KEY (product_id) REFERENCES financial_products(id), FOREIGN KEY (created_by) REFERENCES internal_users(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    try { $pdo->exec('ALTER TABLE credit_applications ADD COLUMN reviewed_by INT UNSIGNED NULL, ADD COLUMN reviewed_at TIMESTAMP NULL, ADD COLUMN decision_note VARCHAR(255) NULL'); } catch (Throwable $ignored) {}
    try { $pdo->exec('ALTER TABLE credit_applications ADD COLUMN approved_multiplier TINYINT UNSIGNED NULL, ADD COLUMN monthly_installment DECIMAL(14,2) NULL'); } catch (Throwable $ignored) {}
    foreach (['disbursed_on' => 'DATE NULL', 'first_due_date' => 'DATE NULL'] as $column => $definition) {
        $check = $pdo->prepare('SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=?');
        $check->execute(['credit_applications', $column]);
        if (!(int) $check->fetchColumn()) $pdo->exec('ALTER TABLE credit_applications ADD COLUMN ' . $column . ' ' . $definition);
    }
    $pdo->exec("CREATE TABLE IF NOT EXISTS credit_installments (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, credit_application_id BIGINT UNSIGNED NOT NULL, installment_number SMALLINT UNSIGNED NOT NULL, due_date DATE NOT NULL, principal_amount DECIMAL(14,2) NOT NULL, interest_amount DECIMAL(14,2) NOT NULL, total_amount DECIMAL(14,2) NOT NULL, paid_amount DECIMAL(14,2) NOT NULL DEFAULT 0, status ENUM('pendiente','pagada','anulada') NOT NULL DEFAULT 'pendiente', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (credit_application_id) REFERENCES credit_applications(id), UNIQUE KEY credit_installment_number (credit_application_id,installment_number), KEY credit_installment_due (due_date,status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("CREATE TABLE IF NOT EXISTS affiliation_requests (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, document_number VARCHAR(50) NOT NULL UNIQUE, first_name VARCHAR(100) NOT NULL, last_name VARCHAR(100) NOT NULL, email VARCHAR(190) NULL, phone VARCHAR(50) NULL, company_name VARCHAR(190) NULL, documents_status ENUM('pendientes','completos') NOT NULL DEFAULT 'pendientes', status ENUM('en_revision','aprobada','rechazada') NOT NULL DEFAULT 'en_revision', created_by INT UNSIGNED NOT NULL, reviewed_by INT UNSIGNED NULL, reviewed_at TIMESTAMP NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (created_by) REFERENCES internal_users(id), FOREIGN KEY (reviewed_by) REFERENCES internal_users(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("CREATE TABLE IF NOT EXISTS configuration_catalog (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, category VARCHAR(80) NOT NULL, label VARCHAR(190) NOT NULL, payload LONGTEXT NOT NULL, active TINYINT(1) NOT NULL DEFAULT 1, created_by INT UNSIGNED NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY category_label (category,label)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("CREATE TABLE IF NOT EXISTS payments (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, associate_id INT UNSIGNED NOT NULL, payment_method_id INT UNSIGNED NULL, concept VARCHAR(150) NOT NULL, amount DECIMAL(14,2) NOT NULL, reference VARCHAR(100) NULL, status ENUM('pendiente','aplicado','anulado') NOT NULL DEFAULT 'aplicado', received_on DATE NOT NULL, recorded_by INT UNSIGNED NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (associate_id) REFERENCES associates(id), FOREIGN KEY (payment_method_id) REFERENCES configuration_catalog(id), FOREIGN KEY (recorded_by) REFERENCES internal_users(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    foreach (['credit_installment_id' => 'BIGINT UNSIGNED NULL'] as $column => $definition) {
        $check = $pdo->prepare('SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=?');
        $check->execute(['payments', $column]);
        if (!(int) $check->fetchColumn()) $pdo->exec('ALTER TABLE payments ADD COLUMN ' . $column . ' ' . $definition);
    }
    $pdo->exec("CREATE TABLE IF NOT EXISTS receivables (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, associate_id INT UNSIGNED NOT NULL, reference VARCHAR(100) NOT NULL, due_date DATE NOT NULL, amount DECIMAL(14,2) NOT NULL, status ENUM('por_vencer','vencida','pagada','anulada') NOT NULL DEFAULT 'por_vencer', created_by INT UNSIGNED NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (associate_id) REFERENCES associates(id), FOREIGN KEY (created_by) REFERENCES internal_users(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("CREATE TABLE IF NOT EXISTS payroll_collections (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, period_label VARCHAR(100) NOT NULL, expected_amount DECIMAL(14,2) NOT NULL DEFAULT 0, collected_amount DECIMAL(14,2) NOT NULL DEFAULT 0, status ENUM('borrador','enviado','recibido','conciliado') NOT NULL DEFAULT 'borrador', created_by INT UNSIGNED NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (created_by) REFERENCES internal_users(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    foreach (['company_id' => 'INT UNSIGNED NULL', 'collection_date' => 'DATE NULL'] as $column => $definition) {
        $check = $pdo->prepare('SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=?');
        $check->execute(['payroll_collections', $column]);
        if (!(int) $check->fetchColumn()) $pdo->exec('ALTER TABLE payroll_collections ADD COLUMN ' . $column . ' ' . $definition);
    }
    $uniquePayroll = $pdo->prepare('SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name=? AND index_name=?');
    $uniquePayroll->execute(['payroll_collections', 'payroll_company_date_unique']);
    if (!(int) $uniquePayroll->fetchColumn()) $pdo->exec('ALTER TABLE payroll_collections ADD UNIQUE KEY payroll_company_date_unique (company_id,collection_date)');
    $pdo->exec("CREATE TABLE IF NOT EXISTS payroll_collection_items (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, payroll_collection_id BIGINT UNSIGNED NOT NULL, associate_id INT UNSIGNED NOT NULL, charge_type ENUM('aporte','cuota_credito','convenio') NOT NULL, credit_application_id BIGINT UNSIGNED NULL, reference VARCHAR(190) NOT NULL, amount DECIMAL(14,2) NOT NULL, collected_amount DECIMAL(14,2) NOT NULL DEFAULT 0, status ENUM('pendiente','recaudado','anulado') NOT NULL DEFAULT 'pendiente', created_by INT UNSIGNED NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (payroll_collection_id) REFERENCES payroll_collections(id), FOREIGN KEY (associate_id) REFERENCES associates(id), FOREIGN KEY (credit_application_id) REFERENCES credit_applications(id), FOREIGN KEY (created_by) REFERENCES internal_users(id), KEY payroll_collection_items_collection_idx (payroll_collection_id,status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("CREATE TABLE IF NOT EXISTS promissory_notes (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, associate_id INT UNSIGNED NOT NULL, credit_application_id BIGINT UNSIGNED NULL, note_number VARCHAR(100) NOT NULL UNIQUE, status ENUM('borrador','pendiente_firma','firmado','custodiado','anulado') NOT NULL DEFAULT 'borrador', notes VARCHAR(255) NULL, created_by INT UNSIGNED NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (associate_id) REFERENCES associates(id), FOREIGN KEY (credit_application_id) REFERENCES credit_applications(id), FOREIGN KEY (created_by) REFERENCES internal_users(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("CREATE TABLE IF NOT EXISTS promissory_documents (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, promissory_note_id BIGINT UNSIGNED NOT NULL, label VARCHAR(120) NOT NULL, original_name VARCHAR(255) NOT NULL, storage_key VARCHAR(64) NOT NULL UNIQUE, mime_type VARCHAR(80) NOT NULL, byte_size INT UNSIGNED NOT NULL, status ENUM('pendiente','custodiado','rechazado','retirado') NOT NULL DEFAULT 'pendiente', created_by INT UNSIGNED NOT NULL, reviewed_by INT UNSIGNED NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TIMESTAMP NULL, FOREIGN KEY (promissory_note_id) REFERENCES promissory_notes(id), FOREIGN KEY (created_by) REFERENCES internal_users(id), FOREIGN KEY (reviewed_by) REFERENCES internal_users(id), KEY promissory_documents_note_status_idx (promissory_note_id,status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
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
    if (!isset($_SESSION['user']) || !is_array($_SESSION['user'])) return null;
    $stmt = db()->prepare('SELECT active FROM internal_users WHERE id=? LIMIT 1');
    $stmt->execute([(int) ($_SESSION['user']['id'] ?? 0)]);
    if (!(int) $stmt->fetchColumn()) {
        $_SESSION = [];
        session_destroy();
        return null;
    }
    return $_SESSION['user'];
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

function active_savings_balance(PDO $db, int $associateId, bool $lockAssociate = false): float {
    $components = active_savings_components($db, $associateId, $lockAssociate);
    return $components['vista'] + $components['aportes'];
}

function active_savings_components(PDO $db, int $associateId, bool $lockAssociate = false): array {
    $associate = $db->prepare('SELECT id FROM associates WHERE id=? AND status="activo"' . ($lockAssociate ? ' FOR UPDATE' : ''));
    $associate->execute([$associateId]);
    if (!$associate->fetchColumn()) throw new RuntimeException('El asociado no existe o no está activo.');
    $balance = $db->prepare("SELECT COALESCE(SUM(vista_amount),0) AS vista,COALESCE(SUM(contributions_amount),0) AS aportes FROM savings_transactions WHERE associate_id=? AND status='aplicado'");
    $balance->execute([$associateId]);
    $row = $balance->fetch() ?: [];
    return ['vista' => (float)($row['vista'] ?? 0), 'aportes' => (float)($row['aportes'] ?? 0)];
}

function valid_iso_date(string $value): bool {
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
    return $date instanceof DateTimeImmutable && $date->format('Y-m-d') === $value;
}

function create_credit_installments(PDO $db, int $creditId, float $principal, int $months, float $monthlyPayment, string $firstDueDate): void {
    if (!valid_iso_date($firstDueDate) || $principal <= 0 || $months < 1 || $months > 60) {
        throw new RuntimeException('La fecha de primera cuota o el plazo no son válidos.');
    }
    $first = new DateTimeImmutable($firstDueDate);
    $day = (int)$first->format('d');
    $balance = round($principal, 2);
    $insert = $db->prepare('INSERT INTO credit_installments(credit_application_id,installment_number,due_date,principal_amount,interest_amount,total_amount) VALUES(?,?,?,?,?,?)');
    for ($number = 1; $number <= $months; $number++) {
        $monthIndex = ((int)$first->format('Y') * 12) + ((int)$first->format('n') - 1) + ($number - 1);
        $year = intdiv($monthIndex, 12); $monthNumber = ($monthIndex % 12) + 1;
        $month = new DateTimeImmutable(sprintf('%04d-%02d-01', $year, $monthNumber));
        $dueDate = $month->setDate($year, $monthNumber, min($day, (int)$month->format('t')))->format('Y-m-d');
        $interest = round($balance * 0.02, 2);
        $principalDue = $number === $months ? $balance : min($balance, round($monthlyPayment - $interest, 2));
        if ($principalDue <= 0) throw new RuntimeException('La cuota aprobada no alcanza a amortizar el capital.');
        $total = round($principalDue + $interest, 2);
        $insert->execute([$creditId,$number,$dueDate,$principalDue,$interest,$total]);
        $balance = round(max(0, $balance - $principalDue), 2);
    }
    if ($balance > 0.01) throw new RuntimeException('El plan de cuotas no cubre el saldo total.');
}

function record_savings_transaction(PDO $db, int $associateId, int $productId, string $type, float $amount, string $reference, int $userId): int {
    $vista = $type === 'aporte' ? round($amount * 0.30, 2) : -$amount;
    $contributions = $type === 'aporte' ? $amount - $vista : 0;
    $q = $db->prepare('INSERT INTO savings_transactions(associate_id,product_id,movement_type,amount,vista_amount,contributions_amount,reference,recorded_by) VALUES(?,?,?,?,?,?,?,?)');
    $q->execute([$associateId,$productId,$type,$amount,$vista,$contributions,substr($reference,0,100),$userId]);
    return (int)$db->lastInsertId();
}

function private_document_directory(): string {
    $directory = dirname($_SERVER['DOCUMENT_ROOT'], 2) . '/fegcon-private-documents';
    if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) throw new RuntimeException('No fue posible crear la carpeta privada de documentos.');
    @chmod($directory, 0700);
    $root = realpath($directory);
    $publicRoot = realpath((string) $_SERVER['DOCUMENT_ROOT']);
    if (!$root || !$publicRoot || strncmp($root . DIRECTORY_SEPARATOR, $publicRoot . DIRECTORY_SEPARATOR, strlen($publicRoot . DIRECTORY_SEPARATOR)) === 0) throw new RuntimeException('La carpeta privada no puede estar dentro del sitio público.');
    return $root;
}

function private_document_path(string $key): string {
    if (!preg_match('/\A[a-f0-9]{48}\.(pdf|jpg|png)\z/', $key)) throw new RuntimeException('Archivo privado no válido.');
    return private_document_directory() . DIRECTORY_SEPARATOR . $key;
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
        case 'company_create':
            $name=substr(clean($v['company_name']??''),0,190);$taxId=substr(clean($v['tax_id']??''),0,50);$contact=substr(clean($v['contact_name']??''),0,160);$email=substr(clean($v['contact_email']??''),0,190);
            if(!$name)throw new RuntimeException('El nombre de la empresa es obligatorio.');
            if($email!==''&&!filter_var($email,FILTER_VALIDATE_EMAIL))throw new RuntimeException('El correo de contacto no es válido.');
            $q=$db->prepare('INSERT INTO companies(name,tax_id,contact_name,contact_email) VALUES(?,?,?,?)');$q->execute([$name,$taxId?:null,$contact?:null,$email?:null]);$id=(int)$db->lastInsertId();audit($db,$reviewerId,'empresa',$id,'crear_aprobado',$name);return ['entity'=>'empresa','id'=>$id];
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
        case 'associate_update':
            $id=(int)($v['id']??0);$first=clean($v['firstName']??'');$last=clean($v['lastName']??'');$document=clean($v['documentNumber']??'');if(!$id||!$first||!$last||!$document)throw new RuntimeException('Datos del asociado incompletos.');
            $companyId=null;$companyName=clean($v['company']??'');if($companyName!==''){$q=$db->prepare('SELECT id FROM companies WHERE name=? LIMIT 1');$q->execute([$companyName]);$companyId=$q->fetchColumn();if(!$companyId){$q=$db->prepare('INSERT INTO companies(name) VALUES(?)');$q->execute([$companyName]);$companyId=(int)$db->lastInsertId();}}
            $q=$db->prepare('UPDATE associates SET document_type=?,document_number=?,first_name=?,last_name=?,email=?,phone=?,company_id=? WHERE id=?');$q->execute([clean($v['documentType']??'')?:'CC',$document,$first,$last,clean($v['email']??'')?:null,clean($v['phone']??'')?:null,$companyId?:null,$id]);if(!$q->rowCount()&&!$db->query('SELECT id FROM associates WHERE id='.(int)$id)->fetchColumn())throw new RuntimeException('El asociado no existe.');
            $q=$db->prepare('INSERT INTO associate_events(associate_id,event_type,title,description,created_by) VALUES (? ,"actualizacion","Datos actualizados","La Superadmin aprobó la actualización de datos.",?)');$q->execute([$id,$reviewerId]);audit($db,$reviewerId,'asociado',$id,'actualizar_aprobado',$document);return ['entity'=>'asociado','id'=>$id];
        case 'associate_retire':
            $id=(int)($v['id']??0);if(!$id)throw new RuntimeException('El asociado no existe.');$q=$db->prepare('UPDATE associates SET status="retirado" WHERE id=? AND status="activo"');$q->execute([$id]);if(!$q->rowCount())throw new RuntimeException('El asociado ya fue retirado o no existe.');$q=$db->prepare('INSERT INTO associate_events(associate_id,event_type,title,description,created_by) VALUES (? ,"retiro","Asociado retirado","La Superadmin autorizó el retiro del asociado.",?)');$q->execute([$id,$reviewerId]);audit($db,$reviewerId,'asociado',$id,'retirar_aprobado','');return ['entity'=>'asociado','id'=>$id];
        case 'promissory_document_create':
            $id=(int)($v['document_id']??0);$q=$db->prepare('SELECT storage_key FROM promissory_documents WHERE id=? AND status="pendiente"');$q->execute([$id]);$key=$q->fetchColumn();if(!$key||!is_file(private_document_path((string)$key)))throw new RuntimeException('El archivo privado ya no está disponible para revisión.');$q=$db->prepare('UPDATE promissory_documents SET status="custodiado",reviewed_by=?,reviewed_at=NOW() WHERE id=? AND status="pendiente"');$q->execute([$reviewerId,$id]);if(!$q->rowCount())throw new RuntimeException('El documento ya fue atendido o no existe.');audit($db,$reviewerId,'documento_pagare',$id,'custodiar_aprobado',substr(clean($v['label']??''),0,120));return ['entity'=>'documento_pagare','id'=>$id];
        case 'promissory_document_delete':
            $id=(int)($v['document_id']??0);$q=$db->prepare('UPDATE promissory_documents SET status="retirado",reviewed_by=?,reviewed_at=NOW() WHERE id=? AND status="custodiado"');$q->execute([$reviewerId,$id]);if(!$q->rowCount())throw new RuntimeException('El documento ya fue retirado o no existe.');audit($db,$reviewerId,'documento_pagare',$id,'retirar_aprobado',substr(clean($v['label']??''),0,120));return ['entity'=>'documento_pagare','id'=>$id];
        case 'savings_transaction':
            $associate = (int) ($v['associate_id'] ?? 0); $product = (int) ($v['product_id'] ?? 0); $amount = (float) ($v['amount'] ?? 0); $type = clean($v['movement_type'] ?? '');
            if (!$associate || !$product || $amount <= 0 || !in_array($type, ['aporte','retiro'], true)) throw new RuntimeException('Movimiento de ahorro inválido.');
            require_core_product($db, $product, 'ahorro');
            $balance = active_savings_components($db, $associate, true);
            if ($type === 'retiro' && $amount > $balance['vista']) throw new RuntimeException('El retiro supera el saldo disponible a la vista. Los aportes del 70% no están disponibles para retiro inmediato.');
            $id = record_savings_transaction($db,$associate,$product,$type,$amount,clean($v['reference'] ?? ''),$requesterId); audit($db,$reviewerId,'ahorro',$id,'registrar_aprobado',$type); return ['entity'=>'ahorro','id'=>$id];
        case 'credit_application':
            $associate = (int) ($v['associate_id'] ?? 0); $product = (int) ($v['product_id'] ?? 0); $amount = (float) ($v['amount'] ?? 0); $term = (int) ($v['term_months'] ?? 0);
            if (!$associate || !$product || $amount <= 0 || $term < 1 || $term > 60) throw new RuntimeException('Solicitud de crédito inválida.');
            require_core_product($db, $product, 'credito');
            $balance = active_savings_components($db, $associate, true);
            if ($amount > max(0,$balance['aportes']) * 5) throw new RuntimeException('El monto solicitado supera el cupo máximo de cinco veces los aportes.');
            $q = $db->prepare('INSERT INTO credit_applications(associate_id,product_id,requested_amount,requested_term_months,purpose,created_by) VALUES(?,?,?,?,?,?)'); $q->execute([$associate,$product,$amount,$term,substr(clean($v['purpose'] ?? ''),0,255),$requesterId]);
            $id = (int) $db->lastInsertId(); audit($db,$reviewerId,'credito',$id,'solicitar_aprobado','Solicitud'); return ['entity'=>'credito','id'=>$id];
        case 'credit_decision':
            $id=(int)($v['id']??0); $status=clean($v['status']??''); if (!$id || !in_array($status,['aprobada','rechazada'],true)) throw new RuntimeException('Decisión de crédito inválida.');
            $q=$db->prepare('SELECT associate_id,requested_amount,requested_term_months FROM credit_applications WHERE id=? AND status="en_revision"');$q->execute([$id]);$application=$q->fetch();if(!$application)throw new RuntimeException('La solicitud ya fue procesada.');$multiplier=(int)($v['multiplier']??0);$monthly=null;if($status==='aprobada'){if(!in_array($multiplier,[3,4,5],true))throw new RuntimeException('Selecciona el cupo aprobado: 3, 4 o 5 veces los aportes.');$balance=active_savings_components($db,(int)$application['associate_id'],true);$base=max(0,$balance['aportes']);if((float)$application['requested_amount']>$base*$multiplier)throw new RuntimeException('El monto solicitado supera el cupo del multiplicador elegido.');$term=(int)$application['requested_term_months'];$principal=(float)$application['requested_amount'];$monthly=$principal*.02/(1-pow(1.02,-$term));}
            $q=$db->prepare('UPDATE credit_applications SET status=?,reviewed_by=?,reviewed_at=NOW(),decision_note=?,approved_multiplier=?,monthly_installment=? WHERE id=? AND status="en_revision"');$q->execute([$status,$reviewerId,substr(clean($v['note']??''),0,255),$status==='aprobada'?$multiplier:null,$monthly,$id]);if(!$q->rowCount())throw new RuntimeException('La solicitud ya fue procesada.');
            audit($db,$reviewerId,'credito',$id,$status,'Decisión aprobada'); return ['entity'=>'credito','id'=>$id];
        case 'credit_disbursement':
            $id=(int)($v['id']??0);$disbursedOn=clean($v['disbursed_on']??'');$firstDueDate=clean($v['first_due_date']??'');
            if(!$id||!valid_iso_date($disbursedOn)||!valid_iso_date($firstDueDate)||$firstDueDate<=$disbursedOn)throw new RuntimeException('Indica la fecha real del desembolso y una primera cuota posterior.');
            $q=$db->prepare('SELECT requested_amount,requested_term_months,monthly_installment FROM credit_applications WHERE id=? AND status="aprobada" FOR UPDATE');$q->execute([$id]);$credit=$q->fetch();if(!$credit||!$credit['monthly_installment'])throw new RuntimeException('Solo se puede desembolsar un crédito aprobado con cuota calculada.');
            $q=$db->prepare('UPDATE credit_applications SET status="desembolsada",disbursed_on=?,first_due_date=? WHERE id=? AND status="aprobada"');$q->execute([$disbursedOn,$firstDueDate,$id]);if(!$q->rowCount())throw new RuntimeException('El crédito ya fue desembolsado o cambió de estado.');
            create_credit_installments($db,$id,(float)$credit['requested_amount'],(int)$credit['requested_term_months'],(float)$credit['monthly_installment'],$firstDueDate);
            audit($db,$reviewerId,'credito',$id,'desembolsar',$disbursedOn.' · primera cuota '.$firstDueDate);return ['entity'=>'credito','id'=>$id];
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
            $installmentId=(int)($v['credit_installment_id']??0);if($installmentId){$q=$db->prepare('SELECT i.total_amount,i.paid_amount,i.status,c.associate_id FROM credit_installments i JOIN credit_applications c ON c.id=i.credit_application_id WHERE i.id=? AND c.status="desembolsada" FOR UPDATE');$q->execute([$installmentId]);$installment=$q->fetch();if(!$installment||(int)$installment['associate_id']!==$associate||$installment['status']!=='pendiente')throw new RuntimeException('La cuota ya fue pagada o no pertenece a este asociado.');$remaining=round((float)$installment['total_amount']-(float)$installment['paid_amount'],2);if($amount>$remaining)throw new RuntimeException('El pago supera el saldo pendiente de esta cuota.');$paid=round((float)$installment['paid_amount']+$amount,2);$installmentStatus=$paid+0.001>=(float)$installment['total_amount']?'pagada':'pendiente';$q=$db->prepare('UPDATE credit_installments SET paid_amount=?,status=? WHERE id=?');$q->execute([$paid,$installmentStatus,$installmentId]);}
            $q=$db->prepare('INSERT INTO payments(associate_id,credit_installment_id,payment_method_id,concept,amount,reference,received_on,recorded_by) VALUES(?,?,?,?,?,?,?,?)');$q->execute([$associate,$installmentId?:null,(int)($v['payment_method_id']??0)?:null,$concept,$amount,substr(clean($v['reference']??''),0,100),clean($v['received_on']??'')?:date('Y-m-d'),$requesterId]);$id=(int)$db->lastInsertId();audit($db,$reviewerId,'pago',$id,'registrar_aprobado',$concept);return ['entity'=>'pago','id'=>$id];
        case 'payroll_collection_create':
            $company=(int)($v['company_id']??0);$date=clean($v['collection_date']??'');$parsed=DateTimeImmutable::createFromFormat('!Y-m-d',$date);$dateValid=$parsed&&$parsed->format('Y-m-d')===$date;$day=$dateValid?(int)$parsed->format('d'):0;if(!$company||!$dateValid||!in_array($day,[10,20],true))throw new RuntimeException('Selecciona una empresa y un día de cobro 10 o 20.');$q=$db->prepare('SELECT name FROM companies WHERE id=? AND active=1');$q->execute([$company]);$companyName=$q->fetchColumn();if(!$companyName)throw new RuntimeException('La empresa no existe o está inactiva.');$period=substr(clean($v['period_label']??($companyName.' · '.$date)),0,100);$q=$db->prepare('SELECT id FROM payroll_collections WHERE company_id=? AND collection_date=? LIMIT 1');$q->execute([$company,$date]);if($q->fetchColumn())throw new RuntimeException('Ya existe una relación para esta empresa y fecha.');$q=$db->prepare('INSERT INTO payroll_collections(company_id,collection_date,period_label,expected_amount,created_by) VALUES(?,?,?,?,?)');$q->execute([$company,$date,$period,0,$requesterId]);$id=(int)$db->lastInsertId();audit($db,$reviewerId,'cobro_nomina',$id,'crear_aprobado',$period);return ['entity'=>'cobro_nomina','id'=>$id];
        case 'payroll_item_create':
            $collection=(int)($v['payroll_collection_id']??0);$associate=(int)($v['associate_id']??0);$type=clean($v['charge_type']??'');$credit=(int)($v['credit_application_id']??0);$amount=(float)($v['amount']??0);$reference=substr(clean($v['reference']??''),0,190);if(!$collection||!$associate||!in_array($type,['aporte','cuota_credito','convenio'],true)||$amount<=0||!$reference)throw new RuntimeException('Completa asociado, tipo de cobro, concepto y valor.');$q=$db->prepare('SELECT c.company_id,c.status,a.company_id AS associate_company,a.status AS associate_status FROM payroll_collections c JOIN associates a ON a.id=? WHERE c.id=?');$q->execute([$associate,$collection]);$context=$q->fetch();if(!$context||$context['status']!=='borrador')throw new RuntimeException('La relación no existe o ya fue enviada.');if($context['associate_status']!=='activo')throw new RuntimeException('Solo puedes incluir asociados activos.');if((int)$context['company_id']!==(int)$context['associate_company'])throw new RuntimeException('El asociado no pertenece a la empresa de esta relación.');if($type==='cuota_credito'){$q=$db->prepare('SELECT monthly_installment FROM credit_applications WHERE id=? AND associate_id=? AND status IN ("aprobada","desembolsada")');$q->execute([$credit,$associate]);$installment=$q->fetchColumn();if($installment===false||$installment===null)throw new RuntimeException('Selecciona un crédito aprobado que tenga cuota mensual definida.');}else $credit=null;$q=$db->prepare('INSERT INTO payroll_collection_items(payroll_collection_id,associate_id,charge_type,credit_application_id,reference,amount,created_by) VALUES(?,?,?,?,?,?,?)');$q->execute([$collection,$associate,$type,$credit?:null,$reference,$amount,$requesterId]);$id=(int)$db->lastInsertId();$q=$db->prepare('UPDATE payroll_collections SET expected_amount=(SELECT COALESCE(SUM(amount),0) FROM payroll_collection_items WHERE payroll_collection_id=? AND status<>"anulado") WHERE id=?');$q->execute([$collection,$collection]);audit($db,$reviewerId,'cobro_nomina_detalle',$id,'crear_aprobado',$reference);return ['entity'=>'cobro_nomina_detalle','id'=>$id];
        case 'payroll_item_reconcile':
            $id=(int)($v['id']??0);$collected=(float)($v['collected_amount']??-1);if(!$id||$collected<0)throw new RuntimeException('Valor recaudado inválido.');$q=$db->prepare('SELECT i.amount,i.payroll_collection_id,i.status,c.status AS collection_status FROM payroll_collection_items i JOIN payroll_collections c ON c.id=i.payroll_collection_id WHERE i.id=? FOR UPDATE');$q->execute([$id]);$item=$q->fetch();if(!$item||$item['status']==='anulado'||$item['collection_status']!=='recibido')throw new RuntimeException('El recaudo solo se registra después de recibir la relación de la empresa.');if($collected>(float)$item['amount'])throw new RuntimeException('El recaudo no puede superar el valor cobrado.');$status=$collected>=(float)$item['amount']?'recaudado':'pendiente';$q=$db->prepare('UPDATE payroll_collection_items SET collected_amount=?,status=? WHERE id=?');$q->execute([$collected,$status,$id]);$q=$db->prepare('UPDATE payroll_collections SET collected_amount=(SELECT COALESCE(SUM(collected_amount),0) FROM payroll_collection_items WHERE payroll_collection_id=? AND status<>"anulado") WHERE id=?');$q->execute([(int)$item['payroll_collection_id'],(int)$item['payroll_collection_id']]);audit($db,$reviewerId,'cobro_nomina_detalle',$id,'conciliar',number_format($collected,2,'.',''));return ['entity'=>'cobro_nomina_detalle','id'=>$id];
        case 'payroll_item_void':
            $id=(int)($v['id']??0);if(!$id)throw new RuntimeException('Selecciona un concepto de la relación.');$q=$db->prepare('SELECT i.payroll_collection_id,i.status,c.status AS collection_status FROM payroll_collection_items i JOIN payroll_collections c ON c.id=i.payroll_collection_id WHERE i.id=? FOR UPDATE');$q->execute([$id]);$item=$q->fetch();if(!$item||$item['collection_status']!=='borrador'||$item['status']==='anulado')throw new RuntimeException('Solo puedes retirar conceptos activos de una relación en borrador.');$q=$db->prepare('UPDATE payroll_collection_items SET status="anulado" WHERE id=?');$q->execute([$id]);$collection=(int)$item['payroll_collection_id'];$q=$db->prepare('UPDATE payroll_collections SET expected_amount=(SELECT COALESCE(SUM(amount),0) FROM payroll_collection_items WHERE payroll_collection_id=? AND status<>"anulado"),collected_amount=(SELECT COALESCE(SUM(collected_amount),0) FROM payroll_collection_items WHERE payroll_collection_id=? AND status<>"anulado") WHERE id=?');$q->execute([$collection,$collection,$collection]);audit($db,$reviewerId,'cobro_nomina_detalle',$id,'anular','Concepto retirado del borrador');return ['entity'=>'cobro_nomina_detalle','id'=>$id];
        case 'payroll_collection_status':
            $id=(int)($v['id']??0);$status=clean($v['status']??'');if(!$id||!in_array($status,['enviado','recibido','conciliado'],true))throw new RuntimeException('Estado de relación inválido.');$q=$db->prepare('SELECT status FROM payroll_collections WHERE id=? FOR UPDATE');$q->execute([$id]);$current=$q->fetchColumn();$allowed=['borrador'=>'enviado','enviado'=>'recibido','recibido'=>'conciliado'];if(!$current||($allowed[$current]??'')!==$status)throw new RuntimeException('Completa cada etapa en orden antes de continuar.');if($status==='enviado'){$q=$db->prepare('SELECT COUNT(*) FROM payroll_collection_items WHERE payroll_collection_id=? AND status<>"anulado"');$q->execute([$id]);if((int)$q->fetchColumn()===0)throw new RuntimeException('Agrega al menos un concepto antes de enviar la relación.');}if($status==='conciliado'){$q=$db->prepare('SELECT COUNT(*) FROM payroll_collection_items WHERE payroll_collection_id=? AND status<>"anulado" AND collected_amount<amount');$q->execute([$id]);if((int)$q->fetchColumn()>0)throw new RuntimeException('Registra los recaudos pendientes antes de conciliar la relación.');}$q=$db->prepare('UPDATE payroll_collections SET status=? WHERE id=?');$q->execute([$status,$id]);audit($db,$reviewerId,'cobro_nomina',$id,$status,'Cambio de estado');return ['entity'=>'cobro_nomina','id'=>$id];
        case 'promissory_note_create':
            $associate=(int)($v['associate_id']??0);$credit=(int)($v['credit_application_id']??0);$number=substr(clean($v['note_number']??''),0,100);if(!$associate||!$credit||!$number)throw new RuntimeException('Asociado, crédito aprobado y número de pagaré son obligatorios.');$q=$db->prepare('SELECT id FROM credit_applications WHERE id=? AND associate_id=? AND status IN ("aprobada","desembolsada")');$q->execute([$credit,$associate]);if(!$q->fetchColumn())throw new RuntimeException('El crédito no corresponde al asociado o aún no ha sido aprobado.');$q=$db->prepare('INSERT INTO promissory_notes(associate_id,credit_application_id,note_number,status,notes,created_by) VALUES(?,?,?,?,?,?)');$q->execute([$associate,$credit,$number,'borrador',substr(clean($v['notes']??''),0,255),$requesterId]);$id=(int)$db->lastInsertId();audit($db,$reviewerId,'pagare',$id,'crear_aprobado',$number);return ['entity'=>'pagare','id'=>$id];
        case 'receivable_create':
            $associate=(int)($v['associate_id']??0);$amount=(float)($v['amount']??0);$ref=substr(clean($v['reference']??''),0,100);$date=clean($v['due_date']??'');if(!$associate||$amount<=0||!$ref||!$date)throw new RuntimeException('Datos de cartera incompletos.');$q=$db->prepare('INSERT INTO receivables(associate_id,reference,due_date,amount,created_by) VALUES(?,?,?,?,?)');$q->execute([$associate,$ref,$date,$amount,$requesterId]);$id=(int)$db->lastInsertId();audit($db,$reviewerId,'cartera',$id,'crear_aprobado',$ref);return ['entity'=>'cartera','id'=>$id];
        case 'catalog_item_create':
            $category=clean($v['category']??'');$label=substr(clean($v['label']??''),0,190);if($category!=='convenio'||!$label)throw new RuntimeException('Datos del convenio incompletos.');$payload=is_array($v['payload']??null)?$v['payload']:[];$q=$db->prepare('INSERT INTO configuration_catalog(category,label,payload,created_by) VALUES(?,?,?,?)');$q->execute([$category,$label,json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),$requesterId]);$id=(int)$db->lastInsertId();audit($db,$reviewerId,'convenio',$id,'crear_aprobado',$label);return ['entity'=>'convenio','id'=>$id];
        default: throw new RuntimeException('Tipo de cambio no autorizado.');
    }
}
