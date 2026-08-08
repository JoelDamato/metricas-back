const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/metricas-v2/views/generador-params.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'public/metricas-v2/js/views/herramientas.page.js'), 'utf8');

test('el generador permite guardar sub_origen como campo GHL dentro del preset', () => {
  assert.match(html, /id="utmSubOrigin"/);
  assert.match(html, /sub_origen <small>\(campo GHL\)<\/small>/);
  assert.match(script, /key: 'sub_origen'/);
  assert.match(script, /mergeTag: '\{\{contact\.sub_origen\}\}'/);
  assert.match(script, /params\.sub_origen = subOrigin/);
  assert.match(script, /params\.sub_origen \|\| ''/);
  assert.match(script, /key !== 'sub_origen'/);
});
