# ARCA: tipo de factura y selección para no facturar

Ventas Club muestra una columna Tipo. Para facturas autorizadas usa el tipo emitido por ARCA; antes de emitir muestra el tipo previsto por la lógica existente, con “Por confirmar” cuando faltan datos fiscales. La previsualización sigue validando la condición antes de emitir.

Desde Conciliadas se pueden seleccionar registros y moverlos a No facturar. Desde esa pestaña pueden volver a Conciliadas. Se conserva el registro, sus datos fiscales y la conciliación original. Las pestañas siguen el mes seleccionado. Esta selección no modifica comprobantes, saldos ni comisiones.

La RPC `set_mp_billing_selection` bloquea cada fila y aplica toda la selección en una transacción. Solo Administración puede usar la ruta. No permite mover facturas emitidas, emisiones en curso o respuestas pendientes de recuperar de ARCA. Los registros excluidos no se pueden reclamar para emitir ni reactivar mediante una conciliación desactualizada.

Validación con PostgreSQL local: exclusión/restauración, rollback de lotes con conflicto, protección de CAE e intentos inciertos, permisos y compatibilidad con la conciliación existente. No se emiten comprobantes fiscales durante las pruebas.
