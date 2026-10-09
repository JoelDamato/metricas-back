# Marketing: VSL + rt y detalle de agendas

El filtro VSL + rt exige las dos condiciones: origen actual RT y primer origen VSL. Reconoce los nombres históricos `Postulación MEG - RT` y `Postulación MEG - VSL - …`, espacios y enlaces codificados. No completa primer origen faltante con otros campos.

Se aplica a agendas, aplicables, reuniones, anuncios, calidad, trazabilidad y a las consultas de ventas, cash y AOV mediante el lead vinculado por GHL ID. La cohorte combinada se calcula desde leads porque la vista diaria solo agrupa por origen actual. Las inversiones conservan su criterio existente: entradas registradas para el filtro seleccionado; no se asigna toda la inversión VSL o RT a esta subcohorte.

El detalle aparece arriba y corresponde a los registros con fecha de agenda en el rango y origen actual válido que cuenta el KPI existente, sin alterar su criterio por el estado Agendó. Se conserva una fila por registro de la base y se incluye su ID para detectar posibles duplicados al validar. La tabla muestra 50 filas y permite ampliar; el CSV UTF-8 descarga todas, con GHL ID/link, datos de contacto, fecha, estado, ambos orígenes, closer, setter y campos de campaña. Incluye también los filtros usados. Protege celdas que podrían interpretarse como fórmulas.

Los cambios de fecha/origen actualizan el panel. Las respuestas de consultas anteriores no pueden reemplazar la selección más reciente ni su archivo descargable.

## Carga y diseño (9 de octubre)
El panel obtiene el resumen completo mediante `GET /api/metricas/marketing/dashboard`.
Las consultas iguales comparten promesas únicamente dentro de esa solicitud; no se
cachean los importes entre usuarios o actualizaciones. `marketing/origins` usa la
función SQL `marketing_origin_options`, restringida a service_role, y conserva sólo
el catálogo de orígenes durante 60 segundos. Los filtros y la exportación usan la
misma respuesta; una respuesta anterior no puede reemplazar un filtro más reciente.
