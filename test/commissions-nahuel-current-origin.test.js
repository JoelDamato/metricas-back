const test = require('node:test');
const assert = require('node:assert/strict');

const commissionsService = require('../modules/metricasv2/services/commissions.service');

const {
  hasCommissionAgendaSignals,
  buildLiveAgendaCountMap,
  qualifiesForSettingTransaction,
  enrichComprobanteOrigins,
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

test('Nahuel no cuenta Primer origen APSET si Origen actual no es APSET', () => {
  const row = agenda({
    origen_actual: 'Instagram orgánico',
    primer_origen: 'Postulación MEG - APSET'
  });

  assert.equal(hasCommissionAgendaSignals(row), false);
});

test('Nahuel ignora Primer origen, origen y calendario históricos si Origen actual no es APSET', () => {
  const row = agenda({
    origen_actual: 'Instagram orgánico',
    primer_origen: 'Referido',
    origen: 'APSET histórico',
    ultimo_origen: 'APSET histórico',
    calendario_agendado: 'APSET'
  });

  assert.equal(hasCommissionAgendaSignals(row), false);
});

test('el conteo mensual de Nahuel usa solo Origen actual APSET', () => {
  const rows = [
    agenda({ origen_actual: 'APSET', origen: 'VSL' }),
    agenda({ origen_actual: 'VSL', primer_origen: 'APSET' }),
    agenda({ origen_actual: 'VSL', primer_origen: 'Referido', calendario_agendado: 'APSET' }),
    agenda({ origen_actual: 'APSET', aplica: 'No aplica' })
  ];

  const result = buildLiveAgendaCountMap(rows, '2026-07');

  assert.equal(result.get('nahuel iasci')?.agendo, 1);
});

test('otros setters usan Primer origen u Origen actual APSET / RT', () => {
  const row = agenda({
    setter: 'Otro Setter',
    origen_actual: 'Postulación MEG - RT',
    origen: 'VSL',
    calendario_agendado: 'Calendario general'
  });

  assert.equal(hasCommissionAgendaSignals(row), true);
  assert.equal(hasCommissionAgendaSignals({ ...row, origen_actual: 'Instagram orgánico', primer_origen: 'RT' }), true);
  assert.equal(hasCommissionAgendaSignals({ ...row, origen_actual: 'Instagram orgánico', primer_origen: 'Referido', calendario_agendado: 'RT' }), false);
});

test('las ventas de Nahuel califican por APSET, RT o VSL en cualquiera de los dos orígenes', () => {
  assert.equal(qualifiesForSettingTransaction({ setter: 'Nahuel Iasci', origen_actual: 'Postulación MEG - APSET' }), true);
  assert.equal(qualifiesForSettingTransaction({ setter: 'Nahuel Iasci', origen_actual: 'Instagram', primer_origen: 'APSET' }), true);
  assert.equal(qualifiesForSettingTransaction({ setter: 'Nahuel Iasci', origen_actual: 'Postulación MEG - RT - NI' }), true);
  assert.equal(qualifiesForSettingTransaction({ setter: 'Nahuel Iasci', origen_actual: 'Instagram', primer_origen: 'Postulación MEG | RT NI' }), true);
  assert.equal(qualifiesForSettingTransaction({ setter: 'Nahuel Iasci', origen_actual: 'VSL', primer_origen: 'Instagram' }), true);
  assert.equal(qualifiesForSettingTransaction({ setter: 'Nahuel Iasci', origen_actual: 'Instagram', primer_origen: 'VSL' }), true);
  assert.equal(qualifiesForSettingTransaction({ setter: 'Nahuel Iasci', origen_actual: 'Postulación MEG - RT' }), true);
  assert.equal(qualifiesForSettingTransaction({ setter: 'Nahuel Iasci', origen_actual: 'RT', primer_origen: 'Referido' }), true);
  assert.equal(qualifiesForSettingTransaction({ setter: 'Otro Setter', primer_origen: 'Postulacion Meg | RT - NI' }), true);
  assert.equal(qualifiesForSettingTransaction({ setter: 'Nahuel Iasci', origen_actual: 'Instagram', primer_origen: 'Referido', origen: 'APSET', calendario_agendado: 'RT' }), false);
});

test('Nahuel cobra 4,5% fijo si VSL está en Primer origen u Origen actual', () => {
  const config = commissionsService.normalizeConfig({
    global: { includeOnlyVerified: false },
    personRoles: [
      { person: 'Patricia Conti', role: 'Closer' },
      { person: 'Nahuel Iasci', role: 'Setter' }
    ]
  });
  const baseSale = {
    tipo: 'Venta',
    producto_format: 'MEG 2.1',
    responsable_venta: 'Patricia Conti',
    setter: 'Nahuel Iasci',
    f_venta: '2026-07-15',
    f_acreditacion: '2026-07-15',
    cash_ar: 100000,
    cash_collected_ar: 100000,
    cash_collected_ars: 100000
  };
  const agendaRows = Array.from({ length: 20 }, (_, index) => agenda({
    ghlid: `agenda-${index}`,
    origen_actual: 'APSET'
  }));

  const details = buildTransactionDetails({
    monthKey: '2026-07',
    config,
    comprobantesRows: [
      { ...baseSale, id: 'vsl-actual', cliente_format: 'VSL actual', origen_actual: 'VSL', primer_origen: 'Instagram' },
      { ...baseSale, id: 'vsl-primero', cliente_format: 'VSL primero', origen_actual: 'Instagram', primer_origen: 'VSL' }
    ],
    settersRows: [],
    agendaRows
  });

  const setterDetails = details.filter((detail) => detail.role === 'Setter');
  assert.equal(setterDetails.length, 2);
  assert.deepEqual(setterDetails.map((detail) => detail.commissionPct), [0.045, 0.045]);
  assert.ok(setterDetails.every((detail) => detail.sourceRule === 'VSL en Primer origen u Origen actual'));
});

test('el comprobante hereda Primer origen del lead vinculado por GHL ID', () => {
  const rows = enrichComprobanteOrigins(
    [{ id: 'comprobante-1', ghlid: 'GHL-1', origen_actual: '', primer_origen: '' }],
    [{ ghlid: 'GHL-1', origen_actual: 'Instagram', primer_origen: 'APSET', last_edited_time: '2026-09-03T12:00:00Z' }]
  );

  assert.equal(rows[0].origen_actual, 'Instagram');
  assert.equal(rows[0].primer_origen, 'APSET');
});

test('Nahuel cobra 4,5% cuando APSET está en Primer origen aunque Origen actual sea otro', () => {
  const config = commissionsService.normalizeConfig({
    global: { includeOnlyVerified: false },
    personRoles: [
      { person: 'Patricia Conti', role: 'Closer' },
      { person: 'Nahuel Iasci', role: 'Setter' }
    ]
  });
  const details = buildTransactionDetails({
    monthKey: '2026-07',
    config,
    comprobantesRows: [{
      id: 'meg-apset-primer-origen',
      tipo: 'Venta',
      producto_format: 'MEG 2.1',
      cliente_format: 'Cliente APSET',
      responsable_venta: 'Patricia Conti',
      setter: 'Nahuel Iasci',
      origen_actual: 'Instagram orgánico',
      primer_origen: 'Postulación MEG - APSET',
      f_venta: '2026-07-15',
      f_acreditacion: '2026-07-15',
      cash_ar: 100000,
      cash_collected_ar: 100000,
      cash_collected_ars: 100000
    }],
    settersRows: [],
    agendaRows: [agenda({ primer_origen: 'APSET' })]
  });

  const setterDetail = details.find((detail) => detail.role === 'Setter');
  assert.equal(setterDetail?.commissionPct, 0.045);
  assert.equal(setterDetail?.commissionAmount, 4500);
  assert.equal(setterDetail?.firstOrigin, 'Postulación MEG - APSET');
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
  assert.match(html, /comisiones\.page\.js\?v=20260904-nahuel-ventas-2/);
});
