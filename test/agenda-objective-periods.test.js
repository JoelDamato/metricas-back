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

test('la escala quincenal usa base 22k, objetivo 30k y referencia de 15 días', () => {
  const defaults = periods.defaultRules(2026, 9);
  const adjusted = periods.adjustRules(defaults, 15, 2026, 9);

  assert.deepEqual(defaults, { floor: 22000, target: 30000, step: 10000, standardDays: 15 });
  assert.equal(adjusted.floor, 22000);
  assert.equal(adjusted.target, 30000);
  assert.equal(adjusted.step, 10000);
});

test('la escala quincenal prorratea quincenas de distinta duración', () => {
  const adjusted = periods.adjustRules(periods.defaultRules(2027, 2), 13, 2027, 2);

  assert.equal(adjusted.floor, 19066.67);
  assert.equal(adjusted.target, 26000);
  assert.equal(adjusted.step, 8666.67);
});

test('el resumen de cada período muestra su cash acumulado', () => {
  const view = fs.readFileSync(
    path.join(__dirname, '../public/metricas-v2/views/mag-sistema-agendas.html'),
    'utf8'
  );

  assert.match(view, /class="wkp-cash">Cash: \$\{fmt\(weekTotal\)\}/);
  assert.match(view, /const totals=bonusTotals\(\)/);
  assert.match(view, /id="cash-load-meta"/);
  assert.match(view, /Cash visible: \$\{fmt\(Number\(cashLoadState\.total\|\|0\)\)\}/);
  assert.match(view, /Promise\.allSettled/);
});

test('el bonus quincenal aplica 1% en 30k, 2% en 40k y tope de 3% desde 50k', () => {
  const view = fs.readFileSync(
    path.join(__dirname, '../public/metricas-v2/views/mag-sistema-agendas.html'),
    'utf8'
  );
  const start = view.indexOf('function bonusPct(cash,days)');
  const end = view.indexOf('function wkStatus', start);
  const context = {
    adj: () => ({ target: 30000, step: 10000 }),
    getSelectedPeriod: () => ({ year: 2026, month: 9 }),
    usesFortnightlyObjectives: () => true,
    Math
  };

  vm.createContext(context);
  vm.runInContext(view.slice(start, end), context);

  assert.equal(context.bonusPct(29999, 15), 0);
  assert.equal(context.bonusPct(30000, 15), 0.01);
  assert.equal(context.bonusPct(39999, 15), 0.01);
  assert.equal(context.bonusPct(40000, 15), 0.02);
  assert.equal(context.bonusPct(50000, 15), 0.03);
  assert.equal(context.bonusPct(90000, 15), 0.03);
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
