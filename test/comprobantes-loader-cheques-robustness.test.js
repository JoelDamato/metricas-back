const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

const comprobantesLoaderService = require('../modules/metricasv2/services/comprobantes-loader.service');
const env = require('../modules/metricasv2/config/env');

const {
  buildDraftOperations,
  normalizePayload,
  validateChequeRows
} = comprobantesLoaderService._test;

const USER = {
  email: 'gaitanmauro23@gmail.com',
  nombre: 'Mauro Gaitan'
};

const CLIENT_PAGE_ID = '2a548251-7a95-810d-bad8-d6427a33cc02';
const RELATED_SALE_ID = '2b448251-7a95-80e1-a94e-dc4b64411ac1';
const PRODUCT_PAGE_ID = '11111111-1111-1111-1111-111111111111';
const PAYMENT_PAGE_ID = '22222222-2222-2222-2222-222222222222';
const RESPONSIBLE_USER_ID = '33333333-3333-3333-3333-333333333333';
const CHEQUE_DATES = [
  '2026-08-04',
  '2026-09-04',
  '2026-10-04',
  '2026-11-04',
  '2026-12-04',
  '2027-01-04'
];

function encodedPdf(label = 'comprobante') {
  return Buffer.from(`%PDF-1.4\n${label}\n%%EOF`).toString('base64');
}

function makeAttachment(index, overrides = {}) {
  const name = overrides.name || `cheque-${index}.pdf`;
  const base64 = overrides.base64 || encodedPdf(name);
  return {
    name,
    type: 'application/pdf',
    size: Buffer.from(base64, 'base64').length,
    base64,
    ...overrides
  };
}

function makeCheque(index, montoArs = 1_000_000, overrides = {}) {
  return {
    montoArs,
    fechaAcreditacion: CHEQUE_DATES[index - 1],
    archivoNombre: `cheque-${index}.pdf`,
    ...overrides
  };
}

function makeChequeBundle(count = 6, amounts = null) {
  const safeAmounts = amounts || Array.from({ length: count }, () => 1_000_000);
  return {
    cheques: safeAmounts.map((amount, index) => makeCheque(index + 1, amount)),
    attachmentFiles: safeAmounts.map((_, index) => makeAttachment(index + 1)),
    cashCollectedArs: safeAmounts.reduce((sum, amount) => sum + amount, 0)
  };
}

function makeSalePayload(overrides = {}) {
  const bundle = makeChequeBundle(6);
  return {
    tipo: 'Venta',
    ghlId: 'robust-sale-client',
    clientName: 'Cliente Venta Robusta',
    clientPageId: CLIENT_PAGE_ID,
    responsableVenta: 'Mauro Gaitan',
    fechaVenta: '2026-08-04',
    fechaAcreditacion: '2026-08-04',
    tc: 1_000,
    cashCollectedArs: bundle.cashCollectedArs,
    medioPago: 'E-cheq Bco Frances',
    dniCuit: '20123456789',
    productName: 'Meg 2.1',
    facturacionUsd: 100,
    cantidadPagos: 6,
    chequeCount: 6,
    cheques: bundle.cheques,
    attachmentFiles: bundle.attachmentFiles,
    submissionKey: 'robust-sale-default',
    ...overrides
  };
}

function makeCollectionPayload(overrides = {}) {
  const amounts = [100_000, 200_000, 300_000, 400_000, 500_000, 600_000];
  const bundle = makeChequeBundle(6, amounts);
  return {
    tipo: 'Cobranza',
    ghlId: 'robust-collection-client',
    clientName: 'Cliente Cobranza Robusta',
    clientPageId: CLIENT_PAGE_ID,
    responsableVenta: 'Mauro Gaitan',
    fechaVenta: '2026-02-12',
    fechaAcreditacion: '2026-08-04',
    tc: 1_000,
    cashCollectedArs: bundle.cashCollectedArs,
    medioPago: 'JT - E-Check',
    dniCuit: '20987654321',
    latestSaleId: RELATED_SALE_ID,
    chequeCount: 6,
    cheques: bundle.cheques,
    attachmentFiles: bundle.attachmentFiles,
    submissionKey: 'robust-collection-default',
    ...overrides
  };
}

test('Venta admite seis cheques aunque el cash USD supere ampliamente la facturación', () => {
  const normalized = normalizePayload(makeSalePayload(), USER);
  const operations = buildDraftOperations(normalized);

  assert.equal(normalized.cashCollectedArs / normalized.tc, 6_000);
  assert.equal(normalized.facturacionUsd, 100);
  assert.equal(normalized.chequeCount, 6);
  assert.equal(normalized.cantidadPagos, 6);
  assert.equal(operations.length, 6);
  assert.deepEqual(
    operations.map((operation) => operation.localType),
    ['Venta', 'Cobranza', 'Cobranza', 'Cobranza', 'Cobranza', 'Cobranza']
  );
  assert.equal(
    operations[0].properties['Cantidad de pagos'].select.name,
    '6 Pagos'
  );
});

test('Cobranza de seis cheques genera seis cobranzas relacionadas y conserva cada fila', () => {
  const payload = makeCollectionPayload();
  const normalized = normalizePayload(payload, USER);
  const operations = buildDraftOperations(normalized);
  const compactRelatedSaleId = RELATED_SALE_ID.replace(/-/g, '');

  assert.equal(operations.length, 6);
  assert.deepEqual(operations.map((operation) => operation.localType), Array(6).fill('Cobranza'));

  operations.forEach((operation, index) => {
    assert.equal(operation.properties['Cash AR'].number, payload.cheques[index].montoArs);
    assert.equal(
      operation.properties['Cash collected'].number,
      Number((payload.cheques[index].montoArs / payload.tc).toFixed(2))
    );
    assert.equal(
      operation.properties['Fecha de acreditacion'].date.start,
      payload.cheques[index].fechaAcreditacion
    );
    assert.equal(operation.properties['Fecha respaldo'].date.start, payload.fechaVenta);
    assert.equal(operation.properties['F.venta respaldo'].date.start, payload.fechaVenta);
    assert.equal(
      operation.properties['Venta relacionada'].relation[0].id,
      compactRelatedSaleId
    );
    assert.deepEqual(operation.attachmentNames, [payload.cheques[index].archivoNombre]);
    assert.equal(operation.properties['Cheque?'].checkbox, true);
    assert.equal(operation.properties.Finalizado.checkbox, true);
  });
});

test('un cheque único usa monto, fecha y archivo de su fila específica', () => {
  const attachment = makeAttachment(1);
  const cheque = makeCheque(1, 325_500, {
    fechaAcreditacion: '2026-12-31'
  });
  const normalized = normalizePayload(makeSalePayload({
    cashCollectedArs: 325_500,
    fechaAcreditacion: '2026-08-04',
    cantidadPagos: 1,
    chequeCount: 1,
    cheques: [cheque],
    attachmentFiles: [attachment]
  }), USER);
  const operations = buildDraftOperations(normalized);

  assert.equal(operations.length, 1);
  assert.equal(operations[0].localType, 'Venta');
  assert.equal(operations[0].properties['Cash AR'].number, 325_500);
  assert.equal(operations[0].properties['Fecha de acreditacion'].date.start, '2026-12-31');
  assert.deepEqual(operations[0].attachmentNames, ['cheque-1.pdf']);
});

test('rechaza cantidades de cheques 0, 7 o decimales', () => {
  for (const invalidCount of [0, 7, 1.5]) {
    assert.throws(
      () => validateChequeRows([], invalidCount, 1, [], { requireFiles: false }),
      /número entero entre 1 y 6/
    );
  }
});

test('rechaza montos de cheque nulos o negativos', () => {
  for (const invalidAmount of [0, -1]) {
    assert.throws(
      () => validateChequeRows([
        {
          montoArs: invalidAmount,
          fechaAcreditacion: '2026-08-04',
          archivoNombre: null
        }
      ], 1, invalidAmount, [], { requireFiles: false }),
      /monto del cheque 1 debe ser mayor a cero/
    );
  }
});

test('rechaza cuando la suma de cheques difiere del cash ARS total', () => {
  assert.throws(
    () => validateChequeRows([
      { montoArs: 1_000, fechaAcreditacion: '2026-08-04', archivoNombre: null },
      { montoArs: 2_000, fechaAcreditacion: '2026-09-04', archivoNombre: null }
    ], 2, 3_100, [], { requireFiles: false }),
    /suma de los cheques no coincide/
  );
});

test('rechaza archivoNombre vacío, inexistente o repetido entre cheques', () => {
  assert.throws(
    () => validateChequeRows([
      { montoArs: 1_000, fechaAcreditacion: '2026-08-04', archivoNombre: null }
    ], 1, 1_000, [makeAttachment(1)]),
    /archivo o foto de cada cheque/
  );

  assert.throws(
    () => validateChequeRows([
      { montoArs: 1_000, fechaAcreditacion: '2026-08-04', archivoNombre: 'no-existe.pdf' }
    ], 1, 1_000, [makeAttachment(1)]),
    /No encontré el archivo no-existe\.pdf/
  );

  assert.throws(
    () => validateChequeRows([
      { montoArs: 1_000, fechaAcreditacion: '2026-08-04', archivoNombre: 'mismo.pdf' },
      { montoArs: 1_000, fechaAcreditacion: '2026-09-04', archivoNombre: 'mismo.pdf' }
    ], 2, 2_000, [
      makeAttachment(1, { name: 'mismo.pdf' }),
      makeAttachment(2, { name: 'otro.pdf' })
    ]),
    /Cada cheque debe tener un archivo distinto/
  );
});

test('rechaza MIME no permitido y archivo cuyo contenido real supera 20 MB', () => {
  const invalidMimeFile = makeAttachment(1, {
    name: 'cheque-1.txt',
    type: 'text/plain'
  });
  assert.throws(
    () => normalizePayload(makeSalePayload({
      cashCollectedArs: 1_000,
      cantidadPagos: 1,
      chequeCount: 1,
      cheques: [makeCheque(1, 1_000)],
      attachmentFiles: [invalidMimeFile]
    }), USER),
    /debe ser JPG, PNG, WEBP o PDF/
  );

  const oversizedBase64 = Buffer.alloc((20 * 1024 * 1024) + 1, 0x61).toString('base64');
  const oversizedFile = makeAttachment(1, {
    base64: oversizedBase64,
    size: 1
  });
  assert.throws(
    () => normalizePayload(makeSalePayload({
      cashCollectedArs: 1_000,
      cantidadPagos: 1,
      chequeCount: 1,
      cheques: [makeCheque(1, 1_000)],
      attachmentFiles: [oversizedFile]
    }), USER),
    /supera el límite de 20 MB/
  );
});

function notionOptionPage(id, name) {
  return {
    id,
    properties: {
      Nombre: {
        type: 'title',
        title: [{ plain_text: name }]
      }
    }
  };
}

function createdNotionPageId(index) {
  return `00000000-0000-0000-0000-${String(index).padStart(12, '0')}`;
}

function installNotionMocks(t, { failPageAt = null, existingPages = [] } = {}) {
  const databaseId = 'test-comprobantes-database';
  const productDatabaseId = 'test-products-database';
  const paymentDatabaseId = 'test-payment-methods-database';
  const previousEnv = {
    supabaseUrl: env.supabaseUrl,
    supabaseKey: env.supabaseKey,
    notionApiKey: env.notionApiKey,
    notionComprobantesDatabaseId: env.notionComprobantesDatabaseId,
    notionDatabaseId: env.notionDatabaseId,
    notionProductsDatabaseId: env.notionProductsDatabaseId
  };
  env.supabaseUrl = 'https://supabase.test';
  env.supabaseKey = 'test-supabase-service-key';
  env.notionApiKey = 'test-notion-api-key';
  env.notionComprobantesDatabaseId = databaseId;
  env.notionDatabaseId = databaseId;
  env.notionProductsDatabaseId = productDatabaseId;
  t.after(() => Object.assign(env, previousEnv));

  const calls = {
    pageCreateAttempts: 0,
    createdProperties: [],
    fileUploadCreates: [],
    uploadRequests: [],
    filePatches: [],
    finalizationPatches: [],
    archivedPageIds: []
  };

  t.mock.method(axios, 'get', async (url) => {
    if (url === 'https://supabase.test/rest/v1/leads_raw') {
      return {
        data: [{
          id: CLIENT_PAGE_ID,
          ghlid: 'robust-sale-client',
          nombre: 'Cliente Venta Robusta',
          mail: 'cliente@example.com',
          telefono: '1111111111',
          etapa: 'Cliente'
        }]
      };
    }
    if (url === 'https://supabase.test/rest/v1/comprobantes') {
      return { data: [] };
    }
    if (url === `https://api.notion.com/v1/databases/${databaseId}`) {
      return {
        data: {
          properties: {
            Productos: { relation: { database_id: productDatabaseId } },
            'Medios de pago': { relation: { database_id: paymentDatabaseId } }
          }
        }
      };
    }
    if (url === 'https://api.notion.com/v1/users') {
      return {
        data: {
          results: [{
            id: RESPONSIBLE_USER_ID,
            type: 'person',
            name: 'Mauro Gaitan',
            person: { email: USER.email }
          }],
          has_more: false
        }
      };
    }
    throw new Error(`GET inesperado en mock: ${url}`);
  });

  t.mock.method(axios, 'post', async (url, body) => {
    if (url === `https://api.notion.com/v1/databases/${productDatabaseId}/query`) {
      return { data: { results: [notionOptionPage(PRODUCT_PAGE_ID, 'Meg 2.1')] } };
    }
    if (url === `https://api.notion.com/v1/databases/${paymentDatabaseId}/query`) {
      return { data: { results: [notionOptionPage(PAYMENT_PAGE_ID, 'E-cheq Bco Frances')] } };
    }
    if (url === `https://api.notion.com/v1/databases/${databaseId}/query`) {
      if (body?.filter?.property === 'Info Comprobantes') {
        return { data: { results: existingPages, has_more: false } };
      }
      return { data: { results: [], has_more: false } };
    }
    if (url === 'https://api.notion.com/v1/file_uploads') {
      const index = calls.fileUploadCreates.length + 1;
      calls.fileUploadCreates.push(index);
      return {
        data: {
          id: `file-upload-${index}`,
          upload_url: `https://uploads.test/${index}`
        }
      };
    }
    if (url === 'https://api.notion.com/v1/pages') {
      calls.pageCreateAttempts += 1;
      if (calls.pageCreateAttempts === failPageAt) {
        const error = new Error(`falló operación ${failPageAt}`);
        error.response = {
          status: 500,
          data: { message: `falló operación ${failPageAt}` }
        };
        throw error;
      }
      const id = createdNotionPageId(calls.pageCreateAttempts);
      calls.createdProperties.push(body.properties);
      return {
        data: {
          id,
          url: `https://notion.test/${id}`
        }
      };
    }
    throw new Error(`POST inesperado en mock: ${url}`);
  });

  t.mock.method(axios, 'patch', async (url, body) => {
    const pageId = url.split('/').pop();
    if (body?.archived === true) {
      calls.archivedPageIds.push(pageId);
    } else if (body?.properties?.Comprobante) {
      calls.filePatches.push({ pageId, files: body.properties.Comprobante.files });
    } else if (body?.properties?.Finalizado) {
      calls.finalizationPatches.push({ pageId, properties: body.properties });
    } else {
      throw new Error(`PATCH inesperado en mock: ${url}`);
    }
    return { data: { id: pageId } };
  });

  t.mock.method(globalThis, 'fetch', async (url) => {
    calls.uploadRequests.push(String(url));
    return {
      ok: true,
      status: 200,
      text: async () => ''
    };
  });

  return calls;
}

test('createComprobante crea seis páginas y seis adjuntos con dependencias Notion aisladas', async (t) => {
  const calls = installNotionMocks(t);
  const payload = makeSalePayload({
    submissionKey: 'robust-e2e-success-six'
  });

  const result = await comprobantesLoaderService.createComprobante(payload, USER);

  assert.equal(result.created.length, 6);
  assert.deepEqual(
    result.created.map((item) => item.type),
    ['Venta', 'Cobranza', 'Cobranza', 'Cobranza', 'Cobranza', 'Cobranza']
  );
  assert.equal(calls.pageCreateAttempts, 6);
  assert.equal(calls.fileUploadCreates.length, 6);
  assert.equal(calls.uploadRequests.length, 6);
  assert.equal(calls.filePatches.length, 6);
  assert.ok(calls.filePatches.every((patch) => patch.files.length === 1));
  assert.equal(calls.finalizationPatches.length, 1);
  assert.equal(calls.createdProperties[0]['Cantidad de pagos'].select.name, '6 Pagos');

  const createdSaleId = createdNotionPageId(1).replace(/-/g, '');
  calls.createdProperties.slice(1).forEach((properties) => {
    assert.equal(properties['Venta relacionada'].relation[0].id, createdSaleId);
  });
});

test('createComprobante archiva las tres páginas parciales si falla la operación cuatro', async (t) => {
  const calls = installNotionMocks(t, { failPageAt: 4 });
  const payload = makeSalePayload({
    submissionKey: 'robust-e2e-rollback-operation-four'
  });

  await assert.rejects(
    comprobantesLoaderService.createComprobante(payload, USER),
    (error) => {
      assert.match(error.message, /falló operación 4/);
      assert.deepEqual(
        [...error.details.rolledBackPageIds].sort(),
        [createdNotionPageId(1), createdNotionPageId(2), createdNotionPageId(3)].sort()
      );
      assert.deepEqual(error.details.rollbackFailedIds, []);
      return true;
    }
  );

  assert.equal(calls.pageCreateAttempts, 4);
  assert.deepEqual(
    [...calls.archivedPageIds].sort(),
    [createdNotionPageId(1), createdNotionPageId(2), createdNotionPageId(3)].sort()
  );
});

test('createComprobante reutiliza una carga persistida completa sin crear ni subir de nuevo', async (t) => {
  const payload = makeSalePayload({
    submissionKey: 'robust-e2e-persistent-replay'
  });
  const relatedSaleId = createdNotionPageId(1).replace(/-/g, '');
  const existingPages = payload.cheques.map((cheque, index) => ({
    id: createdNotionPageId(index + 1),
    url: `https://notion.test/${createdNotionPageId(index + 1)}`,
    properties: {
      Tipo: {
        select: { name: index === 0 ? 'Venta' : 'Cobranza' }
      },
      Comprobante: {
        files: [{ name: cheque.archivoNombre }]
      },
      'Cash AR': {
        number: cheque.montoArs
      },
      'Venta relacionada': {
        relation: [{ id: relatedSaleId }]
      }
    }
  }));
  const calls = installNotionMocks(t, { existingPages });

  const result = await comprobantesLoaderService.createComprobante(payload, USER);

  assert.equal(result.idempotentReplay, true);
  assert.equal(result.created.length, 6);
  assert.deepEqual(
    result.created.map((item) => item.id),
    existingPages.map((page) => page.id)
  );
  assert.equal(calls.pageCreateAttempts, 0);
  assert.equal(calls.fileUploadCreates.length, 0);
  assert.equal(calls.uploadRequests.length, 0);
  assert.equal(calls.filePatches.length, 0);
  assert.equal(calls.finalizationPatches.length, 0);
  assert.equal(calls.archivedPageIds.length, 0);
});
