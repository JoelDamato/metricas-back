const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const pagePath = path.join(__dirname, '..', 'public', 'metricas-v2', 'js', 'views', 'alertas-operativas.page.js');
const pageSource = fs.readFileSync(pagePath, 'utf8');

function createNode() {
  return {
    textContent: '',
    innerHTML: '',
    hidden: false,
    disabled: false,
    classList: { toggle() {} },
    addEventListener() {},
    toggleAttribute(_name, enabled) { this.hidden = Boolean(enabled); },
    querySelectorAll() { return []; }
  };
}

test('carga alertas y determina pendientes por fecha de llamada', async () => {
  const nodeIds = [
    'status',
    'alertasAreaSummary',
    'alertasSummary',
    'alertasSections',
    'alertasFechaCorte',
    'alertasLastUpdate',
    'reloadAlertas',
    'alertasLoading'
  ];
  const nodes = Object.fromEntries(nodeIds.map((id) => [id, createNode()]));
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthKey = `${currentYear}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const todayKey = `${currentMonthKey}-${String(now.getDate()).padStart(2, '0')}`;
  const previousMonth = new Date(currentYear, now.getMonth() - 1, 10);
  const previousMonthKey = [
    previousMonth.getFullYear(),
    String(previousMonth.getMonth() + 1).padStart(2, '0'),
    String(previousMonth.getDate()).padStart(2, '0')
  ].join('-');
  const futureDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const futureDateKey = [
    futureDate.getFullYear(),
    String(futureDate.getMonth() + 1).padStart(2, '0'),
    String(futureDate.getDate()).padStart(2, '0')
  ].join('-');

  const context = {
    console,
    Date,
    Intl,
    setTimeout,
    clearTimeout,
    document: {
      getElementById(id) { return nodes[id] || null; },
      body: { appendChild() {} },
      createElement() { return createNode(); }
    },
    window: {
      metricasApi: {
        async fetchOperationalAlerts() {
          return {
            rows: {
              csm: [],
              comprobantes: [{ estado: 'Sin conciliar', tipo: 'Venta', facturacion: 100 }],
              leads: [
                {
                  nombre: 'Llamada más nueva',
                  closer: 'Closer Alfa',
                  fecha_agenda: `${currentMonthKey}-01`,
                  fecha_llamada: todayKey,
                  agendo: 'Agendo',
                  aplica: 'Aplica',
                  llamada_meg: 'Pendiente'
                },
                {
                  nombre: 'Entra por llamada',
                  closer: 'Closer Zeta',
                  fecha_agenda: `${currentYear - 1}-12-20`,
                  fecha_llamada: `${currentMonthKey}-01`,
                  agendo: 'Agendo',
                  aplica: 'Aplica',
                  llamada_meg: 'Pendiente'
                },
                {
                  nombre: 'Llamada de otro mes',
                  closer: 'Closer Uno',
                  fecha_agenda: `${currentMonthKey}-01`,
                  fecha_llamada: previousMonthKey,
                  agendo: 'Agendo',
                  aplica: 'Aplica',
                  llamada_meg: 'Pendiente'
                },
                {
                  nombre: 'Sin llamada',
                  closer: 'Closer Uno',
                  fecha_agenda: `${currentYear}-01-10`,
                  fecha_llamada: '',
                  agendo: 'Agendo',
                  aplica: 'Aplica',
                  llamada_meg: ''
                },
                {
                  nombre: 'Llamada futura',
                  closer: 'Closer Uno',
                  fecha_agenda: `${currentYear}-01-10`,
                  fecha_llamada: futureDateKey,
                  agendo: 'Agendo',
                  aplica: 'Aplica',
                  llamada_meg: 'Pendiente'
                }
              ]
            }
          };
        }
      }
    }
  };
  context.globalThis = context;

  vm.runInNewContext(pageSource, context, { filename: pagePath });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.doesNotMatch(nodes.status.textContent, /No pude cargar/);
  assert.match(nodes.alertasSummary.innerHTML, /Agendas pendientes/);
  assert.match(nodes.alertasSummary.innerHTML, /del mes actual/);
  assert.match(nodes.alertasSections.innerHTML, /Entra por llamada/);
  assert.ok(
    nodes.alertasSections.innerHTML.indexOf('Entra por llamada')
      < nodes.alertasSections.innerHTML.indexOf('Llamada más nueva'),
    'la llamada más antigua debe aparecer antes que la más nueva'
  );
  assert.doesNotMatch(nodes.alertasSections.innerHTML, /Llamada de otro mes/);
  assert.doesNotMatch(nodes.alertasSections.innerHTML, /Sin llamada/);
  assert.doesNotMatch(nodes.alertasSections.innerHTML, /Llamada futura/);
  assert.match(nodes.alertasSections.innerHTML, /Comprobantes sin conciliar/);
  assert.doesNotMatch(nodes.alertasSections.innerHTML, /Clientes duplicados en leads/);
  assert.doesNotMatch(nodes.alertasSections.innerHTML, /Ventas con cash raro/);
});

test('no conserva referencias rotas al listado de comprobantes sin conciliar', () => {
  assert.equal((pageSource.match(/unreconciledRows/g) || []).length, 4);
});
