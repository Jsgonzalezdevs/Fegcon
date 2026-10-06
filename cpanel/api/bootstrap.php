<?php
declare(strict_types=1);

/** Shared hosting API bootstrap. Compatible with PHP 7.4+. */
const FEGCON_ROLES = ['administrador', 'afiliaciones', 'creditos', 'cartera', 'tesoreria', 'consulta'];

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
    $pdo->exec("CREATE TABLE IF NOT EXISTS financial_products (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, product_type ENUM('ahorro','credito') NOT NULL, name VARCHAR(150) NOT NULL, code VARCHAR(40) NOT NULL, parameters_json LONGTEXT NOT NULL, active TINYINT(1) NOT NULL DEFAULT 1, created_by INT UNSIGNED NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY product_type_code (product_type, code)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("CREATE TABLE IF NOT EXISTS savings_transactions (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, associate_id INT UNSIGNED NOT NULL, product_id INT UNSIGNED NOT NULL, movement_type ENUM('aporte','retiro') NOT NULL, amount DECIMAL(14,2) NOT NULL, status ENUM('pendiente','aplicado','anulado') NOT NULL DEFAULT 'aplicado', reference VARCHAR(100) NULL, recorded_by INT UNSIGNED NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (associate_id) REFERENCES associates(id), FOREIGN KEY (product_id) REFERENCES financial_products(id), FOREIGN KEY (recorded_by) REFERENCES internal_users(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("CREATE TABLE IF NOT EXISTS credit_applications (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, associate_id INT UNSIGNED NOT NULL, product_id INT UNSIGNED NOT NULL, requested_amount DECIMAL(14,2) NOT NULL, requested_term_months INT UNSIGNED NOT NULL, purpose VARCHAR(255) NULL, status ENUM('borrador','en_revision','aprobada','rechazada','desembolsada') NOT NULL DEFAULT 'en_revision', created_by INT UNSIGNED NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (associate_id) REFERENCES associates(id), FOREIGN KEY (product_id) REFERENCES financial_products(id), FOREIGN KEY (created_by) REFERENCES internal_users(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
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
