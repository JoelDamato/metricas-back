const MONTHS = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' }
];

const ORIGIN_WHITELIST = ['VSL', 'ORG', 'CLASES', 'APSET'];
let estrategiaField = null;

const SUM_FIELDS = [
  'total_agendados',
  'total_aplica',
  'total_respondio',
  'total_confirmo',
  'total_cancelado',
  'total_no_asistidas',
  'total_pendientes',
  'total_efectuadas',
  'total_ventas',
  'total_paid_upfront',
  'ccne',
  'ccne_efectuadas',
  'ccne_vendidas',
  'cce',
  'cce_efectuadas',
  'cce_vendidas',
  'facturacion_total_mes',
  'cash_collected_real_mes',
  'cash_collected_otros_meses',
  'cash_collected_agendas_mes'
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

function getCurrentPeriod() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function setOptions(selectId, options, selectedValue, includeAll = false) {
  const select = document.getElementById(selectId);
  const allOption = includeAll ? '<option value="">Todos</option>' : '';

  select.innerHTML = allOption + options
    .map((option) => {
      const value = typeof option === 'object' ? option.value : option;
      const label = typeof option === 'object' ? option.label : option;
      return `<option value="${value}">${label}</option>`;
    })
    .join('');

  if (selectedValue !== undefined && selectedValue !== null && selectedValue !== '') {
    select.value = String(selectedValue);
  }
}

function uniqueValues(rows, key) {
  return [...new Set(rows.map((row) => row[key]).filter((v) => v !== null && v !== undefined && v !== ''))].sort((a, b) => String(a).localeCompare(String(b)));
}

function detectEstrategiaField(rows) {
  const candidates = ['estrategia_a', 'estrategia', 'strategy'];
  return candidates.find((field) => rows.some((r) => Object.prototype.hasOwnProperty.call(r, field))) || null;
}

function disableEstrategiaFilter() {
  const select = document.getElementById('estrategia');
  select.innerHTML = '<option value="">No disponible en esta vista</option>';
  select.disabled = true;
}

function getFilters() {
  return {
    anio: document.getElementById('anio').value,
    origen: document.getElementById('origen').value,
    estrategia: document.getElementById('estrategia').value
  };
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function applyLocalFilters(rows, filters) {
  return (rows || []).filter((row) => {
    if (filters.origen) {
      if (normalizeText(row.origen) !== normalizeText(filters.origen)) return false;
    }
    if (filters.estrategia && estrategiaField) {
      if (normalizeText(row[estrategiaField]) !== normalizeText(filters.estrategia)) return false;
    }
    return true;
  });
}

function sanitizeRowsForYear(rows, year) {
  return (rows || []).filter((row) => {
    const y = Number(row.anio);
    const m = Number(row.mes);
    return y === year && Number.isInteger(m) && m >= 1 && m <= 12;
  });
}

function emptyAccumulator() {
  const acc = {};
  SUM_FIELDS.forEach((field) => {
    acc[field] = 0;
  });
  return acc;
}

function aggregateByMonth(rows) {
  const byMonth = new Map();
  const totals = emptyAccumulator();

  rows.forEach((row) => {
    const month = Number(row.mes);
    if (!Number.isInteger(month) || month < 1 || month > 12) return;

    if (!byMonth.has(month)) {
      byMonth.set(month, emptyAccumulator());
    }

    const monthAcc = byMonth.get(month);
    SUM_FIELDS.forEach((field) => {
      const value = Number(row[field] || 0);
      monthAcc[field] += value;
      totals[field] += value;
    });
  });

  return { byMonth, totals };
}

function metricRowsFor(acc) {
  const ag = acc.total_agendados;
  const apl = acc.total_aplica;
  const resp = acc.total_respondio;
  const conf = acc.total_confirmo;
  const canc = acc.total_cancelado;
  const noAs = acc.total_no_asistidas;
  const ef = acc.total_efectuadas;
  const ven = acc.total_ventas;
  const paid = acc.total_paid_upfront;
  const fact = acc.facturacion_total_mes;
  const ccne = acc.ccne;
  const cce = acc.cce;
  const efTotal = ef;
  const venTotal = ven;

  return {
    agendados: ag,
    aplicables: apl,
    pctAplicables: safeDiv(apl * 100, ag),
    respuesta: resp,
    pctRespuesta: safeDiv(resp * 100, apl),
    confirmados: conf,
    pctConfirmados: safeDiv(conf * 100, resp),
    canceladas: canc,
    pctCanceladas: canc === 0 ? 0 : safeDiv(canc * 100, apl),
    noAsistidas: noAs,
    pctNoAsistidas: noAs === 0 ? 0 : safeDiv(noAs * 100, apl),
    pendientes: acc.total_pendientes,
    efectuadas: ef,
    pctEfectuadas: ef === 0 ? 0 : safeDiv(ef * 100, apl),
    ventas: ven,
    pctVendidas: ef === 0 ? 0 : safeDiv(ven * 100, ef),
    paidUpfront: paid,
    pctPaidUpfront: fact === 0 ? 0 : safeDiv(paid * 100, fact),
    aov: safeDiv(fact, ven),
    tasaCierre: safeDiv(ven * 100, ag),
    ccne,
    pctCcne: safeDiv(ccne * 100, apl),
    ccneEfectuadas: acc.ccne_efectuadas,
    pctCcneEfectuadas: safeDiv(acc.ccne_efectuadas * 100, efTotal),
    ccneVendidas: acc.ccne_vendidas,
    pctCcneVendidas: safeDiv(acc.ccne_vendidas * 100, venTotal),
    cce,
    pctCce: safeDiv(cce * 100, apl),
    cceEfectuadas: acc.cce_efectuadas,
    pctCceEfectuadas: safeDiv(acc.cce_efectuadas * 100, efTotal),
    cceVendidas: acc.cce_vendidas,
    pctCceVendidas: safeDiv(acc.cce_vendidas * 100, venTotal),
    factTotalMes: acc.facturacion_total_mes,
    ccRealMes: acc.cash_collected_real_mes,
    ccOtrosMeses: acc.cash_collected_otros_meses,
    ccAgendasMes: acc.cash_collected_agendas_mes
  };
}

function buildMatrixTable(rows, filters) {
  const container = document.getElementById('tableContainer');
  const currentMonth = new Date().getMonth() + 1;

  if (!rows.length) {
    container.innerHTML = '<p>No hay datos para el filtro seleccionado.</p>';
    return;
  }

  const { byMonth, totals } = aggregateByMonth(rows);
  const months = MONTHS.map((m) => m.value);
  const totalMetrics = metricRowsFor(totals);

  const monthMetricsMap = new Map();
  months.forEach((m) => {
    monthMetricsMap.set(m, metricRowsFor(byMonth.get(m) || emptyAccumulator()));
  });

  const metricDefinitions = [
    { key: 'agendados', label: 'Agendados', format: 'number' },
    { key: 'aplicables', label: 'Aplicables', format: 'number' },
    { key: 'pctAplicables', label: '% Aplicables', format: 'percent' },
    { key: 'respuesta', label: 'Respuesta', format: 'number' },
    { key: 'pctRespuesta', label: '% Respuesta', format: 'percent' },
    { key: 'confirmados', label: 'Confirmados', format: 'number' },
    { key: 'pctConfirmados', label: '% Confirmados', format: 'percent' },
    { key: 'canceladas', label: 'Canceladas', format: 'number' },
    { key: 'pctCanceladas', label: '% Canceladas', format: 'percent' },
    { key: 'noAsistidas', label: 'No asistidas', format: 'number' },
    { key: 'pctNoAsistidas', label: '% No asistidas', format: 'percent' },
    { key: 'pendientes', label: 'Pendientes', format: 'number' },
    { key: 'efectuadas', label: 'Efectuadas', format: 'number' },
    { key: 'pctEfectuadas', label: '% Efectuadas', format: 'percent' },
    { key: 'ventas', label: 'Ventas', format: 'number' },
    { key: 'pctVendidas', label: '% Vendidas', format: 'percent' },
    { key: 'paidUpfront', label: 'Paid Upfront', format: 'currency' },
    { key: 'pctPaidUpfront', label: '% Paid Upfront', format: 'percent' },
    { key: 'aov', label: 'AOV', format: 'currency' },
    { key: 'tasaCierre', label: 'Tasa de Cierre', format: 'percent' },
    { key: 'ccne', label: 'CCNE', format: 'number' },
    { key: 'pctCcne', label: '% CCNE', format: 'percent' },
    { key: 'ccneEfectuadas', label: 'CCNE Efectuadas', format: 'number' },
    { key: 'pctCcneEfectuadas', label: '% CCNE Efectuadas', format: 'percent' },
    { key: 'ccneVendidas', label: 'CCNE Vendidas', format: 'number' },
    { key: 'pctCcneVendidas', label: '% CCNE Vendidas', format: 'percent' },
    { key: 'cce', label: 'CCE', format: 'number' },
    { key: 'pctCce', label: '% CCE', format: 'percent' },
    { key: 'cceEfectuadas', label: 'CCE Efectuadas', format: 'number' },
    { key: 'pctCceEfectuadas', label: '% CCE Efectuadas', format: 'percent' },
    { key: 'cceVendidas', label: 'CCE Vendidas', format: 'number' },
    { key: 'pctCceVendidas', label: '% CCE Vendidas', format: 'percent' },
    { key: 'factTotalMes', label: 'Facturación Total Mes', format: 'currency' },
    { key: 'ccRealMes', label: 'Cash Collected Real Mes', format: 'currency' },
    { key: 'ccOtrosMeses', label: 'Cash Collected Otros Meses', format: 'currency' },
    { key: 'ccAgendasMes', label: 'Cash Collected Agendas Mes', format: 'currency' }
  ];

  const formatValue = (value, type) => {
    if (type === 'currency') return formatCurrency(value);
    if (type === 'percent') return formatPercent(value);
    return formatNumber(value);
  };

  const headerMonths = months
    .map((month) => `<th class="${month === currentMonth ? 'month-current' : ''}">${month}</th>`)
    .join('');

  const bodyRows = metricDefinitions
    .map((metric) => {
      const monthCells = months
        .map((month) => {
          const monthMetrics = monthMetricsMap.get(month);
          return `<td class="${month === currentMonth ? 'month-current' : ''}">${formatValue(monthMetrics[metric.key], metric.format)}</td>`;
        })
        .join('');

      const totalValue = formatValue(totalMetrics[metric.key], metric.format);

      return `
        <tr>
          <td><strong>${metric.label}</strong></td>
          ${monthCells}
          <td><strong>${totalValue}</strong></td>
        </tr>
      `;
    })
    .join('');

  container.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Mes</th>
            ${headerMonths}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${bodyRows}
          <tr>
            <td><strong>Totales del período</strong></td>
            <td colspan="${months.length + 1}">
              Año ${filters.anio}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function buildKpis(rows) {
  const wrap = document.getElementById('kpiContainer');

  if (!rows.length) {
    wrap.innerHTML = '';
    return;
  }

  const { totals } = aggregateByMonth(rows);
  const metrics = metricRowsFor(totals);

  wrap.innerHTML = `
    <article class="card"><h4>Total Agendados</h4><p>${formatNumber(totals.total_agendados)}</p></article>
    <article class="card"><h4>Total Ventas</h4><p>${formatNumber(totals.total_ventas)}</p></article>
    <article class="card"><h4>Tasa Cierre</h4><p>${formatPercent(metrics.tasaCierre)}</p></article>
    <article class="card"><h4>Facturación Total</h4><p>${formatCurrency(totals.facturacion_total_mes)}</p></article>
    <article class="card"><h4>Cash Real Total</h4><p>${formatCurrency(totals.cash_collected_real_mes)}</p></article>
  `;
}

async function initFilters() {
  const status = document.getElementById('status');
  status.textContent = 'Cargando opciones de filtros...';

  const response = await window.metricasApi.fetchRows('agenda_totales', {
    limit: 2000,
    orderBy: 'anio',
    orderDir: 'desc'
  });

  const rows = response.rows || [];
  const current = getCurrentPeriod();

  const years = uniqueValues(rows, 'anio')
    .map((y) => Number(y))
    .filter((y) => Number.isInteger(y) && y >= 2000)
    .sort((a, b) => b - a);
  const origenes = uniqueValues(rows, 'origen').filter((origin) => ORIGIN_WHITELIST.includes(origin));

  estrategiaField = detectEstrategiaField(rows);

  const defaultYear = years.includes(current.year) ? current.year : years[0];
  setOptions('anio', years, defaultYear);
  setOptions('origen', origenes, '', true);

  if (estrategiaField) {
    const estrategias = uniqueValues(rows, estrategiaField);
    setOptions('estrategia', estrategias, '', true);
    document.getElementById('estrategia').disabled = false;
  } else {
    disableEstrategiaFilter();
  }
}

async function loadAgendaTotales() {
  const status = document.getElementById('status');
  const filters = getFilters();
  status.textContent = 'Cargando agenda_totales...';

  try {
    const selectedYear = Number(filters.anio);
    if (!Number.isInteger(selectedYear) || selectedYear < 2000) {
      status.textContent = 'Seleccioná un año válido.';
      return;
    }

    const query = {
      limit: 2000,
      orderBy: 'mes',
      orderDir: 'asc',
      eq_anio: selectedYear
    };

    if (filters.origen) query.eq_origen = filters.origen;
    if (filters.estrategia && estrategiaField) {
      query[`eq_${estrategiaField}`] = filters.estrategia;
    }

    const response = await window.metricasApi.fetchRows('agenda_totales', query);
    const rows = applyLocalFilters(sanitizeRowsForYear(response.rows, selectedYear), filters);

    buildKpis(rows);
    buildMatrixTable(rows, filters);
    status.textContent = `Filas: ${rows.length} | año ${selectedYear}${filters.origen ? ` | origen ${filters.origen}` : ''}${filters.estrategia ? ` | estrategia ${filters.estrategia}` : ''}`;
  } catch (error) {
    status.textContent = error.message;
  }
}

async function initPage() {
  await initFilters();
  await loadAgendaTotales();
}

document.getElementById('reload').addEventListener('click', loadAgendaTotales);
initPage();
