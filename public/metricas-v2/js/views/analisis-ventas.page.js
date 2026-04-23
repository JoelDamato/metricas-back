const MONTHS = [
  { value: 1, label: 'Enero', shortLabel: '1' },
  { value: 2, label: 'Febrero', shortLabel: '2' },
  { value: 3, label: 'Marzo', shortLabel: '3' },
  { value: 4, label: 'Abril', shortLabel: '4' },
  { value: 5, label: 'Mayo', shortLabel: '5' },
  { value: 6, label: 'Junio', shortLabel: '6' },
  { value: 7, label: 'Julio', shortLabel: '7' },
  { value: 8, label: 'Agosto', shortLabel: '8' },
  { value: 9, label: 'Septiembre', shortLabel: '9' },
  { value: 10, label: 'Octubre', shortLabel: '10' },
  { value: 11, label: 'Noviembre', shortLabel: '11' },
  { value: 12, label: 'Diciembre', shortLabel: '12' }
];

const ANALYSIS_SECTIONS = [
  {
    key: 'agenda',
    title: 'Analisis por fecha de agendamiento',
    dateField: 'fecha_de_agendamiento',
    salesLabel: 'Agendas vendidas',
    salesDetailLabel: 'ventas',
    salesDescription: 'Comprobantes de tipo Venta agrupados por fecha de agendamiento.',
    panelDescription: 'Solo toma comprobantes de tipo Venta, por fecha de agendamiento. No entra cobranza y tampoco productos Club. La clasificacion de señas usa el cash total acumulado de la venta.'
  },
  {
    key: 'venta',
    title: 'Analisis por fecha de venta',
    dateField: 'f_venta',
    salesLabel: 'Ventas por fecha de venta',
    salesDetailLabel: 'ventas',
    salesDescription: 'Comprobantes de tipo Venta agrupados por la fecha real de venta.',
    panelDescription: 'Misma logica de ventas validas y mismo corte de señas, pero agrupando por f_venta en lugar de fecha de agendamiento.'
  }
];

function formatCurrency(value) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function formatNumber(value) {
  return new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 20
  }).format(Number(value || 0));
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function safeDiv(a, b) {
  if (!b) return 0;
  return Number(a || 0) / Number(b || 0);
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function getCurrentYear() {
  return new Date().getFullYear();
}

function getYearRange(year) {
  const safeYear = Number(year);
  return {
    from: `${safeYear}-01-01`,
    to: `${safeYear}-12-31`
  };
}

function getDateValue(row, dateField) {
  return row?.[dateField] || null;
}

function parseYearFromDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return Number(match[1]);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getFullYear();
}

function parseMonthFromDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return Number(match[2]);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getMonth() + 1;
}

function isValidSaleProduct(product) {
  const normalized = normalizeText(product);
  return Boolean(normalized) && normalized !== 'empty' && !normalized.includes('club');
}

function isValidSaleRow(row, dateField) {
  if (normalizeText(row.tipo) !== 'venta') return false;
  if (!isValidSaleProduct(row.producto_format)) return false;
  return Number.isInteger(parseMonthFromDate(getDateValue(row, dateField)));
}

function getEffectiveCashCollected(row) {
  const cashCollectedTotal = Number(row.cash_collected_total || 0);
  if (cashCollectedTotal > 0) return cashCollectedTotal;
  return Number(row.cash_collected || 0);
}

function getCashPct(row) {
  return safeDiv(getEffectiveCashCollected(row) * 100, Number(row.facturacion || 0));
}

function getClientName(row) {
  return String(
    row.cliente
    || row.cliente_format
    || row.mail
    || row.comprobante
    || 'Sin nombre'
  ).trim();
}

function createMonthBucket() {
  return {
    ventas: [],
    senias: [],
    mayor30: []
  };
}

function buildRowDefinitions(section) {
  return [
    {
      key: 'ventas',
      label: section.salesLabel,
      detailLabel: section.salesDetailLabel,
      description: section.salesDescription
    },
    {
      key: 'senias',
      label: 'Señas',
      detailLabel: 'señas',
      description: 'Ventas con cash total acumulado menor al 30% de la facturacion.'
    },
    {
      key: 'mayor30',
      label: '30% o mas',
      detailLabel: 'ventas con 30% o mas',
      description: 'Ventas con cash total acumulado mayor o igual al 30% de la facturacion.'
    }
  ];
}

function buildYearSummary(rows, year, dateField) {
  const byMonth = new Map();
  const filteredRows = (rows || []).filter((row) => (
    isValidSaleRow(row, dateField)
    && parseYearFromDate(getDateValue(row, dateField)) === Number(year)
  ));

  MONTHS.forEach((month) => {
    byMonth.set(month.value, createMonthBucket());
  });

  filteredRows.forEach((row) => {
    const month = parseMonthFromDate(getDateValue(row, dateField));
    if (!byMonth.has(month)) return;

    const bucket = byMonth.get(month);
    bucket.ventas.push(row);

    if (getCashPct(row) < 30) {
      bucket.senias.push(row);
    } else {
      bucket.mayor30.push(row);
    }
  });

  return {
    byMonth,
    totals: ['ventas', 'senias', 'mayor30'].reduce((acc, key) => {
      acc[key] = MONTHS.reduce((sum, month) => sum + byMonth.get(month.value)[key].length, 0);
      return acc;
    }, {}),
    totalRows: filteredRows.length
  };
}

function renderKpis(summary) {
  const container = document.getElementById('kpiContainer');
  container.innerHTML = `
    <article class="card metric-card">
      <h4>Agendadas vendidas</h4>
      <p>${formatNumber(summary.totals.ventas)}</p>
    </article>
    <article class="card metric-card">
      <h4>Señas por agenda</h4>
      <p>${formatNumber(summary.totals.senias)}</p>
    </article>
    <article class="card metric-card">
      <h4>30% o mas por agenda</h4>
      <p>${formatNumber(summary.totals.mayor30)}</p>
    </article>
    <article class="card metric-card">
      <h4>% Señas por agenda</h4>
      <p>${formatPercent(safeDiv(summary.totals.senias * 100, summary.totals.ventas))}</p>
    </article>
  `;
}

function buildCellButton(sectionKey, rowKey, month, rows) {
  const value = rows.length;
  if (!value) return '0';

  return `
    <button
      type="button"
      class="sales-analysis-cell-btn"
      data-section-key="${sectionKey}"
      data-row-key="${rowKey}"
      data-month="${month}"
    >${formatNumber(value)}</button>
  `;
}

function buildSectionPanel(section, summary, year) {
  const rowDefinitions = buildRowDefinitions(section);
  const headerMonths = MONTHS
    .map((month) => `<th title="${month.label}">${month.shortLabel}</th>`)
    .join('');

  const bodyRows = rowDefinitions.map((definition) => {
    const monthCells = MONTHS
      .map((month) => {
        const rows = summary.byMonth.get(month.value)?.[definition.key] || [];
        return `<td>${buildCellButton(section.key, definition.key, month.value, rows)}</td>`;
      })
      .join('');

    return `
      <tr>
        <td>
          <div class="sales-analysis-row-label">
            <strong>${definition.label}</strong>
            <small>${definition.description}</small>
          </div>
        </td>
        ${monthCells}
        <td><strong>${formatNumber(summary.totals[definition.key])}</strong></td>
      </tr>
    `;
  }).join('');

  return `
    <section class="sales-analysis-panel">
      <h3>${section.title}</h3>
      <p>${section.panelDescription}</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Concepto</th>
              ${headerMonths}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${bodyRows}
            <tr>
              <td><strong>Periodo</strong></td>
              <td colspan="${MONTHS.length + 1}">Año ${year} · ${formatNumber(summary.totalRows)} ventas validas</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderTables(sectionSummaries, year) {
  const container = document.getElementById('tableContainer');
  container.innerHTML = sectionSummaries
    .map(({ section, summary }) => buildSectionPanel(section, summary, year))
    .join('');
}

function showDetailPopup({ section, rowDefinition, month, year, rows }) {
  const existing = document.getElementById('salesAnalysisDetailPopup');
  if (existing) existing.remove();

  const monthLabel = MONTHS.find((item) => item.value === Number(month))?.label || `Mes ${month}`;
  const orderedRows = [...rows].sort((a, b) => getClientName(a).localeCompare(getClientName(b), 'es'));
  const itemsHtml = orderedRows.length
    ? `
      <ol class="sales-analysis-detail-list">
        ${orderedRows.map((row) => `
          <li>
            <strong>${escapeHtml(getClientName(row))}</strong>
            <span class="sales-analysis-detail-meta">
              Producto: ${escapeHtml(row.producto_format || 'Sin producto')}
            </span>
            <span class="sales-analysis-detail-meta">
              Closer: ${escapeHtml(row.creado_por || 'Sin closer')} · Facturacion: ${formatCurrency(row.facturacion)} · Cash inicial: ${formatCurrency(row.cash_collected)} · Cash/facturacion: ${formatPercent(getCashPct(row))}
            </span>
            <span class="sales-analysis-detail-meta">
              Cash total venta: ${formatCurrency(getEffectiveCashCollected(row))}
            </span>
          </li>
        `).join('')}
      </ol>
    `
    : '<p>No hay clientes para esa celda.</p>';

  const popup = document.createElement('div');
  popup.id = 'salesAnalysisDetailPopup';
  popup.className = 'kpi-popup metric-info-popup';
  popup.innerHTML = `
    <div class="kpi-popup-card sales-analysis-detail-card">
      <h3>${section.title} · ${rowDefinition.label} · ${monthLabel} ${year}</h3>
      <p>${formatNumber(rows.length)} ${rowDefinition.detailLabel} en el mes seleccionado.</p>
      ${itemsHtml}
      <button id="salesAnalysisDetailPopupClose" type="button">Cerrar</button>
    </div>
  `;

  document.body.appendChild(popup);

  const close = () => popup.remove();
  popup.addEventListener('click', (event) => {
    if (event.target === popup) close();
  });
  document.getElementById('salesAnalysisDetailPopupClose').addEventListener('click', close);
}

function bindTableDetails(sectionSummaries, year) {
  const summaryMap = new Map(sectionSummaries.map((item) => [item.section.key, item]));

  document.querySelectorAll('.sales-analysis-cell-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const item = summaryMap.get(button.dataset.sectionKey);
      if (!item) return;

      const rowDefinition = buildRowDefinitions(item.section).find((row) => row.key === button.dataset.rowKey);
      const month = Number(button.dataset.month);
      const rows = item.summary.byMonth.get(month)?.[button.dataset.rowKey] || [];
      if (!rowDefinition) return;

      showDetailPopup({ section: item.section, rowDefinition, month, year, rows });
    });
  });
}

function getYearOptions(baseYear, availableYears = []) {
  const years = new Set(availableYears.map((value) => Number(value)).filter((value) => Number.isInteger(value)));

  for (let offset = -3; offset <= 1; offset += 1) {
    years.add(baseYear + offset);
  }

  return [...years].sort((a, b) => b - a);
}

async function fetchRowsForDateField({ from, to, dateField, orderDir = 'asc' }) {
  const response = await window.metricasApi.fetchAllRows('comprobantes', {
    limit: 1000,
    from,
    to,
    dateField,
    orderBy: dateField,
    orderDir
  });

  return response.rows || [];
}

async function initYearFilter() {
  const currentYear = getCurrentYear();
  const discoveryFrom = `${currentYear - 3}-01-01`;
  const discoveryTo = `${currentYear + 1}-12-31`;
  const responses = await Promise.all(ANALYSIS_SECTIONS.map((section) => (
    fetchRowsForDateField({
      from: discoveryFrom,
      to: discoveryTo,
      dateField: section.dateField,
      orderDir: 'desc'
    })
  )));

  const years = getYearOptions(
    currentYear,
    responses.flatMap((rows, index) => rows
      .filter((row) => isValidSaleRow(row, ANALYSIS_SECTIONS[index].dateField))
      .map((row) => parseYearFromDate(getDateValue(row, ANALYSIS_SECTIONS[index].dateField))))
  );

  const select = document.getElementById('anio');
  select.innerHTML = years
    .map((year) => `<option value="${year}">${year}</option>`)
    .join('');

  const queryYear = Number(new URLSearchParams(window.location.search).get('anio'));
  const selectedYear = years.includes(queryYear) ? queryYear : currentYear;
  select.value = String(selectedYear);
}

async function loadSalesAnalysis() {
  const status = document.getElementById('status');
  const year = Number(document.getElementById('anio').value || getCurrentYear());
  const { from, to } = getYearRange(year);

  status.textContent = 'Cargando analisis de ventas...';

  try {
    const responses = await Promise.all(ANALYSIS_SECTIONS.map(async (section) => ({
      section,
      rows: await fetchRowsForDateField({
        from,
        to,
        dateField: section.dateField,
        orderDir: 'asc'
      })
    })));

    const sectionSummaries = responses.map(({ section, rows }) => ({
      section,
      summary: buildYearSummary(rows, year, section.dateField)
    }));

    renderKpis(sectionSummaries[0]?.summary || { totals: { ventas: 0, senias: 0, mayor30: 0 } });
    renderTables(sectionSummaries, year);
    bindTableDetails(sectionSummaries, year);

    const params = new URLSearchParams(window.location.search);
    params.set('anio', String(year));
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);

    status.textContent = `Año ${year} cargado. Arriba ves el analisis por fecha de agendamiento y abajo el mismo corte por fecha de venta, siempre usando cash total acumulado de la venta.`;
  } catch (error) {
    document.getElementById('kpiContainer').innerHTML = '';
    document.getElementById('tableContainer').innerHTML = '';
    status.textContent = error.message || 'No se pudo cargar el analisis de ventas.';
  }
}

async function init() {
  await initYearFilter();
  document.getElementById('reload').addEventListener('click', loadSalesAnalysis);
  document.getElementById('anio').addEventListener('change', loadSalesAnalysis);
  await loadSalesAnalysis();
}

init();
