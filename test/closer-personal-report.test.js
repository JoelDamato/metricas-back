const assert = require('node:assert/strict');
const test = require('node:test');

process.env.SUPABASE_URL = 'https://supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

const axios = require('axios');
const reportService = require('../modules/metricasv2/services/closer-personal-report.service');
const env = require('../modules/metricasv2/config/env');
const {
  buildMonthlyComparisonContext,
  buildTeamMetricsPayload,
  buildTeamMonthlyComparisonContext,
  normalizeTeamMemberInsights
} = reportService;
const supabaseService = require('../modules/metricasv2/services/supabase.service');

const originalAxiosGet = axios.get;
const originalAxiosPost = axios.post;

test.afterEach(() => {
  axios.get = originalAxiosGet;
  axios.post = originalAxiosPost;
});

function row(overrides = {}) {
  return {
    closer: 'Carlos Tu',
    anio: 2026,
    mes: 1,
    total_agendados: 10,
    total_aplica: 8,
    total_respondio: 8,
    total_confirmo: 7,
    total_cancelado: 1,
    total_no_asistidas: 2,
    total_pendientes: 0,
    total_efectuadas: 6,
    total_ventas: 2,
    total_paid_upfront: 0,
    ccne: 0,
    cce_llamada: 0,
    cce_whatsapp: 0,
    facturacion_total_mes: 3000,
    facturacion_f_agenda: 3000,
    cash_collected_real_mes: 2000,
    cash_collected_otros_meses: 0,
    cash_collected_agendas_mes: 2000,
    ...overrides
  };
}

test('arma contexto con meses anteriores y posteriores, excluyendo el mes principal', () => {
  const rows = [
    row({ anio: 2025, mes: 12, cash_collected_agendas_mes: 1000 }),
    row({ anio: 2026, mes: 1, cash_collected_agendas_mes: 2000 }),
    row({ anio: 2026, mes: 2, cash_collected_agendas_mes: 3000 }),
    row({ anio: 2026, mes: 3, cash_collected_agendas_mes: 4000 }),
    row({ closer: 'Mauro Gaitan', anio: 2026, mes: 2, cash_collected_agendas_mes: 1000 })
  ];

  const history = buildMonthlyComparisonContext(rows, 'Carlos Tu', '2026-01', 6);

  assert.deepEqual(history.map((item) => item.monthValue), ['2025-12', '2026-02', '2026-03']);
  assert.equal(history[1].cashAgendasMes, 3000);
  assert.equal(history[1].shareOfTeamCashPct, 75);
  assert.equal(history.some((item) => item.monthValue === '2026-01'), false);
});

test('consolida el resultado del equipo con tasas ponderadas y aporte por closer', () => {
  const metrics = buildTeamMetricsPayload([
    {
      closer: 'Carlos Tu', agendas: 10, aplicables: 8, efectuadas: 6, noAsistidas: 2,
      ventas: 2, paidUpfront: 1000, facturacionAgenda: 3000, facturacionTotalMes: 3000,
      cashAgendasMes: 2000, cashRealMes: 2000, cashOtrosMeses: 0, cierrePct: 33.333,
      efectuadasSobreAplicablesPct: 75, noAsistidasPct: 25, cashPorAgenda: 200,
      cashPorReunion: 333.333, ticketPromedio: 1500, cashSobreFacturacionPct: 66.667
    },
    {
      closer: 'Mauro Gaitan', agendas: 20, aplicables: 16, efectuadas: 8, noAsistidas: 8,
      ventas: 2, paidUpfront: 500, facturacionAgenda: 2000, facturacionTotalMes: 2000,
      cashAgendasMes: 1000, cashRealMes: 1000, cashOtrosMeses: 0, cierrePct: 25,
      efectuadasSobreAplicablesPct: 50, noAsistidasPct: 50, cashPorAgenda: 50,
      cashPorReunion: 125, ticketPromedio: 1000, cashSobreFacturacionPct: 50
    }
  ], '2026-07');

  assert.equal(metrics.activeClosers, 2);
  assert.equal(metrics.teamSummary.agendas, 30);
  assert.equal(metrics.teamSummary.ventas, 4);
  assert.ok(Math.abs(metrics.teamSummary.tasaCierrePct - (4 / 14 * 100)) < 1e-9);
  assert.ok(Math.abs(metrics.closerBreakdown[0].shareOfTeamCashPct - (2000 / 3000 * 100)) < 1e-9);
  assert.equal(metrics.closerBreakdown[1].rankingPosition, 2);
});

test('arma una comparación histórica consolidada del equipo', () => {
  const history = buildTeamMonthlyComparisonContext([
    row({ anio: 2026, mes: 5, cash_collected_agendas_mes: 1000 }),
    row({ closer: 'Mauro Gaitan', anio: 2026, mes: 5, cash_collected_agendas_mes: 500 }),
    row({ anio: 2026, mes: 6, cash_collected_agendas_mes: 2000 }),
    row({ anio: 2026, mes: 7, cash_collected_agendas_mes: 3000 })
  ], '2026-06', 6);

  assert.deepEqual(history.map((item) => item.monthValue), ['2026-05', '2026-07']);
  assert.equal(history[0].activeClosers, 2);
  assert.equal(history[0].cashAgendasMes, 1500);
});

test('la lectura por integrante sólo conserva closers reales y completa faltantes', () => {
  const insights = normalizeTeamMemberInsights({
    lecturaIntegrantes: [
      { closer: 'Carlos Tu', titulo: 'Lectura GPT', txt: 'Dato válido.', cls: 'highlight' },
      { closer: 'Persona inventada', titulo: 'No corresponde', txt: 'No debe aparecer.', cls: 'neutral' }
    ]
  }, [
    { closer: 'Carlos Tu', rankingPosition: 1, cashAgendasMes: 2000, shareOfTeamCashPct: 66.67, ventas: 2, cierrePct: 33.3 },
    { closer: 'Mauro Gaitan', rankingPosition: 2, cashAgendasMes: 1000, shareOfTeamCashPct: 33.33, ventas: 1, cierrePct: 20 }
  ]);

  assert.deepEqual(insights.map((item) => item.closer), ['Carlos Tu', 'Mauro Gaitan']);
  assert.equal(insights[0].titulo, 'Lectura GPT');
  assert.match(insights[1].txt, /1 venta/);
  assert.equal(insights.some((item) => item.closer === 'Persona inventada'), false);
});

test('genera la narrativa del equipo con todos los closers y un esquema separado', async () => {
  const originalListRows = supabaseService.listRows;
  const originalApiKey = env.openAiApiKey;
  const originalModel = env.openAiReportModel;
  let requestPayload = null;

  supabaseService.listRows = async (_resource, options) => (
    options.eqFilters.anio === 2026
      ? [
        row({ closer: 'Carlos Tu', anio: 2026, mes: 7, cash_collected_agendas_mes: 2000 }),
        row({ closer: 'Mauro Gaitan', anio: 2026, mes: 7, cash_collected_agendas_mes: 1000 })
      ]
      : []
  );
  env.openAiApiKey = 'test-openai-key';
  env.openAiReportModel = 'test-model';
  axios.post = async (url, payload) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    requestPayload = payload;
    return {
      data: {
        output_text: JSON.stringify({
          chips: ['Equipo activo', '3 ventas'],
          kpis: [],
          fortalezas: [],
          atencion: [],
          analisisHistorico: 'Sin historia suficiente.',
          lecturaIntegrantes: [],
          mensaje: 'Lectura grupal.',
          pedidoAdicionalRespuesta: '',
          pasos: [],
          sistemaMsg: 'Conclusión.'
        })
      }
    };
  };

  try {
    const generated = await reportService.generateCloserTeamReport({ month: '2026-07' });
    assert.equal(generated.reportType, 'team');
    assert.equal(generated.activeClosers, 2);
    assert.equal(generated.metrics.closerBreakdown.length, 2);
    assert.equal(requestPayload.text.format.name, 'closer_team_report');
    assert.match(requestPayload.input, /Carlos Tu/);
    assert.match(requestPayload.input, /Mauro Gaitan/);
    assert.match(requestPayload.instructions, /equipo, no como reporte personal/);
  } finally {
    supabaseService.listRows = originalListRows;
    env.openAiApiKey = originalApiKey;
    env.openAiReportModel = originalModel;
  }
});

test('al guardar devuelve el reporte recién escrito sin releer una copia cacheada', async () => {
  let getCalls = 0;
  let uploadedReport = null;

  axios.get = async () => {
    getCalls += 1;
    return { data: JSON.stringify({ metrics: { cierrePct: 0 } }) };
  };
  axios.post = async (url, body, config) => {
    if (url.endsWith('/storage/v1/bucket')) return { data: {} };
    uploadedReport = JSON.parse(body.toString('utf8'));
    assert.equal(config.headers['cache-control'], '0');
    return { data: {} };
  };

  const stored = await supabaseService.saveCloserPersonalReport({
    closer: 'Claudio Nicolini',
    month: '2026-07'
  }, {
    metrics: { cierrePct: 22.22 }
  }, {
    email: 'mati@example.com'
  });

  assert.equal(getCalls, 0);
  assert.equal(stored.report.metrics.cierrePct, 22.22);
  assert.equal(uploadedReport.metrics.cierrePct, 22.22);
  assert.equal(stored.report.savedBy, 'mati@example.com');
});

test('la lectura del reporte evita la caché del storage', async () => {
  let requestedUrl = '';
  let requestedConfig = null;

  axios.get = async (url, config) => {
    requestedUrl = url;
    requestedConfig = config;
    return { data: JSON.stringify({ metrics: { cierrePct: 22.22 } }) };
  };

  const stored = await supabaseService.getStoredCloserPersonalReport({
    closer: 'Claudio Nicolini',
    month: '2026-07'
  });

  assert.match(requestedUrl, /\.json\?v=\d+$/);
  assert.equal(requestedConfig.headers['Cache-Control'], 'no-cache, no-store, max-age=0');
  assert.equal(requestedConfig.headers.Pragma, 'no-cache');
  assert.equal(stored.report.metrics.cierrePct, 22.22);
});

test('el reporte de equipo se guarda separado de los reportes personales', async () => {
  let uploadedUrl = '';
  let uploadedReport = null;

  axios.post = async (url, body) => {
    if (url.endsWith('/storage/v1/bucket')) return { data: {} };
    uploadedUrl = url;
    uploadedReport = JSON.parse(body.toString('utf8'));
    return { data: {} };
  };

  const stored = await supabaseService.saveCloserTeamReport({ month: '2026-07' }, {
    reportType: 'team',
    metrics: { teamSummary: { ventas: 8 } }
  }, { email: 'mati@example.com' });

  assert.match(uploadedUrl, /\/teams\/2026-07\/team-report\.json$/);
  assert.equal(uploadedReport.reportType, 'team');
  assert.equal(stored.report.metrics.teamSummary.ventas, 8);
  assert.equal(stored.report.savedBy, 'mati@example.com');
});

test('la lectura del reporte de equipo evita caché y usa su ruta propia', async () => {
  let requestedUrl = '';
  axios.get = async (url) => {
    requestedUrl = url;
    return { data: JSON.stringify({ reportType: 'team' }) };
  };

  const stored = await supabaseService.getStoredCloserTeamReport({ month: '2026-07' });

  assert.match(requestedUrl, /\/teams\/2026-07\/team-report\.json\?v=\d+$/);
  assert.equal(stored.report.reportType, 'team');
});
