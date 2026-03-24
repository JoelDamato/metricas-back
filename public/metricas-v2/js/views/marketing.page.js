function formatInteger(value) {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatCurrency(value, currency = 'USD') {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function formatRatio(value) {
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function formatPercent(value) {
  return `${formatRatio(value)}%`;
}

function safeDiv(a, b) {
  if (!Number(b)) return 0;
  return Number(a || 0) / Number(b || 0);
}

function showLoading(message) {
  const popup = document.getElementById('loadingPopup');
  document.getElementById('loadingMessage').textContent = message || 'Cargando...';
  popup.hidden = false;
}

function hideLoading() {
  document.getElementById('loadingPopup').hidden = true;
}

function showPopup(message, type = 'success') {
  const existing = document.getElementById('kpiPopup');
  if (existing) existing.remove();

  const popup = document.createElement('div');
  popup.id = 'kpiPopup';
  popup.className = `kpi-popup ${type}`;
  popup.innerHTML = `
    <div class="kpi-popup-card">
      <p>${message}</p>
      <button id="kpiPopupClose">Cerrar</button>
    </div>
  `;
  document.body.appendChild(popup);

  const close = () => popup.remove();
  document.getElementById('kpiPopupClose').addEventListener('click', close);
  setTimeout(close, 2500);
}

function setDefaultDates() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  document.getElementById('desde').value = from.toISOString().slice(0, 10);
  document.getElementById('hasta').value = now.toISOString().slice(0, 10);
}

function setOriginOptions(origins) {
  const select = document.getElementById('origen');
  select.innerHTML = ['<option value="">Todos</option>']
    .concat(origins.map((origin) => `<option value="${origin}">${origin}</option>`))
    .join('');
}

function getFilters() {
  return {
    from: document.getElementById('desde').value,
    to: document.getElementById('hasta').value,
    origen: document.getElementById('origen').value
  };
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function normalizeOriginGroup(value) {
  const text = normalizeText(value);
  if (text.includes('apset')) return 'APSET';
  if (text.includes('clases')) return 'CLASES';
  if (text.includes('org')) return 'ORG';
  if (text.includes('vsl')) return 'VSL';
  return String(value || '').trim() || 'Sin origen';
}

function sumField(rows, key) {
  return (rows || []).reduce((sum, row) => sum + Number(row[key] || 0), 0);
}

function computeMetrics(rows, investment, extras = {}) {
  const inversionPlanificada = Number(investment?.inversion_planificada || 0);
  const inversionRealizada = Number(investment?.inversion_realizada || 0);
  const agendas = sumField(rows, 'reuniones_agendadas');
  const aplican = sumField(rows, 'agendas_aplicables');
  const cashCollected = sumField(rows, 'cash_collected');
  const facturacion = sumField(rows, 'facturacion');
  const leadsContactados = sumField(rows, 'leads_contactados_cc');
  const ccExitosos = sumField(rows, 'call_confirmer_exitosos');
  const llamadasCce = sumField(rows, 'llamadas_venta_asistidas_cce');
  const ventasCce = sumField(rows, 'ventas_cce');
  const ccNoExitosos = sumField(rows, 'aplicaciones_no_calificaban_cc');
  const llamadasCcne = sumField(rows, 'llamadas_venta_asistidas_ccne');
  const ventasCcne = sumField(rows, 'ventas_ccne');
  const reunionesTotales = llamadasCce + llamadasCcne;
  const ventasTotales = Number(extras.ventasTotales ?? (ventasCce + ventasCcne));
  const aovDia1 = Number(extras.aovDia1 || 0);

  return {
    inversionPlanificada,
    inversionRealizada,
    agendas,
    costoAgenda: safeDiv(inversionRealizada, agendas),
    aplican,
    costoAplicables: safeDiv(inversionRealizada, aplican),
    costoCcExitoso: safeDiv(inversionRealizada, ccExitosos),
    costoReunionRealizada: safeDiv(inversionRealizada, reunionesTotales),
    costoVenta: safeDiv(inversionRealizada, ventasTotales),
    cashCollected,
    facturacion,
    roasFacturacion: safeDiv(facturacion, inversionRealizada),
    roasCc: safeDiv(cashCollected, inversionRealizada),
    aov: safeDiv(facturacion, ventasTotales),
    aovDia1,
    reunionesTotales,
    ventasTotales,
    tasaCierre: safeDiv(ventasTotales * 100, reunionesTotales),
    leadsContactados,
    ccExitosos,
    llamadasCce,
    ventasCce,
    costoVentaCce: safeDiv(inversionRealizada, ventasCce),
    llamadasCcne,
    ccNoExitosos,
    ventasCcne,
    costoVentaCcne: safeDiv(inversionRealizada, ventasCcne)
  };
}

function renderMetricTable(title, rows) {
  return `
    <section class="table-wrap marketing-panel">
      <div class="marketing-panel-head">
        <h3>${title}</h3>
      </div>
      <table class="marketing-table">
        <tbody>
          ${rows.map((row) => `
            <tr>
              <th>${row.label}</th>
              <td>${row.value}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>
  `;
}

function aggregateAdsMetrics(rows, filters) {
  const byAd = new Map();

  (rows || []).forEach((row) => {
    const adname = String(row.adname || '').trim();
    if (!adname) return;

    if (filters.origen && normalizeOriginGroup(row.origen) !== filters.origen) {
      return;
    }

    const current = byAd.get(adname) || {
      adname,
      agendas: 0,
      cce: 0,
      llamadas: 0,
      ventas: 0
    };

    current.agendas += 1;
    if (normalizeText(row.call_confirm) === 'exitoso') {
      current.cce += 1;
    }
    if (normalizeText(row.llamada_meg) === 'efectuada') {
      current.llamadas += 1;
    }
    if (row.fecha_venta) {
      current.ventas += 1;
    }

    byAd.set(adname, current);
  });

  return [...byAd.values()].sort((a, b) => {
    const diff = b.agendas - a.agendas;
    if (diff !== 0) return diff;
    return a.adname.localeCompare(b.adname);
  });
}

function renderAdsMetricsTable(rows) {
  const container = document.getElementById('adsMetricsContainer');

  if (!rows.length) {
    container.innerHTML = `
      <details class="ads-collapse" open>
        <summary>Metricas Anuncios</summary>
        <div class="table-wrap marketing-panel">
          <div class="report-empty">No hay datos de leads para este rango.</div>
        </div>
      </details>
    `;
    return;
  }

  const body = rows.map((row) => `
    <tr>
      <td>${row.adname}</td>
      <td>${formatInteger(row.agendas)}</td>
      <td>${formatInteger(row.cce)}</td>
      <td>${formatInteger(row.llamadas)}</td>
      <td>${formatInteger(row.ventas)}</td>
    </tr>
  `).join('');

  container.innerHTML = `
    <details class="ads-collapse">
      <summary>Metricas Anuncios</summary>
      <div class="table-wrap marketing-panel ads-panel">
        <table class="marketing-table ads-table">
          <thead>
            <tr>
              <th>Adname</th>
              <th>Agendas</th>
              <th>CCE</th>
              <th>Llamadas</th>
              <th>Ventas</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </details>
  `;
}

function aggregateQualityMetrics(rows, filters) {
  const byQuality = new Map();

  (rows || []).forEach((row) => {
    const calidad = String(row.calidad_lead || '').trim() || 'Sin calidad';

    if (filters.origen && normalizeOriginGroup(row.origen) !== filters.origen) {
      return;
    }

    const current = byQuality.get(calidad) || {
      calidad,
      agendas: 0,
      cce: 0,
      llamadas: 0,
      ventas: 0
    };

    current.agendas += 1;
    if (normalizeText(row.call_confirm) === 'exitoso') {
      current.cce += 1;
    }
    if (normalizeText(row.llamada_meg) === 'efectuada') {
      current.llamadas += 1;
    }
    if (row.fecha_venta) {
      current.ventas += 1;
    }

    byQuality.set(calidad, current);
  });

  return [...byQuality.values()].sort((a, b) => {
    const diff = b.agendas - a.agendas;
    if (diff !== 0) return diff;
    return a.calidad.localeCompare(b.calidad);
  });
}

function renderQualityMetricsTable(rows) {
  const container = document.getElementById('qualityMetricsContainer');

  if (!rows.length) {
    container.innerHTML = `
      <details class="ads-collapse">
        <summary>Metricas por Calidad</summary>
        <div class="table-wrap marketing-panel">
          <div class="report-empty">No hay datos de calidad para este rango.</div>
        </div>
      </details>
    `;
    return;
  }

  const total = rows.reduce((acc, row) => ({
    agendas: acc.agendas + row.agendas,
    cce: acc.cce + row.cce,
    llamadas: acc.llamadas + row.llamadas,
    ventas: acc.ventas + row.ventas
  }), { agendas: 0, cce: 0, llamadas: 0, ventas: 0 });

  const body = rows.map((row) => `
    <tr>
      <td>${row.calidad}</td>
      <td>${formatInteger(row.agendas)}</td>
      <td>${formatInteger(row.cce)}</td>
      <td>${formatInteger(row.llamadas)}</td>
      <td>${formatInteger(row.ventas)}</td>
    </tr>
  `).join('');

  container.innerHTML = `
    <details class="ads-collapse">
      <summary>Metricas por Calidad</summary>
      <div class="table-wrap marketing-panel ads-panel">
        <table class="marketing-table ads-table">
          <thead>
            <tr>
              <th>Calidad Lead</th>
              <th>Agendas</th>
              <th>CCE</th>
              <th>Llamadas</th>
              <th>Ventas</th>
            </tr>
          </thead>
          <tbody>
            ${body}
            <tr>
              <td><strong>Total</strong></td>
              <td><strong>${formatInteger(total.agendas)}</strong></td>
              <td><strong>${formatInteger(total.cce)}</strong></td>
              <td><strong>${formatInteger(total.llamadas)}</strong></td>
              <td><strong>${formatInteger(total.ventas)}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  `;
}

function formatDateLabel(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(date);
}

function renderTraceabilityTable(rows) {
  const container = document.getElementById('traceabilityContainer');

  if (!rows.length) {
    container.innerHTML = `
      <details class="ads-collapse">
        <summary>Trazabilidad Anuncios</summary>
        <div class="table-wrap marketing-panel">
          <div class="report-empty">No hay leads para este rango de creación.</div>
        </div>
      </details>
    `;
    return;
  }

  const body = rows.map((row) => `
    <tr>
      <td>${formatDateLabel(row.fecha_agenda)}</td>
      <td>${row.nombre || '-'}</td>
      <td>${row.mail || '-'}</td>
      <td>${row.campaign || '-'}</td>
      <td>${row.adset || '-'}</td>
      <td>${row.adname || '-'}</td>
      <td>${row.calidad_lead || '-'}</td>
      <td>${row.aplica || '-'}</td>
      <td>${row.call_confirm || '-'}</td>
      <td>${row.llamada_meg || '-'}</td>
      <td>${row.fecha_venta ? 'Si' : '-'}</td>
      <td>${row.setter || '-'}</td>
      <td>${formatDateLabel(row.created_time)}</td>
    </tr>
  `).join('');

  container.innerHTML = `
    <details class="ads-collapse">
      <summary>Trazabilidad Anuncios</summary>
      <div class="table-wrap marketing-panel ads-panel traceability-panel">
        <table class="marketing-table ads-table traceability-table">
          <thead>
            <tr>
              <th>Fecha agenda</th>
              <th>Nombre</th>
              <th>Mail</th>
              <th>Campaign</th>
              <th>Adset</th>
              <th>Adname</th>
              <th>Calidad</th>
              <th>Aplica</th>
              <th>Call confirm</th>
              <th>Llamada Meg</th>
              <th>Venta</th>
              <th>Setter</th>
              <th>created_time</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </details>
  `;
}

function renderDashboard(rows, investment, extras = {}) {
  const container = document.getElementById('marketingContainer');

  if (!(rows || []).length) {
    container.innerHTML = '<div class="table-wrap marketing-panel"><div class="report-empty">No hay datos para el rango seleccionado.</div></div>';
    return;
  }

  const m = computeMetrics(rows, investment, extras);
  document.getElementById('inversionRealizada').value = Number(m.inversionRealizada || 0).toFixed(2);

  const leftRows = [
    { label: 'Inversión planificada', value: formatCurrency(m.inversionPlanificada) },
    { label: 'Inversión realizada', value: formatCurrency(m.inversionRealizada) },
    { label: 'Agendas', value: formatInteger(m.agendas) },
    { label: 'Costo por Agenda', value: formatCurrency(m.costoAgenda) },
    { label: 'Aplican', value: formatInteger(m.aplican) },
    { label: 'Costo por aplicables', value: formatCurrency(m.costoAplicables) },
    { label: 'Costo por Call Confirmer Exitoso', value: formatCurrency(m.costoCcExitoso) },
    { label: 'Costo por reunión realizada', value: formatCurrency(m.costoReunionRealizada) },
    { label: 'Costo por venta', value: formatCurrency(m.costoVenta) },
    { label: 'Cash collected', value: formatCurrency(m.cashCollected) },
    { label: 'Facturación', value: formatCurrency(m.facturacion) },
    { label: 'ROAS sobre facturación total', value: formatRatio(m.roasFacturacion) },
    { label: 'ROAS sobre CC', value: formatRatio(m.roasCc) },
    { label: 'AOV', value: formatCurrency(m.aov) },
    { label: 'AOV día 1', value: formatCurrency(m.aovDia1) },
    { label: 'Reuniones TOTALES', value: formatInteger(m.reunionesTotales) },
    { label: 'Ventas totales', value: formatInteger(m.ventasTotales) },
    { label: 'Tasa de cierre (%)', value: formatPercent(m.tasaCierre) }
  ];

  const rightRows = [
    { label: 'Inversión planificada', value: formatCurrency(m.inversionPlanificada) },
    { label: 'Inversión realizada', value: formatCurrency(m.inversionRealizada) },
    { label: 'Agendas', value: formatInteger(m.agendas) },
    { label: 'Aplican', value: formatInteger(m.aplican) },
    { label: 'Leads contactados CC', value: formatInteger(m.leadsContactados) },
    { label: 'CC Exitosos', value: formatInteger(m.ccExitosos) },
    { label: 'Llamadas ventas asistidas CCE', value: formatInteger(m.llamadasCce) },
    { label: 'Ventas CCE', value: formatInteger(m.ventasCce) },
    { label: 'Costo por Venta (CCE)', value: formatCurrency(m.costoVentaCce) },
    { label: 'Llamadas venta asistidas CCNE', value: formatInteger(m.llamadasCcne) },
    { label: 'Call Confirmer NO EXITOSOS', value: formatInteger(m.ccNoExitosos) },
    { label: 'Ventas CCNE', value: formatInteger(m.ventasCcne) },
    { label: 'Costo por Venta (CCNE)', value: formatCurrency(m.costoVentaCcne) },
    { label: 'Reuniones TOTALES', value: formatInteger(m.reunionesTotales) },
    { label: 'Ventas totales', value: formatInteger(m.ventasTotales) }
  ];

  container.innerHTML = [
    renderMetricTable('Resumen General', leftRows),
    renderMetricTable('Embudo Comercial', rightRows)
  ].join('');
}

async function loadOrigins() {
  const response = await window.metricasApi.fetchAllRows('kpi_marketing_diario', {
    limit: 1000,
    orderBy: 'fecha',
    orderDir: 'desc'
  });

  const origins = [...new Set((response.rows || [])
    .map((row) => String(row.origen || '').trim())
    .filter(Boolean))].sort((a, b) => a.localeCompare(b));

  setOriginOptions(origins);
}

async function loadDashboard() {
  const status = document.getElementById('status');
  const filters = getFilters();

  if (!filters.from || !filters.to) {
    status.textContent = 'Seleccioná un rango de fechas.';
    return;
  }

  showLoading('Cargando KPI Marketing...');
  status.textContent = 'Consultando Supabase...';

  try {
    const rowOptions = {
      limit: 1000,
      from: filters.from,
      to: filters.to,
      dateField: 'fecha'
    };

    if (filters.origen) {
      rowOptions.eq_origen = filters.origen;
    }

    const [rowsResponse, investmentResponse, aovDia1Response, ventasTotalesResponse, leadsResponse, traceabilityResponse] = await Promise.all([
      window.metricasApi.fetchAllRows('kpi_marketing_diario', rowOptions),
      window.metricasApi.fetchMarketingInvestment(filters),
      window.metricasApi.fetchMarketingAovDia1(filters),
      window.metricasApi.fetchMarketingVentasTotales(filters),
      window.metricasApi.fetchAllRows('leads_raw', {
        limit: 1000,
        from: filters.from,
        to: filters.to,
        dateField: 'fecha_agenda'
      }),
      window.metricasApi.fetchAllRows('leads_raw', {
        limit: 1000,
        from: filters.from,
        to: filters.to,
        dateField: 'created_time'
      })
    ]);

    const rows = rowsResponse.rows || [];
    const leadRows = leadsResponse.rows || [];
    const adRows = aggregateAdsMetrics(leadRows, filters);
    const qualityRows = aggregateQualityMetrics(leadRows, filters);
    const traceabilityRows = (traceabilityResponse.rows || []).filter((row) => {
      if (filters.origen && normalizeOriginGroup(row.origen) !== filters.origen) {
        return false;
      }
      return true;
    });
    renderDashboard(rows, investmentResponse.investment || null, {
      ...(aovDia1Response || {}),
      ...(ventasTotalesResponse || {})
    });
    renderAdsMetricsTable(adRows);
    renderQualityMetricsTable(qualityRows);
    renderTraceabilityTable(traceabilityRows);
    status.textContent = `${rows.length} registros KPI, ${adRows.length} anuncios y ${traceabilityRows.length} leads de trazabilidad procesados.`;
  } catch (error) {
    status.textContent = error.message;
    document.getElementById('marketingContainer').innerHTML = '<div class="table-wrap marketing-panel"><div class="report-empty">No se pudo cargar el KPI de marketing.</div></div>';
    document.getElementById('adsMetricsContainer').innerHTML = '';
    document.getElementById('qualityMetricsContainer').innerHTML = '';
    document.getElementById('traceabilityContainer').innerHTML = '';
  } finally {
    hideLoading();
  }
}

async function saveInvestment() {
  const filters = getFilters();
  const status = document.getElementById('status');
  const inversionRealizada = Number(document.getElementById('inversionRealizada').value || 0);

  if (!filters.from || !filters.to) {
    status.textContent = 'Seleccioná primero el período.';
    return;
  }

  showLoading('Guardando inversión...');

  try {
    await window.metricasApi.saveMarketingInvestment({
      ...filters,
      inversion_realizada: inversionRealizada
    });

    showPopup('Inversión guardada correctamente.');
    await loadDashboard();
  } catch (error) {
    showPopup(error.message, 'error');
    status.textContent = error.message;
    hideLoading();
  }
}

async function init() {
  setDefaultDates();
  await loadOrigins();
  await loadDashboard();

  document.getElementById('reload').addEventListener('click', loadDashboard);
  document.getElementById('saveInvestment').addEventListener('click', saveInvestment);
}

init();
