const test = require('node:test'), assert = require('node:assert/strict');
const {classify} = require('../modules/csm/debtors');
test('listas de CSM: deudores, morosos y negociación sin duplicar', () => {
  const r = (o) => ({ghlid: o.n, nombre: o.n, productos_adquiridos: 'Meg 2.1', ...o});
  const out = classify([
    r({n: 'a', estado_pago: 'Deudor', fecha_final: '2026-11-10'}),
    r({n: 'b', estado_pago: 'Apurar'}),
    r({n: 'c', fecha_final: '2026-11-20'}),
    r({n: 'd', fecha_final: '2026-11-20', fecha_final_renovacion: '2026-11-01'}),
    r({n: 'e', fecha_final: '2027-05-01'}),
    r({n: 'f', fecha_final: '2026-11-01', abandono: 'Si'}),
    r({n: 'g', fecha_final: '2026-10-25'})
  ], '2026-11-05');
  assert.deepEqual(out.deudores.map(x => x.nombre), ['a']);
  assert.deepEqual(out.morosos.map(x => x.nombre), ['b']);
  assert.deepEqual(out.negociacion.map(x => x.nombre), ['g', 'c']);
});
