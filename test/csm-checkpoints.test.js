const assert = require('node:assert/strict');
const test = require('node:test');

const csmCheckpoints = require('../modules/metricasv2/services/csm-checkpoints.service');
const access = require('../modules/auth/access');

test('expone las personas y categorías exactas de la especificación CSM', () => {
  const rules = csmCheckpoints.getCsmRules();

  assert.deepEqual(rules.members, [
    'Valeria Calmet',
    'Sofía Gallardo',
    'Gabriela Costarelli'
  ]);
  assert.equal(rules.categories.strike.length, 14);
  assert.equal(rules.categories.check.length, 3);
  assert.equal(
    rules.categories.strike[0],
    'Ausencia, llegada tarde o falta de preparación (reunión con cliente o interna del equipo)'
  );
  assert.equal(
    rules.categories.check[1],
    'Resolución proactiva de un problema, con evidencia'
  );
});

test('calcula la tabla completa de bono y el total sobre USD 850', () => {
  const expected = new Map([
    [-3, 0],
    [-1, 0],
    [0, 100],
    [1, 125],
    [2, 150],
    [3, 175],
    [4, 250],
    [5, 275],
    [6, 300],
    [7, 325],
    [8, 350],
    [20, 350]
  ]);

  for (const [score, bonus] of expected) {
    assert.equal(csmCheckpoints.getCsmBonus(score), bonus);
  }

  const [valeria] = csmCheckpoints.summarizeCsmEntries([
    { closer_nombre: 'Valeria Calmet', tipo: 'check' },
    { closer_nombre: 'Valeria Calmet', tipo: 'check' },
    { closer_nombre: 'Valeria Calmet', tipo: 'strike' }
  ]);
  assert.equal(valeria.score, 1);
  assert.equal(valeria.bonusUsd, 125);
  assert.equal(valeria.totalUsd, 975);
});

test('asigna al mes siguiente lo cargado después del último día hábil', () => {
  assert.deepEqual(
    csmCheckpoints.getCsmAccountingPeriod('2026-10-30'),
    { anio: 2026, mes: 10, lastBusinessDay: 30 }
  );
  assert.deepEqual(
    csmCheckpoints.getCsmAccountingPeriod('2026-10-31'),
    { anio: 2026, mes: 11, lastBusinessDay: 30 }
  );
  assert.deepEqual(
    csmCheckpoints.getCsmAccountingPeriod('2026-12-31'),
    { anio: 2026, mes: 12, lastBusinessDay: 31 }
  );
});

test('valida que persona, tipo, fecha y categoría pertenezcan a CSM', () => {
  const valid = csmCheckpoints.validateCsmEntryInput({
    closer_nombre: 'Sofia Gallardo',
    fecha: '2026-07-29',
    tipo: 'check',
    categoria: 'Propuesta implementada (mejora, documento o proceso ya hecho)',
    detalle: 'Se implementó el proceso y quedó documentado.'
  });

  assert.equal(valid.closer_nombre, 'Sofía Gallardo');
  assert.equal(valid.cantidad, 1);

  assert.throws(
    () => csmCheckpoints.validateCsmEntryInput({
      ...valid,
      tipo: 'strike',
      categoria: 'Propuesta implementada (mejora, documento o proceso ya hecho)'
    }),
    /La categoría no corresponde/
  );
  assert.throws(
    () => csmCheckpoints.validateCsmEntryInput({
      ...valid,
      closer_nombre: 'Persona desconocida'
    }),
    /La persona debe ser/
  );
});

test('genera alertas al alcanzar 3 y 6 meses consecutivos negativos', () => {
  const negativeEntry = {
    closer_nombre: 'Gabriela Costarelli',
    tipo: 'strike',
    cantidad: 1
  };
  const threeMonths = csmCheckpoints.buildCsmReport([
    { anio: 2026, mes: 7, entries: [negativeEntry] },
    { anio: 2026, mes: 6, entries: [negativeEntry] },
    { anio: 2026, mes: 5, entries: [negativeEntry] },
    { anio: 2026, mes: 4, entries: [] }
  ]);
  assert.deepEqual(threeMonths.alerts, [{
    name: 'Gabriela Costarelli',
    consecutiveNegativeMonths: 3,
    threshold: 3
  }]);

  const sixMonths = csmCheckpoints.buildCsmReport(
    Array.from({ length: 6 }, (_, index) => ({
      anio: 2026,
      mes: 7 - index,
      entries: [negativeEntry]
    }))
  );
  assert.equal(sixMonths.alerts[0].threshold, 6);
  assert.equal(sixMonths.alerts[0].consecutiveNegativeMonths, 6);
});

test('Belén y Mati pueden editar CSM y los editores de ventas conservan su permiso original', () => {
  assert.equal(
    access.canEditCsmCheckpointsForUser({ email: 'belenherrera.gestion@gmail.com' }),
    true
  );
  assert.equal(
    access.canEditCsmCheckpointsForUser({ email: 'matirandazzo@gmail.com', role: 'total' }),
    true
  );
  assert.equal(
    access.canEditAgendaCheckpointsForUser({ email: 'matirandazzo@gmail.com' }),
    true
  );
  assert.equal(
    access.canEditAgendaCheckpointsForUser({ email: 'belenherrera.gestion@gmail.com' }),
    false
  );
});
