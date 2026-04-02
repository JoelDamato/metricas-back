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
    viewLabel: '"kpi_marketing_diario"',
    dateLabel: 'La columna "fecha" de la vista sale de date("leads_raw"."fecha_agenda")',
    logic: 'Suma "reuniones_agendadas" de "kpi_marketing_diario". En esta métrica, la fila diaria representa directamente la fecha de agenda: date("leads_raw"."fecha_agenda").'
  },
  'Inversión planificada': {
    title: 'Inversión planificada',
    viewLabel: '"kpi_marketing_inversiones"',
    dateLabel: 'Rango guardado en "fecha_desde" y "fecha_hasta"',
    logic: 'Suma "inversion_planificada" de los registros de inversión cuyo rango queda dentro del filtro seleccionado. Si el origen es "Todos", no filtra por "origen".'
  },
  'Inversión realizada': {
    title: 'Inversión realizada',
    viewLabel: '"kpi_marketing_inversiones"',
    dateLabel: 'Rango guardado en "fecha_desde" y "fecha_hasta"',
    logic: 'Suma "inversion_realizada" de los registros de "kpi_marketing_inversiones" que entran en el rango seleccionado. Si el origen es "Todos", agrega todos los orígenes.'
  },
  'Aplican': {
    title: 'Aplican',
    viewLabel: '"kpi_marketing_diario"',
    dateLabel: 'La columna "fecha" de la vista sale de date("leads_raw"."fecha_agenda")',
    logic: 'Suma "agendas_aplicables" de "kpi_marketing_diario". La fila diaria está armada sobre date("leads_raw"."fecha_agenda").'
  },
  'Costo por Agenda': {
    title: 'Costo por Agenda',
    viewLabel: 'Cálculo frontend sobre "kpi_marketing_inversiones" + "kpi_marketing_diario"',
    dateLabel: 'Mixta: inversiones por "fecha_desde"/"fecha_hasta" + "kpi_marketing_diario"."fecha", donde "fecha" = date("leads_raw"."fecha_agenda")',
    logic: 'Se calcula como "inversion_realizada" dividido "agendas". La inversión sale de "kpi_marketing_inversiones" y "agendas" de "reuniones_agendadas" en "kpi_marketing_diario", cuya fecha diaria nace de date("leads_raw"."fecha_agenda").'
  },
  'Costo por aplicables': {
    title: 'Costo por aplicables',
    viewLabel: 'Cálculo frontend sobre "kpi_marketing_inversiones" + "kpi_marketing_diario"',
    dateLabel: 'Mixta: inversiones por "fecha_desde"/"fecha_hasta" + "kpi_marketing_diario"."fecha", donde "fecha" = date("leads_raw"."fecha_agenda")',
    logic: 'Se calcula como "inversion_realizada" dividido "agendas_aplicables". La base diaria de aplicables sale de "kpi_marketing_diario", cuya fecha nace de date("leads_raw"."fecha_agenda").'
  },
  'Cash collected': {
    title: 'Cash collected',
    viewLabel: '"kpi_marketing_diario"',
    dateLabel: 'La fila usa "kpi_marketing_diario"."fecha"; esa columna nace de date("leads_raw"."fecha_agenda"), pero para esta métrica se completa con comprobantes donde date("f_acreditacion") = "fecha"',
    logic: 'Suma "cash_collected" desde "kpi_marketing_diario". Internamente la vista hace un join diario contra comprobantes acreditados por "f_acreditacion", y vuelca ese total sobre la fila cuyo alias "fecha" coincide con esa acreditación.'
  },
  'Facturación': {
    title: 'Facturación',
    viewLabel: '"kpi_marketing_diario"',
    dateLabel: 'La fila usa "kpi_marketing_diario"."fecha"; esa columna nace de date("leads_raw"."fecha_agenda"), pero la facturación se cruza en la vista con comprobantes donde date("f_acreditacion") = "fecha"',
    logic: 'Muestra "facturacion" desde "kpi_marketing_diario". Hoy ese valor no entra por "f_venta": la vista lo pega al día usando comprobantes agrupados por date("f_acreditacion").'
  },
  'Costo por Call Confirmer Exitoso': {
    title: 'Costo por Call Confirmer Exitoso',
    viewLabel: 'Cálculo frontend sobre "kpi_marketing_inversiones" + "kpi_marketing_diario"',
    dateLabel: 'Mixta: inversiones por "fecha_desde"/"fecha_hasta" + "kpi_marketing_diario"."fecha", donde "fecha" = date("leads_raw"."fecha_agenda")',
    logic: 'Se calcula como "inversion_realizada" dividido "call_confirmer_exitosos". Esa cantidad sale de "kpi_marketing_diario" sobre filas diarias cuyo alias "fecha" nace de date("leads_raw"."fecha_agenda").'
  },
  'Costo por reunión realizada': {
    title: 'Costo por reunión realizada',
    viewLabel: 'Cálculo frontend sobre "kpi_marketing_inversiones" + "kpi_marketing_diario"',
    dateLabel: 'Mixta: inversiones por "fecha_desde"/"fecha_hasta" + "kpi_marketing_diario"."fecha", donde "fecha" = date("leads_raw"."fecha_agenda")',
    logic: 'Se calcula como "inversion_realizada" dividido "reunionesTotales". "reunionesTotales" sale de la suma de asistidas CCE y CCNE dentro de "kpi_marketing_diario", usando la fila diaria cuyo alias "fecha" nace de date("leads_raw"."fecha_agenda").'
  },
  'Costo por venta': {
    title: 'Costo por venta',
    viewLabel: 'Cálculo frontend sobre "kpi_marketing_inversiones" + endpoint "marketing/ventas-totales"',
    dateLabel: 'Mixta: rango de "fecha_desde"/"fecha_hasta" + "fecha_de_agendamiento"',
    logic: 'Se calcula como "inversion_realizada" dividido "ventasTotales". El total de ventas se trae desde comprobantes por "fecha_de_agendamiento".'
  },
  'Leads contactados CC': {
    title: 'Leads contactados CC',
    viewLabel: '"kpi_marketing_diario"',
    dateLabel: 'La columna "fecha" de la vista sale de date("leads_raw"."fecha_agenda")',
    logic: 'Suma "leads_contactados_cc". En la vista actual solo cuenta filas con "agendo"=\'Agendo\', "aplica"=\'Aplica\' y call confirmer exitoso, agrupadas por date("leads_raw"."fecha_agenda").'
  },
  'AOV': {
    title: 'AOV',
    viewLabel: 'Cálculo frontend sobre "kpi_marketing_diario" + endpoint de ventas',
    dateLabel: 'Mixta: la facturación se lee sobre "kpi_marketing_diario"."fecha" y ese alias hoy se cruza por date("f_acreditacion"); las ventas salen por "fecha_de_agendamiento"',
    logic: 'Se calcula en frontend como "facturacion" dividido "ventasTotales". Ojo: hoy mezcla facturación diaria pegada por date("f_acreditacion") en "kpi_marketing_diario" con ventas traídas desde comprobantes por "fecha_de_agendamiento".'
  },
  'AOV día 1': {
    title: 'AOV día 1',
    viewLabel: 'Endpoint "marketing/aov-dia-1" sobre "comprobantes"',
    dateLabel: '"fecha_de_agendamiento"',
    logic: 'Promedio de "cash_collected" por venta del día 1, filtrando comprobantes donde "fecha_correspondiente" y "fecha_de_llamada" caen el mismo día.'
  },
  'Reuniones TOTALES': {
    title: 'Reuniones TOTALES',
    viewLabel: '"kpi_marketing_diario"',
    dateLabel: 'La columna "fecha" de la vista sale de date("leads_raw"."fecha_agenda")',
    logic: 'Se calcula como "llamadas_venta_asistidas_cce" + "llamadas_venta_asistidas_ccne". Ambas columnas se agrupan sobre date("leads_raw"."fecha_agenda") y ya vienen filtradas por "agendo"=\'Agendo\', "aplica"=\'Aplica\' y "llamada_meg"=\'Efectuada\'.'
  },
  'Llamadas ventas asistidas CCE': {
    title: 'Llamadas ventas asistidas CCE',
    viewLabel: '"kpi_marketing_diario"',
    dateLabel: 'La columna "fecha" de la vista sale de date("leads_raw"."fecha_agenda")',
    logic: 'Suma "llamadas_venta_asistidas_cce". En la vista solo cuenta filas con "agendo"=\'Agendo\', "aplica"=\'Aplica\', call confirmer exitoso y "llamada_meg"=\'Efectuada\', agrupadas por date("leads_raw"."fecha_agenda").'
  },
  'Ventas CCE': {
    title: 'Ventas CCE',
    viewLabel: '"kpi_marketing_diario"',
    dateLabel: 'La fila usa "kpi_marketing_diario"."fecha"; esa columna nace de date("leads_raw"."fecha_agenda"), pero para esta métrica la vista cruza comprobantes donde date("fecha_de_agendamiento") = "fecha"',
    logic: 'Suma "ventas_cce". La vista trae este total desde comprobantes agrupados por date("fecha_de_agendamiento") y origen, filtrando "estado_cc"=\'Exitoso\', y lo pega sobre la fila cuyo alias "fecha" coincide con esa fecha de agendamiento.'
  },
  'Costo por Venta (CCE)': {
    title: 'Costo por Venta (CCE)',
    viewLabel: 'Cálculo frontend sobre "kpi_marketing_inversiones" + "kpi_marketing_diario"',
    dateLabel: 'Mixta: rango de "fecha_desde"/"fecha_hasta" + "fecha"/"fecha_de_agendamiento"',
    logic: 'Se calcula como "inversion_realizada" dividido "ventas_cce". Las ventas CCE salen de comprobantes por "fecha_de_agendamiento" y "estado_cc"=\'Exitoso\'.'
  },
  'Llamadas venta asistidas CCNE': {
    title: 'Llamadas venta asistidas CCNE',
    viewLabel: '"kpi_marketing_diario"',
    dateLabel: 'La columna "fecha" de la vista sale de date("leads_raw"."fecha_agenda")',
    logic: 'Suma "llamadas_venta_asistidas_ccne". La vista solo cuenta filas con "agendo"=\'Agendo\', "aplica"=\'Aplica\', sin call confirmer exitoso y "llamada_meg"=\'Efectuada\', agrupadas por date("leads_raw"."fecha_agenda").'
  },
  'Call Confirmer NO EXITOSOS': {
    title: 'Call Confirmer NO EXITOSOS',
    viewLabel: '"kpi_marketing_diario"',
    dateLabel: 'La columna "fecha" de la vista sale de date("leads_raw"."fecha_agenda")',
    logic: 'Suma "aplicaciones_no_calificaban_cc". En la vista cuenta filas con "agendo"=\'Agendo\', "aplica"=\'Aplica\' y sin éxito en "call_confirm" ni "cc_whatsapp", agrupadas por date("leads_raw"."fecha_agenda").'
  },
  'Ventas CCNE': {
    title: 'Ventas CCNE',
    viewLabel: '"kpi_marketing_diario"',
    dateLabel: 'La fila usa "kpi_marketing_diario"."fecha"; esa columna nace de date("leads_raw"."fecha_agenda"), pero para esta métrica la vista cruza comprobantes donde date("fecha_de_agendamiento") = "fecha"',
    logic: 'Suma "ventas_ccne". La vista lo trae desde comprobantes agrupados por date("fecha_de_agendamiento") y origen, filtrando "estado_cc"=\'No exitoso\', y lo pega sobre la fila cuyo alias "fecha" coincide con esa fecha.'
  },
  'Costo por Venta (CCNE)': {
    title: 'Costo por Venta (CCNE)',
    viewLabel: 'Cálculo frontend sobre "kpi_marketing_inversiones" + "kpi_marketing_diario"',
    dateLabel: 'Mixta: rango de "fecha_desde"/"fecha_hasta" + "fecha"/"fecha_de_agendamiento"',
    logic: 'Se calcula como "inversion_realizada" dividido "ventas_ccne". Las ventas CCNE salen de comprobantes por "fecha_de_agendamiento" con "estado_cc"=\'No exitoso\'.'
  },
  'Ventas totales': {
    title: 'Ventas totales',
    viewLabel: 'Endpoint "marketing/ventas-totales" sobre "comprobantes"',
    dateLabel: '"fecha_de_agendamiento"',
    logic: 'Cuenta ventas de comprobantes por "fecha_de_agendamiento" para mantener la misma base que agendas.'
  },
  'Tasa de cierre (%)': {
    title: 'Tasa de cierre (%)',
    viewLabel: 'Cálculo frontend sobre "kpi_marketing_diario" + endpoint de ventas',
    dateLabel: 'Mixta: reuniones sobre "kpi_marketing_diario"."fecha", donde "fecha" = date("leads_raw"."fecha_agenda"), y ventas por "fecha_de_agendamiento"',
    logic: 'Se calcula en frontend como "ventasTotales" dividido "reunionesTotales" por 100. "reunionesTotales" sale de la vista diaria armada sobre date("leads_raw"."fecha_agenda"), mientras que "ventasTotales" sale de comprobantes por "fecha_de_agendamiento".'
  },
  'CC Exitosos': {
    title: 'CC Exitosos',
    viewLabel: '"kpi_marketing_diario"',
    dateLabel: 'La columna "fecha" de la vista sale de date("leads_raw"."fecha_agenda")',
    logic: 'Suma "call_confirmer_exitosos" de "kpi_marketing_diario". En la vista actual esa columna solo cuenta filas con "agendo"=\'Agendo\', "aplica"=\'Aplica\' y call confirmer exitoso, agrupadas por date("leads_raw"."fecha_agenda").'
  },
  'ROAS sobre facturación total': {
    title: 'ROAS sobre facturación total',
    viewLabel: 'Cálculo frontend sobre "kpi_marketing_inversiones" + "kpi_marketing_diario"',
    dateLabel: 'Mixta: inversiones por "fecha_desde"/"fecha_hasta" + facturación diaria pegada sobre "kpi_marketing_diario"."fecha", donde hoy se cruza por date("f_acreditacion")',
    logic: 'Se calcula como "facturacion" dividido "inversion_realizada". La inversión sale de "kpi_marketing_inversiones" y la facturación del valor diario de "kpi_marketing_diario", que hoy se asigna por date("f_acreditacion").'
  },
  'ROAS sobre CC': {
    title: 'ROAS sobre CC',
    viewLabel: 'Cálculo frontend sobre "kpi_marketing_inversiones" + "kpi_marketing_diario"',
    dateLabel: 'Mixta: inversiones por "fecha_desde"/"fecha_hasta" + cash diario pegado sobre "kpi_marketing_diario"."fecha", donde hoy se cruza por date("f_acreditacion")',
    logic: 'Se calcula como "cash_collected" dividido "inversion_realizada". El cash sale de "kpi_marketing_diario" y se asigna al día por date("f_acreditacion"), mientras que la inversión sale del acumulado filtrado en "kpi_marketing_inversiones".'
  }
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

    .marketing-editor-buttons {
      display: flex;
      flex-direction: column;
      gap: 10px;
      align-self: stretch;
      justify-content: flex-end;
    }

    .marketing-editor-buttons .marketing-save {
      width: 100%;
    }

    .marketing-history-link {
      align-self: flex-start;
      padding: 0;
      border: 0;
      background: transparent;
      color: #1d66c2;
      font: inherit;
      font-size: 0.88rem;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
    }

    .investment-history-card {
      width: min(1220px, 100%);
      text-align: left;
      padding: 20px;
    }

    .investment-history-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 16px;
    }

    .investment-history-top h3 {
      margin: 0;
      color: #17345f;
    }

    .investment-history-top p {
      margin: 6px 0 0;
      color: #42597d;
    }

    .investment-history-close {
      padding: 10px 14px;
      border: 1px solid rgba(23, 63, 115, 0.16);
      border-radius: 12px;
      background: #f6fbff;
      color: #173f73;
      font-weight: 700;
    }

    .investment-history-filters {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: end;
      margin-bottom: 12px;
    }

    .investment-history-filters label {
      min-width: 180px;
    }

    .investment-history-status {
      margin: 0 0 12px;
      color: #36517b;
      font-weight: 600;
    }

    .investment-history-table-wrap {
      max-height: 62vh;
      overflow: auto;
    }

    .investment-history-table th,
    .investment-history-table td {
      white-space: nowrap;
      vertical-align: middle;
    }

    .investment-history-table th {
      position: sticky;
      top: 0;
      z-index: 2;
    }

    .investment-history-table td input,
    .investment-history-table td select {
      width: 100%;
      min-width: 110px;
      padding: 8px 10px;
      border-radius: 10px;
      border: 1px solid rgba(20, 70, 132, 0.16);
      background: rgba(255, 255, 255, 0.96);
    }

    .investment-history-actions-cell {
      display: flex;
      gap: 8px;
    }

    .investment-history-row-btn {
      padding: 8px 12px;
      border-radius: 10px;
      border: 0;
      font-weight: 700;
    }

    .investment-history-row-btn.save {
      background: linear-gradient(90deg, #d7e9ff 0%, #afcff8 100%);
      color: #111111;
    }

    .investment-history-row-btn.delete {
      background: #ffe8e8;
      color: #a32626;
    }

    @media (max-width: 980px) {
      .investment-history-top {
        flex-direction: column;
      }

      .investment-history-card {
        padding: 16px;
      }
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
      <p><strong>Vista que usa:</strong> ${info.viewLabel || '"kpi_marketing_diario"'}</p>
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

function formatDateTimeLabel(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function serializeInvestmentRecordKey(row) {
  return encodeURIComponent(JSON.stringify({
    fecha_desde: row.fecha_desde,
    fecha_hasta: row.fecha_hasta,
    origen: row.origen
  }));
}

function parseInvestmentRecordKey(value) {
  try {
    return JSON.parse(decodeURIComponent(String(value || '')));
  } catch (error) {
    return null;
  }
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

function getInvestmentHistoryPopup() {
  return document.getElementById('investmentHistoryPopup');
}

function getInvestmentHistoryFilters() {
  return {
    from: document.getElementById('investmentHistoryFrom')?.value || '',
    to: document.getElementById('investmentHistoryTo')?.value || ''
  };
}

function setInvestmentHistoryStatus(message) {
  const status = document.getElementById('investmentHistoryStatus');
  if (status) status.textContent = message || '';
}

function renderInvestmentHistoryTable(rows) {
  const container = document.getElementById('investmentHistoryTableWrap');
  if (!container) return;

  if (!(rows || []).length) {
    container.innerHTML = '<div class="report-empty">No hay inversiones guardadas para ese rango.</div>';
    return;
  }

  container.innerHTML = `
    <table class="marketing-table investment-history-table">
      <thead>
        <tr>
          <th>Fecha desde</th>
          <th>Fecha hasta</th>
          <th>Origen</th>
          <th>Inversión planificada</th>
          <th>Inversión realizada</th>
          <th>Última actualización</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${(rows || []).map((row) => {
          const recordKey = serializeInvestmentRecordKey(row);
          return `
            <tr data-record-key="${recordKey}">
              <td>${escapeHtml(row.fecha_desde || '-')}</td>
              <td>${escapeHtml(row.fecha_hasta || '-')}</td>
              <td>${escapeHtml(row.origen || '-')}</td>
              <td>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  class="investment-history-planificada"
                  value="${Number(row.inversion_planificada || 0)}"
                />
              </td>
              <td>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  class="investment-history-realizada"
                  value="${Number(row.inversion_realizada || 0)}"
                />
              </td>
              <td>${escapeHtml(formatDateTimeLabel(row.updated_at))}</td>
              <td class="investment-history-actions-cell">
                <button type="button" class="investment-history-row-btn save" data-action="save">Guardar</button>
                <button type="button" class="investment-history-row-btn delete" data-action="delete">Borrar</button>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;

  container.querySelectorAll('.investment-history-row-btn[data-action="save"]').forEach((button) => {
    button.addEventListener('click', () => saveInvestmentHistoryRow(button));
  });

  container.querySelectorAll('.investment-history-row-btn[data-action="delete"]').forEach((button) => {
    button.addEventListener('click', () => deleteInvestmentHistoryRow(button));
  });
}

async function loadInvestmentHistory() {
  const { from, to } = getInvestmentHistoryFilters();

  if (from && to && from > to) {
    setInvestmentHistoryStatus('El rango del historial es inválido.');
    return;
  }

  setInvestmentHistoryStatus('Cargando inversiones guardadas...');

  try {
    const response = await window.metricasApi.fetchMarketingInvestments({ from, to });
    const rows = response.rows || [];
    renderInvestmentHistoryTable(rows);
    setInvestmentHistoryStatus(`${rows.length} registro(s) encontrados para el rango seleccionado.`);
  } catch (error) {
    renderInvestmentHistoryTable([]);
    setInvestmentHistoryStatus(error.message);
  }
}

async function saveInvestmentHistoryRow(button) {
  const row = button.closest('tr');
  const record = parseInvestmentRecordKey(row?.dataset.recordKey);
  if (!row || !record) return;

  const inversionPlanificada = Number(row.querySelector('.investment-history-planificada')?.value || 0);
  const inversionRealizada = Number(row.querySelector('.investment-history-realizada')?.value || 0);

  if (inversionPlanificada < 0 || inversionRealizada < 0) {
    setInvestmentHistoryStatus('Los montos editados no pueden ser negativos.');
    return;
  }

  setInvestmentHistoryStatus('Guardando cambios del registro seleccionado...');

  try {
    await window.metricasApi.updateMarketingInvestmentRecord({
      ...record,
      inversion_planificada: inversionPlanificada,
      inversion_realizada: inversionRealizada
    });

    showPopup('Registro de inversión actualizado.');
    await loadInvestmentHistory();
    await loadDashboard();
  } catch (error) {
    setInvestmentHistoryStatus(error.message);
  }
}

async function deleteInvestmentHistoryRow(button) {
  const row = button.closest('tr');
  const record = parseInvestmentRecordKey(row?.dataset.recordKey);
  if (!row || !record) return;

  const confirmed = window.confirm(`Vas a borrar la inversión ${record.fecha_desde} a ${record.fecha_hasta} de ${record.origen}.`);
  if (!confirmed) return;

  setInvestmentHistoryStatus('Borrando registro seleccionado...');

  try {
    await window.metricasApi.deleteMarketingInvestmentRecord(record);
    showPopup('Registro de inversión borrado.');
    await loadInvestmentHistory();
    await loadDashboard();
  } catch (error) {
    setInvestmentHistoryStatus(error.message);
  }
}

function closeInvestmentHistoryPopup() {
  getInvestmentHistoryPopup()?.remove();
}

function openInvestmentHistoryPopup() {
  closeInvestmentHistoryPopup();

  const mainFilters = getFilters();
  const popup = document.createElement('div');
  popup.id = 'investmentHistoryPopup';
  popup.className = 'kpi-popup metric-info-popup';
  popup.innerHTML = `
    <div class="kpi-popup-card investment-history-card">
      <div class="investment-history-top">
        <div>
          <h3>Inversiones totales</h3>
          <p>Filtrá por fecha para revisar todos los registros guardados y administrarlos uno por uno.</p>
        </div>
        <button id="investmentHistoryClose" type="button" class="investment-history-close">Cerrar</button>
      </div>

      <div class="actions investment-history-filters">
        <label>
          Desde
          <input id="investmentHistoryFrom" type="date" value="${escapeHtml(mainFilters.from || '')}" />
        </label>
        <label>
          Hasta
          <input id="investmentHistoryTo" type="date" value="${escapeHtml(mainFilters.to || '')}" />
        </label>
        <button id="investmentHistorySearch" type="button">Buscar</button>
      </div>

      <p id="investmentHistoryStatus" class="investment-history-status"></p>
      <div id="investmentHistoryTableWrap" class="table-wrap marketing-panel investment-history-table-wrap"></div>
    </div>
  `;
  document.body.appendChild(popup);

  popup.addEventListener('click', (event) => {
    if (event.target === popup) closeInvestmentHistoryPopup();
  });

  document.getElementById('investmentHistoryClose').addEventListener('click', closeInvestmentHistoryPopup);
  document.getElementById('investmentHistorySearch').addEventListener('click', loadInvestmentHistory);

  loadInvestmentHistory();
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
    const currentInvestment = Number(investment?.inversion_realizada || 0);
    document.getElementById('investmentEditorHelp').textContent = `Total actual del filtro: ${formatCurrency(currentInvestment)}. El monto que cargues abajo se suma a este total.`;
    document.getElementById('inversionRealizada').value = '';
    return;
  }

  const m = computeMetrics(rows, investment, extras);
  const investmentHelp = document.getElementById('investmentEditorHelp');
  investmentHelp.textContent = `Total actual del filtro: ${formatCurrency(m.inversionRealizada)}. El monto que cargues abajo se suma a este total.`;
  document.getElementById('inversionRealizada').value = '';

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
        viewLabel: '"kpi_marketing_diario"',
        dateLabel: '"fecha"',
        logic: `Se muestra para el rango seleccionado usando la fuente diaria que corresponda a "${label}". Si esta métrica mezcla inversión, ventas o cash, la definición final puede combinar "kpi_marketing_diario", "kpi_marketing_inversiones" y comprobantes.`
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

  if (inversionRealizada <= 0) {
    status.textContent = 'Ingresá un monto mayor a 0 para agregar.';
    return;
  }

  showLoading('Guardando inversión...');

  try {
    await window.metricasApi.saveMarketingInvestment({
      ...filters,
      inversion_realizada: inversionRealizada
    });

    showPopup(`Se agregaron ${formatCurrency(inversionRealizada)} al filtro seleccionado.`);
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
  document.getElementById('openInvestmentHistory').addEventListener('click', (event) => {
    event.preventDefault();
    openInvestmentHistoryPopup();
  });
}

init();
