# Gestión FEGCON

Aplicación interna para gestionar asociados, afiliaciones, aportes, solicitudes de crédito, cartera, pagos, pagarés y relaciones de cobro. La interfaz se sirve como archivos estáticos y las operaciones usan PHP y MySQL del cPanel.

## Datos iniciales

Una instalación nueva no contiene asociados, movimientos, créditos, pagarés, pagos ni cobros de ejemplo. El instalador crea la primera cuenta Superadmin. La API configura únicamente los productos y reglas aprobados por FEGCON: 30% ahorro a la vista, 70% aportes y crédito de libre inversión al 2% mensual sobre saldo pendiente, de 1 a 60 meses. No se crean personas ni saldos ficticios.

Los operadores pueden proponer operaciones; la Superadmin debe aprobarlas para aplicarlas. La Superadmin también configura la tasa de usura de cada mes. Las reglas base del fondo no se pueden modificar desde la interfaz.

## Requisitos locales

- Node.js 22.13 o superior
- pnpm
- PHP y MySQL en el cPanel donde se instala la aplicación

## Compilar para cPanel

```sh
pnpm install
pnpm run build:cpanel
```

El paquete listo para subir queda en `release/`. Para una instalación nueva, crea una base MySQL vacía, importa `release/database/001_core.sql`, sube el contenido de `release/public/` al subdominio y ejecuta `setup.php` una sola vez para crear la cuenta Superadmin. El instalador guarda la conexión en un archivo privado fuera de `public_html`; no crees ni subas `api/config.php`. Elimina `setup.php` al terminar.

Las instrucciones detalladas y el procedimiento de actualización están en [cpanel/README.md](cpanel/README.md). Actualizar los archivos conserva los datos de la base existente; para iniciar en cero, instala en una base vacía nueva. No subas secretos, copias de documentos ni datos de asociados al repositorio.
