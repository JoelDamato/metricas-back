const test = require('node:test');
const assert = require('node:assert/strict');

const {
  _test: {
    getClubPriceOptions,
    applySelectedClubPrice,
    normalizePayload,
    buildDraftOperations
  }
} = require('../modules/metricasv2/services/comprobantes-loader.service');

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
    cantidadPagos: 1,
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
