const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_URL = 'https://supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

const axios = require('axios');
const mercadoPagoService = require('../modules/metricasv2/services/mercado-pago.service');

function workflowRow(index) {
  return {
    record_kind: 'payment',
    record_id: String(index).padStart(12, '0'),
    status: 'invoiced',
    record_snapshot: {
      kind: 'payment',
      id: String(index).padStart(12, '0'),
      date: '2026-08-20T12:00:00.000Z'
    },
    reconciled_at: '2026-08-20T12:00:00.000Z',
    invoiced_at: '2026-08-20T12:05:00.000Z',
    arca_cae: `CAE-${index}`,
    arca_invoice_number: `00005-${String(index).padStart(8, '0')}`
  };
}

test('lee más de 1000 filas del workflow con un cursor estable', async () => {
  const originalGet = axios.get;
  const calls = [];
  axios.get = async (_url, options) => {
    calls.push(options.params);
    if (calls.length === 1) return { data: Array.from({ length: 1000 }, (_, index) => workflowRow(index + 1)) };
    return { data: Array.from({ length: 11 }, (_, index) => workflowRow(index + 1001)) };
  };

  try {
    const result = await mercadoPagoService.getStoredWorkflowRecords('2026-08', 'invoiced');

    assert.equal(result.records.length, 1011);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].order, 'record_kind.asc,record_id.asc');
    assert.equal(calls[0].limit, 1000);
    assert.match(calls[1].or, /record_kind\.eq\.payment,record_id\.gt\.000000001000/);
  } finally {
    axios.get = originalGet;
  }
});
