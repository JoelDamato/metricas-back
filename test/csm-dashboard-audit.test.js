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
      f_pago_con_acceso: '2026-05-01', f_onboarding: '2026-05-20', f_diagnostico: '2026-06-01',
      f_costos_1: '2026-06-05', f_costos_2: '2026-06-10', f_cashflow: '2026-06-22'
    },
    {
      id: 'b', ghlid: 'b', nombre: 'Diagnóstico rápido', acceso: 'Acceso',
      f_pago_con_acceso: '2026-05-01', f_onboarding: '2026-06-02', f_diagnostico: '2026-06-05',
      f_costos_1: '2026-06-08'
    },
    {
      id: 'c', ghlid: 'c', nombre: 'Pendiente de junio', acceso: 'Acceso',
      f_pago_con_acceso: '2026-05-01', f_onboarding: '2026-06-03'
    },
    {
      id: 'd', ghlid: 'd', nombre: 'Diagnóstico de julio', acceso: 'Acceso',
      f_pago_con_acceso: '2026-06-04', f_onboarding: '2026-06-04', f_diagnostico: '2026-07-01'
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
  assert.equal(metric(page, 'session_costs_2'), undefined);
  assert.equal(metric(page, 'session_cashflow').value, '1');
  assert.match(metric(page, 'session_cashflow').info.logic, /f_cashflow/);

  const people = page.sections.find((section) => section.key === 'desglose-persona');
  assert.ok(people);
  assert.ok(Array.isArray(people.totalRow));
  assert.equal(page.sections.every((section) => Array.isArray(section.totalRow)), true);

  const intervals = page.sections.find((section) => section.title === 'Días entre sesiones');
  assert.equal(intervals.rows[0][2], '2');
  assert.equal(intervals.rows[1][2], '0');
});

test('CSM por Estado usa nomenclatura clara y expone cuadros con totales', () => {
  const api = loadInternals();
  const rows = api.enrichRows([
    { id: '1', ghlid: 'one', nombre: 'Con acceso', acceso: 'Acceso', f_pago_con_acceso: '2026-06-01', f_cashflow: '2026-06-10' },
    { id: '2', ghlid: 'two', nombre: 'Pendiente', acceso: '', f_pago_con_acceso: '2026-06-02' }
  ]);
  const page = api.buildSituationPageAudited(rows, { allRows: rows, filters: { year: '2026', month: '6' } });
  assert.equal(metric(page, 'unknown_support').label, 'Clientes con acceso sin informar');
  assert.ok(page.sections.some((section) => section.key === 'desglose-persona' && Array.isArray(section.totalRow)));
  assert.ok(page.sections.some((section) => section.key === 'sesiones-periodo' && Array.isArray(section.totalRow)));
  assert.equal(page.sections.every((section) => Array.isArray(section.totalRow)), true);
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

test('las portadas de CSM agrupan las métricas sin mostrar filtros ni resultados', () => {
  const tiempo = fs.readFileSync(path.join(root, 'public/metricas-v2/views/csm-tiempo.html'), 'utf8');
  const situacion = fs.readFileSync(path.join(root, 'public/metricas-v2/views/csm-situacion.html'), 'utf8');
  const cuadro = fs.readFileSync(path.join(root, 'public/metricas-v2/views/csm-cuadro.html'), 'utf8');

  for (const html of [tiempo, situacion]) {
    assert.match(html, /id="kpiContainer"[^>]*hidden/);
    assert.match(html, /id="tableContainer"[^>]*hidden/);
    assert.match(html, /class="chart-panel" hidden/);
    assert.match(html, /Elegí qué querés consultar/);
    assert.doesNotMatch(html, /id="csmYear"/);
    assert.doesNotMatch(html, /id="csmMonth"/);
  }

  assert.match(script, /function renderCsmDirectory/);
  assert.match(script, /vista: 'grupo'/);
  assert.match(script, /key: 'diagnosticos'/);
  assert.match(script, /key: 'estado-actual'/);
  assert.match(cuadro, /id="csmYear"/);
  assert.match(cuadro, /id="csmMonth"/);
  assert.match(cuadro, /id="csmPageLoading"/);
  assert.match(cuadro, /Preparando la información/);
  assert.match(script, /function setCsmPageLoading/);
  assert.match(script, /setCsmPageLoading\(false\)/);
  assert.match(cuadro, /chart\.umd\.min\.js/);
});

test('cada categoría CSM construye un gráfico propio excepto Módulos', () => {
  const api = loadInternals();
  const filters = { year: '2026', month: '9' };
  const timePage = api.buildTimePageByEvent([], { allRows: [], filters });
  const situationPage = api.buildSituationPageAudited([], { allRows: [], filters });

  const timeGroups = api.getCsmDirectoryGroups('tiempo');
  const situationGroups = api.getCsmDirectoryGroups('situacion');
  assert.equal(timeGroups.length, 6);
  assert.equal(situationGroups.length, 6);
  assert.equal(timeGroups.filter((group) => group.key !== 'modulos').every((group) => group.chart && api.buildCsmGroupChart(timePage, group)), true);
  assert.equal(timeGroups.find((group) => group.key === 'modulos')?.chart, undefined);
  assert.equal(situationGroups.every((group) => group.chart && api.buildCsmGroupChart(situationPage, group)), true);
});

test('Módulos muestra sólo el último módulo cargado y cuenta sus días de forma inclusiva', () => {
  const api = loadInternals();
  const today = new Date(2026, 8, 20);
  const rows = api.enrichRows([
    {
      id: 'amarillo-m2', ghlid: 'amarillo-m2', nombre: 'Amarillo M2',
      acceso: 'Acceso', modulo_1: '2026-08-20', modulo_2: '2026-09-01'
    },
    {
      id: 'rojo-m1', ghlid: 'rojo-m1', nombre: 'Rojo M1',
      acceso: 'Acceso', modulo_1: '2026-09-07'
    },
    {
      id: 'amarillo-curso', ghlid: 'amarillo-curso', nombre: 'Amarillo en curso',
      acceso: 'Acceso', modulo_1: '2026-09-14'
    },
    {
      id: 'en-termino', ghlid: 'en-termino', nombre: 'En término',
      acceso: 'Acceso', modulo_1: '2026-09-16'
    },
    {
      id: 'sin-inicio-m1', ghlid: 'sin-inicio-m1', nombre: 'Sin inicio M1',
      acceso: 'Acceso', f_pago_con_acceso: '2024-12-10'
    },
    {
      id: 'sin-inicio-m2', ghlid: 'sin-inicio-m2', nombre: 'Sin inicio M2',
      acceso: 'Acceso', f_onboarding: '2026-08-01', modulo_2: null
    }
  ]);

  const modules = api.buildModuleTraffic(rows, today);
  const m1 = modules.find((module) => module.key === 'm1');
  const m2 = modules.find((module) => module.key === 'm2');
  const m5 = modules.find((module) => module.key === 'm5');

  assert.equal(m1.yellowDays, 7);
  assert.equal(m1.redDays, 14);
  assert.deepEqual(Array.from(m1.yellow, (client) => client.nombre), ['Amarillo en curso']);
  assert.deepEqual(Array.from(m1.red, (client) => client.nombre), ['Rojo M1']);
  assert.deepEqual(Array.from(m1.onTrack, (client) => client.nombre), ['En término']);
  assert.equal(m1.clients.some((client) => client.nombre === 'Sin inicio M1'), false);
  assert.equal(m2.yellowDays, 14);
  assert.equal(m2.redDays, 21);
  assert.equal(m2.yellow[0].nombre, 'Amarillo M2');
  assert.equal(m2.yellow[0].days, 20);
  assert.equal(m2.clients.some((client) => client.nombre === 'Sin inicio M2'), false);
  assert.equal(m5.hasTrafficLight, false);
});

test('Módulos usa una foto global y excluye Sin acceso, En Pausa y abandonos', () => {
  const api = loadInternals();
  const rows = api.enrichRows([
    { id: 'septiembre', ghlid: 'septiembre', nombre: 'Ingreso septiembre', acceso: 'Acceso', f_pago_con_acceso: '2026-09-02', modulo_1: '2026-09-10' },
    { id: 'anterior', ghlid: 'anterior', nombre: 'Ingreso anterior', acceso: 'Acceso', f_pago_con_acceso: '2026-05-02', modulo_1: '2026-05-10' },
    { id: 'pausa', ghlid: 'pausa', nombre: 'En pausa', acceso: 'Acceso', pausa: 'En Pausa', f_pago_con_acceso: '2026-04-02', modulo_1: '2026-04-10' },
    { id: 'pausa-vencida', ghlid: 'pausa-vencida', nombre: 'Pausa vencida', acceso: 'Acceso', pausa: 'Pausa vencida', f_pago_con_acceso: '2026-03-02', modulo_1: '2026-03-10' },
    { id: 'sin-acceso', ghlid: 'sin-acceso', nombre: 'Sin acceso', acceso: 'Sin acceso', f_pago_con_acceso: '2026-02-02', modulo_1: '2026-02-10' },
    { id: 'abandono', ghlid: 'abandono', nombre: 'Abandono', acceso: 'Acceso', abandono: 'Abandono', f_pago_con_acceso: '2026-01-02', modulo_1: '2026-01-10' }
  ]);
  const filters = { year: '2026', month: '9' };
  const cohortRows = api.filterRowsByDatePeriod(rows, 'f_pago_con_acceso', filters);
  const page = api.buildTimePageByEvent(cohortRows, { allRows: rows, filters });
  const m1Names = Array.from(page.moduleTraffic.find((module) => module.key === 'm1').clients, (client) => client.nombre).sort();

  assert.deepEqual(m1Names, ['Ingreso anterior', 'Ingreso septiembre', 'Pausa vencida']);
  assert.equal(page.moduleTrafficBaseCount, 3);
  assert.equal(api.isInCurrentModuleCircuit(rows[2]), false);
  assert.equal(api.isInCurrentModuleCircuit(rows[3]), true);
});

test('Ravasio permanece en M2 hasta que exista una fecha de M3', () => {
  const api = loadInternals();
  const rows = api.enrichRows([{
    id: 'ravasio',
    ghlid: 'ravasio',
    nombre: 'Fernando Ravasio',
    acceso: 'Acceso',
    modulo_1: '2026-02-05',
    modulo_2: '2026-02-11',
    modulo_3: null
  }]);
  const modules = api.buildModuleTraffic(rows, new Date(2026, 8, 24));
  const m2 = modules.find((module) => module.key === 'm2');
  const m3 = modules.find((module) => module.key === 'm3');

  assert.equal(m2.clients[0].nombre, 'Fernando Ravasio');
  assert.equal(m2.clients[0].days, 226);
  assert.equal(m3.clients.length, 0);
});

test('la portada Por Tiempo expone Módulos y la subvista renderiza pestañas amarillas y rojas', () => {
  const api = loadInternals();
  const modulesGroup = api.getCsmDirectoryGroups('tiempo').find((group) => group.key === 'modulos');
  assert.ok(modulesGroup);
  assert.equal(modulesGroup.chart, undefined);
  assert.match(script, /function renderModuleTraffic/);
  assert.match(script, /data-csm-module-tab/);
  assert.match(script, /Amarillo desde/);
  assert.match(script, /Rojo desde/);
  assert.match(script, /class="csm-module-ghl-link"/);
  assert.match(script, /Abrir en GHL/);
  assert.match(script, /selectedGroup\.key === 'modulos'/);
  assert.match(script, /isModuleSnapshotView/);
  assert.match(script, /hideFilters: isModuleSnapshotView/);
  assert.match(script, /hideStatus: isModuleSnapshotView/);
});
