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
  assert.equal(metrics.rentabilidadPromedio, 2875);
  assert.equal(metrics.rentabilidadTotal, 5750);
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
  assert.equal(empty.rentabilidadPromedio, null);
});

test('rentabilidad conserva pérdidas y costos sin ventas', () => {
  const { context: c } = page();
  const zeroSales = c.metricRowsFor({ ...c.emptyAccumulator(), total_agendados: 10 }, 800, 40);
  assert.equal(zeroSales.rentabilidadTotal, -200);
  assert.equal(zeroSales.rentabilidadPromedio, null);
  const loss = c.metricRowsFor({ ...c.emptyAccumulator(), total_agendados: 10,
    total_ventas: 2, facturacion_f_agenda: 100 }, 800, 40);
  assert.equal(loss.rentabilidadTotal, -100);
  assert.equal(loss.rentabilidadPromedio, -50);
});

test('costo y rentabilidad anuales suman asignaciones mensuales aunque cambie la participación', () => {
  const { context: c, elements } = page();
  const rows = [
    { mes: 1, total_agendados: 10, total_ventas: 2, facturacion_f_agenda: 6000 },
    { mes: 2, total_agendados: 30, total_ventas: 1, facturacion_f_agenda: 3000 }
  ];
  const render = () => c.buildMatrixTable(rows, { anio: 2026, closer: 'Carlos Tu' }, {},
    { total: 1000, byMonth: { 1: 800, 2: 200 } },
    { totalAgendados: 80, byMonth: { 1: 40, 2: 40 } });
  render();
  const values = (key) => elements.tableContainer.innerHTML.match(
    new RegExp('data-metric-key="' + key + '"[\\s\\S]*?</tr>'))[0];
  // 800*10/40 + 200*30/40 = 350, no 1000*40/80 = 500.
  assert.match(values('costoAgendaCloser'), /350,00/);
  assert.match(values('rentabilidadTotal'), /8\.650,00/);
  assert.match(values('rentabilidadPromedio'), /2\.883,33/);
  elements.displayMonth.value = 'all';
  render();
  assert.match(values('rentabilidadTotal'), /5\.800,00[\s\S]*2\.850,00[\s\S]*8\.650,00/);
});

test('tabla mensual muestra costo por closer y promedio de venta con total anual', () => {
  const { context: c, elements } = page();
  c.buildMatrixTable([
    { mes: 1, total_agendados: 10, total_ventas: 2, facturacion_f_agenda: 6000, facturacion_total_mes: 1500 }
  ], { anio: 2026, closer: 'Carlos Tu' }, {},
  { total: 1000, byMonth: { 1: 1000 } }, { totalAgendados: 40, byMonth: { 1: 40 } });
  const rendered = elements.tableContainer.innerHTML;
  assert.match(rendered, /Promedio de venta/);
  assert.match(rendered, /Costo por closer/);
  assert.match(rendered, /3\.000,00/);
  assert.match(rendered, /250,00/);
  assert.match(rendered, /Total anual/);
  const firstTable = rendered.split('</table>')[0];
  const keys = [...firstTable.matchAll(/data-metric-key="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(keys.slice(-4), ['costoAgendaCloser', 'aov', 'rentabilidadPromedio', 'rentabilidadTotal']);
  assert.equal(keys.filter((key) => key === 'aov').length, 1);
  assert.equal(keys.filter((key) => key === 'costoAgendaCloser').length, 1);
});

test('NEW dura 25 días desde el lanzamiento y no reaparece al cambiar filtros', () => {
  const { context: c } = page();
  const start = Date.parse('2026-11-11T00:00:00-03:00');
  const end = Date.parse('2026-12-06T00:00:00-03:00');
  assert.equal(end - start, 25 * 86400000);
  for (const key of ['costoAgendaCloser', 'aov', 'rentabilidadPromedio', 'rentabilidadTotal']) {
    assert.equal(c.closerMetricNewBadge(key, start - 1), '');
    assert.match(c.closerMetricNewBadge(key, start), />NEW</);
    assert.match(c.closerMetricNewBadge(key, end - 1), />NEW</);
    assert.equal(c.closerMetricNewBadge(key, end), '');
    assert.equal(c.closerMetricNewBadge(key, end + 86400000), '');
  }
  assert.equal(c.closerMetricNewBadge('ventas', start), '');
});
