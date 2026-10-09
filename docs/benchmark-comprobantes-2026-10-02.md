# Medición de carga de comprobantes

Fecha: 2026-10-03T02:44:58.242Z

Pruebas reales desde el backend local: tres repeticiones por escenario, alternando el orden de los proveedores. Archivos PDF sintéticos de 1 MiB, subidos secuencialmente como en la implementación actual. Incluye primera llamada sin calentamiento. No mide navegador → backend, creación/asociación final del comprobante ni sincronización posterior. No se crearon ventas ni cobranzas ni se modificaron saldos.

| Operación | Notion promedio (s) | Supabase promedio (s) | Menos tiempo |
|---|---:|---:|---:|
| Abrir formulario | 3.62 | 0.39 | 89% |
| Buscar cliente y venta | 2.04 | 0.56 | 73% |
| Subir 1 archivo(s) | 1.85 | 1.35 | 27% |
| Subir 3 archivo(s) | 6.58 | 2.64 | 60% |
| Subir 6 archivo(s) | 11.16 | 5.20 | 53% |

Sin errores en las 30 mediciones. Se eliminaron los 30 objetos temporales de Supabase. Los 30 uploads de Notion quedaron sin asociar a páginas; no se crearon comprobantes en Notion.

Muestra pequeña y sujeta a variaciones de red. No constituye un benchmark completo de guardar y ver actualizado en todas las vistas.

Datos crudos: `../tmp/benchmark-comprobantes/results.json`. Script reproducible: `../tmp/benchmark-comprobantes/run.cjs`.
