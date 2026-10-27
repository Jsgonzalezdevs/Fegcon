# Puesta en marcha de Gestión FEGCON

## Reglas vigentes

Estas reglas quedan definidas por FEGCON en el sistema; el Operador solo las consulta. Las escrituras de operación hechas por el Operador quedan pendientes hasta que la Superadmin las apruebe.

- El ahorro total se distribuye en 30% a la vista, con disponibilidad inmediata, y 70% en aportes que sirven de base para el cupo de crédito.
- Solo existe la línea de libre inversión. Su tasa fija es 2% mensual sobre saldo pendiente y su plazo va de 1 a 60 meses.
- Para libranza se requieren los dos últimos desprendibles y certificación laboral. Para independientes se requiere declaración de renta y uno o dos codeudores según el monto evaluado por la Superadmin.
- El cupo equivale a 3, 4 o 5 veces el 70% de los aportes, según decisión de la Superadmin para cada solicitud.
- La mora se calcula como capital de la cuota × (tasa de usura vigente del período ÷ 100) ÷ 360 × días en mora. La Superadmin registra el porcentaje aplicable a cada mes.
- Los cobros individuales se realizan quincenal o mensualmente por WhatsApp. A las empresas se les remiten cobros por libranza los días 10 y 20, con aportes, cuotas de crédito y convenios cuando aplique.
- FEGCON conserva alrededor de siete documentos por crédito en una carpeta digital por asociado. Los nombres exactos de esos documentos aún no están definidos aquí.

## Usuarios y autorización

- `superadmin`: cuenta única creada en la instalación inicial. Administra la configuración y aprueba o rechaza cambios.
- `operador`: puede consultar y solicitar operaciones; sus altas y decisiones quedan en una bandeja de aprobación.
- La API exige la autorización en el servidor. La restricción no depende solamente de ocultar botones en la interfaz.
- Los cambios de rol y la creación de otros Superadmin están bloqueados desde la gestión ordinaria de usuarios.

## Puesta en marcha

Antes de operar, la Superadmin debe configurar:

1. Datos institucionales y usuarios Operador.
2. Empresas y convenios de nómina.
3. Requisitos documentales de afiliación y flujo de aprobación.
4. Porcentaje de usura vigente para cada período aplicable.
5. Períodos de cobro y medios de pago.
6. Nombres definitivos de los documentos de crédito y plantillas institucionales.

## Reglas de seguridad

- No active un módulo financiero sin un producto o flujo aprobado.
- Proteja la cuenta Superadmin y mantenga sus credenciales fuera del programa.
- Revise la bitácora antes de aprobar, rechazar, desembolsar o anular movimientos.
- Configure copias de seguridad de MySQL desde el panel del proveedor.

## Estado de módulos

- Las solicitudes del Operador se aplican solo después de la aprobación de la Superadmin.
- La aplicación aún no incluye carga y almacenamiento privado de los escaneos de pagarés; solo conserva registros de pagarés.
- El envío automático de WhatsApp y la conciliación detallada de nómina requieren una integración operativa posterior.
