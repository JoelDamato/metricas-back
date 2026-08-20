const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

const {
  getValue,
  mapToSupabase,
  extractDeletedPageId,
  deleteFromSupabase
} = require('../controllers/webhookcom');

function relation(...ids) {
  return {
    type: 'relation',
    relation: ids.map((id) => ({ id }))
  };
}

test('getValue devuelve el primer ID de una relación de Notion', () => {
  assert.equal(getValue(relation('venta-1', 'venta-2')), 'venta-1');
  assert.equal(getValue(relation()), null);
});

test('getValue conserva el mapeo de tipos existentes', () => {
  assert.equal(getValue({ type: 'number', number: 1250 }), 1250);
  assert.equal(getValue({ type: 'checkbox', checkbox: false }), false);
  assert.equal(getValue({
    type: 'rich_text',
    rich_text: [{ plain_text: 'Cheque recibido' }]
  }), 'Cheque recibido');
});

test('getValue resuelve a Pablo aunque Notion oculte el nombre del usuario', () => {
  assert.equal(getValue({
    type: 'people',
    people: [{
      object: 'user',
      id: '32ed872b-594c-8111-8b96-0002d7decc97'
    }]
  }), 'Pablo Butera');
});

test('mapea Venta relacionada y Cobranza relacionada a sus IDs de Supabase', () => {
  const row = mapToSupabase({
    data: {
      id: 'comprobante-notion-id',
      properties: {
        'Venta relacionada': relation('venta-notion-id'),
        'Cobranza relacionada': relation('cobranza-notion-id'),
        Tipo: { type: 'select', select: { name: 'Cobranza' } }
      }
    }
  });

  assert.equal(row.id, 'comprobante-notion-id');
  assert.equal(row.venta_relacionada, 'venta-notion-id');
  assert.equal(row.cobranza_relacionada, 'cobranza-notion-id');
  assert.equal(row.tipo, 'Cobranza');
});

test('extrae el ID seguro de un evento page.deleted', () => {
  assert.equal(extractDeletedPageId({
    type: 'page.deleted',
    entity: { id: ' 2a548251-7a95-810d-bad8-d6427a33cc02 ' }
  }), '2a548251-7a95-810d-bad8-d6427a33cc02');
  assert.equal(extractDeletedPageId({ type: 'page.deleted', entity: {} }), null);
  assert.equal(extractDeletedPageId({
    type: 'page.deleted',
    entity: { id: 'pagina-notion-id' }
  }), null);
  assert.equal(extractDeletedPageId({
    type: 'page.updated',
    entity: { id: 'pagina-notion-id' }
  }), null);
});

test('page.deleted borra exclusivamente el comprobante indicado por entity.id', async () => {
  const originalGet = axios.get;
  const originalDelete = axios.delete;
  const originalPost = axios.post;
  const deleteCalls = [];

  axios.get = async () => ({ data: { archived: true } });
  axios.delete = async (url, config) => {
    deleteCalls.push({ url, config });
    return { status: 204 };
  };
  axios.post = async () => ({ status: 201 });

  try {
    await deleteFromSupabase({
      type: 'page.deleted',
      entity: { id: '2a548251-7a95-810d-bad8-d6427a33cc02' }
    });
  } finally {
    axios.get = originalGet;
    axios.delete = originalDelete;
    axios.post = originalPost;
  }

  assert.equal(deleteCalls.length, 1);
  assert.match(deleteCalls[0].url, /\/rest\/v1\/comprobantes$/);
  assert.deepEqual(deleteCalls[0].config.params, { id: 'eq.2a548251-7a95-810d-bad8-d6427a33cc02' });
});

test('page.deleted no borra una fila si Notion no confirma que esté archivada', async () => {
  const originalGet = axios.get;
  const originalDelete = axios.delete;
  let deleteCalls = 0;
  axios.get = async () => ({ data: { archived: false, in_trash: false } });
  axios.delete = async () => {
    deleteCalls += 1;
    return { status: 204 };
  };

  try {
    await assert.rejects(
      deleteFromSupabase({
        type: 'page.deleted',
        entity: { id: '2a548251-7a95-810d-bad8-d6427a33cc02' }
      }),
      /Notion no confirma/
    );
  } finally {
    axios.get = originalGet;
    axios.delete = originalDelete;
  }

  assert.equal(deleteCalls, 0);
});
