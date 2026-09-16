const test = require('node:test');
const assert = require('node:assert/strict');
const { mapToSupabase } = require('../controllers/webhooksheets2');

function richText(value) {
  return {
    type: 'rich_text',
    rich_text: [{ plain_text: value }]
  };
}

function formulaString(value) {
  return {
    type: 'formula',
    formula: { type: 'string', string: value }
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

test('normaliza números argentinos devueltos como texto por fórmulas históricas', () => {
  const row = mapToSupabase({
    data: {
      id: 'notion-page-id',
      properties: {
        Facturacion: formulaString('0,0'),
        'Facturacion total': formulaString('1.234,56'),
        'Cash collected total': formulaString('1234.56')
      }
    }
  });

  assert.equal(row.facturacion, 0);
  assert.equal(row.facturacion_total, 1234.56);
  assert.equal(row.cash_collected_total, 1234.56);
});
