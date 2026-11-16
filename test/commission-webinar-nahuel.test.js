const test = require('node:test');
const assert = require('node:assert/strict');
const service = require('../modules/metricasv2/services/commissions.service');
const { validateConfig } = require('../modules/metricasv2/services/commission-config-validation');
const config = service.normalizeConfig({ global: { includeOnlyVerified: false, webinarNahuelRandazzoPct: .025 } });
const base = { tipo: 'Venta', estado: 'Conciliado', f_acreditacion: '2026-11-02', cash_ar: 100000, tc: 1000, producto_format: 'MEG', origen_actual: 'Webinar' };
const run = (rows, rules = config) => service._test.buildWebinarNahuelSummary({ monthKey: '2026-11', config: rules, comprobantesRows: rows });
test('Nahuel Randazzo cobra sobre todo el CC webinar una vez, sin depender de setters ni excluir Club', () => {
  const sale = { ...base, id: 'sale', webinarSetters: ['Brenda', 'Valentina'] };
  const summary = run([sale, sale, { ...base, id: 'no-setter' }, { ...base, id: 'club', producto_format: 'Club' },
    { ...base, id: 'setter', origen_actual: 'VSL', webinarSetters: ['Nahuel Iasci'] },
    { ...base, id: 'other', origen_actual: 'VSL' }]);
  assert.equal(summary.person, 'Nahuel Randazzo');
  assert.equal(summary.cashArs, 400000);
  assert.equal(summary.transactions, 4);
  assert.equal(summary.commissionAmount, 10000);
});
test('incluye cobranzas del mes vinculadas a ventas webinar anteriores y excluye pendientes/rebotados', () => {
  const summary = run([{ ...base, id: 'sale', f_acreditacion: '2026-10-28' },
    { ...base, id: 'payment', tipo: 'Cobranza', origen_actual: '', venta_relacionada: 'sale' },
    { ...base, id: 'pending', estado: 'Pendiente' }, { ...base, id: 'bounced', rebotar_pago: true },
    { ...base, id: 'future', f_acreditacion: '2026-12-01' }]);
  assert.equal(summary.cashArs, 100000);
  assert.equal(summary.commissionAmount, 2500);
});
test('respeta la verificación y guarda el porcentaje sin alterar otras reglas', () => {
  const rules = service.normalizeConfig({ global: { webinarNahuelRandazzoPct: .05 } });
  assert.equal(run([{ ...base, id: 'unverified', verificacion_comisiones: 'Error' }], rules).cashArs, 0);
  assert.equal(service.normalizeConfig(rules).global.webinarNahuelRandazzoPct, .05);
  assert.equal(service.normalizeConfig({}).global.webinarNahuelRandazzoPct, 0);
  for (const value of [-.01, 1.01, '5', NaN]) assert.throws(() => validateConfig({ global: { webinarNahuelRandazzoPct: value } }));
  assert.doesNotThrow(() => validateConfig({ global: { webinarNahuelRandazzoPct: 0 } }));
});

test('input previsualiza comisión, guarda un parche mensual y bloquea meses cerrados', async () => {
  const fs = require('node:fs');
  const vm = require('node:vm');
  const source = fs.readFileSync('public/metricas-v2/js/views/comisiones.page.js', 'utf8');
  const code = source.slice(source.indexOf('  function renderWebinarPanel()'), source.indexOf('  function refreshCommissionViews()'));
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { value: '5', validity: { valid: true }, listeners: {}, reportValidity: () => true,
      addEventListener(event, listener) { this.listeners[event] = listener; } });
    return elements.get(id);
  };
  const saved = [];
  const state = { month: '2026-11', dashboard: { webinarNahuel: { cashArs: 200000, pct: .025, commissionAmount: 5000 }, locked: false } };
  const context = { state, document: { getElementById: element }, formatCurrency: value => String(value),
    formatPercent: value => String(value), escapeHtml: value => String(value), monthInput: {},
    window: { metricasApi: { saveCommissionConfig: async patch => saved.push(patch) } }, loadPage: async () => {} };
  vm.createContext(context);
  vm.runInContext(`${code}\nrenderWebinarPanel();`, context);
  element('commissionWebinarNahuelPct').listeners.input();
  assert.equal(element('commissionWebinarNahuelAmount').textContent, '10000');
  await element('saveWebinarNahuelPct').listeners.click();
  assert.equal(saved[0].month, '2026-11');
  assert.equal(saved[0].config.global.webinarNahuelRandazzoPct, .05);
  assert.deepEqual(Object.keys(saved[0].config.global), ['webinarNahuelRandazzoPct']);
  state.dashboard.locked = true;
  vm.runInContext('renderWebinarPanel();', context);
  assert.match(element('commissionWebinarPanel').innerHTML, /Mes cerrado/);
  await element('saveWebinarNahuelPct').listeners.click();
  assert.equal(saved.length, 1);
});
