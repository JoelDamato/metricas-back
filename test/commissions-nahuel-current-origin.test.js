const test = require('node:test');
const assert = require('node:assert/strict');

const commissionsService = require('../modules/metricasv2/services/commissions.service');

const { hasCommissionAgendaSignals, buildLiveAgendaCountMap, qualifiesForSettingTransaction } = commissionsService._test;

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
