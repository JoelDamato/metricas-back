const EXCLUDED_CLOSERS = ['nahuel', 'shirlet', 'shirley'];
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

  anioInput.value = period.year;

  mesSelect.innerHTML = MONTHS.map((m) => `<option value="${m.value}">${m.label}</option>`).join('');
  mesSelect.value = String(period.month);
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
  return {
    anio: Number(document.getElementById('anio').value),
    mes: Number(document.getElementById('mes').value),
    limit: 80
  };
}

function filterRows(rows, anio, mes) {
  return rows.filter((row) => {
    if (isExcludedCloser(row.closer)) return false;

    const okAnio = anio ? Number(row.anio) === Number(anio) : true;
    const okMes = mes ? Number(row.mes) === Number(mes) : true;
    return okAnio && okMes;
  });
}

function computeEffectiveness(row) {
  const fact = Number(row.facturacion_total || 0);
  const cash = Number(row.cash_collected_total || 0);
  if (fact <= 0) return 0;
  return (cash / fact) * 100;
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

function buildTable(rows) {
  const container = document.getElementById('tableContainer');

  if (!rows.length) {
    container.innerHTML = '<p>No hay datos para ese filtro.</p>';
    return;
  }

  const ordered = [...rows].sort((a, b) => Number(a.ranking_posicion) - Number(b.ranking_posicion));

  const head = `
    <tr>
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

function renderChart(rows) {
  const canvas = document.getElementById('rankingChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const ordered = [...rows]
    .sort((a, b) => Number(a.ranking_posicion) - Number(b.ranking_posicion))
    .slice(0, 10);
  const labels = ordered.map((row) => row.closer || 'Sin nombre');
  const facturacion = ordered.map((row) => Number(row.facturacion_total || 0));
  const cash = ordered.map((row) => Number(row.cash_collected_total || 0));

  if (rankingChart) {
    rankingChart.destroy();
  }

  rankingChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Facturación',
          data: facturacion,
          borderRadius: 8,
          backgroundColor: 'rgba(39, 121, 230, 0.75)'
        },
        {
          label: 'Cash Collected',
          data: cash,
          borderRadius: 8,
          backgroundColor: 'rgba(14, 165, 140, 0.75)'
        }
      ]
    },
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
      eq_mes: filters.mes
    });

    const filteredRows = filterRows(response.rows || [], filters.anio, filters.mes);
    buildKpiCards(filteredRows);
    buildTable(filteredRows);
    renderChart(filteredRows);
    status.textContent = `Filas cargadas: ${filteredRows.length} (mes ${filters.mes}/${filters.anio})`;
  } catch (error) {
    status.textContent = error.message;
  }
}

setupDefaultFilters();
document.getElementById('reload').addEventListener('click', loadRanking);
loadRanking();
