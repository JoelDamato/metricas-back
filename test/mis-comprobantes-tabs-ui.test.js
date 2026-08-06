const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/metricas-v2/views/mis-comprobantes.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'public/metricas-v2/js/views/mis-comprobantes.page.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'public/metricas-v2/css/styles.css'), 'utf8');

test('Mis comprobantes ofrece pestañas separadas para registros propios y como setter', () => {
  assert.match(html, /id="misComprobantesScopeTabs"/);
  assert.match(html, /data-comprobante-scope="mine"/);
  assert.match(html, /data-comprobante-scope="setter"/);
  assert.match(script, /function getRowAccessScope/);
  assert.match(script, /getRowAccessScope\(row\) !== state\.scope/);
  assert.match(script, /querySelectorAll\('\[data-comprobante-scope\]'\)/);
});

test('Mis comprobantes ofrece filtros por conciliación, no conciliación y rebote', () => {
  assert.match(html, /data-reconciliation="conciliated"/);
  assert.match(html, /data-reconciliation="not_conciliated"/);
  assert.match(html, /data-reconciliation="bounced"/);
  assert.match(script, /function isBouncedRow/);
  assert.match(script, /reconciliationMode === 'bounced'/);
  assert.match(script, /querySelectorAll\('\[data-reconciliation\]'\)/);
});

test('la tabla de Mis comprobantes aprovecha el ancho disponible de pantalla', () => {
  assert.match(html, /mis-comprobantes-layout/);
  assert.match(styles, /\.mis-comprobantes-page \.mis-comprobantes-layout/);
  assert.match(styles, /width: calc\(100vw - clamp\(24px, 4vw, 72px\)\)/);
});

test('los clics en las pestañas actualizan el listado de comprobantes', async () => {
  const listenerMap = new Map();
  const makeClassList = () => ({
    values: new Set(),
    toggle(name, active) {
      if (active) this.values.add(name);
      else this.values.delete(name);
    }
  });
  const makeElement = (options = {}) => ({
    hidden: false,
    disabled: false,
    value: options.value || '',
    dataset: options.dataset || {},
    textContent: '',
    innerHTML: '',
    selectedOptions: options.selectedOptions || [{ textContent: 'Todos' }],
    classList: makeClassList(),
    getAttribute(attribute) {
      return options.attributes?.[attribute] || '';
    },
    setAttribute(attribute, value) {
      options.attributes ||= {};
      options.attributes[attribute] = value;
    },
    addEventListener(eventName, handler) {
      listenerMap.set(this, listenerMap.get(this) || {});
      listenerMap.get(this)[eventName] = handler;
    },
    click() {
      listenerMap.get(this)?.click?.();
    },
    querySelector(selector) {
      return selector === 'span' ? options.span : null;
    },
    querySelectorAll() {
      return options.children || [];
    }
  });

  const scopeMine = makeElement({
    dataset: { comprobanteScope: 'mine' },
    attributes: { 'data-comprobante-scope': 'mine' }
  });
  const scopeSetter = makeElement({
    dataset: { comprobanteScope: 'setter' },
    attributes: { 'data-comprobante-scope': 'setter' }
  });
  const reconciliationAll = makeElement({
    dataset: { reconciliation: 'all' },
    attributes: { 'data-reconciliation': 'all' }
  });
  const reconciliationConciliated = makeElement({
    dataset: { reconciliation: 'conciliated' },
    attributes: { 'data-reconciliation': 'conciliated' }
  });
  const statusSpan = makeElement();
  const elements = {
    misComprobantesHint: makeElement(),
    misComprobantesStatus: makeElement({ span: statusSpan }),
    misComprobantesSummary: makeElement(),
    misComprobantesTable: makeElement(),
    reloadMisComprobantes: makeElement(),
    misComprobantesMonth: makeElement({ value: '2026-08' }),
    misComprobantesResponsibleFilter: makeElement(),
    misComprobantesScopeTabs: makeElement({ children: [scopeMine, scopeSetter] }),
    misComprobantesReconciliationTabs: makeElement({ children: [reconciliationAll, reconciliationConciliated] }),
    misComprobantesClubFilter: makeElement(),
    misComprobantesSearch: makeElement(),
    misComprobantesOwnerChip: makeElement()
  };
  const document = {
    getElementById(id) {
      return elements[id] || null;
    }
  };
  const context = {
    document,
    Intl,
    Date,
    String,
    Number,
    Array,
    Set,
    RegExp,
    window: {
      metricasApi: {
        fetchMyComprobantes: async () => ({
          responsibleName: 'Nahue Randazzo',
          canViewBySetter: true,
          rows: [
            { id: 'own', cliente_format: 'Propio', responsable_venta: 'Nahue Randazzo', f_venta: '2026-08-01', estado: 'Conciliado', accessScope: 'mine' },
            { id: 'setter', cliente_format: 'Setter', responsable_venta: 'Otro closer', f_venta: '2026-08-02', estado: 'Sin conciliar', accessScope: 'setter' }
          ]
        })
      }
    }
  };

  vm.runInNewContext(script, context);
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  assert.match(elements.misComprobantesTable.innerHTML, /Propio/);
  scopeSetter.click();
  assert.match(elements.misComprobantesTable.innerHTML, /Setter/);
  assert.doesNotMatch(elements.misComprobantesTable.innerHTML, /Propio/);
  reconciliationConciliated.click();
  assert.match(elements.misComprobantesTable.innerHTML, /No encontré comprobantes/);
  assert.equal(reconciliationConciliated.classList.values.has('is-active'), true);
});
