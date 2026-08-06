const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

const comprobantesLoaderService = require('../modules/metricasv2/services/comprobantes-loader.service');
const env = require('../modules/metricasv2/config/env');

const CURRENT_CLIENT_PAGE_ID = '3ad48251-7a95-81a1-94fc-df8f32732e9b';
const DUPLICATE_CLIENT_PAGE_ID = '4ad48251-7a95-81a1-94fc-df8f32732e9b';
const FOREIGN_CLIENT_PAGE_ID = '2ec48251-7a95-81a7-ba63-ed03d7999010';
const FOREIGN_SALE_PAGE_ID = '3a848251-7a95-818a-9893-f8a69b7c456e';
const CSM_PAGE_ID = '5ad48251-7a95-81a1-94fc-df8f32732e9b';
const CURRENT_GHL_ID = 'OsKMU8RIm6w2ZXKpziAy';
const FOREIGN_GHL_ID = '2LFMcBeH4bSVveLllskD';
const NOTION_DATABASE_ID = 'test-sale-ownership-database';

function installEnv(t) {
  const previousEnv = {
    supabaseUrl: env.supabaseUrl,
    supabaseKey: env.supabaseKey,
    notionApiKey: env.notionApiKey,
    notionComprobantesDatabaseId: env.notionComprobantesDatabaseId,
    notionDatabaseId: env.notionDatabaseId
  };
  env.supabaseUrl = 'https://supabase.ownership.test';
  env.supabaseKey = 'test-supabase-service-key';
  env.notionApiKey = 'test-notion-api-key';
  env.notionComprobantesDatabaseId = NOTION_DATABASE_ID;
  env.notionDatabaseId = NOTION_DATABASE_ID;
  t.after(() => Object.assign(env, previousEnv));
}

function currentClientRow() {
  return {
    id: CURRENT_CLIENT_PAGE_ID,
    ghlid: CURRENT_GHL_ID,
    nombre: 'Alejandro Di Fabrizio',
    mail: 'alejandrodifabrizio@gmail.com',
    telefono: '011 7139-3494',
    etapa: 'Agendo'
  };
}

function foreignNotionSale() {
  return {
    id: FOREIGN_SALE_PAGE_ID,
    properties: {
      Tipo: { select: { name: 'Venta' } },
      Cliente: { relation: [{ id: FOREIGN_CLIENT_PAGE_ID }] },
      Identificador: {
        title: [{ plain_text: 'Transaccion de Alejandro Di Fabrizio' }]
      },
      'GHL ID': { formula: { string: FOREIGN_GHL_ID } },
      'Producto Format': { formula: { string: 'Meg 2.1' } },
      'F.venta respaldo': { date: { start: '2026-07-24' } },
      Facturacion: { number: 4527 },
      'Cash AR': { number: 1200000 },
      'Cash collected Total': { formula: { number: 1200 } }
    }
  };
}

test('hasSaleOwnership usa relación/GHL exactos y falla cerrado', () => {
  const { hasSaleOwnership } = comprobantesLoaderService._test;
  assert.equal(typeof hasSaleOwnership, 'function');

  const identity = {
    ghlId: CURRENT_GHL_ID,
    clientPageIds: [CURRENT_CLIENT_PAGE_ID]
  };

  const cases = [
    {
      name: 'acepta la relación directa aunque la venta no tenga GHL',
      sale: { clientPageId: CURRENT_CLIENT_PAGE_ID },
      relatedGhlIds: [],
      expected: true
    },
    {
      name: 'acepta otra página CRM únicamente si tiene el mismo GHL exacto',
      sale: { clientPageId: DUPLICATE_CLIENT_PAGE_ID },
      relatedGhlIds: [CURRENT_GHL_ID],
      expected: true
    },
    {
      name: 'prioriza la relación ajena aunque el GHL directo de la venta sea engañoso',
      sale: { clientPageId: FOREIGN_CLIENT_PAGE_ID, ghlId: CURRENT_GHL_ID },
      relatedGhlIds: [FOREIGN_GHL_ID],
      expected: false
    },
    {
      name: 'sin relación acepta el mismo GHL exacto',
      sale: { ghlId: CURRENT_GHL_ID },
      relatedGhlIds: [],
      expected: true
    },
    {
      name: 'sin relación rechaza GHL distinto',
      sale: { ghlId: FOREIGN_GHL_ID },
      relatedGhlIds: [],
      expected: false
    },
    {
      name: 'sin relación ni GHL rechaza por falta de identidad',
      sale: {},
      relatedGhlIds: [],
      expected: false
    },
    {
      name: 'trata el GHL como identificador opaco y sensible a mayúsculas',
      sale: { ghlId: CURRENT_GHL_ID.toLowerCase() },
      relatedGhlIds: [],
      expected: false
    },
    {
      name: 'rechaza una venta con relaciones mezcladas aunque una coincida',
      sale: { clientPageIds: [CURRENT_CLIENT_PAGE_ID, FOREIGN_CLIENT_PAGE_ID] },
      relatedGhlIds: [CURRENT_GHL_ID, FOREIGN_GHL_ID],
      expected: false
    }
  ];

  cases.forEach(({ name, sale, relatedGhlIds, expected }) => {
    assert.equal(
      hasSaleOwnership(sale, identity, relatedGhlIds),
      expected,
      name
    );
  });
});

test('lookup automático no usa nombre/título y descarta una venta de otro cliente', async (t) => {
  installEnv(t);
  const notionQueries = [];
  const relatedClientLookups = [];

  t.mock.method(axios, 'get', async (url, config = {}) => {
    if (url === 'https://supabase.ownership.test/rest/v1/leads_raw') {
      if (config.params?.ghlid === `eq.${CURRENT_GHL_ID}`) {
        return { data: [currentClientRow()] };
      }
      if (config.params?.id) {
        relatedClientLookups.push(config.params.id);
        return {
          data: [{ id: FOREIGN_CLIENT_PAGE_ID, ghlid: FOREIGN_GHL_ID }]
        };
      }
    }
    if (url === 'https://supabase.ownership.test/rest/v1/comprobantes') {
      return { data: [] };
    }
    throw new Error(`GET inesperado en mock: ${url}`);
  });

  t.mock.method(axios, 'post', async (url, body) => {
    if (url === `https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`) {
      notionQueries.push(body);
      // La respuesta maliciosa/defectuosa simula una venta cuyo título coincide,
      // pero cuya relación Cliente pertenece a otra persona.
      return { data: { results: [foreignNotionSale()] } };
    }
    throw new Error(`POST inesperado en mock: ${url}`);
  });

  const client = await comprobantesLoaderService.lookupClientByGhlId(CURRENT_GHL_ID);

  assert.equal(client.pageId, CURRENT_CLIENT_PAGE_ID);
  assert.equal(client.latestSale, null);
  assert.equal(notionQueries.length, 1);
  assert.equal(relatedClientLookups.length, 1);

  const serializedFilter = JSON.stringify(notionQueries[0].filter);
  assert.match(serializedFilter, /"property":"Cliente"/);
  assert.match(serializedFilter, new RegExp(CURRENT_CLIENT_PAGE_ID));
  assert.doesNotMatch(serializedFilter, /Identificador|Alejandro Di Fabrizio/i);
});

test('un cliente encontrado sólo en CSM usa su relación CRM 2.0 y no la página CSM', async (t) => {
  installEnv(t);

  t.mock.method(axios, 'get', async (url, config = {}) => {
    if (url === 'https://supabase.ownership.test/rest/v1/leads_raw') {
      return { data: [] };
    }
    if (url === 'https://supabase.ownership.test/rest/v1/csm') {
      assert.equal(config.params?.ghlid, `eq.${CURRENT_GHL_ID}`);
      return {
        data: [{
          id: CSM_PAGE_ID,
          ghlid: CURRENT_GHL_ID,
          nombre: 'Alejandro Di Fabrizio',
          mail: 'alejandro@example.com',
          telefono: '011 7139-3494',
          actividad: 'Activo',
          crm_2_0: CURRENT_CLIENT_PAGE_ID
        }]
      };
    }
    if (url === `https://api.notion.com/v1/pages/${CURRENT_CLIENT_PAGE_ID.replace(/-/g, '')}`) {
      return {
        data: {
          id: CURRENT_CLIENT_PAGE_ID,
          properties: {
            'GHL ID': { formula: { string: CURRENT_GHL_ID } }
          }
        }
      };
    }
    if (url === 'https://supabase.ownership.test/rest/v1/comprobantes') {
      return { data: [] };
    }
    throw new Error(`GET inesperado en mock: ${url}`);
  });

  t.mock.method(axios, 'post', async (url) => {
    if (url === `https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`) {
      return { data: { results: [] } };
    }
    throw new Error(`POST inesperado en mock: ${url}`);
  });

  const client = await comprobantesLoaderService.lookupClientByGhlId(CURRENT_GHL_ID);

  assert.equal(client.source, 'csm');
  assert.equal(client.pageId, CURRENT_CLIENT_PAGE_ID.replace(/-/g, ''));
  assert.notEqual(client.pageId, CSM_PAGE_ID.replace(/-/g, ''));
  assert.deepEqual(client.pageIds, [CURRENT_CLIENT_PAGE_ID.replace(/-/g, '')]);
});

test('lookup manual rechaza una venta relacionada a otro cliente', async (t) => {
  installEnv(t);

  t.mock.method(axios, 'get', async (url, config = {}) => {
    if (url === 'https://supabase.ownership.test/rest/v1/comprobantes') {
      assert.equal(config.params?.id, `eq.${FOREIGN_SALE_PAGE_ID.replace(/-/g, '')}`);
      return {
        data: [{
          id: FOREIGN_SALE_PAGE_ID,
          cliente: FOREIGN_CLIENT_PAGE_ID,
          cliente_format: 'Transaccion de Alejandro Di Fabrizio',
          // Incluso un GHL directo incorrectamente copiado no debe superar la relación.
          ghlid: CURRENT_GHL_ID,
          producto_format: 'Meg 2.1',
          f_venta: '2026-07-24',
          facturacion: 4527,
          cash_ar: 1200000,
          cash_collected_total: 1200,
          tipo: 'Venta'
        }]
      };
    }
    if (url === 'https://supabase.ownership.test/rest/v1/leads_raw') {
      if (config.params?.ghlid === `eq.${CURRENT_GHL_ID}`) {
        return { data: [currentClientRow()] };
      }
      if (config.params?.id) {
        return {
          data: [{ id: FOREIGN_CLIENT_PAGE_ID, ghlid: FOREIGN_GHL_ID }]
        };
      }
    }
    throw new Error(`GET inesperado en mock: ${url}`);
  });

  await assert.rejects(
    comprobantesLoaderService.lookupRelatedSaleById(FOREIGN_SALE_PAGE_ID, {
      ghlId: CURRENT_GHL_ID,
      clientPageId: CURRENT_CLIENT_PAGE_ID
    }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.message, 'La venta relacionada pertenece a otro cliente');
      return true;
    }
  );
});

test('lookup manual falla cerrado si una venta tiene relaciones de clientes mezcladas', async (t) => {
  installEnv(t);

  t.mock.method(axios, 'get', async (url, config = {}) => {
    if (url === 'https://supabase.ownership.test/rest/v1/comprobantes') {
      return {
        data: [{
          id: FOREIGN_SALE_PAGE_ID,
          cliente: [CURRENT_CLIENT_PAGE_ID, FOREIGN_CLIENT_PAGE_ID],
          cliente_format: 'Relación mezclada',
          ghlid: CURRENT_GHL_ID,
          producto_format: 'Meg 2.1',
          f_venta: '2026-07-24',
          facturacion: 4527,
          cash_ar: 1200000,
          cash_collected_total: 1200,
          tipo: 'Venta'
        }]
      };
    }
    if (
      url === 'https://supabase.ownership.test/rest/v1/leads_raw'
      && config.params?.ghlid === `eq.${CURRENT_GHL_ID}`
    ) {
      return { data: [currentClientRow()] };
    }
    throw new Error(`GET inesperado en mock: ${url}`);
  });

  await assert.rejects(
    comprobantesLoaderService.lookupRelatedSaleById(FOREIGN_SALE_PAGE_ID, {
      ghlId: CURRENT_GHL_ID,
      clientPageId: CURRENT_CLIENT_PAGE_ID
    }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.message, 'La venta relacionada pertenece a otro cliente');
      return true;
    }
  );
});

test('una venta de Notion puede usar Fecha correspondiente cuando falta F.venta respaldo', () => {
  const { mapNotionSalePage } = comprobantesLoaderService._test;
  const sale = mapNotionSalePage({
    id: FOREIGN_SALE_PAGE_ID,
    properties: {
      'Fecha correspondiente': {
        formula: { date: { start: '2025-11-28' } }
      },
      'Fecha de acreditacion': { date: { start: '2026-08-06' } }
    }
  });

  assert.equal(sale.fechaVenta, '2025-11-28');
  assert.equal(sale.fechaAcreditacion, '2026-08-06');
});
