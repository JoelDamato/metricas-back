const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

const comprobantesLoaderService = require('../modules/metricasv2/services/comprobantes-loader.service');
const env = require('../modules/metricasv2/config/env');

const {
  _test: {
    getClubPriceOptions,
    applySelectedClubPrice,
    normalizePayload,
    buildDraftOperations
  }
} = comprobantesLoaderService;

const USER = { email: 'matirandazzo@gmail.com', nombre: 'Mati Randazzo' };

function clubPayload(overrides = {}) {
  return {
    tipo: 'Venta',
    ghlId: 'club-client-123',
    clientName: 'Cliente Club',
    clientPageId: '29f48251-7a95-800d-9168-fefc4ff0ff16',
    responsableVenta: 'Mati Randazzo',
    fechaVenta: '2026-08-14',
    fechaAcreditacion: '2026-08-14',
    tc: 1300,
    medioPago: 'Transferencia',
    productName: 'Club',
    clubPriceKey: 'club1',
    attachmentFiles: [],
    ...overrides
  };
}

test('lee Precio club 1 y Precio club 2 desde las propiedades del producto', () => {
  const options = getClubPriceOptions({
    'Precio club 1': { type: 'number', number: 39000 },
    'Precio club 2': { type: 'number', number: 25000 }
  });

  assert.deepEqual(options, [
    { key: 'club1', label: 'Precio Club 1', amountArs: 39000 },
    { key: 'club2', label: 'Precio Club 2', amountArs: 25000 }
  ]);
});

test('una venta Club no pide facturación ni cash manual y usa el precio validado de Notion', () => {
  const normalized = normalizePayload(clubPayload(), USER, { allowMissingAttachments: true });

  assert.equal(normalized.cashCollectedArs, null);
  assert.equal(normalized.facturacionUsd, null);
  assert.equal(normalized.cantidadPagos, 1);

  applySelectedClubPrice(normalized, {
    id: '29f48251-7a95-800d-9168-fefc4ff0ff16',
    name: 'Club',
    clubPriceOptions: [
      { key: 'club1', label: 'Precio Club 1', amountArs: 39000 },
      { key: 'club2', label: 'Precio Club 2', amountArs: 25000 }
    ]
  });
  normalized.productIds = ['29f48251-7a95-800d-9168-fefc4ff0ff16'];

  assert.equal(normalized.cashCollectedArs, 39000);
  assert.equal(normalized.facturacionUsd, 30);
  assert.equal(normalized.clubPriceLabel, 'Precio Club 1');

  const [operation] = buildDraftOperations(normalized);
  assert.equal(operation.properties['Cash AR'].number, 39000);
  assert.equal(operation.properties['Cash collected'].number, 30);
  assert.equal(operation.properties.Facturacion.number, 30);
  assert.match(operation.properties['Info Comprobantes'].rich_text[0].text.content, /Precio Club 1: ARS 39000/);
});

test('rechaza claves o importes de Club que no existen en Notion', () => {
  assert.throws(
    () => normalizePayload(clubPayload({ clubPriceKey: 'club3' }), USER, { allowMissingAttachments: true }),
    /precio de Club elegido no es válido/i
  );

  const normalized = normalizePayload(clubPayload({ clubPriceKey: 'club2' }), USER, { allowMissingAttachments: true });
  assert.throws(
    () => applySelectedClubPrice(normalized, {
      name: 'Club',
      clubPriceOptions: [{ key: 'club1', label: 'Precio Club 1', amountArs: 39000 }]
    }),
    /no existe o no tiene un importe válido en Notion/i
  );
});

test('crea una venta Club completa con un pago automático y los importes de Notion', async (t) => {
  const databaseId = 'test-club-comprobantes';
  const productsDatabaseId = 'test-club-products';
  const paymentsDatabaseId = 'test-club-payments';
  const productPageId = '29f48251-7a95-800d-9168-fefc4ff0ff16';
  const paymentPageId = '39f48251-7a95-800d-9168-fefc4ff0ff16';
  const createdPageId = '49f48251-7a95-800d-9168-fefc4ff0ff16';
  const previousEnv = {
    supabaseUrl: env.supabaseUrl,
    supabaseKey: env.supabaseKey,
    notionApiKey: env.notionApiKey,
    notionComprobantesDatabaseId: env.notionComprobantesDatabaseId,
    notionDatabaseId: env.notionDatabaseId,
    notionProductsDatabaseId: env.notionProductsDatabaseId
  };
  Object.assign(env, {
    supabaseUrl: 'https://supabase.club.test',
    supabaseKey: 'test-supabase-key',
    notionApiKey: 'test-notion-key',
    notionComprobantesDatabaseId: databaseId,
    notionDatabaseId: databaseId,
    notionProductsDatabaseId: productsDatabaseId
  });
  t.after(() => Object.assign(env, previousEnv));

  let createdProperties = null;
  let finalizedProperties = null;

  t.mock.method(axios, 'get', async (url) => {
    if (url === 'https://supabase.club.test/rest/v1/leads_raw') {
      return {
        data: [{
          id: productPageId,
          ghlid: 'club-client-123',
          nombre: 'Cliente Club',
          mail: 'club@example.com',
          telefono: '1111111111',
          etapa: 'Cliente'
        }]
      };
    }
    if (url === `https://api.notion.com/v1/databases/${databaseId}`) {
      return {
        data: {
          properties: {
            Productos: { relation: { database_id: productsDatabaseId } },
            'Medios de pago': { relation: { database_id: paymentsDatabaseId } }
          }
        }
      };
    }
    if (url === 'https://api.notion.com/v1/users') {
      return {
        data: {
          results: [{
            id: '59f48251-7a95-800d-9168-fefc4ff0ff16',
            type: 'person',
            name: 'Mati Randazzo',
            person: { email: USER.email }
          }],
          has_more: false
        }
      };
    }
    throw new Error(`GET inesperado en mock: ${url}`);
  });

  t.mock.method(axios, 'post', async (url, body) => {
    if (url === `https://api.notion.com/v1/databases/${productsDatabaseId}/query`) {
      return {
        data: {
          results: [{
            id: productPageId,
            properties: {
              Nombre: { type: 'title', title: [{ plain_text: 'Club' }] },
              'Precio club 1': { type: 'number', number: 39000 },
              'Precio club 2': { type: 'number', number: 25000 }
            }
          }]
        }
      };
    }
    if (url === `https://api.notion.com/v1/databases/${paymentsDatabaseId}/query`) {
      return {
        data: {
          results: [{
            id: paymentPageId,
            properties: {
              Nombre: { type: 'title', title: [{ plain_text: 'Transferencia' }] }
            }
          }]
        }
      };
    }
    if (url === `https://api.notion.com/v1/databases/${databaseId}/query`) {
      return { data: { results: [], has_more: false } };
    }
    if (url === 'https://api.notion.com/v1/pages') {
      createdProperties = body.properties;
      return { data: { id: createdPageId, url: `https://notion.test/${createdPageId}` } };
    }
    throw new Error(`POST inesperado en mock: ${url}`);
  });

  t.mock.method(axios, 'patch', async (url, body) => {
    assert.equal(url, `https://api.notion.com/v1/pages/${createdPageId}`);
    finalizedProperties = body.properties;
    return { data: { id: createdPageId } };
  });

  const result = await comprobantesLoaderService.createComprobante(clubPayload({
    cantidadPagos: 6,
    submissionKey: 'club-complete-one-payment'
  }), USER, { allowMissingAttachments: true });

  assert.equal(result.created.length, 1);
  assert.equal(createdProperties['Cantidad de pagos'].select.name, '1 Pago');
  assert.equal(createdProperties.Facturacion.number, 30);
  assert.equal(createdProperties['Cash AR'].number, 39000);
  assert.equal(createdProperties['Cash collected'].number, 30);
  assert.deepEqual(createdProperties.Productos.relation, [{ id: productPageId.replace(/-/g, '') }]);
  assert.equal(finalizedProperties.Finalizado.checkbox, true);
  assert.deepEqual(finalizedProperties['Venta relacionada'].relation, [{ id: createdPageId.replace(/-/g, '') }]);
});
