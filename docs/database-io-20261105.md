# Revisión de Disk I/O — 5 de noviembre de 2026

## Evidencia

La base respondió durante la auditoría y no había consultas activas bloqueadas en la primera muestra.
Los contadores de `pg_stat_database` son acumulados desde diciembre de 2025: no permiten atribuir
todo el consumo al aviso de anoche. Los mayores consumidores de archivos temporales entre las
consultas retenidas incluyen Marketing, agendas y Mati World. También hay consultas del propio
panel de Supabase y escrituras de la sincronización de GHL.

La instancia expone aproximadamente 411 MiB de RAM total; en las muestras había 154–168 MiB
disponibles. No se aumentó `work_mem` globalmente: cada operación concurrente lo multiplica.
El porcentaje del presupuesto de burst requiere revisar el panel de infraestructura (MFA).

## Cambios aplicados

- Marketing: las CTE transportan únicamente columnas utilizadas y excluyen antes los leads sin
  origen, que ya eran excluidos por las etapas posteriores. En la consulta de octubre medida:
  337 ms → 89 ms; bloques temporales escritos y leídos: 2810 → 0 (8192 bytes por bloque).
- Mati World: no materializa tres veces una fuente amplia de leads; los contactos GHL se buscan
  por los IDs de las personas necesarias. Bloques temporales escritos: 3745 → 2500 (~33% menos);
  leídos: 4980 → 2490 (50% menos). Los tiempos variaron entre 5,4 y 6,3 s: sigue siendo una vista
  costosa y no se afirma una mejora estable de latencia.
- La migración compara ambos conjuntos completos con `EXCEPT ALL` en los dos sentidos antes
  de reemplazar cada vista; cualquier diferencia revierte la transacción. No cambia filas de negocio.
- Los reportes de agendas y Marketing comparten lecturas concurrentes idénticas, tienen caché
  de 15 segundos (máximo 64 resultados) y un límite global de tres consultas simultáneas por
  proceso. La clave incluye recurso, filtros, selección, orden y paginación. Cada consumidor recibe
  una copia; los errores no se guardan. Comprobantes y escrituras no utilizan esta caché.
- Agendas por Closer deja de solicitar dos veces el mismo informe cuando el closer es Todos.

## Validación

Comparación completa sin diferencias: 8694 filas de Marketing y 460 personas de Mati World.
Webinar octubre mantiene 34 agendas, 9 ventas y USD 21450 de facturación.
Pruebas de concurrencia, caché, errores, vencimiento, aislamiento de resultados y filtros de agendas.

## Seguimiento

`node scripts/audit_database_io.cjs > /tmp/database-io.json` obtiene una muestra de solo lectura.
Comparar dos muestras para medir crecimiento de `temp_bytes` y de los contadores por `queryid`;
no resetear las estadísticas. Revisar también el presupuesto diario y su tendencia en Supabase.
El script no instala tareas programadas ni envía mensajes.

Estas optimizaciones reducen trabajo innecesario, pero no garantizan que un pico futuro nunca
agote el burst. Si la tendencia sigue excediendo la capacidad tras desplegar, evaluar con el dueño
un aumento de compute; no se cambiaron planes ni facturación.
