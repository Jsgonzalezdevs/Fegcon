# Reestructuración de Gestión FEGCON

## Criterios de experiencia

La navegación se organiza por tareas del fondo: personas y empresas, operación financiera y beneficios e información. El inicio es común para ambos perfiles, con pendientes y accesos según permisos. El Centro de control sigue disponible para Superadmin.

Cada módulo dispone de una guía desplegable con propósito, tres pasos y una advertencia contextual. La ayuda permanece disponible sin obligar a completar una inducción. «¿Qué necesitas hacer?» permite buscar acciones con términos cotidianos como préstamo, pago, documento o nómina.

Se usa una superficie clara, texto de mayor tamaño, acentos teal y la identidad previamente existente. El sitio institucional consultado fue https://www.fegcon.com.co/Nosotros, que identifica a FEGCON como Fondo de Empleados del Grupo Constructor del Tolima. Las condiciones financieras implementadas se conservaron del sistema existente; no se sustituyeron por información comercial externa.

## Estructura para mantenimiento

- `app/page.tsx`: sesión, contenedor y navegación.
- `components/fegcon/shared.tsx`: elementos compartidos y catálogo de módulos.
- `lib/permissions.ts`: permisos de consulta y gestión.
- `lib/fegcon-api.ts`: transporte PHP, tiempo máximo de respuesta y lectura JSON.
- `components/fegcon/dashboard.tsx`: inicio. El acceso está separado en `login.tsx`, con estilos en `app/access.css`.
- `components/fegcon/administration.tsx`, `access.tsx`: preparación del fondo, revisión, cuentas, permisos y bitácora.
- `components/fegcon/associates.tsx`: directorio y ficha.
- `components/fegcon/credits.tsx`, `savings.tsx`, `promissory.tsx`, `payroll.tsx`, `companies.tsx`, `records.tsx`: módulos operativos conservando sus contratos PHP.
- `module-guide.tsx`, `field-help.tsx`, `task-finder.tsx`, `associate-select.tsx`: orientación y búsqueda reutilizable.
- `app/workspace.css`: sistema visual compartido. Los estilos heredados de detalles operativos permanecen en `globals.css`.

Los módulos financieros y administrativos se cargan al abrirlos. Un fallo de renderizado muestra recuperación dentro del espacio de trabajo.

## Integridad de los datos

La interfaz sigue usando la API PHP/MySQL de cPanel. No se añadieron registros, saldos, usuarios ni transacciones ficticios a la base operativa. El modo de demostración posterior es independiente y utiliza únicamente el almacenamiento de la pestaña del navegador; véase `MODO-DEMO.md`. Se conservaron CSRF, permisos en servidor, revisión de operaciones y custodia privada.

La ficha solicita el historial del asociado en SQL antes de ordenar los registros. Esto corrige la omisión que ocurría al filtrar en el navegador los últimos cien registros generales. Cada consulta mantiene la autorización de su módulo; la ficha oculta secciones no habilitadas. Un error parcial deja una advertencia en lugar de convertirlo en un cero confirmado.

El directorio consulta el servidor al buscar y contempla nombre completo, documento y empresa. Los selectores de asociados pueden buscar por nombre o documento más allá de las primeras cien personas cargadas. La lista operativa general conserva su límite existente; filtros y CSV indican que operan sobre los registros cargados, no sobre toda la base.

El transporte tiene un máximo de 20 segundos. Nunca reintenta automáticamente escrituras financieras: si se pierde la respuesta, debe revisarse el historial antes de reenviar. CSV protege referencias que podrían interpretarse como fórmulas en una hoja de cálculo.

## Verificación y alcance

Comandos: `npm test`, `npx tsc --noEmit`, `npm run build:cpanel`, `git diff --check`.

`npm test` cubre permisos, CSRF y cuerpo de solicitudes, respuesta de validación del servidor, error JSON, protección CSV y ausencia de reintentos automáticos en operaciones inciertas.

La revisión visual local está disponible ejecutando Vite con `vite.static.config.ts` y abriendo `/qa.html`. Es una galería exclusivamente de desarrollo, señalada como API no conectada. No simula respuestas operativas satisfactorias y no se incluye en `release/`. Sirve para revisar diseño, navegación, guías y errores de consulta sin acceder a producción.

El entorno de trabajo no tiene PHP ni MySQL y no dispone de una sesión operativa abierta. La sintaxis PHP se revisó con un parser; esto no sustituye las pruebas de integración en PHP/MySQL. El paquete se genera para cPanel, pero la publicación en el hosting y las pruebas con datos reales no quedan verificadas por una compilación local.

## Comprobación en cPanel

1. Conservar una copia de seguridad de la base y la configuración privada.
2. Actualizar archivos con el contenido de `release/public/`, siguiendo `cpanel/README.md`.
3. Probar búsqueda de un asociado antiguo y consulta de su historial.
4. Probar una cuenta con permisos de consulta y otra con gestión.
5. Revisar aporte, retiro, crédito, documentos, pagaré, recaudo y nómina en una base de pruebas autorizada.
6. Confirmar aprobación/rechazo y el registro en la bitácora.
7. Revisar el menú móvil, filtros y descargas CSV.

La petición de una mejora del «100%» se interpreta como una transformación completa de la experiencia, no como una métrica demostrada. No se afirma una reducción porcentual de errores o tiempo de aprendizaje sin una comparación con usuarios y tareas medidas.

## Corrección de cargas después de actualizar

Se corrigió una falla por eliminación de archivos de compilaciones previas: una pestaña abierta podía conservar el programa principal anterior y fallar al solicitar una pantalla cargada por demanda. `scripts/build-static.mjs` ahora compila en una carpeta temporal y `publish-static.mjs` combina los assets sin eliminar los antiguos, publica el HTML al final y conserva la API PHP. Se recuperaron los assets de las versiones recientes para las pestañas ya abiertas.

`ModuleBoundary` distingue los errores de carga de módulos de los errores de renderizado. En caso de archivos desactualizados intenta una recarga controlada y retoma el módulo solicitado, sujeto a los permisos de la sesión. La protección contra bucles evita recargas repetidas. No modifica los datos de la demo ni reintenta escrituras financieras. El verificador recorre también las referencias de los módulos separados para detectar archivos ausentes antes de entregar el paquete.
