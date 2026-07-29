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
    id: `${closer}-${date}-${amount}`,
    cliente_format: `Cliente ${closer}`,
    ghlid: `ghl-${closer}`,
    responsable_venta: closer,
    f_acreditacion: `${date}T03:00:00+00:00`,
    cash_collected: amount,
    tipo: 'Venta',
    producto_format: 'MEG',
    estado: 'Conciliado'
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

test('adjunta los leads y comprobantes reales que explican cada alerta', () => {
  const result = build({
    year: 2026,
    month: 7,
    today: '2026-07-29',
    weeklyTarget: 20000,
    agendaRows: [agendaRow()],
    leadRows: [
      {
        id: 'lead-no-show',
        nombre: 'Lead No Show',
        ghlid: 'ghl-no-show',
        closer: 'Mauro Gaitan',
        fecha_agenda: '2026-07-10',
        agendo: 'Agendo',
        aplica: 'Aplica',
        llamada_meg: 'No show',
        origen: 'VSL'
      },
      {
        id: 'lead-efectuado',
        nombre: 'Lead Vendido',
        ghlid: 'ghl-vendido',
        closer: 'Mauro Gaitan',
        fecha_agenda: '2026-07-11',
        agendo: 'Agendo',
        aplica: 'Aplica',
        llamada_meg: 'Efectuada',
        origen: 'ORG'
      }
    ],
    saleRows: [
      {
        id: 'venta-1',
        cliente_format: 'Lead Vendido',
        ghlid: 'ghl-vendido',
        responsable_venta: 'Mauro Gaitan',
        fecha_de_agendamiento: '2026-07-11',
        f_venta: '2026-07-12',
        tipo: 'Venta',
        producto_format: 'MEG 2.1',
        facturacion: 3000
      }
    ],
    cashRows: [
      cashRow('2026-07-28', 500),
      cashRow('2026-04-10', 5000),
      cashRow('2026-05-10', 5000),
      cashRow('2026-06-10', 5000)
    ]
  });

  const noShow = result.alerts.find((alert) => alert.id === 'no-show');
  const closeRate = result.alerts.find((alert) => alert.id === 'tasa-cierre');
  const monthCash = result.alerts.find((alert) => alert.id === 'cash-mes');

  assert.equal(noShow.affected[0].cases[0].client, 'Lead No Show');
  assert.equal(noShow.affected[0].cases[0].ghlid, 'ghl-no-show');
  assert.equal(closeRate.affected[0].cases[0].kind, 'closure');
  assert.equal(closeRate.affected[0].cases[0].converted, true);
  assert.equal(closeRate.affected[0].cases[0].saleProduct, 'MEG 2.1');
  assert.equal(monthCash.affected[0].cases.length, 1);
  assert.equal(monthCash.affected[0].cases[0].amount, 500);
});
