const test = require('node:test');
const assert = require('node:assert/strict');

const { hasLaterClosedBaseMiss } = require('../public/metricas-v2/js/agenda-bonus-policy');

test('una semana mala anterior no revoca el bonus generado después', () => {
  const rows = [
    { index: 0, baseMiss: true },
    { index: 1, baseMiss: true },
    { index: 2, baseMiss: false }
  ];

  assert.equal(hasLaterClosedBaseMiss(rows, 2), false);
});

test('una semana mala posterior revoca el bonus ya generado', () => {
  const rows = [
    { index: 0, baseMiss: false },
    { index: 1, baseMiss: true }
  ];

  assert.equal(hasLaterClosedBaseMiss(rows, 0), true);
});

test('la última semana del mes no puede ser revocada porque no tiene una posterior', () => {
  const rows = [
    { index: 0, baseMiss: true },
    { index: 1, baseMiss: false }
  ];

  assert.equal(hasLaterClosedBaseMiss(rows, 1), false);
});
