const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/metricas-v2/views/conciliacion.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'public/metricas-v2/js/views/conciliacion.page.js'), 'utf8');

test('Conciliación ofrece un único selector de mes de acreditación', () => {
  assert.match(html, /id="conciliacionMonth" type="month"/);
  assert.doesNotMatch(html, /conciliacionDateFrom|conciliacionDateTo/);
  assert.match(script, /refs\.month\.value = currentMonthValue\(\)/);
  assert.match(script, /rowMonth\(row\) !== month/);
});

test('muestra el mes actual al entrar y permite elegir otro mes', async () => {
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
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const otherDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const otherMonth = `${otherDate.getFullYear()}-${String(otherDate.getMonth() + 1).padStart(2, '0')}`;
  const tab = makeElement({ dataset: { statusFilter: 'all' } });
  const elements = {
    conciliacionTotalChip: makeElement(),
    conciliacionTabs: makeElement({ children: [tab] }),
    conciliacionHint: makeElement(),
    conciliacionStatus: makeElement(),
    conciliacionSummary: makeElement(),
    conciliacionTable: makeElement(),
    conciliacionResponsibleFilter: makeElement(),
    conciliacionMonth: makeElement(),
    conciliacionClubFilter: makeElement({ value: 'all' }),
    conciliacionSearch: makeElement(),
    reloadConciliacion: makeElement()
  };
  const context = {
    document: { getElementById: (id) => elements[id] || null },
    Intl,
    Date,
    String,
    Number,
    Array,
    Set,
    RegExp,
    window: {
      metricasApi: {
        fetchReconciliationComprobantes: async () => ({ rows: [
          { id: 'current', cliente_format: 'Mes actual', f_acreditacion: `${currentMonth}-15`, estado: 'Conciliado' },
          { id: 'other', cliente_format: 'Mes anterior', f_acreditacion: `${otherMonth}-15`, estado: null }
        ] })
      }
    }
  };

  vm.runInNewContext(script, context);
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(elements.conciliacionMonth.value, currentMonth);
  assert.match(elements.conciliacionTable.innerHTML, /Mes actual/);
  assert.doesNotMatch(elements.conciliacionTable.innerHTML, /Mes anterior/);

  elements.conciliacionMonth.value = otherMonth;
  elements.conciliacionMonth.change();
  assert.match(elements.conciliacionTable.innerHTML, /Mes anterior/);
  assert.doesNotMatch(elements.conciliacionTable.innerHTML, /Mes actual/);
});
