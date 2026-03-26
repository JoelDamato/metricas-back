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

const MARKETING_SORT_STATE = {
  ads: {
    sortKey: 'agendas',
    direction: 'desc',
    rows: []
  },
  quality: {
    sortKey: 'agendas',
    direction: 'desc',
    rows: []
  },
  traceability: {
    sortKey: 'fecha_agenda',
    direction: 'desc',
    rows: []
  }
};

const MARKETING_NUMERIC_SORT_KEYS = new Set([
  'agendas',
  'cce',
  'llamadas',
  'ventas'
]);

const MARKETING_DATE_SORT_KEYS = new Set([
  'fecha_agenda',
  'created_time',
  'fecha_venta'
]);

const MARKETING_METRIC_INFO = {
  'Agendas': {
    title: 'Agendas',
    dateLabel: '"fecha"',
    logic: 'Suma "reuniones_agendadas" de "kpi_marketing_diario" en el rango seleccionado.'
  },
  'Aplican': {
    title: 'Aplican',
    dateLabel: '"fecha"',
    logic: 'Suma "agendas_aplicables" de "kpi_marketing_diario" en el rango seleccionado.'
  },
  'Cash collected': {
    title: 'Cash collected',
    dateLabel: '"f_acreditacion"',
    logic: 'Suma "cash_collected" en "kpi_marketing_diario", consolidado por fecha diaria del KPI.'
  },
  'Facturación': {
    title: 'Facturación',
    dateLabel: '"fecha_de_agendamiento" y "f_venta"',
    logic: 'Usa la facturación consolidada del KPI de marketing para el rango seleccionado.'
  },
  'AOV': {
    title: 'AOV',
    dateLabel: 'Mixta: facturación / ventas',
    logic: 'Se calcula como "facturacion" dividido "ventasTotales".'
  },
  'AOV día 1': {
    title: 'AOV día 1',
    dateLabel: '"fecha_de_agendamiento"',
    logic: 'Promedio de "cash_collected" por venta del día 1, filtrando comprobantes donde "fecha_correspondiente" y "fecha_de_llamada" caen el mismo día.'
  },
  'Reuniones TOTALES': {
    title: 'Reuniones TOTALES',
    dateLabel: '"fecha"',
    logic: 'Se calcula como "llamadas_venta_asistidas_cce" + "llamadas_venta_asistidas_ccne".'
  },
  'Ventas totales': {
    title: 'Ventas totales',
    dateLabel: '"fecha_de_agendamiento"',
    logic: 'Cuenta ventas de comprobantes por "fecha_de_agendamiento" para mantener la misma base que agendas.'
  },
  'Tasa de cierre (%)': {
    title: 'Tasa de cierre (%)',
    dateLabel: 'Mixta: reuniones y ventas',
    logic: 'Se calcula como "ventasTotales" dividido "reunionesTotales" por 100.'
  },
  'CC Exitosos': {
    title: 'CC Exitosos',
    dateLabel: '"fecha"',
    logic: 'Suma "call_confirmer_exitosos" de "kpi_marketing_diario".'
  }
};

function ensureMarketingViewStyles() {
  if (document.getElementById('marketingViewStyles')) return;

  const style = document.createElement('style');
  style.id = 'marketingViewStyles';
  style.textContent = `
    .metric-info-trigger {
      padding: 0;
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      font-weight: 700;
      text-align: left;
      text-decoration: underline;
      text-decoration-style: dotted;
      text-underline-offset: 3px;
    }

    .metric-info-trigger.metric-label {
      color: #1f3b63;
    }

    .metric-info-card {
      width: min(560px, 100%);
      text-align: left;
    }

    .metric-info-card h3 {
      margin: 0 0 12px;
      color: #17345f;
    }

    .metric-info-card p {
      margin: 0 0 10px;
      color: #42597d;
    }

    .ads-collapse > summary {
      color: #111111;
      background: rgba(255, 255, 255, 0.78);
      text-shadow: none;
    }

    .marketing-sort-trigger {
      width: 100%;
      display: inline-flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
      color: inherit;
      font: inherit;
      font-weight: inherit;
      text-align: inherit;
    }

    .marketing-sort-trigger.active {
      color: #173f73;
    }

    .marketing-sort-arrow {
      flex: 0 0 auto;
      font-size: 0.9rem;
      color: #1d5bb0;
    }

    .ads-table th:not(:first-child) .marketing-sort-trigger,
    .traceability-table th:not(:first-child) .marketing-sort-trigger {
      justify-content: center;
    }
  `;

  document.head.appendChild(style);
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

function showMetricInfo(info) {
  if (!info) return;
  const existing = document.getElementById('metricInfoPopup');
  if (existing) existing.remove();

  const popup = document.createElement('div');
  popup.id = 'metricInfoPopup';
  popup.className = 'kpi-popup metric-info-popup';
  popup.innerHTML = `
    <div class="kpi-popup-card metric-info-card">
      <h3>${info.title}</h3>
      <p><strong>Fecha que usa:</strong> ${info.dateLabel}</p>
      <p><strong>Lógica:</strong> ${info.logic}</p>
      <button id="metricInfoPopupClose" type="button">Cerrar</button>
    </div>
  `;
  document.body.appendChild(popup);

  const close = () => popup.remove();
  popup.addEventListener('click', (event) => {
    if (event.target === popup) close();
  });
  document.getElementById('metricInfoPopupClose').addEventListener('click', close);
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

function getMarketingSortValue(row, key) {
  if (!row || !key) return '';

  if (MARKETING_DATE_SORT_KEYS.has(key)) {
    const raw = row[key];
    if (!raw) return Number.NEGATIVE_INFINITY;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? Number.NEGATIVE_INFINITY : date.getTime();
  }

  if (MARKETING_NUMERIC_SORT_KEYS.has(key)) {
    return Number(row[key] || 0);
  }

  return normalizeText(row[key]);
}

function compareMarketingSortValues(a, b, direction) {
  if (typeof a === 'number' && typeof b === 'number') {
    return direction === 'desc' ? b - a : a - b;
  }

  const left = String(a || '');
  const right = String(b || '');
  return direction === 'desc'
    ? right.localeCompare(left, 'es')
    : left.localeCompare(right, 'es');
}

function sortMarketingRows(rows, sectionKey, fallbackKey, fallbackLabelKey) {
  const state = MARKETING_SORT_STATE[sectionKey];
  const sortKey = state?.sortKey || fallbackKey;
  const direction = state?.direction || 'desc';

  return [...(rows || [])].sort((a, b) => {
    const primary = compareMarketingSortValues(
      getMarketingSortValue(a, sortKey),
      getMarketingSortValue(b, sortKey),
      direction
    );

    if (primary !== 0) return primary;

    return compareMarketingSortValues(
      getMarketingSortValue(a, fallbackLabelKey),
      getMarketingSortValue(b, fallbackLabelKey),
      'asc'
    );
  });
}

function renderMarketingSortHeader(sectionKey, columnKey, label) {
  const state = MARKETING_SORT_STATE[sectionKey];
  const isActive = state?.sortKey === columnKey;
  const arrow = isActive
    ? (state.direction === 'desc' ? '↓' : '↑')
    : '↕';

  return `
    <button
      type="button"
      class="marketing-sort-trigger${isActive ? ' active' : ''}"
      data-sort-section="${sectionKey}"
      data-sort-key="${columnKey}"
      aria-label="Ordenar por ${label}"
    >
      <span>${label}</span>
      <span class="marketing-sort-arrow">${arrow}</span>
    </button>
  `;
}

function updateMarketingSort(sectionKey, columnKey) {
  const state = MARKETING_SORT_STATE[sectionKey];
  if (!state) return;

  if (state.sortKey === columnKey) {
    state.direction = state.direction === 'desc' ? 'asc' : 'desc';
    return;
  }

  state.sortKey = columnKey;
  state.direction = 'desc';
}

function attachMarketingSortHandlers(container, sectionKey, renderFn) {
  container.querySelectorAll(`.marketing-sort-trigger[data-sort-section="${sectionKey}"]`).forEach((button) => {
    button.addEventListener('click', () => {
      updateMarketingSort(sectionKey, button.dataset.sortKey);
      renderFn();
    });
  });
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
              <th><button type="button" class="metric-info-trigger metric-label" data-metric-label="${row.label}">${row.label}</button></th>
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
  const wasOpen = container.querySelector('.ads-collapse')?.open ?? false;

  MARKETING_SORT_STATE.ads.rows = [...(rows || [])];
  const orderedRows = sortMarketingRows(MARKETING_SORT_STATE.ads.rows, 'ads', 'agendas', 'adname');

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

  const body = orderedRows.map((row) => `
    <tr>
      <td>${row.adname}</td>
      <td>${formatInteger(row.agendas)}</td>
      <td>${formatInteger(row.cce)}</td>
      <td>${formatInteger(row.llamadas)}</td>
      <td>${formatInteger(row.ventas)}</td>
    </tr>
  `).join('');

  container.innerHTML = `
    <details class="ads-collapse"${wasOpen ? ' open' : ''}>
      <summary>Metricas Anuncios</summary>
      <div class="table-wrap marketing-panel ads-panel">
        <table class="marketing-table ads-table">
          <thead>
            <tr>
              <th>${renderMarketingSortHeader('ads', 'adname', 'Adname')}</th>
              <th>${renderMarketingSortHeader('ads', 'agendas', 'Agendas')}</th>
              <th>${renderMarketingSortHeader('ads', 'cce', 'CCE')}</th>
              <th>${renderMarketingSortHeader('ads', 'llamadas', 'Llamadas')}</th>
              <th>${renderMarketingSortHeader('ads', 'ventas', 'Ventas')}</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </details>
  `;

  attachMarketingSortHandlers(container, 'ads', () => renderAdsMetricsTable(MARKETING_SORT_STATE.ads.rows));
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
  const wasOpen = container.querySelector('.ads-collapse')?.open ?? false;

  MARKETING_SORT_STATE.quality.rows = [...(rows || [])];
  const orderedRows = sortMarketingRows(MARKETING_SORT_STATE.quality.rows, 'quality', 'agendas', 'calidad');

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

  const body = orderedRows.map((row) => `
    <tr>
      <td>${row.calidad}</td>
      <td>${formatInteger(row.agendas)}</td>
      <td>${formatInteger(row.cce)}</td>
      <td>${formatInteger(row.llamadas)}</td>
      <td>${formatInteger(row.ventas)}</td>
    </tr>
  `).join('');

  container.innerHTML = `
    <details class="ads-collapse"${wasOpen ? ' open' : ''}>
      <summary>Metricas por Calidad</summary>
      <div class="table-wrap marketing-panel ads-panel">
        <table class="marketing-table ads-table">
          <thead>
            <tr>
              <th>${renderMarketingSortHeader('quality', 'calidad', 'Calidad Lead')}</th>
              <th>${renderMarketingSortHeader('quality', 'agendas', 'Agendas')}</th>
              <th>${renderMarketingSortHeader('quality', 'cce', 'CCE')}</th>
              <th>${renderMarketingSortHeader('quality', 'llamadas', 'Llamadas')}</th>
              <th>${renderMarketingSortHeader('quality', 'ventas', 'Ventas')}</th>
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

  attachMarketingSortHandlers(container, 'quality', () => renderQualityMetricsTable(MARKETING_SORT_STATE.quality.rows));
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
  const wasOpen = container.querySelector('.ads-collapse')?.open ?? false;

  MARKETING_SORT_STATE.traceability.rows = [...(rows || [])];
  const orderedRows = sortMarketingRows(MARKETING_SORT_STATE.traceability.rows, 'traceability', 'fecha_agenda', 'nombre');

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

  const body = orderedRows.map((row) => `
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
    <details class="ads-collapse"${wasOpen ? ' open' : ''}>
      <summary>Trazabilidad Anuncios</summary>
      <div class="table-wrap marketing-panel ads-panel traceability-panel">
        <table class="marketing-table ads-table traceability-table">
          <thead>
            <tr>
              <th>${renderMarketingSortHeader('traceability', 'fecha_agenda', 'Fecha agenda')}</th>
              <th>${renderMarketingSortHeader('traceability', 'nombre', 'Nombre')}</th>
              <th>${renderMarketingSortHeader('traceability', 'mail', 'Mail')}</th>
              <th>${renderMarketingSortHeader('traceability', 'campaign', 'Campaign')}</th>
              <th>${renderMarketingSortHeader('traceability', 'adset', 'Adset')}</th>
              <th>${renderMarketingSortHeader('traceability', 'adname', 'Adname')}</th>
              <th>${renderMarketingSortHeader('traceability', 'calidad_lead', 'Calidad')}</th>
              <th>${renderMarketingSortHeader('traceability', 'aplica', 'Aplica')}</th>
              <th>${renderMarketingSortHeader('traceability', 'call_confirm', 'Call confirm')}</th>
              <th>${renderMarketingSortHeader('traceability', 'llamada_meg', 'Llamada Meg')}</th>
              <th>${renderMarketingSortHeader('traceability', 'fecha_venta', 'Venta')}</th>
              <th>${renderMarketingSortHeader('traceability', 'setter', 'Setter')}</th>
              <th>${renderMarketingSortHeader('traceability', 'created_time', 'created_time')}</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </details>
  `;

  attachMarketingSortHandlers(container, 'traceability', () => renderTraceabilityTable(MARKETING_SORT_STATE.traceability.rows));
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

  container.querySelectorAll('.metric-label').forEach((button) => {
    button.addEventListener('click', () => {
      const label = button.dataset.metricLabel;
      showMetricInfo(MARKETING_METRIC_INFO[label] || {
        title: label,
        dateLabel: '"fecha"',
        logic: `Se calcula dentro de "kpi_marketing_diario" para el rango seleccionado, usando la agregación diaria correspondiente a "${label}".`
      });
    });
  });
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
  ensureMarketingViewStyles();
  setDefaultDates();
  await loadOrigins();
  await loadDashboard();

  document.getElementById('reload').addEventListener('click', loadDashboard);
  document.getElementById('saveInvestment').addEventListener('click', saveInvestment);
}

init();
