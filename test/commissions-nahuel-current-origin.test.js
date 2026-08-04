const test = require('node:test');
const assert = require('node:assert/strict');

const commissionsService = require('../modules/metricasv2/services/commissions.service');

const {
  hasCommissionAgendaSignals,
  buildLiveAgendaCountMap,
  qualifiesForSettingTransaction,
  buildTransactionDetails
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

test('otros setters conservan la regla de origen o calendario APSET / RT', () => {
  const row = agenda({
    setter: 'Otro Setter',
    origen_actual: 'Instagram orgánico',
    origen: 'VSL',
    calendario_agendado: 'RT'
  });

  assert.equal(hasCommissionAgendaSignals(row), true);
});

test('una venta o cobranza Setting califica únicamente por origen o calendario APSET / RT', () => {
  assert.equal(qualifiesForSettingTransaction({ origen: 'Postulación MEG - APSET' }), true);
  assert.equal(qualifiesForSettingTransaction({ calendario_agendado: 'Postulacion Meg | RT - NI' }), true);
  assert.equal(qualifiesForSettingTransaction({ origen: 'Postulación MEG - VSL', calendario_agendado: 'Postulación MEG - VSL - 3' }), false);
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
      medios_de_pago: 'Mercado Pago'
    }],
    settersRows: [],
    agendaRows: []
  });

  assert.equal(details.some((detail) => detail.role === 'Setter' && detail.category === 'Club'), false);
  assert.equal(details.some((detail) => detail.role === 'Closer' && detail.category === 'Club'), true);
});
