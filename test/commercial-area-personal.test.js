const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const commissions = require('../modules/metricasv2/services/commissions.service');
const access = require('../modules/auth/access');

test('el área comercial filtra comisiones por la identidad de la sesión', () => {
  const dashboard = {
    month: '2026-09',
    locked: false,
    details: [
      { transactionId: 'a', area: 'Comercial', person: 'Claudio Nicolini', role: 'Closer', category: 'MEG', tipo: 'Venta', commissionAmount: 1000, baseAmount: 10000, cashUsd: 100, facturacionUsd: 200, counters: { agendas: 0 } },
      { transactionId: 'b', area: 'Comercial', person: 'Mauro Gaitan', role: 'Closer', category: 'MEG', tipo: 'Venta', commissionAmount: 9000, baseAmount: 90000, cashUsd: 900, facturacionUsd: 1800, counters: { agendas: 0 } }
    ]
  };
  const result = commissions._test.buildPersonalCommercialArea(dashboard, {
    email: 'meg.claudionicolini@gmail.com', nombre: 'Claudio'
  });

  assert.equal(result.person, 'Claudio Nicolini');
  assert.equal(result.details.length, 1);
  assert.equal(result.details[0].person, 'Claudio Nicolini');
  assert.equal(result.summary.totalCommission, 1000);
  assert.equal(result.summary.cashUsd, 100);
  assert.equal(result.summary.facturacionUsd, 200);
  assert.equal(result.summary.salesCount, 1);
});

test('el área de Nahuel incluye sus ventas Club, su cash y su facturación personal', () => {
  const dashboard = {
    month: '2026-09',
    locked: false,
    details: [
      { transactionId: 'club-1', area: 'Comercial', person: 'Nahuel Iasci', role: 'Setter', category: 'Club', tipo: 'Venta', commissionAmount: 12000, baseAmount: 30000, cashUsd: 40, facturacionUsd: 40, counters: { agendas: 0 } },
      { transactionId: 'meg-1', area: 'Comercial', person: 'Nahuel Iasci', role: 'Setter', category: 'MEG', tipo: 'Cobranza', commissionAmount: 4500, baseAmount: 100000, cashUsd: 100, facturacionUsd: 500, counters: { agendas: 2 } },
      { transactionId: 'team-1', area: 'Comercial', person: 'Claudio Nicolini', role: 'Closer', category: 'MEG', tipo: 'Venta', commissionAmount: 8000, baseAmount: 100000, cashUsd: 100, facturacionUsd: 200, counters: { agendas: 0 } }
    ]
  };

  const result = commissions._test.buildPersonalCommercialArea(dashboard, {
    email: 'iascinahuel@gmail.com',
    nombre: 'Nahuel Iasci'
  });

  assert.equal(result.summary.totalCommission, 16500);
  assert.equal(result.summary.cashUsd, 140);
  assert.equal(result.summary.facturacionUsd, 40);
  assert.equal(result.summary.salesCount, 1);
  assert.equal(result.summary.clubSales, 1);
  assert.equal(result.details.some((detail) => detail.category === 'Club'), true);
});

test('la evolución Club de Nahuel usa los mismos comprobantes comisionables por acreditación', () => {
  const rows = [
    { id: 'club-ene', tipo: 'Venta', producto_format: 'Club', responsable_venta: 'Nahuel Iasci', f_acreditacion: '2026-01-10', verificacion_comisiones: 'OK', cash_ar: 10000 },
    { id: 'club-sep', tipo: 'Venta', producto_format: 'Club', setter: 'Nahuel', responsable_venta: 'Patricia Conti', f_acreditacion: '2026-09-03', verificacion_comisiones: 'OK', cash_ar: 10000 },
    { id: 'club-sep', tipo: 'Venta', producto_format: 'Club', setter: 'Nahuel', responsable_venta: 'Patricia Conti', f_acreditacion: '2026-09-03', verificacion_comisiones: 'OK', cash_ar: 10000 },
    { id: 'club-error', tipo: 'Venta', producto_format: 'Club', responsable_venta: 'Nahuel Iasci', f_acreditacion: '2026-09-04', verificacion_comisiones: 'ERROR', cash_ar: 10000 },
    { id: 'team-club', tipo: 'Venta', producto_format: 'Club', responsable_venta: 'Claudio Nicolini', f_acreditacion: '2026-09-05', verificacion_comisiones: 'OK', cash_ar: 10000 }
  ];

  const series = commissions._test.buildPersonalClubMonthly(rows, {
    email: 'iascinahuel@gmail.com',
    nombre: 'Nahuel Iasci'
  }, 2026, true);

  assert.equal(series[0].sales, 1);
  assert.equal(series[8].sales, 1);
  assert.equal(series.reduce((sum, item) => sum + item.sales, 0), 2);
});

test('closers restringidos acceden al panel personal pero no al tablero general de comisiones', () => {
  const user = { role: 'comercial', email: 'meg.claudionicolini@gmail.com' };
  assert.equal(access.canAccessPageForUser(user, 'area-comercial.html'), true);
  assert.equal(access.canAccessFeatureForUser(user, 'commercial_area', { method: 'GET' }), true);
  assert.equal(access.canAccessPageForUser(user, 'comisiones.html'), false);
});

test('el dashboard enlaza el área personal sin modificar la Central de Métricas', () => {
  const root = path.resolve(__dirname, '..');
  const metricas = fs.readFileSync(path.join(root, 'public/metricas-v2/metricas.html'), 'utf8');
  const dashboard = fs.readFileSync(path.join(root, 'public/metricas-v2/js/views/dashboard.page.js'), 'utf8');
  const csmPage = fs.readFileSync(path.join(root, 'public/metricas-v2/js/views/csm.page.js'), 'utf8');
  assert.doesNotMatch(metricas, /Área Comercial/);
  assert.doesNotMatch(metricas, /\/views\/area-comercial\.html/);
  assert.match(dashboard, /\/views\/area-comercial\.html/);
  assert.match(csmPage, /\/views\/csm-cuadro\.html/);
  assert.doesNotMatch(metricas, /<h3>Por Situación<\/h3>/);
});

test('el área personal desglosa cada comprobante y reconcilia su comisión', () => {
  const root = path.resolve(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'public/metricas-v2/views/area-comercial.html'), 'utf8');
  const script = fs.readFileSync(path.join(root, 'public/metricas-v2/js/views/area-comercial.page.js'), 'utf8');

  assert.match(html, /Comisión por comprobante/);
  assert.match(script, /Comprobantes comisionables/);
  assert.match(script, /Base total comisionable/);
  assert.match(script, /commissionPct/);
  assert.match(script, /commissionAmount/);
  assert.match(script, /Medio de pago/);
  assert.match(script, /Descuentos aplicados/);
  assert.match(script, /IVA:/);
  assert.match(script, /IIBB:/);
  assert.match(script, /Comisión \$\{row\.paymentMethod\}/);
  assert.doesNotMatch(script, /<th>Rol<\/th>/);
  assert.match(script, /Total de \$\{escapeHtml\(String\(summaryData\.transactionCount/);
  assert.doesNotMatch(script, /person=/);
});

test('el detalle Club separa IVA, IIBB y comisión Acredi antes de la base neta', () => {
  const breakdown = commissions._test.computeClubNetBreakdown(121000);
  assert.equal(breakdown.grossArs, 121000);
  assert.equal(breakdown.ivaArs, 21000);
  assert.ok(Math.abs(breakdown.iibbArs - 3500) < 0.001);
  assert.ok(Math.abs(breakdown.paymentFeesArs - 6290) < 0.001);
  assert.ok(Math.abs(breakdown.externalCommissionsArs - 9790) < 0.001);
  assert.ok(Math.abs(breakdown.netArs - 90210) < 0.001);
});

test('el panel personal muestra netos por comprobante sin duplicar descuentos ni descontar de nuevo la comisión', () => {
  const sale = { transactionId: 'sale-net', person: 'Claudio Nicolini', area: 'Comercial', role: 'Closer', tipo: 'Venta', category: 'MEG', tc: 1000, grossArs: 121000, cashArs: 121000, cashUsd: 121, facturacionUsd: 500, ivaArs: 21000, iibbArs: 3500, paymentFeesArs: 6290, totalDeductionsArs: 30790, netTotalArs: 90210, baseAmount: 90210, commissionAmount: 9021, counters: {} };
  const collection = { ...sale, transactionId: 'collection-net', tipo: 'Cobranza', facturacionUsd: 0, grossArs: 100000, cashArs: 100000, cashUsd: 100, ivaArs: 0, iibbArs: 0, paymentFeesArs: 9000, totalDeductionsArs: 9000, netTotalArs: 91000, baseAmount: 91000, commissionAmount: 9100 };
  const dashboard = { month: '2026-10', details: [sale, collection, { ...sale, role: 'Setter', commissionAmount: 1000 }] };
  const result = commissions._test.buildPersonalCommercialArea(dashboard, {email: 'meg.claudionicolini@gmail.com'});
  assert.ok(Math.abs(result.summary.cashUsd - 181.21) < 0.000001);
  assert.equal(result.summary.cashArs, 181210);
  assert.equal(result.summary.totalDeductionsArs, 39790);
  assert.equal(result.summary.facturacionUsd, 469.21);
  assert.equal(result.summary.totalCommission, 19121);
  assert.equal(result.details[0].grossCashUsd, 121);
  assert.equal(result.details[0].grossCashArs, 121000);
  assert.equal(sale.cashUsd, 121, 'no modifica los datos brutos compartidos con administración');
});

test('un neto cero no recupera el bruto y cada comprobante usa su propio tipo de cambio', () => {
  const details = [
    { transactionId: 'zero', person: 'Claudio Nicolini', tipo: 'Venta', tc: 1000, grossArs: 100000, cashUsd: 100, facturacionUsd: 100, totalDeductionsArs: 100000, netTotalArs: 0 },
    { transactionId: 'other-tc', person: 'Claudio Nicolini', tipo: 'Venta', tc: 2000, grossArs: 100000, cashUsd: 50, facturacionUsd: 50, totalDeductionsArs: 10000, netTotalArs: 90000 }
  ];
  const result = commissions._test.buildPersonalCommercialArea({details}, {email: 'meg.claudionicolini@gmail.com'});
  assert.equal(result.summary.cashUsd, 45);
  assert.equal(result.summary.cashArs, 90000);
  assert.equal(result.summary.facturacionUsd, 45);
});
