const assert = require('node:assert/strict');
const test = require('node:test');

process.env.SUPABASE_URL = 'https://supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

const { parseLimit } = require('../modules/metricasv2/services/supabase.service');

test('limita páginas grandes a 1000 filas sin volver al fallback de 100', () => {
  assert.equal(parseLimit(2000), 1000);
  assert.equal(parseLimit(5000), 1000);
  assert.equal(parseLimit(1000), 1000);
});

test('conserva el fallback seguro para límites inválidos', () => {
  assert.equal(parseLimit(0), 100);
  assert.equal(parseLimit('invalido'), 100);
});
