const test = require('node:test');
const assert = require('node:assert/strict');
const { mapToSupabase } = require('../controllers/webhooksheets2');

function richText(value) {
  return {
    type: 'rich_text',
    rich_text: [{ plain_text: value }]
  };
}

test('mapea "Origen Actual" de Notion a origen_actual en Supabase', () => {
  const row = mapToSupabase({
    data: {
      id: 'notion-page-id',
      properties: {
        'Origen Actual': richText('Instagram orgánico')
      }
    }
  });

  assert.equal(row.origen_actual, 'Instagram orgánico');
});

test('tolera el nombre histórico "Origen actual"', () => {
  const row = mapToSupabase({
    data: {
      id: 'notion-page-id',
      properties: {
        'Origen actual': richText('Referido')
      }
    }
  });

  assert.equal(row.origen_actual, 'Referido');
});
