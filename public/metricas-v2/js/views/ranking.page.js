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
    <article class="card">
      <h4>Facturación Total</h4>
      <p>${formatCurrency(totalFacturacion)}</p>
    </article>
    <article class="card">
      <h4>Cash Collected Total</h4>
      <p>${formatCurrency(totalCash)}</p>
    </article>
    <article class="card">
      <h4>Ventas Totales</h4>
      <p>${formatNumber(totalVentas)}</p>
    </article>
    <article class="card">
      <h4>Efectividad Global</h4>
      <p>${effectiveness.toFixed(2)}%</p>
    </article>
  `;
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
      <th>Facturación</th>
      <th>Cash Collected</th>
      <th>Ventas</th>
      <th>% Efectividad</th>
      <th>Incobrable</th>
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
