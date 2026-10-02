const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeConfig, _test: { buildTransactionDetails } } = require('../modules/metricasv2/services/commissions.service');

function sale(id, overrides = {}) {
  return {
    id, tipo: 'Venta', producto_format: 'Club del Costo',
    responsable_venta: 'Patricia Conti', setter: 'Nahuel Iasci',
    f_venta: `2026-10-${String(Number(id.match(/^club-(\d+)$/)?.[1] || 0) + 1).padStart(2, '0')}`, f_acreditacion: '2026-10-01',
    cash_ar: 100000, cash_collected_ar: 100000,
    cash_collected_ars: 100000, medios_de_pago: 'Transferencia',
    ...overrides
  };
}

function calculate(rows) {
  return buildTransactionDetails({
    monthKey: '2026-10',
    // Las configuraciones históricas no deben reemplazar la regla individual.
    config: normalizeConfig({ setterClubScale: [{ min: 1, pct: 0.4 }] }),
    comprobantesRows: rows, settersRows: [], agendaRows: []
  });
}

for (const count of [1, 5, 6, 10, 11, 15, 16, 20]) {
  test(`Nahuel: ${count} ventas conservan su porcentaje individual y transferencias al 40%`, () => {
    const rows = Array.from({ length: count }, (_, i) => sale(`club-${i}`, {
      medios_de_pago: i % 2 ? 'Mercado Pago' : 'Transferencia'
    }));
    const details = calculate([...rows].reverse()).filter((row) => row.person === 'Nahuel Iasci');
    assert.equal(details.length, count);
    for (const detail of details) {
      const position = Number(detail.transactionId.split('-')[1]) + 1;
      const tierPct = position <= 5 ? .5 : position <= 10 ? .55 : position <= 15 ? .6 : .65;
      const expectedPct = detail.paymentMethod === 'Transferencia' ? .4 : tierPct;
      assert.equal(detail.commissionPct, expectedPct);
      assert.equal(detail.commissionAmount, detail.baseAmount * expectedPct);
      assert.equal(detail.counters.clubSalesSequential, position);
    }
  });
}

test('El tramo excluye otros meses, personas, productos, cobranzas y operaciones con error', () => {
  const details = calculate([
    ...Array.from({ length: 5 }, (_, i) => sale(`club-${i}`, { medios_de_pago: 'Mercado Pago' })),
    sale('otro-mes', { f_acreditacion: '2026-09-30' }),
    sale('otra-persona', { setter: 'Otro setter' }),
    sale('otro-producto', { producto_format: 'Meg 2.1' }),
    sale('cobranza', { tipo: 'Cobranza' }),
    sale('error', { verificacion_comisiones: 'Error' })
  ]).filter((row) => row.person === 'Nahuel Iasci' && row.category === 'Club');
  assert.equal(details.length, 5);
  assert.ok(details.every((row) => row.commissionPct === .5));
});

test('Combina las ventas como responsable y setter y evita pagar dos veces a Nahuel por alias', () => {
  const rows = Array.from({ length: 6 }, (_, i) => sale(`club-${i}`, i < 3
    ? { responsable_venta: 'Nahuel', setter: 'Nahuel Iasci' }
    : {}));
  const details = calculate(rows);
  const nahuel = details.filter((row) => ['Nahuel', 'Nahuel Iasci'].includes(row.person));
  assert.equal(nahuel.length, 6);
  assert.ok(nahuel.every((row) => row.commissionPct === .4));
  assert.deepEqual(nahuel.map((row) => row.counters.clubSalesSequential), [1, 2, 3, 4, 5, 6]);
  const patricia = details.filter((row) => row.person === 'Patricia Conti');
  assert.equal(patricia.length, 3);
  assert.ok(patricia.every((row) => row.commissionPct === .4));
});

test('Cinco transferencias elevan la venta Mercado Pago al 55% como setter y responsable', () => {
  for (const asCloser of [false, true]) {
    const rows = Array.from({ length: 6 }, (_, i) => sale(`club-${i}`, {
      ...(asCloser ? { responsable_venta: 'Nahuel Iasci', setter: '' } : {}),
      medios_de_pago: i === 5 ? 'Mercado Pago' : 'Transferencia'
    }));
    const details = calculate([...rows].reverse()).filter((row) => row.person === 'Nahuel Iasci');
    assert.equal(details.length, 6);
    assert.equal(details.find((row) => row.transactionId === 'club-5').commissionPct, .55);
    const transfers = details.filter((row) => row.paymentMethod === 'Transferencia');
    assert.equal(transfers.length, 5);
    assert.ok(transfers.every((row) => row.commissionPct === .4));
    assert.ok(transfers.every((row) => row.commissionAmount === row.baseAmount * .4));
  }
});


test('Las ventas posteriores no aumentan la comisión de las primeras: 16 ventas MP mantienen todos los tramos', () => {
  const rows = Array.from({ length: 16 }, (_, i) => sale(`club-${i}`, { medios_de_pago: 'Mercado Pago' }));
  const before = calculate(rows.slice(0, 5)).filter((row) => row.person === 'Nahuel Iasci');
  const after = calculate([...rows].reverse()).filter((row) => row.person === 'Nahuel Iasci');
  for (const detail of before) {
    const current = after.find((row) => row.transactionId === detail.transactionId);
    assert.equal(current.commissionPct, .5);
    assert.equal(current.commissionAmount, detail.commissionAmount);
  }
  const percentages = rows.map((sale) => after.find((detail) => detail.transactionId === sale.id).commissionPct);
  assert.deepEqual(percentages, [.5, .5, .5, .5, .5, .55, .55, .55, .55, .55, .6, .6, .6, .6, .6, .65]);
});
