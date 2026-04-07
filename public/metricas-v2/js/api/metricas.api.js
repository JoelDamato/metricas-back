function queryString(params) {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '');
  return new URLSearchParams(entries).toString();
}

async function fetchViews() {
  return window.http.getJson('/api/metricas/views');
}

async function fetchRows(resource, options = {}) {
  const qs = queryString(options);
  const suffix = qs ? `?${qs}` : '';
  return window.http.getJson(`/api/metricas/views/${encodeURIComponent(resource)}${suffix}`);
}

async function fetchAgendaDetalleDiarioCloser(options = {}) {
  return fetchRows('agenda_detalle_diario_closer', options);
}

async function fetchVentasDiarioCloser(options = {}) {
  return fetchRows('ventas_diario_closer', options);
}

async function fetchCashCollectedDiarioCloser(options = {}) {
  return fetchRows('cash_collected_diario_closer', options);
}

async function fetchReportesPremioConfig() {
  return window.http.getJson('/api/metricas/reportes/premio');
}

async function saveReportesPremioConfig(payload = {}) {
  return window.http.postJson('/api/metricas/reportes/premio', payload);
}

async function fetchComprobantes(options = {}) {
  return fetchRows('comprobantes', options);
}

async function fetchLeadsRaw(options = {}) {
  return fetchRows('leads_raw', options);
}

async function fetchKpiMarketingDiario(options = {}) {
  return fetchRows('kpi_marketing_diario', options);
}

async function fetchMarketingInvestment(options = {}) {
  const qs = queryString(options);
  const suffix = qs ? `?${qs}` : '';
  return window.http.getJson(`/api/metricas/marketing/inversion${suffix}`);
}

async function saveMarketingInvestment(payload = {}) {
  return window.http.postJson('/api/metricas/marketing/inversion', payload);
}

async function fetchMarketingInvestments(options = {}) {
  const qs = queryString(options);
  const suffix = qs ? `?${qs}` : '';
  return window.http.getJson(`/api/metricas/marketing/inversiones${suffix}`);
}

async function updateMarketingInvestmentRecord(payload = {}) {
  return window.http.patchJson('/api/metricas/marketing/inversiones', payload);
}

async function deleteMarketingInvestmentRecord(payload = {}) {
  return window.http.deleteJson('/api/metricas/marketing/inversiones', payload);
}

async function fetchMarketingAovDia1(options = {}) {
  const qs = queryString(options);
  const suffix = qs ? `?${qs}` : '';
  return window.http.getJson(`/api/metricas/marketing/aov-dia-1${suffix}`);
}

async function askScalito(question, pageContext = {}) {
  return window.http.postJson('/api/metricas/assistant/ask', { question, pageContext });
}

async function fetchMarketingVentasTotales(options = {}) {
  const qs = queryString(options);
  const suffix = qs ? `?${qs}` : '';
  return window.http.getJson(`/api/metricas/marketing/ventas-totales${suffix}`);
}

async function fetchAllRows(resource, options = {}) {
  const pageSize = Math.min(Number(options.limit || 1000), 1000);
  const rows = [];
  let offset = Number(options.offset || 0);

  while (true) {
    const response = await fetchRows(resource, {
      ...options,
      limit: pageSize,
      offset
    });

    const chunk = response.rows || [];
    rows.push(...chunk);

    if (chunk.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return {
    ok: true,
    resource,
    count: rows.length,
    rows
  };
}

window.metricasApi = {
  fetchViews,
  fetchRows,
  fetchAgendaDetalleDiarioCloser,
  fetchVentasDiarioCloser,
  fetchCashCollectedDiarioCloser,
  fetchReportesPremioConfig,
  saveReportesPremioConfig,
  fetchComprobantes,
  fetchLeadsRaw,
  fetchKpiMarketingDiario,
  fetchMarketingInvestment,
  fetchMarketingInvestments,
  fetchMarketingAovDia1,
  fetchMarketingVentasTotales,
  askScalito,
  saveMarketingInvestment,
  updateMarketingInvestmentRecord,
  deleteMarketingInvestmentRecord,
  fetchAllRows
};
