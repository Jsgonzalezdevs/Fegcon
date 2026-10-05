<?php
declare(strict_types=1);

/** Delete this file from public_html immediately after creating the first account. */
$configPath = dirname($_SERVER['DOCUMENT_ROOT'], 2) . '/.fegcon-admin.php';
$error = '';
if (is_file($configPath)) { http_response_code(404); exit('Not found'); }

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
?><!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Configurar FEGCON</title><style>body{font:16px system-ui;margin:40px;max-width:600px;color:#193238}label{display:block;margin-top:14px}input{width:100%;box-sizing:border-box;padding:10px;margin-top:5px}button{margin-top:22px;padding:11px 16px;background:#2f8d9f;color:#fff;border:0;border-radius:6px}.error{color:#a22}</style><h1>Configurar Gestión FEGCON</h1><p>Importa primero la estructura SQL en phpMyAdmin. Esta página debe usarse una sola vez.</p><?php if ($error): ?><p class="error"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></p><?php endif; ?><form method="post"><label>Host MySQL<input name="db_host" value="localhost" required></label><label>Base de datos<input name="db_name" value="fegconco_admin" required></label><label>Usuario MySQL<input name="db_user" value="fegconco_admin" required></label><label>Contraseña MySQL<input type="password" name="db_password" required autocomplete="new-password"></label><hr><label>Nombre del administrador<input name="full_name" required></label><label>Correo del administrador<input type="email" name="email" required></label><label>Contraseña del administrador<input type="password" name="admin_password" minlength="12" required autocomplete="new-password"></label><button>Crear administrador y configurar</button></form></html>
