# Gestión FEGCON

Aplicación interna para gestionar asociados, afiliaciones, aportes, solicitudes de crédito, cartera, pagos, pagarés y relaciones de cobro. La interfaz se sirve como archivos estáticos y las operaciones usan PHP y MySQL del cPanel.

## Datos iniciales

Una instalación nueva no contiene asociados, movimientos, créditos, pagarés, pagos ni cobros de ejemplo. El instalador crea la primera cuenta Superadmin. La API configura únicamente los productos y reglas aprobados por FEGCON: 30% ahorro a la vista, 70% aportes y crédito de libre inversión al 2% mensual sobre saldo pendiente, de 1 a 60 meses. No se crean personas ni saldos ficticios.

Los operadores pueden proponer operaciones; la Superadmin debe aprobarlas para aplicarlas. La Superadmin también configura la tasa de usura de cada mes. Las reglas base del fondo no se pueden modificar desde la interfaz.

## Requisitos locales

- Node.js 22.13 o superior
- pnpm

## Compilar para cPanel

```sh
pnpm install
pnpm run build:static
node scripts/build-cpanel.mjs
```

El paquete completo queda en `release/`. Sube el contenido de `release/public/` a la raíz del subdominio de administración. Importa `release/database/001_core.sql` en la base de datos del cPanel, configura `api/config.php` según las instrucciones del hosting y ejecuta `setup.php` una vez para crear la cuenta Superadmin. Elimina `setup.php` después de la instalación.

Las instrucciones detalladas están en [cpanel/README.md](cpanel/README.md). No subas secretos, copias de documentos ni datos de asociados al repositorio.
