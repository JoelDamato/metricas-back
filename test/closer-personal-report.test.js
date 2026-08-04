const assert = require('node:assert/strict');
const test = require('node:test');

process.env.SUPABASE_URL = 'https://supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

const axios = require('axios');
const { buildMonthlyComparisonContext } = require('../modules/metricasv2/services/closer-personal-report.service');
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
