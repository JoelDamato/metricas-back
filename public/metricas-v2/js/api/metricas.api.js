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

async function fetchLeadsRaw(options = {}) {
  return fetchRows('leads_raw', options);
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
  fetchLeadsRaw,
  fetchAllRows
};
