(function initMisComprobantesPage() {
  const api = window.metricasApi;
  if (!api) return;

  const state = {
    ownerName: '',
    canViewAll: false,
    selectedResponsible: '',
    responsibleOptions: [],
    rows: [],
    filteredRows: []
  };

  const refs = {
    hint: document.getElementById('misComprobantesHint'),
    status: document.getElementById('misComprobantesStatus'),
    summary: document.getElementById('misComprobantesSummary'),
    table: document.getElementById('misComprobantesTable'),
    reload: document.getElementById('reloadMisComprobantes'),
    month: document.getElementById('misComprobantesMonth'),
    responsibleFilter: document.getElementById('misComprobantesResponsibleFilter'),
    reconciliationFilter: document.getElementById('misComprobantesReconciliationFilter'),
    clubFilter: document.getElementById('misComprobantesClubFilter'),
    search: document.getElementById('misComprobantesSearch'),
    ownerChip: document.getElementById('misComprobantesOwnerChip')
  };

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  function parseNumber(value) {
    const numeric = Number(value || 0);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  function resolveCashUsd(row) {
    const tc = parseNumber(row?.tc);
    const cashAr = parseNumber(row?.cash_collected_ar || row?.cash_collected_ars);
    if (cashAr > 0 && tc > 0) return cashAr / tc;
    return parseNumber(row?.cash_collected);
  }

  function formatCurrency(value, currency = 'USD') {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2
    }).format(parseNumber(value));
  }

  function formatDate(value) {
    const text = String(value || '').slice(0, 10);
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return '—';
    return `${match[3]}/${match[2]}/${match[1]}`;
  }

  function toMonthValue(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  function getRowDateValue(row) {
    return String(row.f_venta || row.f_acreditacion || row.fecha_creado || row.created_at || '').slice(0, 10);
  }

  function getRowMonthValue(row) {
    const dateValue = getRowDateValue(row);
    return /^\d{4}-\d{2}-\d{2}$/.test(dateValue) ? dateValue.slice(0, 7) : '';
  }

  function ensureDefaultMonth() {
    if (!refs.month) return;
    if (!refs.month.value) {
      refs.month.value = toMonthValue();
    }
  }

  function renderDetailCell(label, ghlId) {
    return window.metricasGhl?.renderContactCell(label, ghlId) || escapeHtml(label || 'Sin nombre');
  }

  function isClubRow(row) {
    return normalizeText(row?.producto_format).includes('club');
  }

  function isConciliatedRow(row) {
    const status = normalizeText(row?.estado);
    if (!status) return false;
    if (status.includes('sin conciliar')) return false;
    return status.includes('concili');
  }

  function getReconciliationLabel(value) {
    if (value === 'conciliated') return 'Conciliadas';
    if (value === 'not_conciliated') return 'No conciliadas';
    return 'Todas';
  }

  function renderResponsibleFilter() {
    if (!refs.responsibleFilter) return;
    if (!state.canViewAll) {
      refs.responsibleFilter.hidden = true;
      return;
    }

    const options = ['<option value="">Todos los responsables</option>']
      .concat(
        state.responsibleOptions.map((name) => (
          `<option value="${escapeHtml(name)}" ${normalizeText(name) === normalizeText(state.selectedResponsible) ? 'selected' : ''}>${escapeHtml(name)}</option>`
        ))
      );

    refs.responsibleFilter.innerHTML = options.join('');
    refs.responsibleFilter.hidden = false;
  }

  function filterRows() {
    const query = normalizeText(refs.search?.value || '');
    const selectedMonth = String(refs.month?.value || '').trim();
    const reconciliationMode = String(refs.reconciliationFilter?.value || 'all').trim();
    const selectedClubMode = String(refs.clubFilter?.value || 'all').trim();
    state.filteredRows = state.rows.filter((row) => {
      if (selectedMonth && getRowMonthValue(row) !== selectedMonth) return false;
      if (reconciliationMode === 'conciliated' && !isConciliatedRow(row)) return false;
      if (reconciliationMode === 'not_conciliated' && isConciliatedRow(row)) return false;
      if (selectedClubMode === 'exclude' && isClubRow(row)) return false;
      if (selectedClubMode === 'only' && !isClubRow(row)) return false;
      if (!query) return true;
      return [
        row.cliente_format,
        row.ghlid,
        row.producto_format,
        row.tipo
      ].some((value) => normalizeText(value).includes(query));
    });
  }

  function renderSummary() {
    refs.summary.hidden = false;
    const totalFacturacion = state.filteredRows.reduce((sum, row) => sum + parseNumber(row.facturacion), 0);
    const totalCashUsd = state.filteredRows.reduce((sum, row) => sum + resolveCashUsd(row), 0);
    const totalCashArs = state.filteredRows.reduce((sum, row) => sum + parseNumber(row.cash_collected_ars), 0);

    refs.summary.innerHTML = `
      <article class="mis-comprobantes-summary-card">
        <span>Comprobantes</span>
        <strong>${escapeHtml(String(state.filteredRows.length))}</strong>
      </article>
      <article class="mis-comprobantes-summary-card">
        <span>Facturación USD</span>
        <strong>${escapeHtml(formatCurrency(totalFacturacion, 'USD'))}</strong>
      </article>
      <article class="mis-comprobantes-summary-card">
        <span>Cash USD</span>
        <strong>${escapeHtml(formatCurrency(totalCashUsd, 'USD'))}</strong>
      </article>
      <article class="mis-comprobantes-summary-card">
        <span>Cash ARS</span>
        <strong>${escapeHtml(formatCurrency(totalCashArs, 'ARS'))}</strong>
      </article>
    `;
  }

  function renderTable() {
    if (!state.filteredRows.length) {
      refs.table.innerHTML = '<div class="table-wrap csm-table-wrap"><div class="report-empty">No encontré comprobantes para ese filtro.</div></div>';
      return;
    }

    refs.table.innerHTML = `
      <div class="table-wrap csm-table-wrap">
        <table class="csm-table mis-comprobantes-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Responsable de venta</th>
              <th>Tipo</th>
              <th>Producto</th>
              <th>Fecha</th>
              <th>Facturación USD</th>
              <th>Cash USD</th>
              <th>Cash ARS</th>
              <th>Estado</th>
              <th>GHL ID</th>
            </tr>
          </thead>
          <tbody>
            ${state.filteredRows.map((row) => `
              <tr>
                <td>${renderDetailCell(row.cliente_format || 'Sin nombre', row.ghlid || '')}</td>
                <td>${escapeHtml(row.responsable_venta || row.creado_por || '-')}</td>
                <td>${escapeHtml(row.tipo || '-')}</td>
                <td>${escapeHtml(row.producto_format || '-')}</td>
                <td>${escapeHtml(formatDate(row.f_venta || row.f_acreditacion || row.fecha_creado || row.created_at))}</td>
                <td>${escapeHtml(row.facturacion ? formatCurrency(row.facturacion, 'USD') : '-')}</td>
                <td>${escapeHtml(resolveCashUsd(row) ? formatCurrency(resolveCashUsd(row), 'USD') : '-')}</td>
                <td>${escapeHtml((row.cash_collected_ar || row.cash_collected_ars) ? formatCurrency(row.cash_collected_ar || row.cash_collected_ars, 'ARS') : '-')}</td>
                <td>${escapeHtml(row.estado || 'Sin estado')}</td>
                <td>${escapeHtml(row.ghlid || '-')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderAll() {
    filterRows();
    renderSummary();
    renderTable();
    const selectedMonth = String(refs.month?.value || '').trim();
    const reconciliationLabel = getReconciliationLabel(String(refs.reconciliationFilter?.value || 'all').trim());
    const clubLabel = refs.clubFilter?.selectedOptions?.[0]?.textContent || 'Todos';
    const scopeLabel = state.canViewAll
      ? (state.selectedResponsible ? state.selectedResponsible : 'todos los responsables')
      : (state.ownerName || 'tu usuario');
    refs.hint.textContent = `${state.filteredRows.length} comprobantes visibles para ${scopeLabel}${selectedMonth ? ` en ${selectedMonth}` : ''}. Conciliación: ${reconciliationLabel}. Club: ${clubLabel}.`;
    refs.status.hidden = true;
  }

  async function loadPage() {
    refs.status.hidden = false;
    refs.status.querySelector('span').textContent = 'Cargando comprobantes...';
    refs.reload.disabled = true;

    try {
      const response = await api.fetchMyComprobantes({
        limit: 1000,
        responsible: state.canViewAll ? (refs.responsibleFilter?.value || '') : ''
      });
      state.ownerName = String(response?.responsibleName || '').trim();
      state.canViewAll = response?.canViewAll === true;
      state.selectedResponsible = String(response?.selectedResponsible || '').trim();
      state.responsibleOptions = Array.isArray(response?.responsibleOptions) ? response.responsibleOptions : [];
      refs.ownerChip.textContent = state.canViewAll
        ? `Vista global: ${state.selectedResponsible || 'todos'}`
        : `Responsable: ${state.ownerName || 'sin asignar'}`;
      renderResponsibleFilter();
      state.rows = (response?.rows || [])
        .sort((left, right) => String(right.fecha_creado || right.created_at || '').localeCompare(String(left.fecha_creado || left.created_at || '')));

      renderAll();
    } catch (error) {
      refs.status.hidden = false;
      refs.status.querySelector('span').textContent = error.message || 'No pude cargar tus comprobantes.';
      refs.summary.hidden = true;
      refs.table.innerHTML = '<div class="table-wrap csm-table-wrap"><div class="report-empty">No pude cargar tus comprobantes.</div></div>';
    } finally {
      refs.reload.disabled = false;
    }
  }

  refs.reload?.addEventListener('click', loadPage);
  refs.responsibleFilter?.addEventListener('change', loadPage);
  refs.month?.addEventListener('change', renderAll);
  refs.reconciliationFilter?.addEventListener('change', renderAll);
  refs.clubFilter?.addEventListener('change', renderAll);
  refs.search?.addEventListener('input', renderAll);

  ensureDefaultMonth();
  loadPage();
})();
