const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

process.env.SUPABASE_SPACING_MS = '0';
process.env.SUPABASE_MAX_RETRIES = '1';

const { handleWebhook } = require('../controllers/webhooksheets2');

function notionPayload(id = 'notion-page-id') {
  return {
    data: {
      object: 'page',
      id,
      properties: {
        Nombre: {
          type: 'title',
          title: [{ plain_text: 'Contacto de prueba' }]
        },
        'GHL ID': {
          type: 'rich_text',
          rich_text: [{ plain_text: 'ghl-test-id' }]
        }
      }
    }
  };
}

function responseRecorder() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

test('guarda el webhook CRM directamente en Supabase sin llamar a Google Sheets', async (t) => {
  const posts = [];
  t.mock.method(axios, 'post', async (url, body, config) => {
    posts.push({ url, body, config });
    return { status: 201, data: null };
  });

  const res = responseRecorder();
  await handleWebhook({ body: notionPayload() }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.message, 'Webhook de CRM guardado en Supabase');
  assert.equal(posts[0].url.endsWith('/rest/v1/leads_raw'), true);
  assert.equal(posts[0].body.id, 'notion-page-id');
  assert.equal(posts[0].body.ghlid, 'ghl-test-id');
  assert.equal(posts.some(({ url }) => url.includes('script.google.com')), false);
  assert.equal(posts.some(({ url }) => url.endsWith('/rest/v1/webhook_logs')), true);
});

test('no responde éxito cuando Supabase rechaza el upsert', async (t) => {
  t.mock.method(axios, 'post', async (url) => {
    if (url.endsWith('/rest/v1/leads_raw')) {
      const error = new Error('Supabase temporalmente no disponible');
      error.response = { status: 503, data: { message: 'unavailable' } };
      throw error;
    }
    return { status: 201, data: null };
  });

  const res = responseRecorder();
  await handleWebhook({ body: notionPayload() }, res);

  assert.equal(res.statusCode, 502);
  assert.equal(res.body.error, 'No se pudo guardar el webhook de CRM en Supabase');
});

test('rechaza páginas de Notion sin ID antes de intentar el upsert', async (t) => {
  const posts = [];
  t.mock.method(axios, 'post', async (url, body) => {
    posts.push({ url, body });
    return { status: 201, data: null };
  });

  const payload = notionPayload();
  delete payload.data.id;
  const res = responseRecorder();
  await handleWebhook({ body: payload }, res);

  assert.equal(res.statusCode, 422);
  assert.equal(posts.some(({ url }) => url.endsWith('/rest/v1/leads_raw')), false);
  assert.equal(posts.some(({ url }) => url.endsWith('/rest/v1/webhook_logs')), true);
});
