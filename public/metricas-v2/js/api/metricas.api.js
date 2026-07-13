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

async function fetchOperationalAlerts() {
  return window.http.getJson('/api/metricas/alertas-operativas');
}

async function fetchCommissionsDashboard(month) {
  const qs = queryString({ month });
  return window.http.getJson(`/api/metricas/commissions/dashboard?${qs}`);
}

async function fetchCommissionPersonDetail(month, person) {
  const qs = queryString({ month, person });
  return window.http.getJson(`/api/metricas/commissions/person?${qs}`);
}

async function fetchCommissionConfig(month) {
  const qs = queryString({ month });
  return window.http.getJson(`/api/metricas/commissions/config?${qs}`);
}

async function saveCommissionConfig(payload = {}) {
  return window.http.postJson('/api/metricas/commissions/config', payload);
}

async function saveDefaultCommissionConfig(payload = {}) {
  return window.http.postJson('/api/metricas/commissions/config/default', payload);
}

async function lockCommissionMonth(payload = {}) {
  return window.http.postJson('/api/metricas/commissions/config/lock', payload);
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

async function fetchAgendaBonusRules(options = {}) {
  const qs = queryString(options);
  const suffix = qs ? `?${qs}` : '';
  return window.http.getJson(`/api/metricas/agenda-bonus/rules${suffix}`);
}

async function saveAgendaBonusRules(payload = {}) {
  return window.http.postJson('/api/metricas/agenda-bonus/rules', payload);
}

async function fetchAgendaCalendarAssignments(options = {}) {
  const qs = queryString(options);
  const suffix = qs ? `?${qs}` : '';
  return window.http.getJson(`/api/metricas/agenda-calendar/assignments${suffix}`);
}

async function saveAgendaCalendarAssignment(payload = {}) {
  return window.http.postJson('/api/metricas/agenda-calendar/assignments', payload);
}

async function fetchAgendaCheckpoints(options = {}) {
  const qs = queryString(options);
  const suffix = qs ? `?${qs}` : '';
  return window.http.getJson(`/api/metricas/agenda-checkpoints${suffix}`);
}

async function saveAgendaCheckpoint(payload = {}) {
  return window.http.postJson('/api/metricas/agenda-checkpoints', payload);
}

async function saveReportesPremioConfig(payload = {}) {
  return window.http.postJson('/api/metricas/reportes/premio', payload);
}

async function fetchReportComments(options = {}) {
  const qs = queryString(options);
  const suffix = qs ? `?${qs}` : '';
  return window.http.getJson(`/api/metricas/reportes/comentarios${suffix}`);
}

async function saveReportComment(payload = {}) {
  return window.http.postJson('/api/metricas/reportes/comentarios', payload);
}

async function markReportCommentRead(id) {
  return window.http.patchJson(`/api/metricas/reportes/comentarios/${encodeURIComponent(id)}/read`, {});
}

async function fetchComprobantes(options = {}) {
  return fetchRows('comprobantes', options);
}

async function fetchMyComprobantes(options = {}) {
  const qs = queryString(options);
  const suffix = qs ? `?${qs}` : '';
  return window.http.getJson(`/api/metricas/comprobantes-loader/mine${suffix}`);
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

async function fetchMarketingCashCollectedAgenda(options = {}) {
  const qs = queryString(options);
  const suffix = qs ? `?${qs}` : '';
  return window.http.getJson(`/api/metricas/marketing/cash-collected-agenda${suffix}`);
}

async function fetchMarketingCampaignTotals(options = {}) {
  const qs = queryString(options);
  const suffix = qs ? `?${qs}` : '';
  return window.http.getJson(`/api/metricas/marketing/campaign-totales${suffix}`);
}

async function fetchUtmBuilderPresets(options = {}) {
  const qs = queryString(options);
  const suffix = qs ? `?${qs}` : '';
  return window.http.getJson(`/api/metricas/utm-builder/presets${suffix}`);
}

async function saveUtmBuilderPreset(payload = {}) {
  return window.http.postJson('/api/metricas/utm-builder/presets', payload);
}

async function deleteUtmBuilderPreset(payload = {}) {
  return window.http.deleteJson('/api/metricas/utm-builder/presets', payload);
}

async function fetchCloserPersonalPdf(options = {}) {
  const qs = queryString(options);
  const suffix = qs ? `?${qs}` : '';
  return window.http.getJson(`/api/metricas/reportes-personales/pdf${suffix}`);
}

async function uploadCloserPersonalPdf({ closer, month, filename, file }) {
  const qs = queryString({ closer, month, filename });
  const suffix = qs ? `?${qs}` : '';
  const response = await fetch(`/api/metricas/reportes-personales/pdf${suffix}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': file?.type || 'application/pdf'
    },
    body: file
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `Error HTTP ${response.status}`);
  }

  return response.json();
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

async function fetchComprobantesLoaderBootstrap() {
  return window.http.getJson('/api/metricas/comprobantes-loader/bootstrap');
}

async function lookupComprobantesLoaderClient(ghlId) {
  const qs = queryString({ ghlId });
  return window.http.getJson(`/api/metricas/comprobantes-loader/cliente?${qs}`);
}

async function lookupComprobantesLoaderRelatedSale(saleId) {
  const qs = queryString({ saleId });
  return window.http.getJson(`/api/metricas/comprobantes-loader/venta-relacionada?${qs}`);
}

async function createComprobanteManual(payload = {}) {
  return window.http.postJson('/api/metricas/comprobantes-loader', payload);
}

async function generateCloserPersonalReport(payload = {}) {
  return window.http.postJson('/api/metricas/closers/personal-report', payload);
}

async function fetchCloserPersonalReport(params = {}) {
  const qs = queryString({
    closer: params.closer,
    month: params.month
  });
  return window.http.getJson(`/api/metricas/closers/personal-report?${qs}`);
}

async function fetchAuthUsers() {
  return window.http.getJson('/api/metricas/auth/users');
}

async function createAuthUser(payload = {}) {
  return window.http.postJson('/api/metricas/auth/users', payload);
}

async function updateAuthUser(id, payload = {}) {
  return window.http.patchJson(`/api/metricas/auth/users/${encodeURIComponent(id)}`, payload);
}

async function updateAuthUserPassword(id, password) {
  return window.http.patchJson(`/api/metricas/auth/users/${encodeURIComponent(id)}/password`, { password });
}

async function deleteAuthUser(id) {
  return window.http.deleteJson(`/api/metricas/auth/users/${encodeURIComponent(id)}`);
}

window.metricasApi = {
  fetchViews,
  fetchOperationalAlerts,
  fetchCommissionsDashboard,
  fetchCommissionPersonDetail,
  fetchCommissionConfig,
  saveCommissionConfig,
  saveDefaultCommissionConfig,
  lockCommissionMonth,
  fetchRows,
  fetchAgendaDetalleDiarioCloser,
  fetchVentasDiarioCloser,
  fetchCashCollectedDiarioCloser,
  fetchAgendaBonusRules,
  saveAgendaBonusRules,
  fetchAgendaCalendarAssignments,
  saveAgendaCalendarAssignment,
  fetchAgendaCheckpoints,
  saveAgendaCheckpoint,
  fetchReportesPremioConfig,
  saveReportesPremioConfig,
  fetchReportComments,
  saveReportComment,
  markReportCommentRead,
  fetchComprobantes,
  fetchMyComprobantes,
  fetchLeadsRaw,
  fetchKpiMarketingDiario,
  fetchMarketingInvestment,
  fetchMarketingInvestments,
  fetchMarketingAovDia1,
  fetchMarketingVentasTotales,
  fetchMarketingCashCollectedAgenda,
  fetchMarketingCampaignTotals,
  fetchUtmBuilderPresets,
  saveUtmBuilderPreset,
  deleteUtmBuilderPreset,
  fetchCloserPersonalPdf,
  uploadCloserPersonalPdf,
  askScalito,
  saveMarketingInvestment,
  updateMarketingInvestmentRecord,
  deleteMarketingInvestmentRecord,
  fetchAllRows,
  fetchComprobantesLoaderBootstrap,
  lookupComprobantesLoaderClient,
  lookupComprobantesLoaderRelatedSale,
  createComprobanteManual,
  generateCloserPersonalReport,
  fetchCloserPersonalReport,
  fetchAuthUsers,
  createAuthUser,
  updateAuthUser,
  updateAuthUserPassword,
  deleteAuthUser
};
