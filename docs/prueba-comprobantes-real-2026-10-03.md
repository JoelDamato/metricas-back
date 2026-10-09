# Prueba real de comprobantes — 3 de octubre de 2026

Resultado: aprobado. Aplicación local en localhost:3101 conectada al Supabase compartido. Se usó un cliente sintético TEST y un PDF que declara que no representa un pago. Ningún cliente real fue modificado.

La prueba navegó las pantallas reales, sin simular respuestas API: carga, revisión financiera, confirmación con progreso NDJSON, Conciliación y Mis comprobantes. Se usaron sesiones firmadas por el servicio de autenticación de la aplicación para usuarios activos con permisos de closer y administración; no se probó el ingreso de contraseña.

Identificador de prueba: `TEST-E2E-1791039832655`.
Comprobante eliminado al finalizar: `50da7176-7cda-40d5-9a69-410f86f68e7d`.

| Paso | Cobrado USD | Saldo USD | Comisión ARS |
| --- | ---: | ---: | ---: |
| Venta pendiente | 0 | 1.000 | 0 |
| Rebotado con motivo | 0 | 1.000 | 0 |
| Corrección y reenvío | 0 | 1.000 | 0 |
| Conciliado | 150 | 850 | 9.207,22 |
| Rebote posterior | 0 | 1.000 | 0 |

El closer vio el motivo en su listado y editor, cambió el importe de 121.000 a 150.000 ARS y usó “Guardar y reenviar a conciliación”. Se verificó HTTP 403 al intentar conciliar desde la sesión del closer.

En la conciliación del pago corregido se verificaron 26.033,06 ARS de IVA y 8.876,66 ARS de costo de MP-LINK. La base neta de 115.090,28 ARS produjo una comisión del 8%: 9.207,2224 ARS, mostrada redondeada a 9.207,22. La comprobación usó la respuesta del endpoint real del dashboard de comisiones, filtrada al GHL ID exclusivo del TEST.

Estado del contacto incluyó el comprobante y mostró saldo de 850 USD. El rebote posterior revirtió cobro y comisión. No hubo errores JavaScript en el recorrido completo.

Limpieza confirmada: comprobante eliminado, saldo y cobro en cero antes de quitar el cliente sintético, cliente eliminado, adjunto eliminado y sin trabajos de limpieza pendientes para ese archivo. Se conserva la auditoría y la clave de operación para trazabilidad e idempotencia. Los intentos previos de la automatización también eliminaron sus comprobantes y clientes TEST.

Esta prueba habilita el visto bueno funcional del circuito de carga directa, rebote, corrección y conciliación. No es un despliegue: la aplicación publicada y sus webhooks no se actualizaron en esta tarea.
