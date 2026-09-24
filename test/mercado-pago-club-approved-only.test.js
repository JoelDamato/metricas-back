const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

process.env.SUPABASE_URL = 'https://supabase.club-approved.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
process.env.MERCADO_PAGO_ACCESS_TOKEN = 'test-access-token';

const axios = require('axios');
const service = require('../modules/metricasv2/services/mercado-pago.service');
const arcaInvoicingService = require('../modules/metricasv2/services/arca-invoicing.service');

const root = path.resolve(__dirname, '..');
const pageScript = fs.readFileSync(path.join(root, 'public/metricas-v2/js/views/mercado-pago-club.page.js'), 'utf8');
const pageHtml = fs.readFileSync(path.join(root, 'public/metricas-v2/views/mercado-pago-club.html'), 'utf8');

test('la identificación usa additional_info cuando payer trae un objeto vacío', () => {
  assert.deepEqual(service.paymentIdentification({
    payer: { identification: { type: null, number: null } },
    additional_info: { payer: { identification: { type: 'DNI', number: '30111222' } } }
  }), { type: 'DNI', number: '30111222' });
});

test('CUIL se acepta como identificación válida y usa su código documental de ARCA', async () => {
  assert.deepEqual(service.paymentIdentification({
    payer: { identification: { type: 'CUIL', number: '20324887629' } }
  }), { type: 'CUIL', number: '20324887629' });
  assert.equal(service.validateRecipientFields({
    payer: 'Cliente con CUIL',
    payerAddress: 'Calle 123',
    vatConditionId: 5,
    identificationType: 'CUIL',
    identificationNumber: '20324887629'
  }).identificationType, 'CUIL');
  const preview = await arcaInvoicingService.previewInvoice({
    source: 'manual',
    status: 'manual',
    currency: 'ARS',
    amount: 1000,
    description: 'Club del Costo',
    payer: 'Cliente con CUIL',
    payerAddress: 'Calle 123',
    vatConditionId: 5,
    requestedInvoiceType: 'B',
    identificationType: 'CUIL',
    identificationNumber: '20324887629'
  });
  assert.equal(preview.documentType, 86);
  assert.equal(preview.documentNumber, '20324887629');
  assert.match(pageScript, /\['CUIT', 'CUIL'\]\.includes\(type\)/);
});

test('la cola facturable admite sólo pagos aprobados y cargas manuales', () => {
  assert.equal(service.isBillableClubRecord({ kind: 'payment', status: 'approved' }), true);
  assert.equal(service.isBillableClubRecord({ kind: 'payment', status: 'pending' }), false);
  assert.equal(service.isBillableClubRecord({ kind: 'subscription', status: 'authorized' }), false);
  assert.equal(service.isBillableClubRecord({ kind: 'manual', status: 'manual' }), true);
});

test('Ventas Club consulta sólo pagos aprobados, no preapprovals, y completa el DNI desde el detalle', async () => {
  const originalCreate = axios.create;
  const originalGet = axios.get;
  const calls = [];
  axios.create = () => ({
    get: async (url, options = {}) => {
      calls.push({ url, params: options.params || {} });
      if (url === '/v1/payments/search') {
        return {
          data: {
            paging: { total: 3 },
            results: [
              { id: 99001, date_created: '2026-09-10T12:00:00Z', status: 'approved', description: 'Club del Costo', payer: { email: 'cliente@example.com', identification: {} }, transaction_amount: 1000, currency_id: 'ARS' },
              { id: 99002, date_created: '2026-09-11T12:00:00Z', status: 'pending', description: 'Club del Costo', transaction_amount: 1200, currency_id: 'ARS' },
              { id: 99003, date_created: '2026-09-12T12:00:00Z', status: 'approved', description: 'Otro producto', transaction_amount: 1400, currency_id: 'ARS' }
            ]
          }
        };
      }
      if (url === '/v1/payments/99001') {
        return { data: { id: 99001, payer: { identification: { type: 'DNI', number: '30111222' } } } };
      }
      throw new Error(`Consulta inesperada: ${url}`);
    }
  });
  axios.get = async (url) => {
    assert.match(url, /mercado_pago_club_workflow/);
    return { data: [] };
  };

  try {
    const result = await service.getClubRecords('2026-09');
    assert.equal(result.records.length, 1);
    assert.equal(result.records[0].kind, 'payment');
    assert.equal(result.records[0].status, 'approved');
    assert.equal(result.records[0].identificationType, 'DNI');
    assert.equal(result.records[0].identificationNumber, '30111222');
    assert.equal(result.totals.subscriptions, 0);
    assert.equal(result.totals.missingIdentification, 0);
    assert.equal(calls.some((call) => call.url === '/preapproval/search'), false);
    assert.equal(calls.find((call) => call.url === '/v1/payments/search').params.status, 'approved');
  } finally {
    axios.create = originalCreate;
    axios.get = originalGet;
  }
});

test('el backend rechaza conciliar suscripciones autorizadas o pagos pendientes', async () => {
  await assert.rejects(
    service.reconcileRecords([{ kind: 'subscription', id: 'sub-1', status: 'authorized' }], { email: 'admin@example.com' }),
    /Solo se pueden conciliar pagos.*aprobado/i
  );
  await assert.rejects(
    service.reconcileRecords([{ kind: 'payment', id: 'pay-1', status: 'pending' }], { email: 'admin@example.com' }),
    /Solo se pueden conciliar pagos.*aprobado/i
  );
});

test('la facturación abre la previsualización directamente sin exigir formularios intermedios', () => {
  assert.throws(() => service.validateRecipientFields({
    payer: 'Cliente sin documento',
    payerAddress: 'Calle 123',
    vatConditionId: 5,
    identificationType: '',
    identificationNumber: ''
  }), /DNI, CUIT o CUIL válido/);
  assert.match(pageScript, /await openResolvedInvoicePreview\(records\)/);
  assert.doesNotMatch(pageScript, /completeRecipientData/);
  assert.doesNotMatch(pageScript, /Completá los datos fiscales .* antes de facturar/);
  assert.match(pageScript, /approved: 'Aprobado'/);
  assert.match(pageScript, /Sin DNI\/CUIT/);
  assert.match(pageHtml, /direct-invoice-1/);
});
