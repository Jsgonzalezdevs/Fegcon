<?php
declare(strict_types=1);

/** Delete this file from public_html immediately after creating the first account. */
$configPath = dirname($_SERVER['DOCUMENT_ROOT'], 2) . '/.fegcon-admin.php';
$error = '';
if (is_file($configPath)) { http_response_code(404); exit('Not found'); }

function ensure_schema(PDO $pdo): void {
    $exists = $pdo->query("SHOW TABLES LIKE 'internal_users'")->fetchColumn();
    if ($exists) return;
    $schema = <<<'SQL'
CREATE TABLE internal_users (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, full_name VARCHAR(160) NOT NULL, email VARCHAR(190) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL, role ENUM('administrador','afiliaciones','creditos','cartera','tesoreria','consulta') NOT NULL DEFAULT 'consulta', active TINYINT(1) NOT NULL DEFAULT 1, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE companies (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, name VARCHAR(190) NOT NULL UNIQUE, tax_id VARCHAR(50) NULL UNIQUE, contact_name VARCHAR(160) NULL, contact_email VARCHAR(190) NULL, active TINYINT(1) NOT NULL DEFAULT 1, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE associates (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, document_type VARCHAR(10) NOT NULL DEFAULT 'CC', document_number VARCHAR(50) NOT NULL UNIQUE, first_name VARCHAR(100) NOT NULL, last_name VARCHAR(100) NOT NULL, email VARCHAR(190) NULL, phone VARCHAR(50) NULL, address VARCHAR(255) NULL, company_id INT UNSIGNED NULL, job_title VARCHAR(150) NULL, employment_start_date DATE NULL, affiliation_date DATE NULL, status ENUM('activo','retirado','suspendido','pendiente') NOT NULL DEFAULT 'pendiente', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, KEY associates_status_company_idx (status, company_id), CONSTRAINT associates_company_fk FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE associate_events (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, associate_id INT UNSIGNED NOT NULL, event_type VARCHAR(80) NOT NULL, title VARCHAR(190) NOT NULL, description TEXT NULL, occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, created_by INT UNSIGNED NULL, KEY associate_events_associate_date_idx (associate_id, occurred_at), CONSTRAINT associate_events_associate_fk FOREIGN KEY (associate_id) REFERENCES associates(id) ON DELETE CASCADE, CONSTRAINT associate_events_user_fk FOREIGN KEY (created_by) REFERENCES internal_users(id) ON DELETE SET NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE audit_log (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id INT UNSIGNED NOT NULL, entity VARCHAR(80) NOT NULL, entity_id BIGINT UNSIGNED NOT NULL, action VARCHAR(80) NOT NULL, detail VARCHAR(255) NOT NULL DEFAULT '', ip_address VARCHAR(45) NOT NULL DEFAULT '', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY audit_log_entity_idx (entity, entity_id), CONSTRAINT audit_log_user_fk FOREIGN KEY (user_id) REFERENCES internal_users(id) ON DELETE RESTRICT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
SQL;
    foreach (array_filter(array_map('trim', explode(';', $schema))) as $statement) $pdo->exec($statement);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $host = trim((string) ($_POST['db_host'] ?? 'localhost'));
    $name = trim((string) ($_POST['db_name'] ?? ''));
    $user = trim((string) ($_POST['db_user'] ?? ''));
    $password = (string) ($_POST['db_password'] ?? '');
    $fullName = trim((string) ($_POST['full_name'] ?? ''));
    $email = strtolower(trim((string) ($_POST['email'] ?? '')));
    $adminPassword = (string) ($_POST['admin_password'] ?? '');
    if (!$name || !$user || !$fullName || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($adminPassword) < 12) {
        $error = 'Completa los datos y usa una contraseña de al menos 12 caracteres.';
    } else {
        try {
            $pdo = new PDO('mysql:host=' . $host . ';dbname=' . $name . ';charset=utf8mb4', $user, $password, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
            ensure_schema($pdo);
            $check = $pdo->query('SELECT COUNT(*) FROM internal_users')->fetchColumn();
            if ((int) $check > 0) throw new RuntimeException('La base ya tiene usuarios internos.');
            $stmt = $pdo->prepare('INSERT INTO internal_users (full_name, email, password_hash, role) VALUES (?, ?, ?, "administrador")');
            $stmt->execute([$fullName, $email, password_hash($adminPassword, PASSWORD_DEFAULT)]);
            $contents = "<?php\nreturn " . var_export(['db_host' => $host, 'db_name' => $name, 'db_user' => $user, 'db_password' => $password], true) . ";\n";
            if (file_put_contents($configPath, $contents, LOCK_EX) === false) throw new RuntimeException('No fue posible escribir la configuración privada.');
            @chmod($configPath, 0600);
            header('Content-Type: text/html; charset=utf-8');
            exit('<h1>Configuración terminada</h1><p>El administrador fue creado. Elimina <strong>setup.php</strong> desde File Manager antes de iniciar sesión.</p>');
        } catch (Throwable $e) { $error = 'No se pudo completar la configuración. Revisa la base importada y las credenciales.'; }
    }
}
?><!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Configurar FEGCON</title><style>body{font:16px system-ui;margin:40px;max-width:600px;color:#193238}label{display:block;margin-top:14px}input{width:100%;box-sizing:border-box;padding:10px;margin-top:5px}button{margin-top:22px;padding:11px 16px;background:#2f8d9f;color:#fff;border:0;border-radius:6px}.error{color:#a22}</style><h1>Configurar Gestión FEGCON</h1><p>Esta página crea la estructura inicial y el primer administrador. Úsala una sola vez.</p><?php if ($error): ?><p class="error"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></p><?php endif; ?><form method="post"><label>Host MySQL<input name="db_host" value="localhost" required></label><label>Base de datos<input name="db_name" value="fegconco_admin" required></label><label>Usuario MySQL<input name="db_user" value="fegconco_admin" required></label><label>Contraseña MySQL<input type="password" name="db_password" required autocomplete="new-password"></label><hr><label>Nombre del administrador<input name="full_name" required></label><label>Correo del administrador<input type="email" name="email" required></label><label>Contraseña del administrador<input type="password" name="admin_password" minlength="12" required autocomplete="new-password"></label><button>Crear administrador y configurar</button></form></html>
