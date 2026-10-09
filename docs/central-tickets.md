# Central de tickets

Acceso: `/views/tickets.html`, card grande del Dashboard y enlace del menú lateral. Todos los usuarios autenticados pueden crear y consultar tickets e imágenes. Solo el rol `total` puede actualizar estados o reintentar envíos a Notion.

## Notion de Scalo

Configurar `NOTION_TICKETS_API_KEY` únicamente en el entorno del servidor. Es independiente de las credenciales de otras integraciones. La configuración local está en `.env`, ignorado por Git; para producción se debe cargar como secreto del servicio.

La integración utiliza la base Tareas `2f55fdea-62e7-814d-9299-c60f8e1bbecf`, relacionada con Clientes. Alcance fijo del servidor: Matías Randazzo (`2f55fdea-62e7-80e0-8d49-c955ba4822cd`) y Accelerator (`30e5fdea-62e7-80d8-8ffd-fc00f52ed0e7`). Se consulta tanto la relación de cliente como los slugs históricos, se pagina hasta completar y se excluyen las tareas Finalizadas. Si la relación apunta a otro cliente, prevalece sobre un slug desactualizado. La API de detalle y edición valida el cliente y la base antes de operar.

Se muestran estados reales (Pendiente, Bloqueando, En progreso, Revisar), responsables, área, prioridad, vencimiento y descripción. El detalle carga el texto e imágenes de los bloques directos de la página bajo demanda. Los bloques anidados no se reproducen. El selector de cliente está siempre visible (Matías Randazzo o Acelerator). Cada lista se ordena por prioridad: urgente/crítica, alta, media, baja y sin prioridad; a igual prioridad, primero la actualización más reciente. La prioridad se muestra sin abrir el detalle. Hay búsqueda, filtros por área/estado y carga de 30 resultados por vez. Al abrir un ticket se preselecciona el cliente de la lista actual. Caché de lectura de 60 segundos; Actualizar fuerza una consulta. Al finalizar una tarea desaparece del listado.

Al crear un ticket se eligen cliente y área. El servidor conserva el ticket local, sube la imagen a Notion y crea la tarea con asunto, descripción, solicitante y referencia estable. Si falla, se muestra el envío pendiente y el administrador puede reintentarlo. La referencia se busca antes de crear para reconciliar respuestas inciertas. No hay reintentos automáticos en segundo plano. Los cambios de estado de tareas Notion se guardan directamente en Notion.

## Almacenamiento compartido

Por defecto, tickets e imágenes originales se guardan en Supabase (`support_tickets`), con RLS y acceso exclusivo del servidor. La función `support_tickets_mutate` aplica cambios en una transacción y rechaza versiones desactualizadas; el servidor reintenta los conflictos. Esto conserva la cola entre despliegues y permite múltiples instancias.

`TICKETS_DATA_DIR` queda disponible para instalaciones con almacenamiento de archivos persistente y pruebas. No se migran históricos automáticamente.

Pruebas: `node --test test/tickets*.test.js`.
