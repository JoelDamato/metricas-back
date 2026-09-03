const test = require('node:test');
const assert = require('node:assert/strict');

const commissionsService = require('../modules/metricasv2/services/commissions.service');

const {
  hasCommissionAgendaSignals,
  buildLiveAgendaCountMap,
  qualifiesForSettingTransaction,
  buildTransactionDetails,
  buildMarketingAreaSummary
} = commissionsService._test;

function agenda(overrides = {}) {
  return {
    setter: 'Nahuel Iasci',
    fecha_agenda: '2026-07-15T15:00:00-03:00',
    agendo: 'Agendo',
    aplica: 'Aplica',
    origen_actual: '',
    origen: '',
    primer_origen: '',
    ultimo_origen: '',
    calendario_agendado: '',
    ...overrides
  };
}

test('Nahuel cuenta Agendo + Aplica cuando Origen Actual es APSET', () => {
  const row = agenda({
    origen_actual: 'Postulación MEG - APSET',
    origen: 'VSL',
    calendario_agendado: 'Calendario general'
  });

  assert.equal(hasCommissionAgendaSignals(row), true);
});

test('Nahuel ignora origen y calendario históricos si Origen Actual no es APSET', () => {
  const row = agenda({
    origen_actual: 'Instagram orgánico',
    origen: 'APSET histórico',
    ultimo_origen: 'APSET histórico',
    calendario_agendado: 'APSET'
  });

  assert.equal(hasCommissionAgendaSignals(row), false);
});

test('el conteo mensual de Nahuel usa únicamente Origen Actual APSET', () => {
  const rows = [
    agenda({ origen_actual: 'APSET', origen: 'VSL' }),
    agenda({ origen_actual: 'VSL', origen: 'APSET', calendario_agendado: 'APSET' }),
    agenda({ origen_actual: 'APSET', aplica: 'No aplica' })
  ];

  const result = buildLiveAgendaCountMap(rows, '2026-07');

  assert.equal(result.get('nahuel iasci')?.agendo, 1);
});

test('otros setters usan únicamente Origen Actual APSET / RT', () => {
  const row = agenda({
    setter: 'Otro Setter',
    origen_actual: 'Postulación MEG - RT',
    origen: 'VSL',
    calendario_agendado: 'Calendario general'
  });

  assert.equal(hasCommissionAgendaSignals(row), true);
  assert.equal(hasCommissionAgendaSignals({ ...row, origen_actual: 'Instagram orgánico', origen: 'APSET', calendario_agendado: 'RT' }), false);
});

test('una venta o cobranza Setting califica únicamente por Origen Actual APSET / RT', () => {
  assert.equal(qualifiesForSettingTransaction({ origen_actual: 'Postulación MEG - APSET' }), true);
  assert.equal(qualifiesForSettingTransaction({ origen_actual: 'Postulacion Meg | RT - NI' }), true);
  assert.equal(qualifiesForSettingTransaction({ origen_actual: 'Instagram', origen: 'APSET', calendario_agendado: 'RT' }), false);
});

test('Club paga únicamente al responsable de venta y nunca genera comisión de setter', () => {
  const config = commissionsService.normalizeConfig({
    global: {
      includeOnlyVerified: false
    },
    personRoles: [
      { person: 'Patricia Conti', role: 'Closer' },
      { person: 'Nahuel Iasci', role: 'Setter' }
    ]
  });
  const details = buildTransactionDetails({
    monthKey: '2026-07',
    config,
    comprobantesRows: [{
      id: 'club-sin-setting',
      tipo: 'Venta',
      producto_format: 'Club',
      cliente_format: 'Cliente Club',
      responsable_venta: 'Patricia Conti',
      setter: 'Nahuel Iasci',
      f_venta: '2026-07-30',
      f_acreditacion: '2026-07-30',
      cash_ar: 39500,
      cash_collected_ar: 39500,
      cash_collected_ars: 39500,
      medios_de_pago: '29f48251-7a95-8085-95e4-d2f57e29f340',
      medios_de_pago_format: 'Mercado Pago'
    }],
    settersRows: [],
    agendaRows: []
  });

  assert.equal(details.some((detail) => detail.role === 'Setter' && detail.category === 'Club'), false);
  assert.equal(details.some((detail) => detail.role === 'Closer' && detail.category === 'Club'), true);
  assert.equal(details.find((detail) => detail.role === 'Closer')?.paymentMethod, 'Mercado Pago');
});

test('Marketing toma el 5% del cash neto de todas las operaciones verificadas sin duplicar IDs', () => {
  const config = commissionsService.normalizeConfig({
    global: { includeOnlyVerified: true }
  });
  const summary = buildMarketingAreaSummary({
    monthKey: '2026-09',
    config,
    comprobantesRows: [
      {
        id: 'meg-venta-1',
        tipo: 'Venta',
        producto_format: 'MEG 2.1',
        f_acreditacion: '2026-09-01',
        cash_ar: 100000,
        facturacion_ars: 120000,
        verificacion_comisiones: 'OK'
      },
      {
        id: 'meg-venta-1',
        tipo: 'Venta',
        producto_format: 'MEG 2.1',
        f_acreditacion: '2026-09-01',
        cash_ar: 100000,
        facturacion_ars: 120000,
        verificacion_comisiones: 'OK'
      },
      {
        id: 'club-venta-1',
        tipo: 'Venta',
        producto_format: 'Club del Costo',
        f_acreditacion: '2026-09-02',
        cash_ar: 121000,
        facturacion_ars: 121000,
        verificacion_comisiones: 'OK'
      },
      {
        id: 'club-cobranza-1',
        tipo: 'Cobranza',
        producto_format: 'Club del Costo',
        f_acreditacion: '2026-09-03',
        cash_ar: 121000,
        verificacion_comisiones: 'OK'
      },
      {
        id: 'con-error',
        tipo: 'Venta',
        producto_format: 'MEG 2.1',
        f_acreditacion: '2026-09-02',
        cash_ar: 999999,
        verificacion_comisiones: 'Error de control'
      },
      {
        id: 'otro-mes',
        tipo: 'Venta',
        producto_format: 'MEG 2.1',
        f_acreditacion: '2026-08-31',
        cash_ar: 999999,
        verificacion_comisiones: 'OK'
      }
    ]
  });

  assert.equal(summary.label, 'Marketing');
  assert.equal(summary.transactionCount, 3);
  assert.equal(summary.ventasMeg, 1);
  assert.equal(summary.ventasClub, 1);
  assert.equal(summary.facturacion, 241000);
  assert.equal(summary.cc, 280420);
  assert.equal(summary.percentage, 0.05);
  assert.equal(summary.gain, 14021);
  assert.equal(summary.total, 14021);
});

test('la tabla inferior muestra el área Marketing recibida desde el backend', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '../public/metricas-v2/js/views/comisiones.page.js'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '../public/metricas-v2/views/comisiones.html'), 'utf8');

  assert.match(source, /label: 'Marketing'/);
  assert.match(source, /dashboard\?\.marketingArea/);
  assert.match(source, /<th>Ventas Club<\/th>/);
  assert.match(source, /marketingArea\?\.ventasClub/);
  assert.doesNotMatch(source, /label: 'VSL',/);
  assert.match(source, /label: 'VSL \+ RT'/);
  assert.match(html, /comisiones\.page\.js\?v=20260902-marketing-area-3/);
});
