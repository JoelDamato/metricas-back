const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const periods = require('../public/metricas-v2/js/agenda-objective-periods');

test('desde septiembre de 2026 los objetivos se dividen en dos quincenas calendario', () => {
  const result = periods.calcPeriods(2026, 9);

  assert.deepEqual(result.map((row) => [row.startKey, row.endKey, row.days]), [
    ['2026-09-01', '2026-09-15', 15],
    ['2026-09-16', '2026-09-30', 15]
  ]);
});

test('los meses históricos conservan la cadencia semanal', () => {
  const result = periods.calcPeriods(2026, 8);

  assert.equal(result.length, 6);
  assert.equal(result[0].cadence, 'weekly');
  assert.equal(result[0].startKey, '2026-08-01');
  assert.equal(result[0].endKey, '2026-08-02');
});

test('la meta quincenal mantiene la misma proporción diaria de la regla semanal', () => {
  const defaults = periods.defaultRules(2026, 9);
  const adjusted = periods.adjustRules(defaults, 15, 2026, 9);

  assert.deepEqual(defaults, { floor: 33000, target: 40000, step: 10000, standardDays: 14 });
  assert.equal(adjusted.floor, 35357.14);
  assert.equal(adjusted.target, 42857.14);
  assert.equal(adjusted.step, 10714.29);
});

test('el resumen de cada período muestra su cash acumulado', () => {
  const view = fs.readFileSync(
    path.join(__dirname, '../public/metricas-v2/views/mag-sistema-agendas.html'),
    'utf8'
  );

  assert.match(view, /class="wkp-cash">Cash: \$\{fmt\(weekTotal\)\}/);
  assert.match(view, /const totals=bonusTotals\(\)/);
});

test('la tabla principal cambia de semanas a quincenas desde el corte', () => {
  const view = fs.readFileSync(
    path.join(__dirname, '../public/metricas-v2/views/mag-sistema-agendas.html'),
    'utf8'
  );

  assert.match(view, /const displayPeriods=fortnightly\?bonusPeriods:weeks/);
  assert.match(view, /const tots=fortnightly\?bonusTotals\(\):wkTotals\(\)/);
  assert.match(view, /const periodPrefix=fortnightly\?'Q':'S'/);
  assert.match(view, /const periodCash=fortnightly\?\(c\.bonusPeriods\|\|\[\]\):c\.weeks/);
});

test('categorías, reglas, alertas y manual usan quincenas desde el corte', () => {
  const view = fs.readFileSync(
    path.join(__dirname, '../public/metricas-v2/views/mag-sistema-agendas.html'),
    'utf8'
  );
  const manual = fs.readFileSync(
    path.join(__dirname, '../public/metricas-v2/views/mag-manual-closers.html'),
    'utf8'
  );

  assert.match(view, /freePeriods:fortnightly\?1:2/);
  assert.match(view, /Categorías próxima quincena/);
  assert.match(view, /Progresión de categorías por quincena/);
  assert.match(view, /Mínimo quincenal individual/);
  assert.match(view, /result\.period\.cadence==='fortnightly'\?'Quincena':'Semana'/);
  assert.doesNotMatch(manual, /semana/i);
  assert.match(manual, /Quincena 1 · días 1–15/);
  assert.match(manual, /Mínimo 10% quincenal/);
});

test('la progresión de categorías usa el cash de cada quincena', () => {
  const view = fs.readFileSync(
    path.join(__dirname, '../public/metricas-v2/views/mag-sistema-agendas.html'),
    'utf8'
  );
  const start = view.indexOf('function categoryContext()');
  const end = view.indexOf('/* ═══ HELPERS ═══ */', start);
  const low = { name: 'Closer bajo', startCat: 'ABC', weeks: [], bonusPeriods: [5, 0] };
  const high = { name: 'Closer alto', startCat: 'ABC', weeks: [], bonusPeriods: [95, 0] };
  const context = {
    getSelectedPeriod: () => ({ year: 2026, month: 9 }),
    usesFortnightlyObjectives: () => true,
    bonusPeriods: [{}, {}],
    weeks: [{}, {}, {}, {}],
    closers: [low, high],
    MIN_PCT: 10,
    curBonusPeriodIdx: () => 0,
    curWeekIdx: () => 0,
    toDateKey: () => '2026-09-12',
    Date
  };

  vm.createContext(context);
  vm.runInContext(view.slice(start, end), context);
  const totals = context.categoryTotals();

  assert.deepEqual(Array.from(totals), [100, 0]);
  assert.equal(context.categoryContext().freePeriods, 1);
  assert.deepEqual(Array.from(context.catChain(low, totals), (row) => row.cat), ['LIB', 'DE']);
  assert.deepEqual(Array.from(context.catChain(high, totals), (row) => row.cat), ['LIB', 'ABC']);
});
