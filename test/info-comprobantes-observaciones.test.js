const test = require('node:test');
const assert = require('node:assert/strict');
const info = require('../modules/metricasv2/services/info-comprobantes');

const RAW = '[SUPABASE DIRECT] k1 | Carga ID: k1 | Cargado por: Carlos Tu | Responsable venta: Carlos Tu | Precio Club 1: ARS 39500 | Hoy o mañana están los cheques | Meses de soporte: 6 | Adjuntos: a.jpeg\nTEST_METADATA={"mode":"supabase_direct"}';

test('extrae sólo el texto que escribió el closer', () => {
  assert.equal(info.extractObservaciones(RAW), 'Hoy o mañana están los cheques');
  assert.equal(info.extractObservaciones('[SUPABASE DIRECT] k | Carga ID: k | Cargado por: X | Responsable venta: X | Adjuntos: a.pdf'), '');
  assert.equal(info.extractObservaciones(''), '');
});

test('reemplaza las observaciones sin perder los datos de auditoría', () => {
  assert.equal(
    info.mergeObservaciones(RAW, 'Nuevo'),
    'Carga ID: k1 | Cargado por: Carlos Tu | Responsable venta: Carlos Tu | Precio Club 1: ARS 39500 | Nuevo | Meses de soporte: 6 | Adjuntos: a.jpeg'
  );
});

test('tope de 150 caracteres para lo nuevo, sin romper lo ya cargado', () => {
  assert.equal(info.validateObservaciones('x'.repeat(150)).length, 150);
  assert.throws(() => info.validateObservaciones('x'.repeat(151)), (error) => error.statusCode === 400);
  const viejo = 'y'.repeat(400);
  assert.equal(info.validateObservaciones(viejo, viejo), viejo);
  assert.throws(() => info.validateObservaciones(viejo + 'z', viejo), (error) => error.statusCode === 400);
});
