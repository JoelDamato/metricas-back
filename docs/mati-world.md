# Mati World

Ruta interna: `/views/mati-world.html`. No se agrega al menú. La página y `GET /api/metricas/mati-world` exigen sesión con rol `total` y acceso existente a Agendas totales, Comprobantes y CSM. Los usuarios con permisos parciales no reciben datos del mapa. La API rechaza escrituras. La vista SQL sólo es accesible por `service_role`; no se exponen importes, emails, teléfonos, notas de pago ni documentos.

## Fuentes y ubicación

La vista `mati_world_sources` reúne `leads_raw`, la última agenda de `leads_ghl_contacts`, `comprobantes`, `csm`, `csm_followup_profiles` y el responsable de `csm_diagnosticos`. Identidad principal GHL; cuando falta se usa la relación CRM y luego el ID del registro. Múltiples recibos se agrupan; no se deducen identidades por nombre.

Orden de prioridad de ubicación (los estados simultáneos quedan en la ficha):

1. Administración: comprobante sin estado Conciliado o rebotado por estado/bandera. No hay estado separado fiable de «en revisión».
2. Ingreso: contrato u onboarding Pendiente; acceso habilitado con soporte no vigente, o cliente con venta reciente e ingreso por verificar.
3. CSM: fila CSM, Acceso, soporte Activo/Vigente, fecha final posterior al día actual de Buenos Aires, sin En pausa, abandono ni despedida. Coincide con las condiciones de `getSupportStatus`/`hasCurrentSupport` del cuadro CSM.
4. Ventas: comprobante de tipo Venta. Conciliación y acceso son estados independientes.
5. Agendas: última cita comercial sincronizada. No show = ausente; Efectuada/Realizada/showed = realizada; Cancelado/cancelled/canceled/invalid = cancelada. En el intervalo horario sólo se indica «En horario previsto», sin afirmar asistencia. Las sesiones de clientes se excluyen con el clasificador comercial existente y el nombre del calendario.

Agendas de los últimos 30 días y futuras; ventas de los últimos 90 días. Pendientes explícitos de conciliación/contrato, accesos habilitados y soporte vigente se conservan aunque sean anteriores. El mapa es una vista operativa acotada, no el padrón completo.

## Actualización y representación

Consulta automática cada 30 segundos mientras la pestaña está visible; caché del servidor de 20 segundos y una sola consulta concurrente. Se informa la última sincronización efectiva, errores y desconexión. Los datos anteriores permanecen visibles con aviso ante error. No hay actividad simulada ni escritura en fuentes.

SVG original con cinco ambientes, avatares deterministas por ID, búsqueda, filtros, desplazamiento/zoom y ficha lateral. Hasta 18 personajes visibles por zona; el grupo restante abre un directorio paginado. Buscar centra y destaca, incluso si la persona estaba agrupada. Las transiciones responden a cambios reales; se respeta movimiento reducido.

## Limitaciones explícitas

- Sólo está disponible la última agenda sincronizada del contacto; una reprogramación puede reemplazar la anterior. Las agendas sin reloj fiable muestran fecha y «hora sin información».
- «Contrato Realizado» no constituye evidencia de firma digital. No se afirma «firmado».
- No hay responsable administrativo ni fecha fiable de entrada a revisión. Se muestra la creación del comprobante cuando existe, etiquetada como tal, sin estimar espera de revisión.
- Responsable CSM obtenido del diagnóstico; si falta se muestra sin responsable.
- Personas sin ID GHL o relación CRM compartida no pueden vincularse por certeza; no se fusionan por nombre.
- Esta primera versión habilita sólo usuarios con acceso total a las áreas. No amplía permisos de comerciales ni CSM.

## Validación

`node --test test/mati-world.test.js`: identidad, prioridad de pendientes, estados, condiciones CSM, ausencia de inferencias, datos vacíos, transiciones y permisos/API de sólo lectura. La migración es una vista sin cambios en registros de negocio. Verificar además carga real y búsqueda/ficha en navegador después de desplegar.

Verificación publicada (3/11/2026): 463 personas, misma identidad y distribución antes/después de acotar la consulta SQL (de 2.102 filas fuente a 463; carga medida final 1,96 s). API anónima 401 y página sin sesión 302 a login. Mapa real conectado y conteos verificados en navegador. Los registros de prueba existentes en el CRM pueden aparecer si cumplen los criterios; la vista no crea datos de demostración ni clasifica por nombre.

## Sede y oficinas exteriores

El escenario incluye fachada abierta, entrada, escaleras exteriores e interiores y el logo existente de Matías Randazzo. Dos oficinas exteriores representan Dirección (Mati, CEO; Leo, director comercial; Walter, director de marketing) y Scalo (tres puestos de trabajo, computadoras y pantalla de análisis). Son ilustraciones fijas, separadas de los personajes de clientes y sus conteos; no indican presencia real. Los botones Edificio, Dirección y Scalo acercan la cámara a cada ambiente. Verificados visualmente en navegador.
