const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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
