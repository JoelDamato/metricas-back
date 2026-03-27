let allRows = [];
let hasLoadedRows = false;
const LEADS_BDD_INFO = {
  'Facturacion': {
    title: 'Bloque Facturación',
    viewLabel: '"leads_raw"',
    dateLabel: '"fecha_agenda"',
    logic: 'Agrupa los registros de "leads_raw" por el valor del campo "facturacion". Solo entra al bloque si el lead cae dentro del rango por "fecha_agenda".'
  },
  'Inversion': {
    title: 'Bloque Inversión',
    viewLabel: '"leads_raw"',
    dateLabel: '"fecha_agenda"',
    logic: 'Agrupa los registros de "leads_raw" por el valor del campo "inversion", filtrando por "fecha_agenda".'
  },
  'Modelo': {
    title: 'Bloque Modelo',
    viewLabel: '"leads_raw"',
    dateLabel: '"fecha_agenda"',
    logic: 'Agrupa los registros por "modelo_negocio" dentro del rango de "fecha_agenda".'
  },
  'Calidad': {
    title: 'Bloque Calidad',
    viewLabel: '"leads_raw"',
    dateLabel: '"fecha_agenda"',
    logic: 'Agrupa los registros por "calidad_lead" dentro del rango de "fecha_agenda".'
  },
  'Adname': {
    title: 'Bloque Adname',
    viewLabel: '"leads_raw"',
    dateLabel: '"fecha_agenda"',
    logic: 'Agrupa los registros por "adname" dentro del rango de "fecha_agenda".'
  },
  'Agendas': {
    title: 'Agendas',
    viewLabel: '"leads_raw"',
    dateLabel: '"fecha_agenda"',
    logic: 'Cuenta la cantidad de registros que quedan en cada grupo dentro del rango filtrado por "fecha_agenda".'
  },
  'Asistencia': {
    title: 'Asistencia',
    viewLabel: '"leads_raw"',
    dateLabel: '"fecha_agenda"',
    logic: 'Cuenta registros donde "aplica"=\'Aplica\' y "llamada_meg"=\'Efectuada\'. El corte temporal del tablero sigue siendo "fecha_agenda".'
  },
  '% Asistencia': {
    title: '% Asistencia',
    viewLabel: '"leads_raw"',
    dateLabel: '"fecha_agenda"',
    logic: 'Se calcula como "asistencia" dividido "agendas" por 100, donde "asistencia" solo cuenta filas con "aplica"=\'Aplica\' y "llamada_meg"=\'Efectuada\'.'
  },
  'Ventas': {
    title: 'Ventas',
    viewLabel: '"leads_raw"',
    dateLabel: '"fecha_agenda"',
    logic: 'Cuenta registros donde "fecha_venta" tiene valor. La condición interna mira "fecha_venta", pero el filtro temporal del tablero sigue siendo "fecha_agenda".'
  },
  '% Venta': {
    title: '% Venta',
    viewLabel: '"leads_raw"',
    dateLabel: '"fecha_agenda"',
    logic: 'Se calcula como ("ventas" / "asistencia") * 100. "ventas" cuenta filas con "fecha_venta" cargada y "asistencia" solo cuenta filas con "aplica"=\'Aplica\' y "llamada_meg"=\'Efectuada\'; el rango del tablero sigue siendo "fecha_agenda".'
  }
};

const BLOCKS = [
  { key: 'facturacion', title: 'Facturacion', layout: 'half' },
  { key: 'inversion', title: 'Inversion', layout: 'half' },
  { key: 'modelo_negocio', title: 'Modelo', layout: 'full' },
  { key: 'calidad_lead', title: 'Calidad', layout: 'full' },
  { key: 'adname', title: 'Adname', layout: 'full' }
];

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function formatInteger(value) {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '0 %';
  }

  return `${Number(value).toFixed(2)} %`;
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
      <p><strong>Vista que usa:</strong> ${info.viewLabel || '"leads_raw"'}</p>
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

function toDateOnly(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function getCurrentRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    from: from.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10)
  };
}

function setupFilters() {
  const range = getCurrentRange();
  document.getElementById('desde').value = range.from;
  document.getElementById('hasta').value = range.to;
}

function setLoading(isVisible) {
  const popup = document.getElementById('loadingPopup');
  if (!popup) return;
  popup.hidden = !isVisible;
}

function getFilters() {
  return {
    from: document.getElementById('desde').value,
    to: document.getElementById('hasta').value
  };
}

function filterRows(rows, filters) {
  return rows.filter((row) => {
    const agendaDate = toDateOnly(row.fecha_agenda);
    if (!agendaDate) return false;
    if (filters.from && agendaDate < filters.from) return false;
    if (filters.to && agendaDate > filters.to) return false;
    return true;
  });
}

function isAsistencia(row) {
  return normalizeText(row.aplica) === 'aplica' && normalizeText(row.llamada_meg) === 'efectuada';
}

function isVenta(row) {
  return Boolean(row.fecha_venta);
}

function groupRows(rows, field) {
  const map = new Map();

  rows.forEach((row) => {
    const raw = String(row[field] || '').trim();
    const label = raw || 'Sin dato';
    const current = map.get(label) || {
      label,
      agendas: 0,
      asistencia: 0,
      ventas: 0
    };

    current.agendas += 1;
    current.asistencia += isAsistencia(row) ? 1 : 0;
    current.ventas += isVenta(row) ? 1 : 0;

    map.set(label, current);
  });

  return [...map.values()]
    .map((row) => ({
      ...row,
      pctAsistencia: row.agendas > 0 ? (row.asistencia / row.agendas) * 100 : 0,
      pctVenta: row.asistencia > 0 ? (row.ventas / row.asistencia) * 100 : 0
    }))
    .sort((a, b) => {
      if (b.agendas !== a.agendas) return b.agendas - a.agendas;
      return a.label.localeCompare(b.label);
    });
}

function truncateLabel(value, max = 28) {
  const text = String(value || '');
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function buildBlock(block, rows) {
  const grouped = groupRows(rows, block.key);

  const body = grouped.length
    ? grouped.map((row) => `
        <tr>
          <td title="${row.label}">${truncateLabel(row.label, block.key === 'adname' ? 34 : 26)}</td>
          <td>${formatInteger(row.agendas)}</td>
          <td>${formatInteger(row.asistencia)}</td>
          <td>${formatPercent(row.pctAsistencia)}</td>
          <td>${formatInteger(row.ventas)}</td>
          <td>${formatPercent(row.pctVenta)}</td>
        </tr>
      `).join('')
    : `
      <tr>
        <td colspan="6" class="report-empty-cell">No hay datos para este rango.</td>
      </tr>
    `;

  return `
    <section class="respuesta-block respuesta-block-${block.layout}">
      <div class="table-wrap respuesta-table-wrap">
        <table class="respuesta-table">
          <thead>
            <tr>
              <th><button type="button" class="metric-info-trigger metric-label" data-info-key="${block.title}">${block.title}</button></th>
              <th><button type="button" class="metric-info-trigger metric-label" data-info-key="Agendas">Agendas</button></th>
              <th><button type="button" class="metric-info-trigger metric-label" data-info-key="Asistencia">Asistencia</button></th>
              <th><button type="button" class="metric-info-trigger metric-label" data-info-key="% Asistencia">% Asistencia</button></th>
              <th><button type="button" class="metric-info-trigger metric-label" data-info-key="Ventas">Ventas</button></th>
              <th><button type="button" class="metric-info-trigger metric-label" data-info-key="% Venta">% Venta</button></th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderBlocks(rows) {
  const container = document.getElementById('tableContainer');
  container.innerHTML = `
    <div class="respuesta-grid">
      ${BLOCKS.map((block) => buildBlock(block, rows)).join('')}
    </div>
  `;

  container.querySelectorAll('.metric-label').forEach((button) => {
    button.addEventListener('click', () => {
      showMetricInfo(LEADS_BDD_INFO[button.dataset.infoKey] || {
        title: button.dataset.infoKey,
        viewLabel: '"leads_raw"',
        dateLabel: '"fecha_agenda"',
        logic: `La métrica o dimensión "${button.dataset.infoKey}" se interpreta dentro del tablero con filtro temporal por "fecha_agenda".`
      });
    });
  });
}

async function bootstrap() {
  const status = document.getElementById('status');
  setupFilters();
  status.textContent = 'Seleccioná un rango y presioná Buscar.';
  document.getElementById('tableContainer').innerHTML = '';
}

async function applyFilters() {
  const status = document.getElementById('status');
  const filters = getFilters();

  if (filters.from && filters.to && filters.from > filters.to) {
    status.textContent = 'La fecha desde no puede ser mayor a la fecha hasta.';
    document.getElementById('tableContainer').innerHTML = '';
    return;
  }

  setLoading(true);
  try {
    await new Promise((resolve) => requestAnimationFrame(resolve));

    if (!hasLoadedRows) {
      const response = await window.metricasApi.fetchAllRows('leads_raw', {
        limit: 1000
      });

      allRows = response.rows || [];
      hasLoadedRows = true;
    }

    const filtered = filterRows(allRows, filters);
    renderBlocks(filtered);
    status.textContent = `Registros por fecha de agenda: ${formatInteger(filtered.length)}`;
  } finally {
    setLoading(false);
  }
}

document.getElementById('reload').addEventListener('click', () => {
  applyFilters().catch((error) => {
    document.getElementById('status').textContent = error.message;
    setLoading(false);
  });
});
bootstrap();
