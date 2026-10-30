const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('lista cartas más allá de 500 para no truncar comparaciones y exportaciones', async () => {
  const calls = [];
  const module = { exports: {} };
  const axios = { get: async (url, options) => {
    assert.match(url, /csm_diagnosticos$/);
    calls.push(options.params);
    const size = options.params.offset === 0 ? 500 : 1;
    return { data: Array.from({ length: size }, (_, i) => ({ id: String(options.params.offset + i), client_name: `Cliente ${i}`, data: {} })) };
  } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../modules/metricasv2/services/diagnosticos.service.js'), 'utf8'), {
    module, exports: module.exports, require: (name) => name === 'axios' ? axios : name === '../config/env' ? { supabaseUrl: 'https://example.invalid', supabaseKey: 'test' } : require(name)
  });
  const rows = await module.exports.listDiagnosticos();
  assert.equal(rows.length, 501);
  assert.deepEqual(calls.map(call => call.offset), [0, 500]);
  assert.equal(calls[0].order, 'updated_at.desc,id.asc');
});
