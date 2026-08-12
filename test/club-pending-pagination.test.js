const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'public/metricas-v2/views/mercado-pago-club.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'public/metricas-v2/js/views/mercado-pago-club.page.js'), 'utf8');

test('Pendientes se divide en tandas de cuarenta y selecciona sólo la tanda visible', () => {
  assert.match(page, /id="pagination"/);
  assert.match(script, /const PENDING_PAGE_SIZE = 40/);
  assert.match(script, /records\.slice\(from, from \+ PENDING_PAGE_SIZE\)/);
  assert.match(script, /visibleRecords\(\)\.forEach/);
  assert.match(script, /selectedKeys\.clear\(\);\s+renderRecords\(\);/);
  assert.match(script, /Tanda \$\{currentPage\} de \$\{totalPages\}/);
});
