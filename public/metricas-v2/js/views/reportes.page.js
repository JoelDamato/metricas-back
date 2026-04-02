const EXCLUDED_CLOSERS = ['sin closer', 'nahuel', 'shirlet', 'shirley'];
const REPORTES_BLOCK_INFO = {
  'Reporte de Llamadas': {
    title: 'Reporte de Llamadas',
    viewLabel: '"agenda_detalle_diario_closer" + "leads_raw"',
    dateLabel: '"fecha_llamada"',
    logic: 'Las columnas "Agendadas" y "Vendidas" salen de "agenda_detalle_diario_closer". La columna "Asistidas" se recalcula desde "leads_raw" con "agendo"=\'Agendo\', "aplica"=\'Aplica\' y "llamada_meg"=\'Efectuada\', agrupando por "closer" dentro del rango de "fecha_llamada".'
  },
  'Reporte de Agenda': {
    title: 'Reporte de Agenda',
    viewLabel: '"agenda_detalle_diario_closer"',
    dateLabel: '"fecha_llamada"',
    logic: 'Usa la vista "agenda_detalle_diario_closer" y suma por closer las columnas "agendadas" y "aplicables" para el rango diario filtrado.'
  },
  'Ventas Diarias': {
    title: 'Ventas Diarias',
    viewLabel: '"ventas_diario_closer"',
    dateLabel: '"fecha_venta"',
    logic: 'Usa la vista "ventas_diario_closer" y agrupa por closer las ventas cerradas del rango, tomando como fecha de corte "fecha_venta".'
  },
  'Cash Collected Diario': {
    title: 'Cash Collected Diario',
    viewLabel: '"cash_collected_diario_closer"',
    dateLabel: '"fecha_acreditacion"',
    logic: 'Usa la vista "cash_collected_diario_closer" y agrupa por closer el "cash_collected_total", "cash_collected_ars_total" y "cash_collected_conciliado". El "% CC" muestra qué porcentaje del "cash_collected_conciliado" total del rango aporta cada closer.'
  },
  Comprobantes: {
    title: 'Comprobantes',
    viewLabel: '"comprobantes"',
    dateLabel: '"f_acreditacion"',
    logic: 'Cuenta comprobantes por closer usando "creado_por" y los separa por "estado" dentro del rango filtrado de "f_acreditacion". En este bloque se excluyen comprobantes cuyo "producto_format" contiene "Club". Los estados salen directo de la tabla, por ejemplo "Conciliado", "Rectificado", "Rebotado" o sin estado.'
  }
};
const REPORTES_METRIC_INFO = {
  'Reporte de Llamadas|Agendadas': {
    title: 'Reporte de Llamadas · Agendadas',
    viewLabel: '"agenda_detalle_diario_closer"',
    dateLabel: '"fecha_llamada"',
    logic: 'Suma "llamadas_agendadas" en "agenda_detalle_diario_closer", agrupado por closer dentro del rango diario.'
  },
  'Reporte de Llamadas|Asistidas': {
    title: 'Reporte de Llamadas · Asistidas',
    viewLabel: '"leads_raw"',
    dateLabel: '"fecha_llamada"',
    logic: 'Cuenta registros de "leads_raw" donde "agendo"=\'Agendo\', "aplica"=\'Aplica\' y "llamada_meg"=\'Efectuada\', agrupados por "closer" dentro del rango de "fecha_llamada".'
  },
  'Reporte de Llamadas|Vendidas': {
    title: 'Reporte de Llamadas · Vendidas',
    viewLabel: '"agenda_detalle_diario_closer"',
    dateLabel: '"fecha_llamada"',
    logic: 'Suma "llamadas_vendidas" en "agenda_detalle_diario_closer", agrupado por closer dentro del rango diario.'
  },
  'Reporte de Agenda|Agendadas': {
    title: 'Reporte de Agenda · Agendadas',
    viewLabel: '"agenda_detalle_diario_closer"',
    dateLabel: '"fecha_llamada"',
    logic: 'Suma "agendadas" en "agenda_detalle_diario_closer", agrupado por closer en el rango diario.'
  },
  'Reporte de Agenda|Aplicables': {
    title: 'Reporte de Agenda · Aplicables',
    viewLabel: '"agenda_detalle_diario_closer"',
    dateLabel: '"fecha_llamada"',
    logic: 'Suma "aplicables" en "agenda_detalle_diario_closer", agrupado por closer en el rango diario.'
  },
  'Ventas Diarias|Ventas': {
    title: 'Ventas Diarias',
    viewLabel: '"ventas_diario_closer"',
    dateLabel: '"fecha_venta"',
    logic: 'Suma "ventas" en "ventas_diario_closer", agrupado por closer dentro del rango de "fecha_venta".'
  },
  'Cash Collected Diario|CC USD': {
    title: 'Cash Collected Diario · CC USD',
    viewLabel: '"cash_collected_diario_closer"',
    dateLabel: '"fecha_acreditacion"',
    logic: 'Suma "cash_collected_total" en "cash_collected_diario_closer", agrupado por closer dentro del rango de "fecha_acreditacion".'
  },
  'Cash Collected Diario|CC ARS': {
    title: 'Cash Collected Diario · CC ARS',
    viewLabel: '"cash_collected_diario_closer"',
    dateLabel: '"fecha_acreditacion"',
    logic: 'Suma "cash_collected_ars_total" en "cash_collected_diario_closer", agrupado por closer.'
  },
  'Cash Collected Diario|CCC': {
    title: 'Cash Collected Diario · CCC',
    viewLabel: '"cash_collected_diario_closer"',
    dateLabel: '"fecha_acreditacion"',
    logic: 'Suma "cash_collected_conciliado" en "cash_collected_diario_closer", agrupado por closer.'
  },
  'Cash Collected Diario|% CC': {
    title: 'Cash Collected Diario · % CC',
    viewLabel: '"cash_collected_diario_closer"',
    dateLabel: '"fecha_acreditacion"',
    logic: 'Se calcula como ("cash_collected_conciliado" del closer / "cash_collected_conciliado" total del bloque) * 100 dentro del rango filtrado por "fecha_acreditacion".'
  }
};
function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function normalizeComprobanteState(value) {
  const text = String(value || '').trim();
  return text || 'Sin estado';
}

function buildComprobanteStateKey(state) {
  return `estado_${normalizeText(state).replace(/[^a-z0-9]+/g, '_') || 'sin_estado'}`;
}

function shouldIncludeCloser(name) {
  const normalized = normalizeText(name);
  if (!normalized) return false;
  return !EXCLUDED_CLOSERS.some((term) => normalized.includes(term));
}

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

function formatPercent(value) {
  return `${Number(value || 0).toFixed(2)}%`;
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
      <p><strong>Vista que usa:</strong> ${info.viewLabel || 'Depende del bloque'}</p>
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

function setupFilters() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  document.getElementById('desde').value = from.toISOString().slice(0, 10);
  document.getElementById('hasta').value = to.toISOString().slice(0, 10);
}

function getRange() {
  const from = document.getElementById('desde').value;
  const to = document.getElementById('hasta').value;
  return { from, to };
}

function groupByCloser(rows, metricsByRow) {
  const map = new Map();

  rows.forEach((row) => {
    const closer = String(row.closer || '').trim();
    if (!shouldIncludeCloser(closer)) return;

    const current = map.get(closer) || { closer };
    const metrics = metricsByRow(row);

    Object.entries(metrics).forEach(([key, value]) => {
      current[key] = Number(current[key] || 0) + Number(value || 0);
    });

    map.set(closer, current);
  });

  return [...map.values()];
}

function orderClosers(rows, metricKey) {
  return [...rows].sort((a, b) => {
    const diff = Number(b[metricKey] || 0) - Number(a[metricKey] || 0);
    if (diff !== 0) return diff;
    return String(a.closer || '').localeCompare(String(b.closer || ''));
  });
}

function buildTableBlock({ title, subtitle, rows, metrics, sortKey, formatter = formatInteger }) {
  const ordered = orderClosers(rows, sortKey);

  if (!ordered.length) {
    return `
      <section class="report-block">
        <div class="report-block-head">
          <h3><button type="button" class="metric-info-trigger report-block-title" data-block-key="${title}">${title}</button></h3>
          <p>${subtitle}</p>
        </div>
        <div class="table-wrap report-table-wrap">
          <div class="report-empty">No hay datos para este período.</div>
        </div>
      </section>
    `;
  }

  const totals = metrics.reduce((acc, metric) => {
    acc[metric.key] = ordered.reduce((sum, row) => sum + Number(row[metric.key] || 0), 0);
    return acc;
  }, {});

  if (typeof formatter.computeTotals === 'function') {
    formatter.computeTotals(totals);
  }

  const head = `
    <tr>
      <th>${metrics[0].leftLabel || 'Closer'}</th>
      ${ordered.map((row) => `<th>${row.closer}</th>`).join('')}
      <th class="total-col">Total</th>
    </tr>
  `;

  const body = metrics
    .map((metric) => {
      const cells = ordered
        .map((row) => `<td>${formatter(row[metric.key] || 0, metric)}</td>`)
        .join('');

      return `
        <tr>
          <td><button type="button" class="metric-info-trigger metric-label" data-block-title="${title}" data-metric-label="${metric.label}">${metric.label}</button></td>
          ${cells}
          <td class="total-col">${formatter(totals[metric.key] || 0, metric)}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <section class="report-block">
      <div class="report-block-head">
        <h3><button type="button" class="metric-info-trigger report-block-title" data-block-key="${title}">${title}</button></h3>
        <p>${subtitle}</p>
      </div>
      <div class="table-wrap report-table-wrap">
        <table class="report-table">
          <thead>${head}</thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </section>
  `;
}

function cashFormatter(value, metric) {
  if (metric.key === 'cash_collected_ars_total') {
    return formatCurrency(value, 'ARS');
  }
  if (metric.key === 'cash_collected_total' || metric.key === 'cash_collected_conciliado') {
    return formatCurrency(value, 'USD');
  }
  if (metric.key === 'cash_collected_pct') {
    return formatPercent(value);
  }
  return formatInteger(value);
}

cashFormatter.computeTotals = (totals) => {
  const conciliado = Number(totals.cash_collected_conciliado || 0);
  totals.cash_collected_pct = conciliado > 0 ? 100 : 0;
};

function buildReportMarkup(data) {
  const comprobantesMetrics = (data.comprobantesStates || []).map((state) => ({
    key: buildComprobanteStateKey(state),
    label: state
  }));

  return [
    buildTableBlock({
      title: 'Reporte de Llamadas',
      subtitle: 'Agendadas, asistidas y vendidas por closer.',
      rows: data.agendaResumen,
      sortKey: 'llamadas_agendadas',
      metrics: [
        { key: 'llamadas_agendadas', label: 'Agendadas' },
        { key: 'llamadas_asistidas', label: 'Asistidas' },
        { key: 'llamadas_vendidas', label: 'Vendidas' }
      ]
    }),
    buildTableBlock({
      title: 'Reporte de Agenda',
      subtitle: 'Agendadas y aplicables del período.',
      rows: data.agendaResumen,
      sortKey: 'agendadas',
      metrics: [
        { key: 'agendadas', label: 'Agendadas' },
        { key: 'aplicables', label: 'Aplicables' }
      ]
    }),
    buildTableBlock({
      title: 'Ventas Diarias',
      subtitle: 'Ventas cerradas por closer en el período.',
      rows: data.ventasResumen,
      sortKey: 'ventas',
      metrics: [
        { key: 'ventas', label: 'Ventas' }
      ]
    }),
    buildTableBlock({
      title: 'Cash Collected Diario',
      subtitle: 'Cash USD, cash conciliado y participación de cada closer sobre el CCC total.',
      rows: data.cashResumen,
      sortKey: 'cash_collected_total',
      metrics: [
        { key: 'cash_collected_total', label: 'CC USD' },
        { key: 'cash_collected_ars_total', label: 'CC ARS' },
        { key: 'cash_collected_conciliado', label: 'CCC' },
        { key: 'cash_collected_pct', label: '% CC' }
      ],
      formatter: cashFormatter
    }),
    buildTableBlock({
      title: 'Comprobantes',
      subtitle: 'Cantidad de comprobantes por closer, separados por "estado" dentro del rango de acreditación y excluyendo "Club".',
      rows: data.comprobantesResumen,
      sortKey: 'total_comprobantes',
      metrics: comprobantesMetrics.length
        ? comprobantesMetrics
        : [{ key: 'sin_datos', label: 'Sin datos' }]
    })
  ].join('');
}

async function loadAgendaData(range) {
  const [response, leadsResponse] = await Promise.all([
    window.metricasApi.fetchAgendaDetalleDiarioCloser({
      limit: 1000,
      from: range.from,
      to: range.to,
      dateField: 'fecha_llamada'
    }),
    window.metricasApi.fetchAllRows('leads_raw', {
      limit: 1000,
      from: range.from,
      to: range.to,
      dateField: 'fecha_llamada'
    })
  ]);

  const agendaRows = groupByCloser(response.rows || [], (row) => ({
    llamadas_agendadas: row.llamadas_agendadas,
    llamadas_asistidas: row.llamadas_asistidas,
    llamadas_vendidas: row.llamadas_vendidas,
    agendadas: row.agendadas,
    aplicables: row.aplicables
  }));

  const asistidasAplicaRows = groupByCloser(leadsResponse.rows || [], (row) => ({
    llamadas_asistidas:
      normalizeText(row.agendo) === 'agendo'
      && normalizeText(row.aplica) === 'aplica'
      && normalizeText(row.llamada_meg) === 'efectuada'
        ? 1
        : 0
  }));

  const agendaMap = new Map(agendaRows.map((row) => [row.closer, { ...row }]));
  asistidasAplicaRows.forEach((row) => {
    const current = agendaMap.get(row.closer) || {
      closer: row.closer,
      llamadas_agendadas: 0,
      llamadas_asistidas: 0,
      llamadas_vendidas: 0,
      agendadas: 0,
      aplicables: 0
    };

    current.llamadas_asistidas = Number(row.llamadas_asistidas || 0);
    agendaMap.set(row.closer, current);
  });

  return [...agendaMap.values()];
}

async function loadVentasData(range) {
  const response = await window.metricasApi.fetchVentasDiarioCloser({
    limit: 1000,
    from: range.from,
    to: range.to,
    dateField: 'fecha_venta'
  });

  return groupByCloser(response.rows || [], (row) => ({
    ventas: row.ventas
  }));
}

async function loadCashData(range) {
  const response = await window.metricasApi.fetchCashCollectedDiarioCloser({
    limit: 1000,
    from: range.from,
    to: range.to,
    dateField: 'fecha_acreditacion'
  });

  const grouped = groupByCloser(response.rows || [], (row) => {
    const total = Number(row.cash_collected_total || 0);
    const conciliado = Number(row.cash_collected_conciliado || 0);

    return {
      cash_collected_total: total,
      cash_collected_ars_total: Number(row.cash_collected_ars_total || 0),
      cash_collected_conciliado: conciliado
    };
  });

  const totalConciliado = grouped.reduce((sum, row) => sum + Number(row.cash_collected_conciliado || 0), 0);

  return grouped.map((row) => ({
    ...row,
    cash_collected_pct: totalConciliado > 0
      ? (Number(row.cash_collected_conciliado || 0) / totalConciliado) * 100
      : 0
  }));
}

function orderComprobanteStates(states) {
  const priority = ['Conciliado', 'Rectificado', 'Rebotado', 'Sin estado'];
  return [...states].sort((a, b) => {
    const ai = priority.indexOf(a);
    const bi = priority.indexOf(b);
    if (ai !== -1 || bi !== -1) {
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    }
    return a.localeCompare(b, 'es');
  });
}

async function loadComprobantesData(range) {
  const response = await window.metricasApi.fetchAllRows('comprobantes', {
    limit: 1000,
    from: range.from,
    to: range.to,
    dateField: 'f_acreditacion'
  });

  const map = new Map();
  const states = new Set();

  (response.rows || []).forEach((row) => {
    const closer = String(row.creado_por || '').trim();
    if (!shouldIncludeCloser(closer)) return;
    if (normalizeText(row.producto_format).includes('club')) return;

    const state = normalizeComprobanteState(row.estado);
    const key = buildComprobanteStateKey(state);
    const current = map.get(closer) || { closer, total_comprobantes: 0 };

    current[key] = Number(current[key] || 0) + 1;
    current.total_comprobantes += 1;

    map.set(closer, current);
    states.add(state);
  });

  return {
    rows: [...map.values()],
    states: orderComprobanteStates(states)
  };
}

async function loadReportes() {
  const status = document.getElementById('status');
  const container = document.getElementById('reportesContainer');
  const range = getRange();

  if (!range.from || !range.to) {
    status.textContent = 'Elegí un rango de fechas válido.';
    container.innerHTML = '';
    return;
  }

  if (range.from > range.to) {
    status.textContent = 'La fecha desde no puede ser mayor a la fecha hasta.';
    container.innerHTML = '';
    return;
  }

  status.textContent = 'Cargando reportes...';

  try {
    const [agendaResumen, ventasResumen, cashResumen, comprobantesData] = await Promise.all([
      loadAgendaData(range),
      loadVentasData(range),
      loadCashData(range),
      loadComprobantesData(range)
    ]);

    container.innerHTML = buildReportMarkup({
      agendaResumen,
      ventasResumen,
      cashResumen,
      comprobantesResumen: comprobantesData.rows,
      comprobantesStates: comprobantesData.states
    });

    container.querySelectorAll('.metric-label').forEach((button) => {
      button.addEventListener('click', () => {
        const key = `${button.dataset.blockTitle}|${button.dataset.metricLabel}`;
        if (button.dataset.blockTitle === 'Comprobantes') {
          showMetricInfo({
            title: `Comprobantes · ${button.dataset.metricLabel}`,
            viewLabel: '"comprobantes"',
            dateLabel: '"f_acreditacion"',
            logic: `Cuenta comprobantes donde "estado" = "${button.dataset.metricLabel}" y los agrupa por "creado_por" dentro del rango filtrado por "f_acreditacion". En este bloque no se incluyen filas cuyo "producto_format" contiene "Club".`
          });
          return;
        }
        showMetricInfo(REPORTES_METRIC_INFO[key] || {
          title: `${button.dataset.blockTitle} · ${button.dataset.metricLabel}`,
          viewLabel: 'Depende del bloque',
          dateLabel: 'Depende del bloque',
          logic: `Esta métrica se calcula dentro del bloque "${button.dataset.blockTitle}" usando la vista diaria correspondiente.`
        });
      });
    });

    container.querySelectorAll('.report-block-title').forEach((button) => {
      button.addEventListener('click', () => {
        showMetricInfo(REPORTES_BLOCK_INFO[button.dataset.blockKey] || {
          title: button.dataset.blockKey,
          viewLabel: 'Depende del bloque',
          dateLabel: 'Depende del bloque',
          logic: `Este bloque agrupa métricas diarias del reporte "${button.dataset.blockKey}" usando la vista correspondiente.`
        });
      });
    });

    status.textContent = `Rango cargado: ${range.from} a ${range.to}`;
  } catch (error) {
    container.innerHTML = '';
    status.textContent = error.message;
  }
}

setupFilters();
document.getElementById('reload').addEventListener('click', loadReportes);
loadReportes();
