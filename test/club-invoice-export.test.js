const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'public/metricas-v2/views/mercado-pago-club.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'public/metricas-v2/js/views/mercado-pago-club.page.js'), 'utf8');
const service = fs.readFileSync(path.join(root, 'modules/metricasv2/services/mercado-pago.service.js'), 'utf8');

test('Facturadas ofrece un Excel del mes con domicilio, localidad y provincia', () => {
  assert.match(page, /id="exportInvoiced"/);
  assert.match(script, /function splitRecipientAddress/);
  assert.match(script, /'Localidad', 'Provincia'/);
  assert.match(script, /facturas-club-\$\{monthInput\.value\}\.xls/);
  assert.match(script, /activeWorkflow !== 'invoiced'/);
  assert.match(service, /arcaRecipientAddress: .*recipientAddress/);
  assert.match(service, /arcaCaeExpiration: .*caeExpiration/);
});
