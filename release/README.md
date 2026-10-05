# Despliegue sin coste adicional en cPanel

Este paquete usa MySQL y PHP del hosting. No requiere Node.js, Composer ni servicios externos.

1. Ejecute `npm run build:static` en el proyecto local.
2. Suba el contenido de `release/public/` a `public_html/admin.fegcon.com.co/`.
3. Suba la carpeta `cpanel/api/` al mismo directorio como `api/`, y suba `.htaccess`.
4. En phpMyAdmin, seleccione `fegconco_admin` e importe `cpanel/database/001_core.sql`.
5. Suba `cpanel/setup.php` temporalmente a la raíz del subdominio. Visite `https://admin.fegcon.com.co/setup.php`, introduzca las credenciales de MySQL y cree el primer administrador.
6. Elimine `setup.php` inmediatamente desde File Manager.

Nunca suba ni deje dentro de `public_html` el archivo `.fegcon-admin.php`: el instalador lo crea dos niveles por encima del directorio público. Guarde la contraseña de MySQL y del administrador en un gestor de contraseñas.

La primera entrega habilita inicio de sesión, roles, creación y consulta de asociados, auditoría y la base para extender créditos, ahorros, pagos y documentos.
