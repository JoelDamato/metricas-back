# Comisiones netas y dashboards por área

El tablero de comisiones devuelve `cashArs` y `cashUsd` netos. Conserva `grossArs`/`grossCashArs`, `grossCashUsd` y el desglose de IVA, IIBB y cargos del medio de pago. La comisión se calcula sobre la base neta existente: los descuentos no se restan nuevamente del pago del vendedor. Sólo entran comprobantes conciliados según las reglas existentes.

El servidor calcula las filas Comercial, CSM y Marketing; se retiró VSL + RT. Comercial y CSM conservan la base anterior de transacciones MEG del setter al 4%, deduplicadas por comprobante. CSM excluye productos de consultoría en ventas y cobranzas, incluida la venta relacionada. Costos Rentables y MEG permanecen incluidos. Marketing conserva su base de operaciones conciliadas al 5%.

Asignación por email de sesión, sin parámetros de persona elegibles por el cliente:
- Belén Herrera: CSM.
- Walter Alegre: Marketing.
- Leonardo Alaniz: Comercial.

Belén conserva las tarjetas operativas CSM y no ve ranking. Los demás closers mantienen su resumen individual.

Verificación local octubre 2026: cash bruto de comprobantes comisionables $18.382.645,11; neto $15.621.085,10; deducciones $2.761.560,01. Respuestas de las tres cuentas coinciden con las filas del tablero. 51 pruebas de cálculos/permisos y renderizado de los tres dashboards con esas respuestas reales.

Cambios de aplicación en local; sin despliegue ni modificaciones de datos históricos.
