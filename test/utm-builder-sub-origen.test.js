const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/metricas-v2/views/generador-params.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'public/metricas-v2/js/views/herramientas.page.js'), 'utf8');

test('el generador ofrece sub_origen como parámetro extra de GHL dentro del preset', () => {
  assert.doesNotMatch(html, /id="utmSubOrigin"/);
  assert.match(script, /key: 'sub_origen'/);
  assert.match(script, /mergeTag: '\{\{contact\.sub_origen\}\}'/);
  assert.match(script, /normalizeSearchText\(row\.key\) === 'origen_actual'/);
  assert.doesNotMatch(script, /normalizeSearchText\(row\.key\) === 'sub_origen'/);
  assert.doesNotMatch(script, /key !== 'sub_origen'/);
});
