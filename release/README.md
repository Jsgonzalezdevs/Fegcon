# Despliegue de Gestión FEGCON en cPanel

La aplicación usa PHP y MySQL del hosting. No requiere Node.js ni Composer en cPanel. Node.js 22.13 o superior y pnpm solo se necesitan en el equipo que prepara el paquete.

## Preparar el paquete

Desde la raíz del repositorio:

```sh
pnpm install
pnpm run build:static
node scripts/build-cpanel.mjs
```

El paquete queda en `release/`. El script copia la interfaz, la API PHP, `.htaccess`, el instalador y el SQL a las carpetas correspondientes.

## Instalar en el hosting

1. En cPanel, crea una base de datos MySQL vacía y un usuario con todos los permisos sobre esa base. Para iniciar sin registros anteriores, no reutilices una base que ya contenga operación.
2. Importa `release/database/001_core.sql` desde phpMyAdmin.
3. Sube el contenido de `release/public/` a la raíz del subdominio del administrador. Deben quedar juntos `index.html`, `.htaccess`, `setup.php`, la carpeta `assets/` y la carpeta `api/`.
4. Visita la ruta `setup.php`, ingresa las credenciales MySQL y crea la cuenta Superadmin. El instalador guarda la conexión en un archivo privado fuera de `public_html`; no hay que crear `api/config.php`.
5. Guarda la contraseña Superadmin en un gestor seguro y elimina `setup.php` desde el Administrador de archivos de cPanel.
6. Inicia sesión y confirma que asociados, afiliaciones, movimientos, créditos, cartera, pagos, pagarés y cobros estén vacíos. Los productos y las reglas base de FEGCON se inicializan automáticamente al conectar la API.

Una instalación nueva no carga ejemplos. Solo se crean los productos institucionales: aportes (30% a la vista y 70% aportes) y libre inversión (2% mensual sobre saldo pendiente, plazo de 1 a 60 meses).

Los operadores no aplican cambios directamente: cada alta, cambio o decisión operativa que registren queda en espera de aprobación Superadmin. La Superadmin crea las cuentas Operador y aprueba o rechaza esas solicitudes.

## Custodia privada de pagarés

Al cargar el primer escaneo, la API crea `fegcon-private-documents` en la carpeta de la cuenta de hosting, fuera de `public_html`. El usuario de PHP debe poder crear esa carpeta y escribir en ella. Los archivos se aceptan en PDF, JPG o PNG hasta 15 MB y se sirven únicamente tras verificar la sesión interna. El Operador puede proponer una carga o retiro; la Superadmin revisa cada cambio.

## Actualización de una instalación existente

Prepara el mismo paquete y reemplaza los archivos de la raíz del subdominio con el contenido de `release/public/`. Conserva la configuración privada y la base de datos actuales: actualizar el código no borra registros. Si necesitas empezar en cero, crea una base MySQL nueva, importa el SQL y ejecuta el instalador con esa base después de respaldar la configuración anterior. No reutilices la base operativa ni borres tablas sin identificar antes cada registro y su historial.

No subas copias de pagarés, documentos de asociados, contraseñas ni archivos de configuración con secretos al repositorio o al paquete público.
