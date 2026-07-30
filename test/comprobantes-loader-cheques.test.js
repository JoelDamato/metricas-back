const test = require('node:test');
const assert = require('node:assert/strict');

const {
  _test: {
    isChequePaymentMethod,
    buildChequeRows,
    buildDraftOperations,
    normalizePayload
  }
} = require('../modules/metricasv2/services/comprobantes-loader.service');

test('reconoce las variantes de E-cheq configuradas en Notion', () => {
  assert.equal(isChequePaymentMethod('Cheque'), true);
  assert.equal(isChequePaymentMethod('E-cheq Bco Frances'), true);
  assert.equal(isChequePaymentMethod('JT - E-Check'), true);
  assert.equal(isChequePaymentMethod('Transferencia'), false);
});

test('cada cheque conserva su fecha de acreditación', () => {
  const rows = buildChequeRows({
    fechaAcreditacion: '2026-07-27',
    cheques: [
      { montoArs: '1182396.87', fechaAcreditacion: '2026-07-27', archivoNombre: 'cheque-1.png' },
      { montoArs: '1182396.87', fechaAcreditacion: '2026-08-26', archivoNombre: 'cheque-2.png' },
      { montoArs: '1182396.87', fechaAcreditacion: '2026-09-26', archivoNombre: 'cheque-3.png' }
    ]
  });

  assert.deepEqual(rows.map((row) => row.fechaAcreditacion), [
    '2026-07-27',
    '2026-08-26',
    '2026-09-26'
  ]);
});

test('genera una venta y dos cobranzas con las fechas de cada cheque', () => {
  const operations = buildDraftOperations({
    tipo: 'Venta',
    ghlId: '8IKb3hCqlIn5u6SZBKbd',
    clientName: 'Matías Marcelo Gimenez',
    clientPageId: '2a548251-7a95-810d-bad8-d6427a33cc02',
    responsableVenta: 'Mauro Gaitan',
    responsableVentaUserIds: [],
    fechaVenta: '2026-07-27',
    fechaAcreditacion: '2026-07-27',
    tc: 1545,
    cashCollectedArs: 3547190.61,
    medioPago: 'E-cheq Bco Frances',
    medioPagoIds: [],
    dniCuit: '33322447',
    infoComprobantes: 'E-cheq emitidos por GIMENEZ MATIAS MARCELO',
    mesesSoporte: null,
    sesiones: null,
    bonusMati: false,
    attachmentNames: ['cheque-1.png', 'cheque-2.png', 'cheque-3.png'],
    facturacionUsd: 2295.92,
    productName: 'Meg 2.1',
    productIds: [],
    cantidadPagos: 3,
    latestSaleId: null,
    autoFinalizar: false,
    cheques: [
      { montoArs: 1182396.87, fechaAcreditacion: '2026-07-27', archivoNombre: 'cheque-1.png' },
      { montoArs: 1182396.87, fechaAcreditacion: '2026-08-26', archivoNombre: 'cheque-2.png' },
      { montoArs: 1182396.87, fechaAcreditacion: '2026-09-26', archivoNombre: 'cheque-3.png' }
    ]
  });

  assert.deepEqual(operations.map((operation) => operation.localType), ['Venta', 'Cobranza', 'Cobranza']);
  assert.deepEqual(
    operations.map((operation) => operation.properties['Fecha de acreditacion'].date.start),
    ['2026-07-27', '2026-08-26', '2026-09-26']
  );
  assert.deepEqual(
    operations.map((operation) => operation.properties['Fecha respaldo'].date.start),
    ['2026-07-27', '2026-07-27', '2026-07-27']
  );
  assert.deepEqual(
    operations.map((operation) => operation.attachmentNames[0]),
    ['cheque-1.png', 'cheque-2.png', 'cheque-3.png']
  );
  assert.deepEqual(
    operations.map((operation) => operation.properties['Cheque?'].checkbox),
    [true, true, true]
  );
});

test('solo una carga administrativa explícita puede omitir adjuntos', () => {
  const payload = {
    tipo: 'Venta',
    ghlId: '8IKb3hCqlIn5u6SZBKbd',
    clientName: 'Matías Marcelo Gimenez',
    clientPageId: '2a548251-7a95-810d-bad8-d6427a33cc02',
    responsableVenta: 'Mauro Gaitan',
    fechaVenta: '2026-07-27',
    fechaAcreditacion: '2026-07-27',
    tc: 1545,
    cashCollectedArs: 3547190.61,
    medioPago: 'E-cheq Bco Frances',
    dniCuit: '33322447',
    productName: 'Meg 2.1',
    facturacionUsd: 2295.92,
    cantidadPagos: 3,
    chequeCount: 3,
    cheques: [
      { montoArs: 1182396.87, fechaAcreditacion: '2026-07-27' },
      { montoArs: 1182396.87, fechaAcreditacion: '2026-08-26' },
      { montoArs: 1182396.87, fechaAcreditacion: '2026-09-26' }
    ],
    attachmentFiles: []
  };
  const user = { email: 'gaitanmauro23@gmail.com', nombre: 'Mauro Gaitan' };

  assert.throws(
    () => normalizePayload(payload, user),
    /Debés adjuntar el comprobante/
  );
  assert.doesNotThrow(
    () => normalizePayload(payload, user, { allowMissingAttachments: true })
  );
});
