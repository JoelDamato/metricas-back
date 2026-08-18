const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/metricas-v2/views/conciliacion.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'public/metricas-v2/js/views/conciliacion.page.js'), 'utf8');

test('Conciliación permite filtrar por un rango inclusivo de fecha de acreditación', () => {
  assert.match(html, /id="conciliacionDateFrom" type="date"/);
  assert.match(html, /id="conciliacionDateTo" type="date"/);
  assert.match(script, /const date = rowDate\(row\);/);
  assert.match(script, /date < dateFrom/);
  assert.match(script, /date > dateTo/);
  assert.doesNotMatch(script, /conciliacionMonth|rowMonth/);
});

test('los límites son inclusivos y se pueden usar juntos o por separado', async () => {
  const listeners = new Map();
  const makeElement = (options = {}) => ({
    hidden: false,
    disabled: false,
    value: options.value || '',
    textContent: '',
    innerHTML: '',
    dataset: options.dataset || {},
    className: '',
    classList: { toggle() {} },
    setAttribute() {},
    querySelector() { return null; },
    querySelectorAll() { return options.children || []; },
    addEventListener(eventName, handler) {
      listeners.set(this, listeners.get(this) || {});
      listeners.get(this)[eventName] = handler;
    },
    change() { listeners.get(this)?.change?.({ target: this }); }
  });
  const tab = makeElement({ dataset: { statusFilter: 'all' } });
  const elements = {
    conciliacionTotalChip: makeElement(),
    conciliacionTabs: makeElement({ children: [tab] }),
    conciliacionHint: makeElement(),
    conciliacionStatus: makeElement(),
    conciliacionSummary: makeElement(),
    conciliacionTable: makeElement(),
    conciliacionResponsibleFilter: makeElement(),
    conciliacionDateFrom: makeElement(),
    conciliacionDateTo: makeElement(),
    conciliacionClubFilter: makeElement({ value: 'all' }),
    conciliacionSearch: makeElement(),
    reloadConciliacion: makeElement()
  };
  const context = {
    document: { getElementById: (id) => elements[id] || null },
    Intl,
    String,
    Number,
    Array,
    Set,
    RegExp,
    window: {
      metricasApi: {
        fetchReconciliationComprobantes: async () => ({ rows: [
          { id: 'one', cliente_format: 'Inicio', f_acreditacion: '2026-08-15', estado: 'Conciliado' },
          { id: 'two', cliente_format: 'Medio', f_acreditacion: '2026-08-16', estado: null },
          { id: 'three', cliente_format: 'Fin', f_acreditacion: '2026-08-17', estado: 'Rebotado' },
          { id: 'four', cliente_format: 'Sin fecha', f_acreditacion: null, estado: null }
        ] })
      }
    }
  };

  vm.runInNewContext(script, context);
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  elements.conciliacionDateFrom.value = '2026-08-16';
  elements.conciliacionDateFrom.change();
  assert.doesNotMatch(elements.conciliacionTable.innerHTML, /Inicio|Sin fecha/);
  assert.match(elements.conciliacionTable.innerHTML, /Medio/);
  assert.match(elements.conciliacionTable.innerHTML, /Fin/);

  elements.conciliacionDateTo.value = '2026-08-16';
  elements.conciliacionDateTo.change();
  assert.match(elements.conciliacionTable.innerHTML, /Medio/);
  assert.doesNotMatch(elements.conciliacionTable.innerHTML, /Inicio|Fin|Sin fecha/);
  assert.match(elements.conciliacionHint.textContent, /desde 16\/08\/2026 hasta 16\/08\/2026/);
});
