const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('receipt lifecycle succeeds with reconciliation note columns and insert defaults installed', () => {
  const result = spawnSync(process.execPath, ['scripts/validate_comprobantes_runtime.js'], {
    cwd: path.resolve(__dirname, '..'), encoding: 'utf8', timeout: 30000
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.sale, true);
  assert.equal(report.collection, true);
  assert.equal(report.notionRequests, 0);
});
