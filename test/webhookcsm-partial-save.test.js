const test = require('node:test');
const assert = require('node:assert/strict');

const {
  extractMissingCsmColumn,
  isRetryableSupabaseError,
  upsertCsmRowKeepingKnownFields
} = require('../controllers/webhookcsm')._test;

function missingColumnError(column) {
  const error = new Error('Supabase rechazó una columna');
  error.response = {
    status: 400,
    data: {
      code: 'PGRST204',
      message: `Could not find the '${column}' column of 'csm' in the schema cache`
    }
  };
  return error;
}

test('detecta únicamente errores de columna desconocida de CSM', () => {
  assert.equal(extractMissingCsmColumn(missingColumnError('campo_nuevo')), 'campo_nuevo');
  assert.equal(extractMissingCsmColumn({
    response: { status: 400, data: { code: '23505', message: 'duplicate key' } }
  }), null);
  assert.equal(extractMissingCsmColumn({
    response: { status: 400, data: { code: 'PGRST204', message: "Could not find the 'x' column of 'otra_tabla' in the schema cache" } }
  }), null);
});

test('omite campos desconocidos sucesivos y guarda el resto de la fila CSM', async () => {
  const attempts = [];
  const post = async (_url, body) => {
    attempts.push({ ...body });
    if (Object.prototype.hasOwnProperty.call(body, 'campo_nuevo')) {
      throw missingColumnError('campo_nuevo');
    }
    if (Object.prototype.hasOwnProperty.call(body, 'otro_campo')) {
      throw missingColumnError('otro_campo');
    }
    return { status: 201 };
  };

  const result = await upsertCsmRowKeepingKnownFields(
    'https://supabase.test/rest/v1/csm',
    {
      id: 'notion-page-id',
      ghlid: 'ghl-123',
      nombre: 'Cliente de prueba',
      campo_nuevo: 'valor nuevo',
      otro_campo: null
    },
    {},
    post
  );

  assert.equal(result.response.status, 201);
  assert.deepEqual(result.omittedColumns, ['campo_nuevo', 'otro_campo']);
  assert.deepEqual(result.savedRow, {
    id: 'notion-page-id',
    ghlid: 'ghl-123',
    nombre: 'Cliente de prueba'
  });
  assert.equal(attempts.length, 3);
});

test('no oculta errores ajenos al esquema ni permite omitir el identificador', async () => {
  const serverError = new Error('Servidor no disponible');
  serverError.response = { status: 503, data: { message: 'unavailable' } };

  await assert.rejects(
    upsertCsmRowKeepingKnownFields('https://supabase.test/rest/v1/csm', { id: 'id-1' }, {}, async () => {
      throw serverError;
    }),
    /Servidor no disponible/
  );

  await assert.rejects(
    upsertCsmRowKeepingKnownFields('https://supabase.test/rest/v1/csm', { id: 'id-1', nombre: 'Cliente' }, {}, async () => {
      throw missingColumnError('id');
    }),
    /Supabase rechazó una columna/
  );

  assert.equal(isRetryableSupabaseError(serverError), true);
  assert.equal(isRetryableSupabaseError(missingColumnError('campo_nuevo')), false);
});
