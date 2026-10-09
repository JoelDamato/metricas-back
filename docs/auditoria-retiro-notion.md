# Auditoría para retirar Notion

Fecha de corte de la auditoría: 18 de septiembre de 2026.

## Estado del laboratorio local al 21 de septiembre de 2026

Se preparó una primera implementación Supabase-first sin modificar producción:

- El flujo actual Notion → webhook → Supabase sigue siendo el predeterminado.
- No se aplicó ninguna migración, no se hizo deploy y no se escribieron comprobantes de prueba en producción.
- El laboratorio de configuración está restringido por correo exactamente a Mati y Nadia. Las escrituras requieren dos flags y el reemplazo de la pantalla principal exige un tercer flag de corte; los tres están apagados por defecto.
- La simulación usa el contacto real de `leads_raw`, los catálogos auditados y las mismas fórmulas de IVA incluido, comisión incluida y neto Club.
- Venta, cobranzas, devoluciones y cheques múltiples se modelan como un lote atómico con relación real a la venta.
- Cada comprobante nuevo queda preparado con FK a `leads_raw`, al producto, al medio de pago, al responsable comercial, al lote y a su venta madre.
- Los archivos se preparan para un bucket privado, con nombre seguro, tamaño, MIME, hash SHA-256 y rollback ante fallos confirmados.
- La idempotencia persiste por `submission_key`; un reintento completado no vuelve a subir archivos ni duplica filas.
- Si la respuesta de Supabase se corta después del commit, el backend consulta el estado del lote antes de decidir si puede limpiar archivos.
- La configuración privada permite crear, editar, activar y desactivar productos, medios de pago y responsables; también ajustar precios Club, IVA, comisión del medio, saldo inicial y reglas globales que actualmente dependen de Notion.
- El configurador permite exportar un respaldo e importar en bloque el catálogo completo en JSON antes de guardar; muestra explícitamente el avance contra los 51 medios auditados.
- La configuración inicial local ya contiene las 51 filas del catálogo: 17 activas, 31 históricas con nombre y 3 históricas inactivas sin título, conservadas mediante una etiqueta técnica y su ID original de Notion.
- La tabla privada permite buscar y filtrar por activos, históricos o filas sin nombre original para revisar el catálogo completo antes del corte.
- El configurador muestra un preflight de nueve controles. Aunque se activen los tres flags, el backend rechaza una carga antes de subir archivos o insertar filas mientras falte cualquier control: migración, catálogo de 51 medios, catálogos activos, regla CSM, control ARCA, adjuntos históricos, reconciliación histórica, cola de Storage vacía y observación de 48–72 horas.
- Las bajas de catálogos son lógicas: un elemento usado históricamente queda inactivo para nuevas cargas, pero no se elimina ni rompe comprobantes anteriores.
- Los porcentajes comerciales de closer/setter siguen en el panel de comisiones existente; la tasa editable del medio de pago es un concepto distinto y queda en este configurador.
- La misma API que hoy usa la pantalla principal ya puede derivar localmente a Supabase para bootstrap, búsqueda de cliente/venta, alta, edición, baja y conciliación, sin cambiar la interfaz del vendedor.
- El corte sólo se activa cuando coinciden `COMPROBANTES_SUPABASE_DIRECT_ENABLED`, `COMPROBANTES_SUPABASE_DIRECT_WRITES_ENABLED` y `COMPROBANTES_SUPABASE_DIRECT_CUTOVER_ENABLED`; habilitar una o dos no alcanza.
- La edición recalcula IVA, comisión, snapshots netos y el cash acumulado de la venta. La baja bloquea ventas con movimientos relacionados, audita el snapshot completo y limpia metadatos/objetos del Storage.
- Si una baja confirma la eliminación en la base pero Storage falla, cada objeto queda en una cola privada y persistente de limpieza para poder reintentarlo sin dejar el fallo sólo en memoria.
- Mati y Nadia pueden consultar y reintentar esa cola desde la configuración privada; el botón permanece bloqueado mientras los seguros de escritura estén apagados.
- La conciliación directa actualiza Conciliado, No conciliado y Rebotado dentro de una transacción y registra auditoría; ya no necesita una escritura previa en Notion cuando el corte está activo.
- Los adjuntos directos se sirven mediante URLs privadas firmadas y con control de visibilidad por usuario.
- Los campos operativos `mesesSoporte`, sesiones y bonus se conservan en columnas explícitas; la fecha de renovación se calcula por meses calendario y queda probada incluso para fin de mes.
- Ventas, cobranzas, devoluciones y cuotas posteriores de cheques conservan el comportamiento histórico de quedar finalizadas automáticamente; la venta principal además queda relacionada consigo misma.
- Un cliente que sólo aparece en CSM puede resolverse sin Notion siempre que `csm.crm_2_0` apunte a su fila canónica de `leads_raw` y ambos compartan GHL ID.
- La semántica de cash quedó separada: `cash_collected_neto` es el KPI bruto menos IVA que consumen los tableros; `cash_neto_*_snapshot` es el resultado financiero después de IVA y comisión del medio. El total neto de una venta suma el neto individual de cada pago, no aplica la tasa de la venta a todo el lote.

### Validación local aislada

La migración preparada se aplicó únicamente sobre PostgreSQL efímero en memoria mediante PGlite. El validador usa el servicio Node real y las funciones PL/pgSQL reales, con las variables de Supabase y Notion neutralizadas; no inicia el servidor de producción ni abre conexiones externas.

Casos verificados localmente:

- Venta en tres cheques: una venta y dos cobranzas relacionadas, con tres archivos.
- Reintento de la misma carga: cero filas y cero archivos duplicados.
- Cobranza posterior: actualización inicial del total cobrado de la venta de USD 3.000 a USD 4.000 y recálculo a USD 3.500 después de editar la cobranza.
- Venta Club: precio configurable, actualización local de ARS 39.500 a ARS 42.000 y paridad de la fórmula de neto Club.
- Devolución: relación obligatoria con una venta del mismo cliente y sin alterar el cash cobrado acumulado.
- Fallo parcial: rollback completo de lote y filas.
- Cliente/GHL cruzado y actor no autorizado: rechazo antes de persistir.
- Configuración: alta de producto, medio y responsable; actualización de tasas, saldo inicial y precio Club; desactivación de responsable sin borrado físico.
- Responsable: cada alta guarda ID estable y snapshot del nombre; se rechazan responsables inexistentes, inactivos o cuyo ID no coincide con el nombre.
- Seguridad: RLS activo en las tablas nuevas y RPC sin permiso para `anon`/`authenticated`.
- Archivos: metadatos, hash y almacenamiento simulado, con seis archivos asociados a seis operaciones.
- Edición directa, bloqueo de edición conciliada, cambio a Rebotado, baja con limpieza de Storage y bloqueo de una venta con cobranzas relacionadas.
- Persistencia del reintento cuando la baja ya fue confirmada pero la limpieza del archivo falla.
- Bootstrap, búsqueda de cliente/venta, URLs firmadas y carga de un usuario operativo normal (Nahuel), no sólo del administrador del laboratorio.
- Cash con medios mixtos: suma del neto de IVA de cada pago y recálculo correcto después de cambiar importe/medio.

El comando local es `node scripts/validate_comprobantes_direct_local.js`. La última ejecución finalizó con cinco filas y cinco archivos después de probar también una baja real dentro de la base efímera; todas las aserciones aprobaron y hubo cero conexiones a producción. Esto valida el diseño y la migración local; no habilita todavía el corte productivo ni sustituye la comparación histórica y la observación de 48–72 horas exigidas más abajo.

La interfaz se validó además con `node scripts/validate_comprobantes_config_ui_local.js` en Chrome headless, cargando el HTML sin servidor y con `fetch` simulado. Se verificaron altas de producto, medio y responsable, desactivación de responsable, edición/adición de precios Club y bloqueo de Guardar en modo simulación, sin errores de página y con cero conexiones a producción.

La columna histórica `Estado CC` no es una fórmula en la base de comprobantes: es texto cargado por un flujo anterior y las altas recientes ya llegan vacías. No se inventó una regla dentro del laboratorio. Las métricas actuales de CCE/CCNE ya cuentan con reglas explícitas basadas en `leads_raw`; el reemplazo definitivo de ese snapshot histórico debe resolverse en una vista o regla canónica antes del corte.

### Brechas que siguen abiertas antes del corte

El configurador, la pantalla principal, la edición, la baja, los estados de conciliación y los adjuntos nuevos ya están implementados detrás del corte apagado. Todavía faltan estas piezas para autorizar el reemplazo productivo:

- Comparar y aprobar la regla exacta que dispara creación/actualización CSM. La relación canónica y los datos están listos, pero no se inventó cuándo crear una fila CSM.
- Definir el reemplazo de los controles históricos de facturación ARCA que todavía se operan como automatizaciones o botones de Notion. La finalización automática de las altas, la conciliación, el rebote y la rectificación por estado ya no dependen de Notion en el flujo nuevo.
- Revisar y aprobar los 51 medios de pago ya incorporados localmente, especialmente las tres filas históricas que en Notion no tienen título.
- Migrar/verificar los 1.166 archivos históricos; los adjuntos nuevos y sus URLs firmadas ya están resueltos.
- Reconciliar el histórico completo y ejecutar una observación controlada de 48–72 horas antes del corte.

Estas brechas ya no pueden omitirse por accidente: se registran como validaciones explícitas dentro de la configuración y forman parte de un bloqueo de servidor, no sólo de una advertencia visual. En el estado local actual el preflight permanece correctamente bloqueado.

## Conclusión ejecutiva

Es posible retirar Notion, y para la carga de comprobantes es una mejora recomendable. No conviene hacerlo como un corte único sin transición: hoy Notion cumple funciones de base operativa, motor de fórmulas, catálogo, almacenamiento de archivos, relación entre ventas y cobranzas e interfaz manual para CSM/CRM.

La estrategia segura es que Supabase pase a ser la fuente de verdad por etapas, manteniendo compatibilidad con las vistas y servicios actuales. El objetivo final sí puede ser eliminar por completo el token, los webhooks y las bases de Notion, pero el corte debe ocurrir después de reproducir y validar cada responsabilidad.

## Estado verificado

- Notion tiene 1.107 comprobantes activos.
- Supabase tiene exactamente los mismos 1.107 IDs: al momento de la auditoría no hay filas faltantes ni sobrantes.
- Los 1.107 registros de Notion contienen archivos; hay 1.166 archivos en total.
- Supabase solo conserva actualmente el nombre del archivo, no el archivo ni una URL propia permanente.
- La base `comprobantes` de Supabase tiene 94 columnas, pero solo una clave primaria. No tiene claves foráneas ni restricciones de negocio.
- `comprobantes`, `leads_raw`, `csm` y `metricas_usuarios` tienen RLS desactivado.
- Hay 13 vistas operativas dependientes de `comprobantes`, `leads_raw` o `csm`.
- El flujo de comprobantes todavía envía datos a Google Sheets. CSM incluso procesa Sheets antes de Supabase.
- Los últimos 30 días muestran sincronización activa y exitosa, aunque hubo errores anteriores de columnas inexistentes en CRM/CSM y cinco errores recientes de Google Sheets para comprobantes.

La igualdad de 1.107 filas es una buena base para migrar, pero no resuelve el problema de los archivos ni garantiza paridad de todos los valores derivados.

## Qué hace Notion actualmente

### Comprobantes

La base tiene 130 propiedades:

- 79 fórmulas.
- 5 relaciones.
- 1 rollup.
- 47 propiedades de entrada o control, incluyendo botones.

El flujo de alta actual es:

1. El backend consulta en Notion el esquema, productos, medios de pago y usuarios.
2. Valida que el cliente tenga una página de Notion válida.
3. Busca la venta relacionada en Supabase y, si hace falta, vuelve a Notion.
4. Crea las páginas de Notion una por una.
5. Sube los archivos a Notion uno por uno.
6. Vincula venta y cobranzas en Notion.
7. Un webhook de Notion copia los datos y resultados de fórmulas a Supabase.
8. Otro proceso intenta enviarlos a Google Sheets.

Editar, eliminar y conciliar también actualizan primero Notion. La idempotencia se guarda dentro del texto `Info Comprobantes` como `Carga ID`, y además existe una caché temporal en memoria. Eso no alcanza para garantizar idempotencia entre reinicios o múltiples instancias del servidor.

### Catálogos

Notion es la fuente de productos y medios de pago:

- Se relevaron 15 productos, incluido Club con dos precios configurados.
- Se relevaron 51 registros de medios de pago, activos e históricos.
- Los medios guardan tipo, tasa de IVA, comisión, cuenta y saldo inicial.
- Algunas tasas importantes, como IVA 21% o comisión 6,29%, provienen de ese catálogo.

Los valores históricos no deben depender de que una tasa futura cambie. En Supabase cada transacción debe guardar una copia de las tasas aplicadas al momento de la carga.

### CRM actual

La base CRM tiene 127 propiedades:

- 44 fórmulas.
- 81 campos operativos o manuales.
- 2 relaciones.

Mezcla información que proviene de GHL, datos manuales y totales derivados de comprobantes/CSM. Para retirar Notion, GHL debe alimentar directamente una tabla canónica de contactos en Supabase, sin usar una página de Notion como identidad del cliente.

### CSM

La base CSM tiene 155 propiedades:

- 75 fórmulas.
- 77 campos operativos o manuales.
- 2 relaciones.

Los campos manuales incluyen fechas reales de sesiones, módulos, onboarding, diagnóstico, cashflow, EERR, costos, NPS, abandono, renovación y seguimiento. Quitar Notion exige conservar una interfaz donde CSM pueda editar estos eventos y no solo copiar los datos existentes.

### CRM histórico

La base histórica tiene 325 propiedades, de las cuales 240 son fórmulas. Todavía participa como respaldo en cálculos de fecha de venta, pagos, productos y CSM. No es necesario recrear sus 240 fórmulas si primero se materializan los resultados históricos realmente usados y se eliminan los fallbacks del código.

## Fórmulas que deben reemplazarse

### Cálculos por comprobante

Estos deben vivir en Supabase o en funciones SQL testeadas:

- `cash_ars = cash_usd × tipo_de_cambio`.
- IVA incluido: `cash_ars × tasa_iva / (1 + tasa_iva)`.
- Comisión incluida del medio: `cash_ars × tasa_comision / (1 + tasa_comision)`.
- `cash_neto_ars = cash_ars − iva_ars − comision_medio_ars`.
- `facturacion_ars = facturacion_usd × tipo_de_cambio`.
- Neto Club: `(cash_ars / 1,21) − (base × 0,0629) − (base × 0,035)`.
- Fecha correspondiente: fecha de respaldo o fecha de creación.
- Fecha de acreditación: fecha informada o fecha correspondiente.

Hoy existe un trigger de Supabase para cash neto de IVA, pero no reemplaza todo: recibe el IVA ya calculado por Notion y no descuenta la comisión del medio de pago. Debe unificarse una sola definición de “cash neto” para evitar diferencias entre dashboard, ranking y comisiones.

### Cálculos relacionales

Estos deben ser vistas SQL o consultas agregadas:

- Total cobrado de una venta a partir de sus cobranzas.
- Saldo de una venta.
- Última fecha de pago.
- Última venta y último producto del cliente.
- Facturación y cash total del cliente.
- Incobrable a más de 60 días.
- Productos adquiridos.
- Métricas por responsable, setter, origen, producto y período.

### Datos del cliente

No deben copiarse permanentemente a cada comprobante salvo que se quiera un snapshot explícito. Nombre, teléfono, mail, setter, origen actual y primer origen deben obtenerse por `ghlid` desde el contacto canónico. Esto también elimina el problema actual de que `primer_origen` está vacío en los 1.107 comprobantes y `origen_actual` falta en 984, aunque el servicio de comisiones los complete en memoria usando `leads_raw`.

### Presentación

Formatos de fecha, nombres de período, textos decorados, links y estados visuales no deben almacenarse como columnas. Deben calcularse en vistas o en la interfaz.

### Reglas ya existentes fuera de Notion

Gran parte de la lógica de comisiones ya vive en `commissions.service.js`: responsables, reglas de Club, bases netas, escalas, setter, VSL/APSET/RT y enriquecimiento de orígenes. Esa lógica debe conservarse y cubrirse con casos de paridad, no duplicarse en SQL y Node sin una definición única.

## Problemas que no conviene copiar literalmente

- La fórmula CSM `Activos` devuelve 1 cuando la fecha final ya pasó; el nombre y el comportamiento parecen contradictorios.
- Algunas fórmulas tienen comentarios que no coinciden con lo que calculan, por ejemplo la comisión del medio usa la misma estructura de “IVA incluido”.
- `F.venta` tiene múltiples fallbacks hacia CSM y CRM histórico. Hay que materializar una fecha definitiva y registrar su procedencia.
- Fórmulas con `now()` o `today()` cambian sin editar la fila. Deben transformarse en vistas dinámicas o jobs, no en datos congelados.
- Las tasas del catálogo de Notion recalculan el pasado si se modifican. El nuevo modelo debe guardar tasas y montos aplicados como snapshot auditable.

## Arquitectura recomendada

### Primera etapa: evolucionar sin romper consumidores

Conviene mantener inicialmente la tabla `comprobantes` porque 13 vistas y varios servicios ya dependen de ella. Sobre esa tabla se deben agregar:

- `submission_key` único y obligatorio.
- `batch_id` para una carga múltiple.
- Identificador interno generado por Supabase y `legacy_notion_id` para trazabilidad.
- `cliente_ghlid` o referencia al contacto canónico.
- `venta_id` con clave foránea real.
- `producto_id` y `medio_pago_id` con claves foráneas.
- Tasas snapshot: IVA, comisión del medio y cualquier descuento aplicado.
- Montos calculados snapshot: IVA, comisión, cash bruto y cash neto en ARS/USD.
- `created_by_user_id` y `responsible_user_id` vinculados a usuarios internos.
- Estado de conciliación con restricción de valores.
- `deleted_at`, en vez de depender del archivado de Notion.

Tablas nuevas:

- `productos`.
- `medios_pago`.
- `comprobante_archivos`.
- `comprobante_eventos` para auditoría de altas, ediciones, conciliaciones y bajas.
- `contactos` canónica o una evolución controlada de `leads_raw`.
- Una estructura CSM de clientes y eventos/sesiones, evitando 30 columnas de fecha rígidas cuando corresponda.

### Escritura directa

La API debe realizar la carga como una operación idempotente y transaccional:

1. Validar usuario, cliente, producto, medio y montos desde Supabase.
2. Reservar `submission_key` con restricción única.
3. Crear venta y cobranzas dentro de una transacción SQL.
4. Guardar relaciones con claves foráneas.
5. Subir archivos a un bucket privado de Supabase Storage.
6. Registrar metadatos, tamaño, MIME y hash de cada archivo.
7. Confirmar la carga y devolver los registros ya disponibles para leer.

Los archivos deben servirse con URLs firmadas y permisos por rol. El navegador no debe escribir con una service role.

### Índices mínimos

- `comprobantes(ghlid)`.
- `comprobantes(f_acreditacion)`.
- `comprobantes(f_venta)`.
- `comprobantes(responsable_venta, f_venta)`.
- `comprobantes(venta_id)`.
- Índice único sobre `submission_key`.
- Índices parciales para filas no eliminadas y estados pendientes de conciliación.
- Índices en todas las claves foráneas.

## Plan de migración

### Fase 0 — respaldo y contrato de números

- Exportar todas las bases y esquemas de Notion.
- Congelar una lista de fórmulas y reglas usadas realmente.
- Definir el significado único de cash bruto, cash sin IVA, cash neto y comisión.
- Crear una batería de casos dorados por producto, medio, venta, cobranza, cheque, Club y devolución.

### Fase 1 — fundamento Supabase

- Crear catálogos, constraints, claves foráneas, índices y auditoría.
- Agregar idempotencia persistente.
- Implementar cálculos financieros con tasas snapshot.
- Mantener las columnas actuales para no romper vistas.

### Fase 2 — archivos

- Crear bucket privado.
- Copiar los 1.166 archivos de Notion.
- Guardar hash y metadatos.
- Verificar que cada comprobante con archivo en Notion tenga el mismo número de archivos válidos en Storage.

### Fase 3 — comprobantes Supabase-first

- Reemplazar alta, edición, baja y conciliación para operar primero en Supabase.
- Reemplazar productos, medios y responsables de Notion por catálogos internos.
- Validar cargas simples, múltiples y cheques consecutivos.
- Mantener por 48–72 horas una escritura espejo o un comparador contra Notion, sin usar Notion como respuesta principal.

### Fase 4 — corte de comprobantes

- Desactivar webhook de comprobantes y escritura a Sheets.
- Dejar Notion solo lectura durante el período de observación.
- Comparar totales diarios y mensuales, comisiones y conciliación.

### Fase 5 — CRM y CSM

- Enviar GHL directamente a contactos Supabase.
- Crear formularios internos para los 77 campos manuales de CSM que sigan vigentes.
- Reemplazar las 75 fórmulas CSM por vistas/reglas explícitas.
- Materializar los pocos valores históricos necesarios del CRM anterior.
- Retirar los webhooks CRM/CSM y los scripts de resincronización.

### Fase 6 — retiro definitivo

- Ejecutar reconciliación final.
- Revocar token de Notion y quitar variables de entorno.
- Eliminar dependencia del SDK y mapas de personas de Notion.
- Conservar exportación inmutable y logs de migración.

## Criterios de aceptación

No debe cortarse Notion hasta cumplir todos estos puntos:

- 1.107 de 1.107 filas históricas conciliadas por ID o clave de migración.
- 1.166 de 1.166 archivos copiados, legibles y asociados correctamente.
- Totales por mes, persona, producto, medio de pago y estado iguales dentro de tolerancia definida.
- Mismas comisiones para casos representativos y para el histórico completo.
- Ventas, cobranzas, devoluciones y cheques múltiples probados de punta a punta.
- Reintentar la misma carga no genera duplicados, incluso después de reiniciar el servidor.
- Edición, eliminación y conciliación actualizan inmediatamente todas las vistas.
- Acreditaciones futuras siguen apareciendo en el período correcto.
- Roles y permisos impiden que un usuario vea o modifique comprobantes ajenos.
- RLS habilitado o acceso externo completamente bloqueado, manteniendo las escrituras únicamente a través del backend.
- Job de reconciliación y alertas para cualquier diferencia.

## Complejidad y estimación

Estimación para una persona, incluyendo pruebas y observación:

- Retirar Notion solo del circuito de comprobantes: 4 a 6 días hábiles.
- Retirar las dependencias de Notion usadas por esta aplicación, incluyendo CRM y CSM vigentes: 10 a 15 días hábiles.
- Reemplazar además todos los flujos manuales, botones y comportamientos del CRM histórico: 15 a 25 días hábiles, después de decidir cuáles siguen teniendo valor.

El mayor riesgo no es programar el `insert` en Supabase; es mantener exactamente los números, las relaciones, los adjuntos, la edición operativa de CSM y los permisos durante el cambio.

## Recomendación final

Avanzar, comenzando por comprobantes. Es el área donde Notion añade más latencia y fragilidad, mientras Supabase ya contiene el espejo completo y las pantallas ya lo consumen. No apagar Notion todavía: primero hay que implementar Storage, catálogos, idempotencia persistente, relaciones y paridad de fórmulas. Después de 48–72 horas de comparación limpia, se puede cortar el circuito de comprobantes y continuar con CRM/CSM.
