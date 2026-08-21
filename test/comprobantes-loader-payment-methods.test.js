const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const axios = require('axios');

const comprobantesLoaderService = require('../modules/metricasv2/services/comprobantes-loader.service');
const env = require('../modules/metricasv2/config/env');
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
  assert.equal(isNotionPaymentMethodActive({ Estado: { type: 'status', status: { name: 'Activo' } } }), true);
  assert.equal(isNotionPaymentMethodActive({ 'Estado del producto': { type: 'select', select: { name: 'Inactivo' } } }), false);
  assert.equal(isNotionPaymentMethodActive({ Status: { type: 'status', status: { name: 'Activo' } } }), true);
  assert.equal(isNotionPaymentMethodActive({ Status: { type: 'status', status: { name: 'Inactivo' } } }), false);
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

test('carga todos los productos activos desde la base configurada de Notion', async (t) => {
  const comprobantesDatabaseId = 'test-comprobantes-products';
  const productsDatabaseId = '280482517a95804cbbcae130cc9f1ecb';
  const paymentDatabaseId = 'test-payment-products';
  const previousEnv = {
    notionApiKey: env.notionApiKey,
    notionComprobantesDatabaseId: env.notionComprobantesDatabaseId,
    notionDatabaseId: env.notionDatabaseId,
    notionProductsDatabaseId: env.notionProductsDatabaseId
  };
  Object.assign(env, {
    notionApiKey: 'test-notion-key',
    notionComprobantesDatabaseId: comprobantesDatabaseId,
    notionDatabaseId: comprobantesDatabaseId,
    notionProductsDatabaseId: productsDatabaseId
  });
  t.after(() => Object.assign(env, previousEnv));

  t.mock.method(axios, 'get', async (url) => {
    assert.equal(url, `https://api.notion.com/v1/databases/${comprobantesDatabaseId}`);
    return {
      data: {
        properties: {
          Productos: { relation: { database_id: 'otra-base-que-no-debe-usarse' } },
          'Medios de pago': { relation: { database_id: paymentDatabaseId } }
        }
      }
    };
  });

  const queriedDatabases = [];
  t.mock.method(axios, 'post', async (url) => {
    queriedDatabases.push(url);
    if (url === `https://api.notion.com/v1/databases/${productsDatabaseId}/query`) {
      const product = (id, name, active) => ({
        id,
        properties: {
          Nombre: { type: 'title', title: [{ plain_text: name }] },
          Activo: { type: 'checkbox', checkbox: active }
        }
      });
      return {
        data: {
          results: [
            product('product-active-1', 'Producto nuevo A', true),
            product('product-active-2', 'Producto nuevo B', true),
            product('product-inactive', 'Producto oculto', false)
          ]
        }
      };
    }
    if (url === `https://api.notion.com/v1/databases/${paymentDatabaseId}/query`) {
      return { data: { results: [] } };
    }
    throw new Error(`POST inesperado en mock: ${url}`);
  });

  const bootstrap = await comprobantesLoaderService.getBootstrap({
    email: 'test@example.com',
    nombre: 'Test'
  });

  assert.deepEqual(bootstrap.products, ['Producto nuevo A', 'Producto nuevo B']);
  assert.equal(bootstrap.productsSource, 'notion');
  assert.ok(queriedDatabases.includes(`https://api.notion.com/v1/databases/${productsDatabaseId}/query`));
  assert.ok(!queriedDatabases.some((url) => url.includes('otra-base-que-no-debe-usarse')));
});
