const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const comprobantesLoaderService = require('../modules/metricasv2/services/comprobantes-loader.service');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/metricas-v2/views/carga-comprobantes.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'public/metricas-v2/js/views/carga-comprobantes.page.js'), 'utf8');

test('interpreta Activo de Notion y obtiene la leyenda de Cuenta', () => {
  const { isNotionPaymentMethodActive, notionPropertyDisplayText } = comprobantesLoaderService._test;

  assert.equal(isNotionPaymentMethodActive({ Activo: { type: 'checkbox', checkbox: true } }), true);
  assert.equal(isNotionPaymentMethodActive({ Activo: { type: 'checkbox', checkbox: false } }), false);
  assert.equal(isNotionPaymentMethodActive({ Activo: { type: 'formula', formula: { boolean: true } } }), true);
  assert.equal(isNotionPaymentMethodActive({ Activo: { type: 'select', select: { name: 'Activo' } } }), true);
  assert.equal(isNotionPaymentMethodActive({ Activo: { type: 'status', status: { name: 'No activo' } } }), false);
  assert.equal(
    notionPropertyDisplayText({ type: 'rich_text', rich_text: [{ plain_text: 'Banco Nación · 12345' }] }),
    'Banco Nación · 12345'
  );
});

test('el cargador muestra la Cuenta del medio de pago elegido junto al CUIT', () => {
  assert.match(html, /id="paymentAccountHint"/);
  assert.match(script, /function updatePaymentAccountHint\(\)/);
  assert.match(script, /Cuenta: \$\{account\}/);
  assert.match(script, /refs\.medioPago\?\.addEventListener\('change'/);
});
