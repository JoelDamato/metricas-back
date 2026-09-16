const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

const {
  normalizeSince,
  fetchChangedPages,
  upsertRows,
  verifyRows
} = require('../scripts/resync_notion_crm_since');

test('normaliza la fecha inicial y rechaza valores inválidos', () => {
  assert.equal(normalizeSince('2026-09-13'), '2026-09-13T00:00:00.000Z');
  assert.throws(() => normalizeSince('ayer'), /ISO válido/);
});

test('pagina cambios de Notion ordenados por última edición', async () => {
  const calls = [];
  const notion = {
    databases: {
      query: async (params) => {
        calls.push(params);
        if (calls.length === 1) {
          return {
            results: [{ id: 'page-1' }],
            has_more: true,
            next_cursor: 'cursor-2'
          };
        }
        return {
          results: [{ id: 'page-2' }],
          has_more: false,
          next_cursor: null
        };
      }
    }
  };

  const pages = await fetchChangedPages(
    notion,
    'crm-database',
    '2026-09-13T00:00:00.000Z'
  );

  assert.deepEqual(pages.map((page) => page.id), ['page-1', 'page-2']);
  assert.equal(calls[0].filter.timestamp, 'last_edited_time');
  assert.equal(calls[0].sorts[0].direction, 'ascending');
  assert.equal(calls[1].start_cursor, 'cursor-2');
});

test('hace upsert por ID en lotes y verifica todas las filas', async (t) => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  const posts = [];

  t.mock.method(axios, 'post', async (url, body, config) => {
    posts.push({ url, body, config });
    return { status: 201 };
  });
  t.mock.method(axios, 'get', async (_url, config) => {
    const ids = config.params.id.slice(4, -1).split(',');
    return { data: ids.map((id) => ({ id })) };
  });

  const rows = Array.from({ length: 101 }, (_, index) => ({ id: `page-${index}` }));
  await upsertRows(rows);
  const missing = await verifyRows(rows.map((row) => row.id));

  assert.deepEqual(posts.map(({ body }) => body.length), [50, 50, 1]);
  assert.equal(posts.every(({ config }) => config.params.on_conflict === 'id'), true);
  assert.deepEqual(missing, []);
});
