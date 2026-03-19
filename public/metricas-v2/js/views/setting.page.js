const RESOURCE = 'setters';

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

function formatNumber(value) {
  return new Intl.NumberFormat('es-AR').format(Number(value || 0));
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

function uniqueValues(rows, key) {
  return [...new Set(rows.map((row) => row[key]).filter((v) => v !== null && v !== undefined && v !== ''))]
    .sort((a, b) => String(a).localeCompare(String(b)));
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

function getFilters() {
  return {
    anio: Number(document.getElementById('anio').value),
    mes: document.getElementById('mes').value ? Number(document.getElementById('mes').value) : null,
    setter: document.getElementById('setter').value || null
  };
}

function normalizeRows(rows) {
  return (rows || [])
    .filter((row) => Number.isInteger(Number(row.anio)) && Number.isInteger(Number(row.mes)) && Number(row.mes) >= 1 && Number(row.mes) <= 12)
    .map((row) => ({
      anio: Number(row.anio),
      mes: Number(row.mes),
      setter: String(row.setter || '').trim(),
      totales_ig: Number(row.totales_ig || 0),
      contactados: Number(row.contactados || 0),
      aplica_meg: Number(row.aplica_meg || 0),
      link_enviado_meg: Number(row.link_enviado_meg || 0),
      agendo: Number(row.agendo || 0),
      venta_meg: Number(row.venta_meg || 0),
      aplica_club: Number(row.aplica_club || 0),
      consideracion_club: Number(row.consideracion_club || 0),
      link_enviado_club: Number(row.link_enviado_club || 0),
      venta_club: Number(row.venta_club || 0),
      agendo_aplica_pct: Number(row.agendo_aplica_pct || 0)
    }));
}

function percentCell(value) {
  const clamped = Math.max(0, Math.min(100, Number(value || 0)));
  const alpha = 0.18 + (clamped / 100) * 0.56;
  return `<span class="setting-pct" style="background: rgba(30, 136, 229, ${alpha.toFixed(3)});">${formatPercent(value)}</span>`;
}

function rowMetrics(row) {
  const noContactados = row.totales_ig - row.contactados;
  const pctContactados = safeDiv(row.contactados * 100, row.totales_ig);
  const pctNoContactados = safeDiv(noContactados * 100, row.totales_ig);
  const pctAplicaMeg = safeDiv(row.aplica_meg * 100, row.contactados);
  const pctLinkMeg = safeDiv(row.link_enviado_meg * 100, row.aplica_meg);
  const pctAgendo = row.agendo_aplica_pct > 1 ? Number(row.agendo_aplica_pct) : Number(row.agendo_aplica_pct) * 100;
  const pctVentaMeg = safeDiv(row.venta_meg * 100, row.aplica_meg);
  const pctAplicaClub = safeDiv(row.aplica_club * 100, row.contactados);
  const pctConsideracion = safeDiv(row.consideracion_club * 100, row.aplica_club);
  const pctLinkClub = safeDiv(row.link_enviado_club * 100, row.consideracion_club);
  const pctVentaClub = safeDiv(row.venta_club * 100, row.aplica_club);

  return {
    noContactados,
    pctContactados,
    pctNoContactados,
    pctAplicaMeg,
    pctLinkMeg,
    pctAgendo,
    pctVentaMeg,
    pctAplicaClub,
    pctConsideracion,
    pctLinkClub,
    pctVentaClub
  };
}

function buildTable(rows) {
  const container = document.getElementById('tableContainer');

  if (!rows.length) {
    container.innerHTML = '<p>No hay datos para el filtro seleccionado.</p>';
    return;
  }

  const ordered = [...rows].sort((a, b) => {
    if (a.anio !== b.anio) return a.anio - b.anio;
    if (a.mes !== b.mes) return a.mes - b.mes;
    return a.setter.localeCompare(b.setter);
  });

  const totals = ordered.reduce((acc, row) => {
    acc.totales_ig += row.totales_ig;
    acc.contactados += row.contactados;
    acc.aplica_meg += row.aplica_meg;
    acc.link_enviado_meg += row.link_enviado_meg;
    acc.agendo += row.agendo;
    acc.venta_meg += row.venta_meg;
    acc.aplica_club += row.aplica_club;
    acc.consideracion_club += row.consideracion_club;
    acc.link_enviado_club += row.link_enviado_club;
    acc.venta_club += row.venta_club;
    return acc;
  }, {
    totales_ig: 0,
    contactados: 0,
    aplica_meg: 0,
    link_enviado_meg: 0,
    agendo: 0,
    venta_meg: 0,
    aplica_club: 0,
    consideracion_club: 0,
    link_enviado_club: 0,
    venta_club: 0
  });

  const totalNoContactados = totals.totales_ig - totals.contactados;
  const totalPctContactados = safeDiv(totals.contactados * 100, totals.totales_ig);
  const totalPctNoContactados = safeDiv(totalNoContactados * 100, totals.totales_ig);
  const totalPctAplicaMeg = safeDiv(totals.aplica_meg * 100, totals.contactados);
  const totalPctLinkMeg = safeDiv(totals.link_enviado_meg * 100, totals.aplica_meg);
  const totalPctAgendo = safeDiv(totals.agendo * 100, totals.aplica_meg);
  const totalPctVentaMeg = safeDiv(totals.venta_meg * 100, totals.aplica_meg);
  const totalPctAplicaClub = safeDiv(totals.aplica_club * 100, totals.contactados);
  const totalPctConsideracion = safeDiv(totals.consideracion_club * 100, totals.aplica_club);
  const totalPctLinkClub = safeDiv(totals.link_enviado_club * 100, totals.consideracion_club);
  const totalPctVentaClub = safeDiv(totals.venta_club * 100, totals.aplica_club);

  const dataRows = [
    {
      label: 'Mes',
      render: (row) => formatNumber(row.mes),
      total: ''
    },
    {
      label: 'Setter',
      render: (row) => row.setter,
      total: ''
    },
    {
      label: 'Totales IG',
      render: (row) => formatNumber(row.totales_ig),
      total: formatNumber(totals.totales_ig)
    },
    {
      label: 'Contactados',
      render: (row) => formatNumber(row.contactados),
      total: formatNumber(totals.contactados)
    },
    {
      label: '% Contactados',
      render: (row) => percentCell(rowMetrics(row).pctContactados),
      total: percentCell(totalPctContactados),
      isHtml: true
    },
    {
      label: 'No contactados',
      render: (row) => formatNumber(rowMetrics(row).noContactados),
      total: formatNumber(totalNoContactados)
    },
    {
      label: '% No contactados',
      render: (row) => percentCell(rowMetrics(row).pctNoContactados),
      total: percentCell(totalPctNoContactados),
      isHtml: true
    },
    {
      label: 'Aplica MEG',
      render: (row) => formatNumber(row.aplica_meg),
      total: formatNumber(totals.aplica_meg)
    },
    {
      label: '% Aplica MEG',
      render: (row) => percentCell(rowMetrics(row).pctAplicaMeg),
      total: percentCell(totalPctAplicaMeg),
      isHtml: true
    },
    {
      label: 'Link Enviado MEG',
      render: (row) => formatNumber(row.link_enviado_meg),
      total: formatNumber(totals.link_enviado_meg)
    },
    {
      label: '% Link enviado',
      render: (row) => percentCell(rowMetrics(row).pctLinkMeg),
      total: percentCell(totalPctLinkMeg),
      isHtml: true
    },
    {
      label: 'Agendo',
      render: (row) => formatNumber(row.agendo),
      total: formatNumber(totals.agendo)
    },
    {
      label: '% Agendo',
      render: (row) => percentCell(rowMetrics(row).pctAgendo),
      total: percentCell(totalPctAgendo),
      isHtml: true
    },
    {
      label: 'Venta MEG',
      render: (row) => formatNumber(row.venta_meg),
      total: formatNumber(totals.venta_meg)
    },
    {
      label: '% Venta MEG',
      render: (row) => percentCell(rowMetrics(row).pctVentaMeg),
      total: percentCell(totalPctVentaMeg),
      isHtml: true
    },
    {
      label: 'Aplica Club',
      render: (row) => formatNumber(row.aplica_club),
      total: formatNumber(totals.aplica_club)
    },
    {
      label: '% Aplica Club',
      render: (row) => percentCell(rowMetrics(row).pctAplicaClub),
      total: percentCell(totalPctAplicaClub),
      isHtml: true
    },
    {
      label: 'Consideración Club',
      render: (row) => formatNumber(row.consideracion_club),
      total: formatNumber(totals.consideracion_club)
    },
    {
      label: '% Consideración',
      render: (row) => percentCell(rowMetrics(row).pctConsideracion),
      total: percentCell(totalPctConsideracion),
      isHtml: true
    },
    {
      label: 'Link enviado Club',
      render: (row) => formatNumber(row.link_enviado_club),
      total: formatNumber(totals.link_enviado_club)
    },
    {
      label: '% Link enviado club',
      render: (row) => percentCell(rowMetrics(row).pctLinkClub),
      total: percentCell(totalPctLinkClub),
      isHtml: true
    },
    {
      label: 'Venta Club',
      render: (row) => formatNumber(row.venta_club),
      total: formatNumber(totals.venta_club)
    },
    {
      label: '% Venta Club',
      render: (row) => percentCell(rowMetrics(row).pctVentaClub),
      total: percentCell(totalPctVentaClub),
      isHtml: true
    }
  ];

  const headerCols = ordered
    .map(() => '<th></th>')
    .join('');

  const bodyRows = dataRows
    .map((rowDef) => {
      const cells = ordered
        .map((row) => `<td>${rowDef.render(row)}</td>`)
        .join('');

      const total = rowDef.isHtml ? rowDef.total : `<strong>${rowDef.total}</strong>`;
      return `
        <tr>
          <td><strong>${rowDef.label}</strong></td>
          ${cells}
          <td>${total}</td>
        </tr>
      `;
    })
    .join('');

  container.innerHTML = `
    <div class="table-wrap">
      <table class="setting-table">
        <thead>
          <tr>
            <th></th>
            ${headerCols}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
  `;
}

async function initFilters() {
  const status = document.getElementById('status');
  status.textContent = 'Cargando filtros...';

  const response = await window.metricasApi.fetchRows(RESOURCE, {
    limit: 5000,
    orderBy: 'anio',
    orderDir: 'desc'
  });

  const rows = normalizeRows(response.rows || []);
  const current = getCurrentPeriod();

  const years = uniqueValues(rows, 'anio')
    .map((y) => Number(y))
    .filter((y) => Number.isInteger(y) && y >= 2000)
    .sort((a, b) => b - a);

  const setters = uniqueValues(rows, 'setter');
  const defaultYear = years.includes(current.year) ? current.year : years[0];

  setOptions('anio', years, defaultYear);
  setOptions('mes', MONTHS, '', true);
  setOptions('setter', setters, '', true);
}

async function loadSetting() {
  const status = document.getElementById('status');
  const filters = getFilters();
  status.textContent = `Cargando ${RESOURCE}...`;

  try {
    if (!Number.isInteger(filters.anio) || filters.anio < 2000) {
      status.textContent = 'Seleccioná un año válido.';
      return;
    }

    const query = {
      limit: 5000,
      orderBy: 'mes',
      orderDir: 'asc',
      eq_anio: filters.anio
    };

    if (filters.mes) query.eq_mes = filters.mes;
    if (filters.setter) query.eq_setter = filters.setter;

    const response = await window.metricasApi.fetchRows(RESOURCE, query);
    const rows = normalizeRows(response.rows || []);

    buildTable(rows);
    status.textContent = `Filas: ${rows.length} | Año ${filters.anio}${filters.mes ? ` | Mes ${filters.mes}` : ''}${filters.setter ? ` | Setter ${filters.setter}` : ''}`;
  } catch (error) {
    status.textContent = error.message;
  }
}

async function initPage() {
  await initFilters();
  await loadSetting();
}

document.getElementById('reload').addEventListener('click', loadSetting);
initPage();
