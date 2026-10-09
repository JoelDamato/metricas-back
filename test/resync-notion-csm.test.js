const test = require('node:test');
const assert = require('node:assert/strict');

const {
  comparable,
  changedFields,
  buildDiff,
  prepareUpsertRow,
  chunk
} = require('../scripts/resync_notion_csm');

test('compara fechas equivalentes y números serializados sin falsos cambios', () => {
  assert.equal(comparable('2026-09-18T00:00:00Z'), comparable('2026-09-18T00:00:00+00:00'));
  assert.equal(comparable('12.5'), comparable(12.5));
});

test('conserva un closer recuperado cuando Notion no informa uno válido', () => {
  assert.deepEqual(
    changedFields(
      { id: '1', nombre: 'Cliente', closer: 'Anonymous' },
      { id: '1', nombre: 'Cliente', closer: 'Carlos Tu' }
    ),
    []
  );
});

test('considera equivalentes la fórmula numérica Activos y el booleano de Supabase', () => {
  assert.deepEqual(
    changedFields(
      { id: '1', activos: 0 },
      { id: '1', activos: false }
    ),
    []
  );
  assert.deepEqual(
    changedFields(
      { id: '1', activos: 1 },
      { id: '1', activos: true }
    ),
    []
  );
});

test('detecta filas faltantes y campos CSM realmente distintos', () => {
  const page = {
    id: 'notion-1',
    properties: {
      Nombre: { type: 'title', title: [{ plain_text: 'Cliente Uno' }] },
      Acceso: { type: 'select', select: { name: 'Sin acceso' } }
    }
  };
  const differences = buildDiff([page], [{ id: 'notion-1', nombre: 'Cliente Uno', acceso: 'Acceso' }]);
  assert.equal(differences.length, 1);
  assert.deepEqual(differences[0].fields, ['acceso']);
  assert.equal(buildDiff([page], []).at(0).missing, true);
});

test('el upsert conserva el closer recuperado y divide lotes acotados', () => {
  const row = prepareUpsertRow({
    expected: { id: '1', closer: 'Anonymous', acceso: 'Acceso' },
    current: { id: '1', closer: 'Carlos Tu', acceso: 'Sin acceso' }
  });
  assert.equal(row.closer, 'Carlos Tu');
  assert.equal(row.acceso, 'Acceso');
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});
