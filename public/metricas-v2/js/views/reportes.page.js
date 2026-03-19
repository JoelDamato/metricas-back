const EXCLUDED_CLOSERS = ['sin closer', 'nahuel', 'shirlet', 'shirley'];
function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
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
          <h3>${title}</h3>
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
          <td>${metric.label}</td>
          ${cells}
          <td class="total-col">${formatter(totals[metric.key] || 0, metric)}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <section class="report-block">
      <div class="report-block-head">
        <h3>${title}</h3>
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
  const total = Number(totals.cash_collected_total || 0);
  const conciliado = Number(totals.cash_collected_conciliado || 0);
  totals.cash_collected_pct = total > 0 ? (conciliado / total) * 100 : 0;
};

function buildReportMarkup(data) {
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
      subtitle: 'Cash USD, cash conciliado y porcentaje de conciliación.',
      rows: data.cashResumen,
      sortKey: 'cash_collected_total',
      metrics: [
        { key: 'cash_collected_total', label: 'CC USD' },
        { key: 'cash_collected_ars_total', label: 'CC ARS' },
        { key: 'cash_collected_conciliado', label: 'CCC' },
        { key: 'cash_collected_pct', label: '% CC' }
      ],
      formatter: cashFormatter
    })
  ].join('');
}

async function loadAgendaData(range) {
  const response = await window.metricasApi.fetchAgendaDetalleDiarioCloser({
    limit: 1000,
    from: range.from,
    to: range.to,
    dateField: 'fecha_llamada'
  });

  return groupByCloser(response.rows || [], (row) => ({
    llamadas_agendadas: row.llamadas_agendadas,
    llamadas_asistidas: row.llamadas_asistidas,
    llamadas_vendidas: row.llamadas_vendidas,
    agendadas: row.agendadas,
    aplicables: row.aplicables
  }));
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

  return groupByCloser(response.rows || [], (row) => {
    const total = Number(row.cash_collected_total || 0);
    const conciliado = Number(row.cash_collected_conciliado || 0);

    return {
      cash_collected_total: total,
      cash_collected_ars_total: Number(row.cash_collected_ars_total || 0),
      cash_collected_conciliado: conciliado
    };
  }).map((row) => ({
    ...row,
    cash_collected_pct: Number(row.cash_collected_total || 0) > 0
      ? (Number(row.cash_collected_conciliado || 0) / Number(row.cash_collected_total || 0)) * 100
      : 0
  }));
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
    const [agendaResumen, ventasResumen, cashResumen] = await Promise.all([
      loadAgendaData(range),
      loadVentasData(range),
      loadCashData(range)
    ]);

    container.innerHTML = buildReportMarkup({
      agendaResumen,
      ventasResumen,
      cashResumen
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
