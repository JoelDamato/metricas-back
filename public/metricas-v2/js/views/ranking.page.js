const EXCLUDED_CLOSERS = ['nahuel', 'shirlet', 'shirley'];
const ALL_CLOSERS_VALUE = '__ALL__';
const ALL_MONTHS_VALUE = '__ALL__';
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

let rankingChart = null;
const RANKING_METRIC_INFO = {
  facturacion_total: {
    title: 'Facturación Total',
    viewLabel: '"ranking_closers_mensual"',
    dateLabel: 'Mes del ranking por "f_venta"',
    logic: 'Suma "facturacion" de comprobantes con "tipo"=\'Venta\', "producto_format" válido y distinto de Club. La vista agrupa por "creado_por" y por mes de "f_venta".'
  },
  cash_collected_total: {
    title: 'Cash Collected Total',
    viewLabel: '"ranking_closers_mensual"',
    dateLabel: 'Mes del ranking por "f_venta", con corte de cash por "f_acreditacion"',
    logic: 'Suma "cash_collected" de comprobantes no Club. El ranking mensual se sigue agrupando por mes de "f_venta", pero para el cash del mes actual la vista solo deja pasar filas con "f_acreditacion" hasta hoy Argentina.'
  },
  total_ventas: {
    title: 'Ventas Totales',
    viewLabel: '"ranking_closers_mensual"',
    dateLabel: 'Mes del ranking por "f_venta"',
    logic: 'Cuenta comprobantes con "tipo"=\'Venta\', "producto_format" válido y distinto de Club. La vista agrupa por "creado_por" y por mes de "f_venta".'
  },
  efectividad: {
    title: 'Efectividad',
    viewLabel: '"ranking_closers_mensual"',
    dateLabel: 'Mixta: mes del ranking por "f_venta" + corte de cash por "f_acreditacion"',
    logic: 'Se calcula como ("cash_collected_total" / "facturacion_total") * 100. El numerador ya viene con la lógica de acreditación y corte al día de hoy; el denominador usa la facturación del mes de "f_venta".'
  },
  monto_incobrable_total: {
    title: 'Incobrable',
    viewLabel: '"ranking_closers_mensual"',
    dateLabel: 'Mes del ranking por "f_venta"',
    logic: 'Suma "monto_incobrable" de comprobantes no Club, agrupado por "creado_por" dentro del mismo mes de "f_venta" que usa el ranking.'
  }
};

function formatCurrency(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  }).format(n);
}

function formatNumber(value) {
  return new Intl.NumberFormat('es-AR').format(Number(value || 0));
}

function showMetricInfo(metricKey) {
  const info = RANKING_METRIC_INFO[metricKey];
  if (!info) return;

  const existing = document.getElementById('rankingMetricPopup');
  if (existing) existing.remove();

  const popup = document.createElement('div');
  popup.id = 'rankingMetricPopup';
  popup.className = 'kpi-popup metric-info-popup';
  popup.innerHTML = `
    <div class="kpi-popup-card metric-info-card">
      <h3>${info.title}</h3>
      <p><strong>Vista que usa:</strong> ${info.viewLabel || '"ranking_closers_mensual"'}</p>
      <p><strong>Fecha que usa:</strong> ${info.dateLabel}</p>
      <p><strong>Lógica:</strong> ${info.logic}</p>
      <button id="rankingMetricPopupClose" type="button">Cerrar</button>
    </div>
  `;

  document.body.appendChild(popup);

  const close = () => popup.remove();
  popup.addEventListener('click', (event) => {
    if (event.target === popup) close();
  });
  document.getElementById('rankingMetricPopupClose').addEventListener('click', close);
}

function getCurrentPeriod() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1
  };
}

function setupDefaultFilters() {
  const period = getCurrentPeriod();
  const anioInput = document.getElementById('anio');
  const mesSelect = document.getElementById('mes');
  const closerSelect = document.getElementById('closer');

  anioInput.value = period.year;

  mesSelect.innerHTML = [{ value: ALL_MONTHS_VALUE, label: 'Todos' }, ...MONTHS]
    .map((m) => `<option value="${m.value}">${m.label}</option>`)
    .join('');
  mesSelect.value = String(period.month);
  if (closerSelect) {
    closerSelect.innerHTML = `<option value="${ALL_CLOSERS_VALUE}">Todos</option>`;
    closerSelect.value = ALL_CLOSERS_VALUE;
  }
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isExcludedCloser(name) {
  const normalized = normalizeText(name);
  return EXCLUDED_CLOSERS.some((excluded) => normalized.includes(excluded));
}

function getFilters() {
  const monthValue = document.getElementById('mes').value || ALL_MONTHS_VALUE;
  return {
    anio: Number(document.getElementById('anio').value),
    mes: monthValue === ALL_MONTHS_VALUE ? ALL_MONTHS_VALUE : Number(monthValue),
    closer: document.getElementById('closer')?.value || ALL_CLOSERS_VALUE,
    limit: 80
  };
}

function getMonthLabel(month) {
  const found = MONTHS.find((item) => Number(item.value) === Number(month));
  return found ? found.label : String(month || '');
}

function populateCloserFilter(rows, selectedCloser = ALL_CLOSERS_VALUE) {
  const closers = [...new Set((rows || []).map((row) => String(row.closer || '').trim()).filter(Boolean))]
    .filter((name) => !isExcludedCloser(name))
    .sort((a, b) => a.localeCompare(b, 'es'));
  const select = document.getElementById('closer');
  if (!select) return ALL_CLOSERS_VALUE;
  select.innerHTML = [{ value: ALL_CLOSERS_VALUE, label: 'Todos' }, ...closers.map((closer) => ({ value: closer, label: closer }))]
    .map((option) => `<option value="${option.value}">${option.label}</option>`)
    .join('');
  const effectiveCloser = closers.includes(selectedCloser) ? selectedCloser : ALL_CLOSERS_VALUE;
  select.value = effectiveCloser;
  return effectiveCloser;
}

function filterRows(rows, anio, mes, closer = ALL_CLOSERS_VALUE) {
  return rows.filter((row) => {
    if (isExcludedCloser(row.closer)) return false;

    const okAnio = anio ? Number(row.anio) === Number(anio) : true;
    const okMes = mes === ALL_MONTHS_VALUE ? true : (mes ? Number(row.mes) === Number(mes) : true);
    const okCloser = closer === ALL_CLOSERS_VALUE ? true : String(row.closer || '').trim() === closer;
    return okAnio && okMes && okCloser;
  });
}

function computeEffectiveness(row) {
  const fact = Number(row.facturacion_total || 0);
  const cash = Number(row.cash_collected_total || 0);
  if (fact <= 0) return 0;
  return (cash / fact) * 100;
}

function buildTrendLine(values) {
  const points = values.map((value, index) => ({ x: index + 1, y: Number(value || 0) }));
  const n = points.length;
  if (!n) return [];

  const sumX = points.reduce((acc, point) => acc + point.x, 0);
  const sumY = points.reduce((acc, point) => acc + point.y, 0);
  const sumXY = points.reduce((acc, point) => acc + point.x * point.y, 0);
  const sumXX = points.reduce((acc, point) => acc + point.x * point.x, 0);
  const denominator = (n * sumXX) - (sumX * sumX);

  if (!denominator) return values.map((value) => Number(value || 0));

  const slope = ((n * sumXY) - (sumX * sumY)) / denominator;
  const intercept = (sumY - (slope * sumX)) / n;
  return points.map((point) => intercept + (slope * point.x));
}

function buildKpiCards(rows) {
  const wrap = document.getElementById('kpiContainer');

  if (!rows.length) {
    wrap.innerHTML = '';
    return;
  }

  const totalFacturacion = rows.reduce((acc, row) => acc + Number(row.facturacion_total || 0), 0);
  const totalCash = rows.reduce((acc, row) => acc + Number(row.cash_collected_total || 0), 0);
  const totalVentas = rows.reduce((acc, row) => acc + Number(row.total_ventas || 0), 0);
  const effectiveness = totalFacturacion > 0 ? (totalCash / totalFacturacion) * 100 : 0;

  wrap.innerHTML = `
    <article class="card metric-card" data-metric-info="facturacion_total" role="button" tabindex="0">
      <h4>Facturación Total</h4>
      <p>${formatCurrency(totalFacturacion)}</p>
    </article>
    <article class="card metric-card" data-metric-info="cash_collected_total" role="button" tabindex="0">
      <h4>Cash Collected Total</h4>
      <p>${formatCurrency(totalCash)}</p>
    </article>
    <article class="card metric-card" data-metric-info="total_ventas" role="button" tabindex="0">
      <h4>Ventas Totales</h4>
      <p>${formatNumber(totalVentas)}</p>
    </article>
    <article class="card metric-card" data-metric-info="efectividad" role="button" tabindex="0">
      <h4>Efectividad Global</h4>
      <p>${effectiveness.toFixed(2)}%</p>
    </article>
  `;

  wrap.querySelectorAll('[data-metric-info]').forEach((node) => {
    node.addEventListener('click', () => showMetricInfo(node.dataset.metricInfo));
    node.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        showMetricInfo(node.dataset.metricInfo);
      }
    });
  });
}

function buildTable(rows, options = {}) {
  const container = document.getElementById('tableContainer');
  const showMonthColumn = options.showMonthColumn === true;

  if (!rows.length) {
    container.innerHTML = '<p>No hay datos para ese filtro.</p>';
    return;
  }

  const ordered = [...rows].sort((a, b) => {
    if (showMonthColumn && Number(a.mes) !== Number(b.mes)) return Number(a.mes) - Number(b.mes);
    return Number(a.ranking_posicion) - Number(b.ranking_posicion);
  });

  const head = `
    <tr>
      ${showMonthColumn ? '<th>Mes</th>' : ''}
      <th>#</th>
      <th>Closer</th>
      <th><button type="button" class="metric-info-trigger" data-metric-info="facturacion_total">Facturación</button></th>
      <th><button type="button" class="metric-info-trigger" data-metric-info="cash_collected_total">Cash Collected</button></th>
      <th><button type="button" class="metric-info-trigger" data-metric-info="total_ventas">Ventas</button></th>
      <th><button type="button" class="metric-info-trigger" data-metric-info="efectividad">% Efectividad</button></th>
      <th><button type="button" class="metric-info-trigger" data-metric-info="monto_incobrable_total">Incobrable</button></th>
    </tr>
  `;

  const body = ordered
    .map(
      (row) => `
      <tr>
        ${showMonthColumn ? `<td>${getMonthLabel(row.mes)}</td>` : ''}
        <td>${row.ranking_posicion ?? ''}</td>
        <td>${row.closer ?? ''}</td>
        <td>${formatCurrency(row.facturacion_total)}</td>
        <td>${formatCurrency(row.cash_collected_total)}</td>
        <td>${formatNumber(row.total_ventas)}</td>
        <td>${computeEffectiveness(row).toFixed(2)}%</td>
        <td>${formatCurrency(row.monto_incobrable_total)}</td>
      </tr>
    `
    )
    .join('');

  container.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>${head}</thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;

  container.querySelectorAll('.metric-info-trigger').forEach((button) => {
    button.addEventListener('click', () => showMetricInfo(button.dataset.metricInfo));
  });
}

function renderChart(rows, year, monthValue, selectedCloser) {
  const canvas = document.getElementById('rankingChart');
  const title = document.querySelector('.chart-panel h3');
  const description = document.querySelector('.chart-panel p');
  if (!canvas || typeof Chart === 'undefined') return;

  if (rankingChart) {
    rankingChart.destroy();
    rankingChart = null;
  }

  if (!rows.length) {
    if (title) title.textContent = 'Comparativa por Closer';
    if (description) description.textContent = 'No hay datos para graficar con el filtro elegido.';
    return;
  }

  const isAllMonths = monthValue === ALL_MONTHS_VALUE;
  let config;

  if (isAllMonths) {
    const currentPeriod = getCurrentPeriod();
    const visibleMonths = Number(year) === Number(currentPeriod.year)
      ? MONTHS.filter((month) => Number(month.value) <= Number(currentPeriod.month))
      : MONTHS;

    const byMonth = visibleMonths.map((month) => {
      const monthRows = rows.filter((row) => Number(row.mes) === Number(month.value));
      return {
        label: month.label,
        facturacion: monthRows.reduce((sum, row) => sum + Number(row.facturacion_total || 0), 0),
        cash: monthRows.reduce((sum, row) => sum + Number(row.cash_collected_total || 0), 0)
      };
    });
    if (title) title.textContent = selectedCloser === ALL_CLOSERS_VALUE ? `Evolución mensual del equipo ${year}` : `Evolución mensual de ${selectedCloser} en ${year}`;
    if (description) description.textContent = 'Avance mes a mes de "Facturación" y "Cash Collected". La línea roja marca la tendencia del "Cash Collected" para el filtro seleccionado.';
    const datasets = [
      {
        label: 'Facturación',
        data: byMonth.map((item) => item.facturacion),
        borderColor: 'rgba(39, 121, 230, 0.9)',
        backgroundColor: 'rgba(39, 121, 230, 0.18)',
        tension: 0.3,
        fill: true
      },
      {
        label: 'Cash Collected',
        data: byMonth.map((item) => item.cash),
        borderColor: 'rgba(14, 165, 140, 0.95)',
        backgroundColor: 'rgba(14, 165, 140, 0.18)',
        tension: 0.3,
        fill: true
      }
    ];

    datasets.push({
      label: 'Tendencia',
      data: buildTrendLine(byMonth.map((item) => item.cash)),
      borderColor: 'rgba(220, 38, 38, 0.95)',
      backgroundColor: 'transparent',
      borderWidth: 3,
      borderDash: [10, 8],
      pointRadius: 0,
      pointHoverRadius: 0,
      tension: 0
    });

    config = {
      type: 'line',
      data: {
        labels: byMonth.map((item) => item.label),
        datasets
      }
    };
  } else if (rows.length === 1) {
    const [row] = rows;
    if (title) title.textContent = `Detalle de ${row.closer || 'Closer'} - ${getMonthLabel(monthValue)} ${year}`;
    if (description) description.textContent = 'Comparativa puntual de "Facturación" y "Cash Collected" para el período filtrado.';
    config = {
      type: 'bar',
      data: {
        labels: ['Facturación', 'Cash Collected'],
        datasets: [
          {
            label: row.closer || 'Closer',
            data: [Number(row.facturacion_total || 0), Number(row.cash_collected_total || 0)],
            borderRadius: 8,
            backgroundColor: ['rgba(39, 121, 230, 0.78)', 'rgba(14, 165, 140, 0.78)']
          }
        ]
      }
    };
  } else {
    const ordered = [...rows]
      .sort((a, b) => Number(a.ranking_posicion) - Number(b.ranking_posicion))
      .slice(0, 10);
    if (title) title.textContent = `Comparativa por closer - ${getMonthLabel(monthValue)} ${year}`;
    if (description) description.textContent = 'Facturación vs Cash Collected para el mes seleccionado.';
    config = {
      type: 'bar',
      data: {
        labels: ordered.map((row) => row.closer || 'Sin nombre'),
        datasets: [
          {
            label: 'Facturación',
            data: ordered.map((row) => Number(row.facturacion_total || 0)),
            borderRadius: 8,
            backgroundColor: 'rgba(39, 121, 230, 0.75)'
          },
          {
            label: 'Cash Collected',
            data: ordered.map((row) => Number(row.cash_collected_total || 0)),
            borderRadius: 8,
            backgroundColor: 'rgba(14, 165, 140, 0.75)'
          }
        ]
      }
    };
  }

  rankingChart = new Chart(canvas, {
    ...config,
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#1f3b63',
            font: { weight: '700' }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#1f3b63' },
          grid: { display: false }
        },
        y: {
          ticks: {
            color: '#1f3b63',
            callback(value) {
              return formatCurrency(value);
            }
          }
        }
      }
    }
  });
}

async function loadRanking() {
  const status = document.getElementById('status');
  const filters = getFilters();

  status.textContent = 'Cargando ranking...';

  try {
    const response = await window.metricasApi.fetchRows('ranking_closers_mensual', {
      limit: filters.limit,
      orderBy: 'ranking_posicion',
      orderDir: 'asc',
      eq_anio: filters.anio,
      ...(filters.mes !== ALL_MONTHS_VALUE ? { eq_mes: filters.mes } : {})
    });

    const effectiveCloser = populateCloserFilter(response.rows || [], filters.closer);
    const filteredRows = filterRows(response.rows || [], filters.anio, filters.mes, effectiveCloser);
    buildKpiCards(filteredRows);
    buildTable(filteredRows, { showMonthColumn: filters.mes === ALL_MONTHS_VALUE });
    renderChart(filteredRows, filters.anio, filters.mes, effectiveCloser);
    status.textContent = effectiveCloser === ALL_CLOSERS_VALUE
      ? `Filas cargadas: ${filteredRows.length} (${filters.mes === ALL_MONTHS_VALUE ? `Todos los meses ${filters.anio}` : `mes ${filters.mes}/${filters.anio}`})`
      : `Closer: ${effectiveCloser} | ${filters.mes === ALL_MONTHS_VALUE ? `Todos los meses ${filters.anio}` : `mes ${filters.mes}/${filters.anio}`}`;
  } catch (error) {
    status.textContent = error.message;
  }
}

setupDefaultFilters();
document.getElementById('reload').addEventListener('click', loadRanking);
loadRanking();
