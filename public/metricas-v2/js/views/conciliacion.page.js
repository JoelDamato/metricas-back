(function initConciliacionPage() {
  const api = window.metricasApi;
  if (!api) return;

  const state = {
    rows: [],
    baseFilteredRows: [],
    filteredRows: [],
    statusFilter: 'all',
    savingIds: new Set()
  };

  const refs = {
    totalChip: document.getElementById('conciliacionTotalChip'),
    tabs: document.getElementById('conciliacionTabs'),
    hint: document.getElementById('conciliacionHint'),
    status: document.getElementById('conciliacionStatus'),
    summary: document.getElementById('conciliacionSummary'),
    table: document.getElementById('conciliacionTable'),
    responsible: document.getElementById('conciliacionResponsibleFilter'),
    month: document.getElementById('conciliacionMonth'),
    club: document.getElementById('conciliacionClubFilter'),
    search: document.getElementById('conciliacionSearch'),
    reload: document.getElementById('reloadConciliacion')
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
    const number = Number(value || 0);
    return Number.isFinite(number) ? number : 0;
  }

  function resolveCashAr(row) {
    return parseNumber(row?.cash_ar ?? row?.cash_collected_ar ?? row?.cash_collected_ars);
  }

  function resolveCashUsd(row) {
    const tc = parseNumber(row?.tc);
    const cashAr = resolveCashAr(row);
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
    const date = String(value || '').slice(0, 10);
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : '—';
  }

  function reconciliationState(row) {
    const status = normalizeText(row?.estado);
    if (status.includes('rebot')) return 'bounced';
    if (status.includes('concili') && !status.includes('sin conciliar')) return 'conciliated';
    return 'not_conciliated';
  }

  function stateLabel(value) {
    if (value === 'conciliated') return 'Conciliado';
    if (value === 'bounced') return 'Rebotado';
    return 'No conciliado';
  }

  function stateBadge(value) {
    return `<span class="conciliacion-state-badge is-${escapeHtml(value)}">${escapeHtml(stateLabel(value))}</span>`;
  }

  function currentMonthValue(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  function rowMonth(row) {
    const date = String(row?.f_acreditacion || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(0, 7) : '';
  }

  function isClubRow(row) {
    return normalizeText(row?.producto_format).includes('club');
  }

  function renderContact(row) {
    const name = row.cliente_format || 'Sin nombre';
    return window.metricasGhl?.renderContactCell(name, row.ghlid || '') || escapeHtml(name);
  }

  function populateResponsibleFilter() {
    const selected = refs.responsible.value;
    const names = [...new Set(
      state.rows
        .map((row) => String(row.responsable_venta || row.creado_por || '').trim())
        .filter(Boolean)
    )].sort((left, right) => left.localeCompare(right, 'es'));
    refs.responsible.innerHTML = [
      '<option value="">Todos los responsables</option>',
      ...names.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
    ].join('');
    refs.responsible.value = names.includes(selected) ? selected : '';
  }

  function filteredStatusCounts(rows) {
    return rows.reduce((counts, row) => {
      counts.all += 1;
      counts[reconciliationState(row)] += 1;
      return counts;
    }, { all: 0, conciliated: 0, not_conciliated: 0, bounced: 0 });
  }

  function applyFilters() {
    const query = normalizeText(refs.search.value);
    const month = refs.month.value;
    const responsible = normalizeText(refs.responsible.value);
    const clubMode = refs.club.value;

    state.baseFilteredRows = state.rows.filter((row) => {
      if (month && rowMonth(row) !== month) return false;
      if (responsible && normalizeText(row.responsable_venta || row.creado_por) !== responsible) return false;
      if (clubMode === 'only' && !isClubRow(row)) return false;
      if (clubMode === 'exclude' && isClubRow(row)) return false;
      if (!query) return true;
      return [
        row.cliente_format,
        row.ghlid,
        row.producto_format,
        row.responsable_venta,
        row.creado_por,
        row.setter,
        row.tipo,
        row.medios_de_pago_format
      ].some((value) => normalizeText(value).includes(query));
    });

    state.filteredRows = state.statusFilter === 'all'
      ? state.baseFilteredRows
      : state.baseFilteredRows.filter((row) => reconciliationState(row) === state.statusFilter);
  }

  function renderTabs() {
    const counts = filteredStatusCounts(state.baseFilteredRows);
    refs.tabs.querySelectorAll('[data-status-filter]').forEach((button) => {
      const value = button.dataset.statusFilter;
      const active = value === state.statusFilter;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
      const count = button.querySelector('[data-status-count]');
      if (count) count.textContent = String(counts[value] || 0);
    });
  }

  function renderSummary() {
    const counts = filteredStatusCounts(state.baseFilteredRows);
    refs.summary.hidden = false;
    refs.summary.innerHTML = `
      <article class="mis-comprobantes-summary-card"><span>Total</span><strong>${counts.all}</strong></article>
      <article class="mis-comprobantes-summary-card"><span>Conciliados</span><strong>${counts.conciliated}</strong></article>
      <article class="mis-comprobantes-summary-card"><span>No conciliados</span><strong>${counts.not_conciliated}</strong></article>
      <article class="mis-comprobantes-summary-card"><span>Rebotados</span><strong>${counts.bounced}</strong></article>
    `;
  }

  function stateOptions(selected) {
    return [
      ['not_conciliated', 'No conciliado'],
      ['conciliated', 'Conciliado'],
      ['bounced', 'Rebotado']
    ].map(([value, label]) => (
      `<option value="${value}"${value === selected ? ' selected' : ''}>${label}</option>`
    )).join('');
  }

  function renderTable() {
    if (!state.filteredRows.length) {
      refs.table.innerHTML = '<div class="table-wrap csm-table-wrap"><div class="report-empty">No hay comprobantes para los filtros elegidos.</div></div>';
      return;
    }

    refs.table.innerHTML = `
      <div class="table-wrap csm-table-wrap conciliacion-table-wrap">
        <table class="csm-table mis-comprobantes-table conciliacion-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Responsable</th>
              <th>Tipo</th>
              <th>Producto</th>
              <th>Acreditación</th>
              <th>Medio</th>
              <th>Facturación USD</th>
              <th>Cash USD</th>
              <th>Cash AR</th>
              <th>Estado actual</th>
              <th>Cambiar estado</th>
              <th>Origen</th>
            </tr>
          </thead>
          <tbody>
            ${state.filteredRows.map((row) => {
              const currentState = reconciliationState(row);
              const saving = state.savingIds.has(row.id);
              return `
                <tr data-conciliacion-row="${escapeHtml(row.id)}">
                  <td>${renderContact(row)}</td>
                  <td>${escapeHtml(row.responsable_venta || row.creado_por || '—')}</td>
                  <td>${escapeHtml(row.tipo || '—')}</td>
                  <td>${escapeHtml(row.producto_format || '—')}</td>
                  <td>${escapeHtml(formatDate(row.f_acreditacion))}</td>
                  <td>${escapeHtml(row.medios_de_pago_format || '—')}</td>
                  <td>${row.facturacion ? escapeHtml(formatCurrency(row.facturacion)) : '—'}</td>
                  <td>${resolveCashUsd(row) ? escapeHtml(formatCurrency(resolveCashUsd(row))) : '—'}</td>
                  <td>${resolveCashAr(row) ? escapeHtml(formatCurrency(resolveCashAr(row), 'ARS')) : '—'}</td>
                  <td>${stateBadge(currentState)}</td>
                  <td>
                    <div class="conciliacion-state-control">
                      <select data-state-select="${escapeHtml(row.id)}" data-original-state="${currentState}" ${saving ? 'disabled' : ''}>
                        ${stateOptions(currentState)}
                      </select>
                      <button type="button" class="metricas-primary-button" data-save-state="${escapeHtml(row.id)}" disabled>${saving ? 'Guardando...' : 'Guardar'}</button>
                    </div>
                  </td>
                  <td><a class="conciliacion-notion-link" href="https://www.notion.so/${escapeHtml(String(row.id || '').replace(/-/g, ''))}" target="_blank" rel="noreferrer">Abrir en Notion</a></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderAll() {
    applyFilters();
    renderTabs();
    renderSummary();
    renderTable();
    const selectedMonth = refs.month.value ? refs.month.value.split('-').reverse().join('/') : '';
    refs.hint.textContent = `${state.filteredRows.length} comprobantes visibles de ${state.rows.length} totales en Supabase.${selectedMonth ? ` Mes de acreditación: ${selectedMonth}.` : ''}`;
    refs.totalChip.textContent = `${state.rows.length} comprobantes`;
    refs.status.hidden = true;
  }

  function setStatus(message, mode = '') {
    refs.status.hidden = false;
    refs.status.className = `carga-comprobantes-status${mode ? ` is-${mode}` : ''}`;
    refs.status.innerHTML = `<span>${escapeHtml(message)}</span>`;
  }

  async function loadRows() {
    setStatus('Cargando todos los comprobantes desde Supabase...', 'loading');
    refs.reload.disabled = true;
    try {
      const response = await api.fetchReconciliationComprobantes();
      state.rows = Array.isArray(response.rows) ? response.rows : [];
      populateResponsibleFilter();
      renderAll();
    } catch (error) {
      setStatus(error.message || 'No pude cargar los comprobantes.', 'error');
      refs.summary.hidden = true;
      refs.table.innerHTML = '<div class="table-wrap csm-table-wrap"><div class="report-empty">No se pudo cargar la conciliación.</div></div>';
    } finally {
      refs.reload.disabled = false;
    }
  }

  async function saveState(id) {
    const select = refs.table.querySelector(`[data-state-select="${CSS.escape(id)}"]`);
    const nextState = select?.value;
    const originalState = select?.dataset.originalState;
    if (!select || !nextState || nextState === originalState || state.savingIds.has(id)) return;

    state.savingIds.add(id);
    renderTable();
    setStatus(`Actualizando como ${stateLabel(nextState)} en Notion y Supabase...`, 'loading');
    try {
      const response = await api.updateReconciliationComprobante(id, nextState);
      state.rows = state.rows.map((row) => (
        row.id === id ? { ...row, ...(response.row || {}) } : row
      ));
      refs.hint.textContent = response.message || 'Estado actualizado.';
      state.savingIds.delete(id);
      renderAll();
    } catch (error) {
      state.savingIds.delete(id);
      renderAll();
      setStatus(error.message || 'No pude actualizar el estado.', 'error');
    }
  }

  refs.tabs?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-status-filter]');
    if (!button) return;
    state.statusFilter = button.dataset.statusFilter || 'all';
    renderAll();
  });

  [refs.responsible, refs.month, refs.club].forEach((node) => node?.addEventListener('change', renderAll));
  refs.search?.addEventListener('input', renderAll);
  refs.reload?.addEventListener('click', loadRows);
  refs.table?.addEventListener('change', (event) => {
    const select = event.target.closest('[data-state-select]');
    if (!select) return;
    const button = refs.table.querySelector(`[data-save-state="${CSS.escape(select.dataset.stateSelect)}"]`);
    if (button) button.disabled = select.value === select.dataset.originalState;
  });
  refs.table?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-save-state]');
    if (button) saveState(button.dataset.saveState);
  });

  refs.month.value = currentMonthValue();
  loadRows();
})();
