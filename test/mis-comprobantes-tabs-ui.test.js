const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/metricas-v2/views/mis-comprobantes.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'public/metricas-v2/js/views/mis-comprobantes.page.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'public/metricas-v2/css/styles.css'), 'utf8');

test('Mis comprobantes ofrece pestañas separadas para registros propios y como setter', () => {
  assert.match(html, /id="misComprobantesScopeTabs"/);
  assert.match(html, /data-comprobante-scope="mine"/);
  assert.match(html, /data-comprobante-scope="setter"/);
  assert.match(script, /row\.accessScope !== state\.scope/);
});

test('Mis comprobantes ofrece filtros por conciliación, no conciliación y rebote', () => {
  assert.match(html, /data-reconciliation="conciliated"/);
  assert.match(html, /data-reconciliation="not_conciliated"/);
  assert.match(html, /data-reconciliation="bounced"/);
  assert.match(script, /function isBouncedRow/);
  assert.match(script, /reconciliationMode === 'bounced'/);
});

test('la tabla de Mis comprobantes aprovecha el ancho disponible de pantalla', () => {
  assert.match(html, /mis-comprobantes-layout/);
  assert.match(styles, /\.mis-comprobantes-page \.mis-comprobantes-layout/);
  assert.match(styles, /width: calc\(100vw - clamp\(24px, 4vw, 72px\)\)/);
});
