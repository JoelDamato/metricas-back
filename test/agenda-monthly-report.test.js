const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const report = require('../public/metricas-v2/js/agenda-monthly-report');
const access = require('../modules/auth/access');

function checkpoint(closer, tipo, cantidad, operacion = 'sumar', detalle = 'Prueba') {
  return { closer_nombre: closer, tipo, cantidad, operacion, detalle };
}

function cash(overrides = {}) {
  return {
    responsable_venta: 'Carlos Tu',
    producto_format: 'MEG 2.1',
    f_acreditacion: '2026-07-28',
    cash_collected_neto: 100,
    cash_collected: 121,
    estado: 'Conciliado',
    ...overrides
  };
}

test('asigna checks y strikes automáticos según el ranking de pendientes', () => {
  const entries = [
    checkpoint('Carlos Tu', 'pendiente', 1),
    checkpoint('Patricia Conti', 'pendiente', 2),
    checkpoint('Claudio Nicolini', 'pendiente', 3),
    checkpoint('Pablo Butera', 'pendiente', 4),
    checkpoint('Walter Alegre', 'pendiente', 5),
    checkpoint('Mauro Gaitan', 'pendiente', 6)
  ];
  const rows = report.buildScoreRows(entries);
  const byName = new Map(rows.map((row) => [row.name, row]));

  assert.equal(byName.get('Carlos Tu').checkCount, 1);
  assert.equal(byName.get('Patricia Conti').checkCount, 1);
  assert.equal(byName.get('Mauro Gaitan').strikeCount, 2);
  assert.equal(byName.get('Walter Alegre').strikeCount, 1);
  assert.equal(byName.get('Claudio Nicolini').score, 0);
});

test('combina movimientos manuales con los puntos automáticos sin contar pendientes directamente', () => {
  const entries = [
    checkpoint('Carlos Tu', 'check', 2, 'sumar', 'Disponibilidad'),
    checkpoint('Carlos Tu', 'pendiente', 1),
    checkpoint('Patricia Conti', 'pendiente', 2),
    checkpoint('Claudio Nicolini', 'pendiente', 3),
    checkpoint('Pablo Butera', 'pendiente', 4),
    checkpoint('Walter Alegre', 'pendiente', 5),
    checkpoint('Mauro Gaitan', 'pendiente', 6)
  ];
  const carlos = report.buildScoreRows(entries).find((row) => row.name === 'Carlos Tu');
  assert.equal(carlos.pending, 1);
  assert.equal(carlos.checkCount, 3);
  assert.equal(carlos.score, 3);
});

test('no inventa premios ni strikes para closers sin movimientos de pendientes', () => {
  const rows = report.buildScoreRows([
    checkpoint('Carlos Tu', 'pendiente', 2)
  ]);

  rows.forEach((row) => {
    assert.equal(row.checkCount, 0);
    assert.equal(row.strikeCount, 0);
  });
  assert.equal(rows.find((row) => row.name === 'Carlos Tu').pending, 2);
});

test('cuenta únicamente los KPI cumplidos y conserva cash, facturación y ponderación', () => {
  const rows = report.buildKpiRows([{
    closer: 'Carlos Tu',
    efectuadas: 10,
    aplica: 20,
    ventas_llamada: 5,
    efectuadas_agenda: 10,
    aplica_agenda: 20,
    tasa_cierre: 0.5,
    cash_collected: 1000,
    facturacion: 1000,
    cash_collected_3m: 800,
    facturacion_3m: 1000
  }], {
    cierre_llamada_pct: 45,
    asistencia_llamada_pct: 60,
    tasa_asistencia_pct: 45,
    tasa_cierre_pct: 60,
    cash_collected_min: 100,
    cash_collected_3m_min: 90
  });
  const carlos = rows.find((row) => row.name === 'Carlos Tu');

  assert.deepEqual(carlos.achieved, ['Cierre seg. llamada', 'Tasa asistencia', 'Cash collected']);
  assert.equal(carlos.cashCollected, 1000);
  assert.equal(carlos.facturacion, 1000);
  assert.equal(carlos.ponderacionPct, 50);
});

test('no aprueba KPIs operativos cuando el closer no tuvo agendas en el mes', () => {
  const mauro = report.buildKpiRows([{
    closer: 'Mauro Gaitan',
    efectuadas: 1,
    aplica: 1,
    ventas_llamada: 0,
    efectuadas_agenda: 0,
    aplica_agenda: 0,
    tasa_cierre: 0
  }]).find((row) => row.name === 'Mauro Gaitan');

  assert.equal(mauro.asistenciaLlamadaPct, 100);
  assert.equal(mauro.asistenciaLlamadaOk, false);
  assert.deepEqual(mauro.achieved, []);
});

test('el reporte usa únicamente las filas KPI del mes solicitado', () => {
  const model = report.buildReportModel({
    year: 2026,
    month: 8,
    kpiRows: [
      {
        anio: 2026,
        mes: 8,
        closer: 'Carlos Tu',
        efectuadas: 1,
        aplica: 2,
        efectuadas_agenda: 1,
        aplica_agenda: 2
      },
      {
        anio: 2026,
        mes: 9,
        closer: 'Carlos Tu',
        efectuadas: 100,
        aplica: 100,
        efectuadas_agenda: 100,
        aplica_agenda: 100
      }
    ]
  });
  const carlos = model.kpis.find((row) => row.name === 'Carlos Tu');

  assert.equal(carlos.asistenciaLlamadaPct, 50);
  assert.equal(carlos.tasaAsistenciaPct, 50);
});

test('usa cash neto conciliado, excluye Club y descarta comprobantes no conciliados', () => {
  const result = report.buildCashAndBonus([
    cash(),
    cash({ producto_format: 'Club del Costo', cash_collected_neto: 900 }),
    cash({ estado: 'Pendiente', cash_collected_neto: 800 }),
    cash({ responsable_venta: 'Patricia Conti', cash_collected_neto: 50, cash_collected: 500 })
  ], { monto_base_mensual: 40, objetivo_mensual: 50 }, 2026, 7, new Date(2026, 7, 4));

  assert.equal(result.teamTotal, 150);
  assert.equal(result.closers.find((row) => row.name === 'Carlos Tu').total, 100);
  assert.equal(result.closers.find((row) => row.name === 'Patricia Conti').total, 50);
});

test('una meta alcanzada en la última semana conserva el bonus aunque hubo semanas malas antes', () => {
  const result = report.buildCashAndBonus([
    cash({ cash_collected_neto: 100 }),
    cash({ responsable_venta: 'Patricia Conti', cash_collected_neto: 1 })
  ], { monto_base_mensual: 40, objetivo_mensual: 50 }, 2026, 7, new Date(2026, 7, 4));
  const finalWeek = result.weeks.at(-1);
  const patricia = result.distributions.find((row) => row.name === 'Patricia Conti');

  assert.equal(finalWeek.revoked, false);
  assert.ok(finalWeek.payablePool > 0);
  assert.ok(patricia.weeklyBonus > 0, 'el 10% individual no debe excluirla del reparto');
});

test('una semana mala posterior revoca el bonus generado antes', () => {
  const result = report.buildCashAndBonus([
    cash({ f_acreditacion: '2026-06-02', cash_collected_neto: 25000 })
  ], { monto_base_mensual: 16500, objetivo_mensual: 20000 }, 2026, 6, new Date(2026, 7, 4));

  assert.ok(result.weeks[0].generatedPool > 0);
  assert.equal(result.weeks[0].revoked, true);
  assert.equal(result.weeks[0].payablePool, 0);
});

test('el reporte mensual hereda el acceso comercial del Sistema de Agendas', () => {
  assert.equal(access.canAccessPageForUser({ email: 'closer@example.com', role: 'comercial' }, 'mag-reporte-mensual-final.html'), true);
  assert.equal(access.canAccessPageForUser({ email: 'iascinahuel@gmail.com', role: 'comercial' }, 'mag-reporte-mensual-final.html'), true);
  assert.equal(access.canAccessPageForUser({ email: 'sofiangallardod@gmail.com', role: 'csm' }, 'mag-reporte-mensual-final.html'), false);
});

test('Sistema de Agendas integra la pestaña mensual y permite descargar un HTML autosuficiente', () => {
  const agendaView = fs.readFileSync(path.join(__dirname, '../public/metricas-v2/views/mag-sistema-agendas.html'), 'utf8');
  const reportView = fs.readFileSync(path.join(__dirname, '../public/metricas-v2/views/mag-reporte-mensual-final.html'), 'utf8');
  const pageScript = fs.readFileSync(path.join(__dirname, '../public/metricas-v2/js/views/agenda-monthly-report.page.js'), 'utf8');

  assert.match(agendaView, /data-tab="reporte-mensual-final"/);
  assert.match(agendaView, /id="monthlyReportFrame"/);
  assert.match(reportView, /id="monthlyReportStyles"/);
  assert.match(pageScript, /new Blob\(\[html\]/);
  assert.match(pageScript, /reporte_\$\{report\.MONTHS\[currentModel\.month\]\.toLowerCase\(\)\}_\$\{currentModel\.year\}_final\.html/);
});
