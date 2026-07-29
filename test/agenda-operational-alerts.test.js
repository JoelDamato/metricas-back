const test = require('node:test');
const assert = require('node:assert/strict');
const {
  build,
  targetToDate
} = require('../public/metricas-v2/js/agenda-operational-alerts');

function agendaRow(overrides = {}) {
  return {
    closer: 'Mauro Gaitan',
    total_agendados: 10,
    total_aplica: 5,
    total_no_asistidas: 2,
    total_pendientes: 4,
    total_efectuadas: 5,
    total_ventas: 0,
    ...overrides
  };
}

function cashRow(date, amount, closer = 'Mauro Gaitan') {
  return {
    responsable_venta: closer,
    f_acreditacion: `${date}T03:00:00+00:00`,
    cash_collected: amount,
    producto_format: ''
  };
}

test('activa los umbrales operativos con métricas reales del closer', () => {
  const result = build({
    year: 2026,
    month: 7,
    today: '2026-07-29',
    weeklyTarget: 20000,
    closerNames: ['Mauro Gaitan', 'Carlos Tu'],
    agendaRows: [
      agendaRow(),
      agendaRow({
        closer: 'Carlos Tu',
        total_agendados: 20,
        total_aplica: 19,
        total_no_asistidas: 2,
        total_pendientes: 1,
        total_efectuadas: 10,
        total_ventas: 4
      })
    ],
    cashRows: [
      cashRow('2026-07-28', 500),
      cashRow('2026-07-28', 9500, 'Carlos Tu'),
      cashRow('2026-04-10', 5000),
      cashRow('2026-05-10', 5000),
      cashRow('2026-06-10', 5000)
    ]
  });

  const affectedIds = result.alerts
    .filter((alert) => alert.affected.some((row) => row.name === 'Mauro Gaitan'))
    .map((alert) => alert.id);

  assert.deepEqual(affectedIds, [
    'no-aplica',
    'no-show',
    'tasa-cierre',
    'cash-semana',
    'pendientes',
    'cash-mes',
    'cash-trim'
  ]);
  assert.equal(result.summary.high, 3);
  assert.equal(result.summary.medium, 4);
  assert.equal(result.period.weekStart, '2026-07-27');
  assert.equal(result.period.weekEnd, '2026-07-31');
});

test('respeta los límites exactos y no alerta sin denominador', () => {
  const result = build({
    year: 2026,
    month: 7,
    today: '2026-07-29',
    weeklyTarget: 0,
    closerNames: ['Sin actividad'],
    agendaRows: [
      agendaRow({
        closer: 'En límite',
        total_agendados: 10,
        total_aplica: 6,
        total_no_asistidas: 1.5,
        total_pendientes: 3,
        total_efectuadas: 5,
        total_ventas: 1
      })
    ],
    cashRows: []
  });

  assert.equal(result.alerts.length, 0);
});

test('prorratea el objetivo semanal por los días transcurridos del mes', () => {
  const total = targetToDate({
    monthStart: new Date(2026, 6, 1),
    evaluationDate: new Date(2026, 6, 7)
  }, 7000);

  assert.equal(total, 7000);
});
