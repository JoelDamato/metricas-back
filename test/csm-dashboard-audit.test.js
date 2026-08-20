const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'public/metricas-v2/js/views/csm.page.js'), 'utf8');

function loadInternals() {
  const window = { location: { search: '', pathname: '/views/csm-tiempo.html' } };
  const context = {
    window,
    document: { body: { dataset: { csmPage: 'test' } } },
    Intl,
    Date,
    String,
    Number,
    Array,
    Object,
    Map,
    Set,
    RegExp,
    URLSearchParams,
    console
  };
  vm.runInNewContext(script, context);
  return window.csmPageInternals;
}

function metric(page, key) {
  return page.metrics.find((item) => item.key === key);
}

test('CSM usa acceso = Acceso como estado activo y deduplica por GHL', () => {
  const api = loadInternals();
  const rows = api.enrichRows([
    { id: '1', ghlid: 'same', nombre: 'Duplicado viejo', acceso: 'Sin acceso', updated_at: '2026-01-01', f_pago_con_acceso: '2026-01-05' },
    { id: '2', ghlid: 'same', nombre: 'Duplicado nuevo', acceso: 'Acceso', activos: false, updated_at: '2026-02-01', f_pago_con_acceso: '2026-02-05' },
    { id: '3', ghlid: 'inactive', nombre: 'Sin acceso', acceso: 'Sin acceso', activos: true, f_pago_con_acceso: '2026-03-05' },
    { id: '4', ghlid: 'unknown', nombre: 'Sin dato', acceso: null, activos: true, f_pago_con_acceso: '2026-03-06' }
  ]);

  assert.equal(rows[1].isActive, true);
  assert.equal(rows[2].isActive, false);
  assert.equal(rows[3].supportStatus, 'unknown');
  assert.equal(api.dedupeClientRows(rows).length, 3);

  const page = api.buildSituationPageAudited(
    api.filterRowsByDatePeriod(rows, 'f_pago_con_acceso', { year: '2026', month: '3' }),
    { allRows: rows, filters: { year: '2026', month: '3' } }
  );
  assert.equal(metric(page, 'total_clients').value, '3');
  assert.match(metric(page, 'total_clients').base, /4 filas/);
  assert.match(metric(page, 'active_support').value, /^1 /);
  assert.match(metric(page, 'inactive_support').value, /^1 /);
  assert.match(metric(page, 'unknown_support').value, /^1 /);
});

test('CSM por Tiempo cuenta diagnósticos por f_diagnostico y separa pendientes de cohorte', () => {
  const api = loadInternals();
  const rows = api.enrichRows([
    {
      id: 'a', ghlid: 'a', nombre: 'Diagnóstico demorado', acceso: 'Acceso',
      f_pago_con_acceso: '2026-05-20', f_diagnostico: '2026-06-01',
      f_costos_1: '2026-06-05', f_costos_2: '2026-06-10'
    },
    {
      id: 'b', ghlid: 'b', nombre: 'Diagnóstico rápido', acceso: 'Acceso',
      f_pago_con_acceso: '2026-06-02', f_diagnostico: '2026-06-05',
      f_costos_1: '2026-06-08'
    },
    {
      id: 'c', ghlid: 'c', nombre: 'Pendiente de junio', acceso: 'Acceso',
      f_pago_con_acceso: '2026-06-03'
    },
    {
      id: 'd', ghlid: 'd', nombre: 'Diagnóstico de julio', acceso: 'Acceso',
      f_pago_con_acceso: '2026-06-04', f_diagnostico: '2026-07-01'
    }
  ]);
  const filters = { year: '2026', month: '6' };
  const cohortRows = api.filterRowsByDatePeriod(rows, 'f_pago_con_acceso', filters);
  const page = api.buildTimePageByEvent(cohortRows, { allRows: rows, filters });

  assert.equal(metric(page, 'diagnosis_total').value, '2');
  assert.equal(metric(page, 'diagnosis_under_7').value, '1');
  assert.equal(metric(page, 'diagnosis_over_7').value, '1');
  assert.equal(metric(page, 'diagnosis_unclassified').value, '0');
  assert.equal(metric(page, 'pending_diagnosis').value, '1');
  assert.equal(metric(page, 'session_costs_1').value, '2');
  assert.equal(metric(page, 'session_costs_2').value, '1');

  const intervals = page.sections.find((section) => section.title === 'Días entre sesiones');
  assert.equal(intervals.rows[0][2], '2');
  assert.equal(intervals.rows[1][2], '1');
});

test('nuevos ingresos mensuales muestran cantidad única y variación mes contra mes', () => {
  const api = loadInternals();
  const rows = api.enrichRows([
    { id: '1', ghlid: 'jan', acceso: 'Acceso', f_pago_con_acceso: '2026-01-05' },
    { id: '2', ghlid: 'feb-1', acceso: 'Acceso', f_pago_con_acceso: '2026-02-05' },
    { id: '3', ghlid: 'feb-2', acceso: 'Sin acceso', f_pago_con_acceso: '2026-02-06' }
  ]);
  const stats = api.buildMonthlyEntryStats(rows, '2026');

  assert.equal(stats[0].count, 1);
  assert.equal(stats[1].count, 2);
  assert.equal(stats[1].variation, 100);
  assert.equal(stats[1].active, 1);
  assert.equal(stats[1].inactive, 1);
});

test('la primera carga toma el mes pedido en la URL después de poblar los selectores', () => {
  const setupIndex = script.indexOf('setupCsmPeriodFilters(enrichedRows);');
  const readFiltersIndex = script.indexOf('filters = getCsmPeriodFilters();', setupIndex);
  const filterRowsIndex = script.indexOf('filterRowsByPayAccessPeriod(enrichedRows, filters)', readFiltersIndex);

  assert.ok(setupIndex >= 0);
  assert.ok(readFiltersIndex > setupIndex);
  assert.ok(filterRowsIndex > readFiltersIndex);
});
