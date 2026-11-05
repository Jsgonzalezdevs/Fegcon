# Demostración local de FEGCON

## Entrada y recorrido

- Usuario: `demo`.
- Contraseña: `demo`.
- Salida: menú de la cuenta → **Cerrar sesión**.
- Reinicio: **Restablecer demo** en el aviso superior.

Los ejemplos incluyen siete asociados activos y uno pendiente, tres empresas, aportes, una afiliación por revisar, créditos en distintos estados, cuotas, recaudos, obligaciones, pagarés, una relación de nómina y un convenio. Los nombres contienen «Demo», los documentos empiezan por `DEMO-` y los correos usan dominios reservados de ejemplo.

Se puede buscar, consultar y registrar datos ficticios. Los aportes y retiros cambian los saldos de la demo; los pagos pueden aplicarse a cuotas; las afiliaciones aprobadas crean asociados de ejemplo. Un crédito nuevo requiere sus soportes simulados antes de aprobarse y genera cuotas al simular el desembolso. Las decisiones y cambios aparecen en la bitácora local.

Las cuentas creadas desde la demo son ejemplos visuales; no permiten iniciar sesión real. La entrada pública de demostración sigue siendo `demo / demo`.

## Aislamiento

`lib/fegcon-api.ts` detecta únicamente el acceso demo o una sesión demo activa y carga el simulador `lib/demo/api.ts`. En ese modo, todas las llamadas pasan por el simulador; una ruta no implementada devuelve un error local, nunca una llamada al servidor real.

El simulador utiliza solo estas claves de `sessionStorage`:

- `fegcon.demo.active.v1`
- `fegcon.demo.data.v1`

No se insertan cuentas de demostración en PHP/MySQL ni se modifican sus permisos o mecanismos de autenticación. El cierre de sesión demo elimina únicamente sus claves y no llama al cierre de sesión PHP. Un indicador en memoria evita volver accidentalmente al transporte real si se borra el almacenamiento durante una sesión demo abierta.

Los archivos seleccionados en una carga de prueba no se envían al servidor ni se guardan: solo se conserva su nombre, tipo y tamaño como referencia local. Abrir un soporte muestra una explicación de la simulación. No deben seleccionarse documentos reales. Los CSV exportados llevan `DEMO` en el nombre y corresponden exclusivamente a los ejemplos cargados.

## Diseño del acceso

El logo es el archivo original de FEGCON. El nuevo acceso usa composición adaptable, campos con respuesta al foco, control de visibilidad de contraseña, estados de carga y error, transiciones suaves. Respeta `prefers-reduced-motion` y mantiene controles nativos etiquetados para teclado y lectores de pantalla.

El acceso está separado en `components/fegcon/login.tsx` y sus estilos en `app/access.css`. El acceso a las cuentas reales conserva el contrato PHP existente. Cuando ese servicio no está disponible, la pantalla permite explorar la demo igualmente.

## Verificación

`npm test` incluye pruebas de acceso, datos de todos los módulos, saldos, retiros inválidos, pagos sobre cuotas, soportes simulados, aprobación y desembolso de crédito, aprobación de afiliación, aplicación única de solicitudes, restablecimiento, cierre de sesión y ausencia de llamadas de red desde la demo, incluso después de borrar su indicador en el almacenamiento.

La revisión en navegador se realiza sobre la aplicación principal, no sobre la galería de estados vacíos. El paquete de cPanel debe compilarse con `npm run build:cpanel` y verificarse con `node scripts/verify-release.mjs`. Las operaciones reales siguen requiriendo una instalación PHP/MySQL para su validación de integración.
