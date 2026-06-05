(function initMagReporteClosersPage() {
  const RESOURCE = 'agenda_detalle_por_origen_closer';
  const EXCLUDED_CLOSERS = ['sin closer', 'nahuel', 'shirlet', 'shirley'];
  const COLORS = ['#4B8EF5', '#2DD4A0', '#F59E0B', '#A78BFA', '#F472B6', '#34D399', '#F97316', '#06B6D4'];
  const CLOSER_ALIAS_MAP = {
    'pablo butera': 'Pablo Butera',
    'pablo butera vie': 'Pablo Butera',
    'nahuel iasci': 'Nahuel Iasci'
  };

  function normalizeText(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  function canonicalizeCloserName(value) {
    const text = String(value || '').trim();
    if (!text) return text;
    return CLOSER_ALIAS_MAP[normalizeText(text)] || text;
  }

  function resolveResponsibleCloser(row = {}) {
    return canonicalizeCloserName(row.responsable_venta || row.closer);
  }

  function shouldIncludeCloser(value) {
    const normalized = normalizeText(value);
    if (!normalized) return false;
    return !EXCLUDED_CLOSERS.some((term) => normalized.includes(term));
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
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
    return `${Number(value || 0).toFixed(1).replace('.', ',')}%`;
  }

  function formatMonthLabel(monthValue) {
    const [year, month] = String(monthValue || '').split('-').map(Number);
    if (!year || !month) return '';
    const date = new Date(year, month - 1, 1);
    return new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(date);
  }

  function getCurrentMonthValue() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  function parseMonthValue(value) {
    const [year, month] = String(value || '').split('-').map(Number);
    return {
      year: Number.isInteger(year) ? year : 0,
      month: Number.isInteger(month) ? month : 0
    };
  }

  function getColor(index) {
    return COLORS[index % COLORS.length];
  }

  function safeDiv(numerator, denominator) {
    return denominator > 0 ? numerator / denominator : 0;
  }

  function normalizeRows(rows) {
    return (rows || [])
      .map((row) => ({
        ...row,
        closer: resolveResponsibleCloser(row),
        anio: Number(row.anio || 0),
        mes: Number(row.mes || 0),
        total_agendados: Number(row.total_agendados ?? row.total_leads ?? 0),
        total_aplica: Number(row.total_aplica || 0),
        total_respondio: Number(row.total_respondio || 0),
        total_confirmo: Number(row.total_confirmo || 0),
        total_cancelado: Number(row.total_cancelado || 0),
        total_no_asistidas: Number(row.total_no_asistidas || 0),
        total_pendientes: Number(row.total_pendientes || 0),
        total_efectuadas: Number(row.total_efectuadas || 0),
        total_ventas: Number(row.total_ventas || 0),
        total_paid_upfront: Number(row.total_paid_upfront || 0),
        ccne: Number(row.ccne || 0),
        ccne_efectuadas: Number(row.ccne_efectuadas || 0),
        ccne_vendidas: Number(row.ccne_vendidas || 0),
        cce: Number(row.cce || 0),
        cce_llamada: Number(row.cce_llamada || 0),
        cce_llamada_efectuadas: Number(row.cce_llamada_efectuadas || 0),
        cce_llamada_vendidas: Number(row.cce_llamada_vendidas || 0),
        cce_whatsapp: Number(row.cce_whatsapp || 0),
        cce_whatsapp_efectuadas: Number(row.cce_whatsapp_efectuadas || 0),
        cce_whatsapp_vendidas: Number(row.cce_whatsapp_vendidas || 0),
        cce_efectuadas: Number(row.cce_efectuadas || 0),
        cce_vendidas: Number(row.cce_vendidas || 0),
        facturacion_total_mes: Number(row.facturacion_total_mes ?? row.facturacion_total ?? 0),
        facturacion_f_agenda: Number(row.facturacion_f_agenda || 0),
        cash_collected_real_mes: Number(row.cash_collected_real_mes ?? row.cash_collected_total ?? 0),
        cash_collected_otros_meses: Number(row.cash_collected_otros_meses || 0),
        cash_collected_agendas_mes: Number(row.cash_collected_agendas_mes ?? row.cash_collected_agenda ?? 0)
      }))
      .filter((row) => row.anio > 0 && row.mes > 0 && shouldIncludeCloser(row.closer));
  }

  function aggregateByCloser(rows) {
    const map = new Map();

    (rows || []).forEach((row) => {
      const closer = String(row.closer || '').trim();
      if (!closer) return;

      if (!map.has(closer)) {
        map.set(closer, {
          closer,
          agendas: 0,
          aplicables: 0,
          respuesta: 0,
          confirmados: 0,
          canceladas: 0,
          noAsistidas: 0,
          pendientes: 0,
          efectuadas: 0,
          ventas: 0,
          paidUpfront: 0,
          ccne: 0,
          ccneEfectuadas: 0,
          ccneVendidas: 0,
          cce: 0,
          cceLlamada: 0,
          cceLlamadaEfectuadas: 0,
          cceLlamadaVendidas: 0,
          cceWhatsapp: 0,
          cceWhatsappEfectuadas: 0,
          cceWhatsappVendidas: 0,
          cceEfectuadas: 0,
          cceVendidas: 0,
          facturacionTotalMes: 0,
          facturacionAgenda: 0,
          cashRealMes: 0,
          cashOtrosMeses: 0,
          cashAgendasMes: 0
        });
      }

      const current = map.get(closer);
      current.agendas += row.total_agendados;
      current.aplicables += row.total_aplica;
      current.respuesta += row.total_respondio;
      current.confirmados += row.total_confirmo;
      current.canceladas += row.total_cancelado;
      current.noAsistidas += row.total_no_asistidas;
      current.pendientes += row.total_pendientes;
      current.efectuadas += row.total_efectuadas;
      current.ventas += row.total_ventas;
      current.paidUpfront += row.total_paid_upfront;
      current.ccne += row.ccne;
      current.ccneEfectuadas += row.ccne_efectuadas;
      current.ccneVendidas += row.ccne_vendidas;
      current.cce += row.cce;
      current.cceLlamada += row.cce_llamada;
      current.cceLlamadaEfectuadas += row.cce_llamada_efectuadas;
      current.cceLlamadaVendidas += row.cce_llamada_vendidas;
      current.cceWhatsapp += row.cce_whatsapp;
      current.cceWhatsappEfectuadas += row.cce_whatsapp_efectuadas;
      current.cceWhatsappVendidas += row.cce_whatsapp_vendidas;
      current.cceEfectuadas += row.cce_efectuadas;
      current.cceVendidas += row.cce_vendidas;
      current.facturacionTotalMes += row.facturacion_total_mes;
      current.facturacionAgenda += row.facturacion_f_agenda;
      current.cashRealMes += row.cash_collected_real_mes;
      current.cashOtrosMeses += row.cash_collected_otros_meses;
      current.cashAgendasMes += row.cash_collected_agendas_mes;
    });

    return [...map.values()].map((row) => ({
      ...row,
      cierrePct: safeDiv(row.ventas * 100, row.agendas),
      ventasSobreAsistidasPct: safeDiv(row.ventas * 100, row.efectuadas),
      noAsistidasPct: safeDiv(row.noAsistidas * 100, row.aplicables),
      cashPorAgenda: safeDiv(row.cashAgendasMes, row.agendas),
      cashPorReunion: safeDiv(row.cashAgendasMes, row.efectuadas),
      ticketPromedio: safeDiv(row.facturacionAgenda, row.ventas),
      cashPorVenta: safeDiv(row.cashAgendasMes, row.ventas),
      cashSobreFacturacionPct: safeDiv(row.cashAgendasMes * 100, row.facturacionAgenda),
      cierresSobreAsistidasPct: safeDiv(row.ventas * 100, row.efectuadas),
      paidUpfrontPct: safeDiv(row.paidUpfront * 100, row.facturacionTotalMes),
      cceLlamadaPct: safeDiv(row.cceLlamada * 100, row.aplicables),
      cceWhatsappPct: safeDiv(row.cceWhatsapp * 100, row.aplicables)
    })).sort((a, b) => {
      const diff = b.cashAgendasMes - a.cashAgendasMes;
      if (diff !== 0) return diff;
      return a.closer.localeCompare(b.closer, 'es');
    });
  }

  function summarizeRows(rows) {
    return rows.reduce((acc, row) => {
      acc.agendas += row.agendas;
      acc.ventas += row.ventas;
      acc.aplicables += row.aplicables;
      acc.efectuadas += row.efectuadas;
      acc.noAsistidas += row.noAsistidas;
      acc.facturacionAgenda += row.facturacionAgenda;
      acc.cashAgendasMes += row.cashAgendasMes;
      acc.cashRealMes += row.cashRealMes;
      acc.cashOtrosMeses += row.cashOtrosMeses;
      acc.facturacionTotalMes += row.facturacionTotalMes;
      acc.paidUpfront += row.paidUpfront;
      return acc;
    }, {
      agendas: 0,
      ventas: 0,
      aplicables: 0,
      efectuadas: 0,
      noAsistidas: 0,
      facturacionAgenda: 0,
      cashAgendasMes: 0,
      cashRealMes: 0,
      cashOtrosMeses: 0,
      facturacionTotalMes: 0,
      paidUpfront: 0
    });
  }

  function buildHeaderMetrics(summary, monthLabel) {
    const cards = [
      { label: 'Mes', value: monthLabel || 'Sin mes' },
      { label: 'Agendas', value: formatInteger(summary.agendas) },
      { label: 'Ventas', value: formatInteger(summary.ventas) },
      { label: 'Cash Agendas Mes', value: formatCurrency(summary.cashAgendasMes) },
      { label: 'Facturación por agenda', value: formatCurrency(summary.facturacionAgenda) },
      { label: 'Efectividad cobro', value: formatPercent(safeDiv(summary.cashAgendasMes * 100, summary.facturacionAgenda)) },
      { label: 'Tasa cierre', value: formatPercent(safeDiv(summary.ventas * 100, summary.agendas)) }
    ];

    return cards.map((card) => `
      <article class="header-chip">
        <div class="header-chip-label">${card.label}</div>
        <div class="header-chip-value">${card.value}</div>
      </article>
    `).join('');
  }

  function buildPodio(rows) {
    if (!rows.length) {
      return '<div class="empty-state">No hay datos para ese mes.</div>';
    }

    return rows.slice(0, 4).map((row, index) => `
      <article class="podio-card">
        <div class="rank-badge"># ${index + 1} · ${index === 0 ? 'Top cash agenda' : 'Ranking mensual'}</div>
        <div class="podio-name">${escapeHtml(row.closer)}</div>
        <div class="podio-stat"><span>Cash Agendas Mes</span><strong>${formatCurrency(row.cashAgendasMes)}</strong></div>
        <div class="podio-stat"><span>Facturación por agenda</span><strong>${formatCurrency(row.facturacionAgenda)}</strong></div>
        <div class="podio-stat"><span>Agendas</span><strong>${formatInteger(row.agendas)}</strong></div>
        <div class="podio-stat"><span>Ventas</span><strong>${formatInteger(row.ventas)}</strong></div>
        <div class="podio-stat"><span>Tasa cierre</span><strong>${formatPercent(row.cierrePct)}</strong></div>
      </article>
    `).join('');
  }

  function buildTable(rows) {
    if (!rows.length) {
      return '<div class="empty-state">No hay datos para mostrar en este mes.</div>';
    }

    const body = rows.map((row, index) => `
      <tr>
        <td>
          <div class="closer-cell">
            <span class="cdot" style="background:${getColor(index)}"></span>
            <span>${escapeHtml(row.closer)}</span>
          </div>
        </td>
        <td class="r">${formatInteger(row.agendas)}</td>
        <td class="r">${formatInteger(row.aplicables)}</td>
        <td class="r">${formatInteger(row.efectuadas)}</td>
        <td class="r">${formatInteger(row.noAsistidas)} <span style="color:var(--muted)">(${formatPercent(row.noAsistidasPct)})</span></td>
        <td class="r">${formatInteger(row.ventas)}</td>
        <td class="r">${formatPercent(row.cierrePct)}</td>
        <td class="r">${formatCurrency(row.paidUpfront)}</td>
        <td class="r">${formatPercent(row.paidUpfrontPct)}</td>
        <td class="r">${formatInteger(row.ccne)}</td>
        <td class="r">${formatInteger(row.cceLlamada)}</td>
        <td class="r">${formatInteger(row.cceWhatsapp)}</td>
        <td class="r">${formatCurrency(row.facturacionAgenda)}</td>
        <td class="r">${formatCurrency(row.cashAgendasMes)}</td>
        <td class="r">${formatCurrency(row.cashOtrosMeses)}</td>
        <td class="r">${formatCurrency(row.cashRealMes)}</td>
        <td class="r">${formatPercent(row.cashSobreFacturacionPct)}</td>
        <td class="r">${formatCurrency(row.cashPorAgenda)}</td>
      </tr>
    `).join('');

    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Closer</th>
              <th class="r">Agendas</th>
              <th class="r">Aplicables</th>
              <th class="r">Efectuadas</th>
              <th class="r">No asistidas</th>
              <th class="r">Ventas</th>
              <th class="r">Tasa cierre</th>
              <th class="r">Paid Upfront</th>
              <th class="r">% Paid Upfront</th>
              <th class="r">CCNE</th>
              <th class="r">CCE llamada</th>
              <th class="r">CCE WhatsApp</th>
              <th class="r">Facturación agenda</th>
              <th class="r">Cash Agendas Mes</th>
              <th class="r">Cash Otros Meses</th>
              <th class="r">Cash Real Mes</th>
              <th class="r">% Cobro agenda</th>
              <th class="r">Cash / agenda</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    `;
  }

  function buildChartCard(title, rows, getValue, formatter, colorResolver) {
    if (!rows.length) {
      return `<article class="chart-card"><h3>${title}</h3><div class="empty-state">Sin datos.</div></article>`;
    }

    const max = Math.max(...rows.map((row) => Number(getValue(row) || 0)), 0);
    const body = rows.map((row, index) => {
      const value = Number(getValue(row) || 0);
      const width = max > 0 ? (value / max) * 100 : 0;
      return `
        <div class="bar-row">
          <div class="bar-head">
            <span>${escapeHtml(row.closer)}</span>
            <span>${formatter(value)}</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${width}%;background:${colorResolver(row, index)}"></div>
          </div>
        </div>
      `;
    }).join('');

    return `<article class="chart-card"><h3>${title}</h3>${body}</article>`;
  }

  function renderCharts(rows) {
    const topByCashAgenda = [...rows].sort((a, b) => b.cashAgendasMes - a.cashAgendasMes).slice(0, 6);
    const topByAgenda = [...rows].sort((a, b) => b.cashPorAgenda - a.cashPorAgenda).slice(0, 6);
    const byNoShow = [...rows].sort((a, b) => a.noAsistidasPct - b.noAsistidasPct).slice(0, 6);
    const byCollection = [...rows].sort((a, b) => b.cashSobreFacturacionPct - a.cashSobreFacturacionPct).slice(0, 6);

    return [
      buildChartCard('Cash Agendas Mes', topByCashAgenda, (row) => row.cashAgendasMes, (value) => formatCurrency(value), (_, index) => getColor(index)),
      buildChartCard('Cash por agenda', topByAgenda, (row) => row.cashPorAgenda, (value) => formatCurrency(value), (_, index) => getColor(index)),
      buildChartCard('% No asistidas', byNoShow, (row) => row.noAsistidasPct, (value) => formatPercent(value), (_, index) => getColor(index)),
      buildChartCard('% Cobro sobre facturación agenda', byCollection, (row) => row.cashSobreFacturacionPct, (value) => formatPercent(value), (_, index) => getColor(index))
    ].join('');
  }

  async function fetchMonthRows(monthValue) {
    const { year, month } = parseMonthValue(monthValue);
    const response = await window.metricasApi.fetchAllRows(RESOURCE, {
      limit: 1000,
      orderBy: 'mes',
      orderDir: 'asc',
      eq_anio: year
    });

    return normalizeRows(response.rows || []).filter((row) => row.anio === year && row.mes === month);
  }

  function switchTab(nextTab) {
    document.querySelectorAll('.closers-report-page .tb').forEach((button) => {
      button.classList.toggle('active', button.dataset.tab === nextTab);
    });
    document.querySelectorAll('.closers-report-page .tab-content').forEach((section) => {
      section.classList.toggle('active', section.id === `tab-${nextTab}`);
    });
  }

  function syncPersonalFrameMonth(monthValue) {
    const frame = document.getElementById('personalReportFrame');
    if (!frame) return;
    const nextUrl = new URL(frame.getAttribute('src') || '/metricas/views/mag-reportes-personales.html?embed=1', window.location.origin);
    nextUrl.searchParams.set('embed', '1');
    nextUrl.searchParams.set('month', monthValue);
    const nextSrc = `${nextUrl.pathname}${nextUrl.search}`;
    if (frame.getAttribute('src') !== nextSrc) {
      frame.setAttribute('src', nextSrc);
    }
  }

  async function loadReport() {
    const monthInput = document.getElementById('monthFilter');
    const status = document.getElementById('reportStatus');
    const headerMetrics = document.getElementById('headerMetrics');
    const podioGrid = document.getElementById('podioGrid');
    const tableContainer = document.getElementById('tableContainer');
    const chartsGrid = document.getElementById('chartsGrid');

    const monthValue = monthInput.value;
    const monthLabel = formatMonthLabel(monthValue);
    status.textContent = 'Cargando reporte de closers...';
    syncPersonalFrameMonth(monthValue);

    try {
      const fetchedRows = await fetchMonthRows(monthValue);
      const rows = aggregateByCloser(fetchedRows);
      const summary = summarizeRows(rows);

      headerMetrics.innerHTML = buildHeaderMetrics(summary, monthLabel);
      podioGrid.innerHTML = buildPodio(rows);
      tableContainer.innerHTML = buildTable(rows);
      chartsGrid.innerHTML = renderCharts(rows);
      status.textContent = `Datos cargados para ${monthLabel} usando la misma base mensual de Agendas Totales.`;
    } catch (error) {
      console.error(error);
      headerMetrics.innerHTML = '';
      podioGrid.innerHTML = '<div class="empty-state">No pude cargar el ranking del mes.</div>';
      tableContainer.innerHTML = '<div class="empty-state">No pude cargar la tabla del reporte.</div>';
      chartsGrid.innerHTML = '<div class="empty-state">No pude cargar las comparativas.</div>';
      status.textContent = error?.message || 'No pude cargar el reporte.';
    }
  }

  document.getElementById('monthFilter').value = getCurrentMonthValue();
  document.getElementById('reloadReport').addEventListener('click', loadReport);
  document.querySelectorAll('.closers-report-page .tb').forEach((button) => {
    button.addEventListener('click', () => switchTab(button.dataset.tab));
  });

  loadReport();
})();
