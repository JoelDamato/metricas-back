const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function page() {
  const elements = {
    tableContainer: { innerHTML: '', classList: { toggle() {} }, querySelectorAll() { return []; } },
    displayMonth: { value: '1' }
  };
  const context = vm.createContext({
    document: { getElementById: (id) => elements[id] },
    window: {}, Intl, Date, setTimeout
  });
  const source = fs.readFileSync('public/metricas-v2/js/views/agendas-closer.page.js', 'utf8');
  vm.runInContext(source.slice(0, source.indexOf('const displayMonthSelect =')), context);
  return { context, elements };
}

test('promedio de venta usa facturación de las mismas agendas aunque se vendan otro mes', () => {
  const { context: c } = page();
  const metrics = c.metricRowsFor({ ...c.emptyAccumulator(), total_agendados: 10,
    total_ventas: 2, facturacion_f_agenda: 6000, facturacion_total_mes: 1500 }, 1000, 40);
  assert.equal(metrics.aov, 3000);
  assert.equal(metrics.costoAgenda, 25);
  assert.equal(metrics.costoAgendaCloser, 250);
  assert.equal(metrics.costoVentaCloser, 125);
});

test('reparto de inversión conserva el total y promedio anual se pondera por ventas', () => {
  const { context: c } = page();
  const rows = [
    { mes: 1, total_agendados: 10, total_ventas: 1, facturacion_f_agenda: 1000 },
    { mes: 2, total_agendados: 30, total_ventas: 3, facturacion_f_agenda: 9000 }
  ];
  const { totals } = c.aggregateByMonth(rows, 2026);
  const annual = c.metricRowsFor(totals, 800, 40);
  assert.equal(annual.aov, 2500); // No es el promedio simple de 1000 y 3000.
  const closerA = c.metricRowsFor({ ...c.emptyAccumulator(), total_agendados: 10 }, 800, 40);
  const closerB = c.metricRowsFor({ ...c.emptyAccumulator(), total_agendados: 30 }, 800, 40);
  assert.equal(closerA.costoAgendaCloser + closerB.costoAgendaCloser, 800);
  const empty = c.metricRowsFor(c.emptyAccumulator(), 0, 0);
  assert.equal(empty.aov, 0);
  assert.equal(empty.costoVentaCloser, 0);
});

test('tabla mensual muestra costo por closer y promedio de venta con total anual', () => {
  const { context: c, elements } = page();
  c.buildMatrixTable([
    { mes: 1, total_agendados: 10, total_ventas: 2, facturacion_f_agenda: 6000, facturacion_total_mes: 1500 }
  ], { anio: 2026, closer: 'Carlos Tu' }, {},
  { total: 1000, byMonth: { 1: 1000 } }, { totalAgendados: 40, byMonth: { 1: 40 } });
  const rendered = elements.tableContainer.innerHTML;
  assert.match(rendered, /Promedio de venta/);
  assert.match(rendered, /Costo de marketing por closer/);
  assert.match(rendered, /3\.000,00/);
  assert.match(rendered, /250,00/);
  assert.match(rendered, /Total anual/);
});
