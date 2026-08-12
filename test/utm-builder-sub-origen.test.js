const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/metricas-v2/views/generador-params.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'public/metricas-v2/js/views/herramientas.page.js'), 'utf8');

test('el generador ofrece sub_origen como parámetro extra de GHL dentro del preset', () => {
  assert.match(html, /id="utmSubOrigin"/);
  assert.match(script, /const subOrigin = String\(document\.getElementById\('utmSubOrigin'\)/);
  assert.match(script, /params\.sub_origen = subOrigin/);
  assert.match(script, /normalizeSearchText\(row\.key\) === 'origen_actual'/);
  assert.match(script, /normalizeSearchText\(row\.key\) === 'sub_origen'/);
});
