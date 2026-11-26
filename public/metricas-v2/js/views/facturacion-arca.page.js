// Solapa «Facturación ARCA» de Conciliación: pendientes de facturar a mano en ARCA, con tilde de facturado.
(function initFacturacionArca() {
  const http = window.http;
  if (!http) return;

  const state = { rows: [], filter: 'pending', loaded: false, loading: false, saving: new Set(), startDate: '2026-11-01', lastChange: null };
  const $ = (id) => document.getElementById(id);
  const refs = {
    views: document.querySelectorAll('[data-conciliacion-view]'),
    conciliacionPanel: $('conciliacionPanel'),
    panel: $('arcaPanel'),
    badge: $('arcaPendingBadge'),
    tabs: $('arcaTabs'),
    hint: $('arcaHint'),
    status: $('arcaStatus'),
    summary: $('arcaSummary'),
    table: $('arcaTable'),
    responsible: $('arcaResponsible'),
    month: $('arcaMonth'),
    search: $('arcaSearch'),
    reload: $('arcaReload')
  };
  if (!refs.panel) return;

  const escapeHtml = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const normalizeText = (value) => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  const parseNumber = (value) => { const n = Number(value || 0); return Number.isFinite(n) ? n : 0; };
  const cashAr = (row) => parseNumber(row.cash_ar ?? row.cash_collected_ar ?? row.cash_collected_ars);
  const money = (value) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(parseNumber(value));
  const formatDate = (value) => { const m = String(value || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}/${m[2]}/${m[1]}` : '—'; };
  const formatDateTime = (value) => {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
  };
  const responsibleOf = (row) => String(row.responsable_venta || row.creado_por || '').trim();
  const conciliationLabel = (row) => {
    const status = normalizeText(row.estado);
    if (status.includes('rebot')) return ['bounced', 'Rebotado'];
    if (status.includes('concili') && !status.includes('sin conciliar')) return ['conciliated', 'Conciliado'];
    return ['not_conciliated', 'No conciliado'];
  };

  function setStatus(message, mode = '', undo = false) {
    refs.status.hidden = !message;
    refs.status.className = `carga-comprobantes-status${mode ? ` is-${mode}` : ''}`;
    refs.status.innerHTML = message ? `<span>${escapeHtml(message)}</span>${undo ? ' <button type="button" class="metricas-secondary-button" data-arca-undo>Deshacer</button>' : ''}` : '';
  }

  function baseRows() {
    const query = normalizeText(refs.search.value);
    const month = refs.month.value;
    const responsible = normalizeText(refs.responsible.value);
    return state.rows.filter((row) => {
      if (month && String(row.f_acreditacion || '').slice(0, 7) !== month) return false;
      if (responsible && normalizeText(responsibleOf(row)) !== responsible) return false;
      if (!query) return true;
      return [row.cliente_format, row.dni_cuit, row.producto_format, responsibleOf(row), row.medios_de_pago_format, row.ghlid]
        .some((value) => normalizeText(value).includes(query));
    });
  }

  function counts(rows) {
    return rows.reduce((acc, row) => { acc.all += 1; acc[row.facturado_arca ? 'billed' : 'pending'] += 1; return acc; }, { all: 0, pending: 0, billed: 0 });
  }

  function populateResponsibles() {
    const selected = refs.responsible.value;
    const names = [...new Set(state.rows.map(responsibleOf).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
    refs.responsible.innerHTML = ['<option value="">Todos los responsables</option>', ...names.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)].join('');
    refs.responsible.value = names.includes(selected) ? selected : '';
  }

  function render() {
    const rows = baseRows();
    const total = counts(rows);
    const allPending = counts(state.rows).pending;
    refs.badge.textContent = state.loaded ? String(allPending) : '…';
    refs.tabs.querySelectorAll('[data-arca-filter]').forEach((button) => {
      const active = button.dataset.arcaFilter === state.filter;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
      const count = button.querySelector('[data-arca-count]');
      if (count) count.textContent = String(total[button.dataset.arcaFilter] || 0);
    });
    const visible = state.filter === 'all' ? rows : rows.filter((row) => (state.filter === 'billed') === row.facturado_arca);
    const pendingArs = rows.filter((row) => !row.facturado_arca).reduce((sum, row) => sum + cashAr(row), 0);
    refs.summary.hidden = false;
    refs.summary.innerHTML = `
      <article class="mis-comprobantes-summary-card"><span>Pendientes de facturar</span><strong>${total.pending}</strong></article>
      <article class="mis-comprobantes-summary-card"><span>Cash pendiente (ARS)</span><strong>${escapeHtml(money(pendingArs))}</strong></article>
      <article class="mis-comprobantes-summary-card"><span>Facturados</span><strong>${total.billed}</strong></article>`;
    refs.hint.textContent = `Comprobantes de cuentas propias acreditados desde el ${formatDate(state.startDate)}, sin Club, Efectivo ni PayPal. `
      + (state.filter === 'pending' ? 'Al tildar «Facturado» el comprobante pasa a Facturados.' : 'Destildá si se marcó por error y vuelve a Pendientes.');

    if (!visible.length) {
      refs.table.innerHTML = `<div class="table-wrap csm-table-wrap"><div class="report-empty">${state.filter === 'pending' && state.rows.length ? 'No queda ningún comprobante pendiente de facturar para estos filtros.' : 'No hay comprobantes para los filtros elegidos.'}</div></div>`;
      return;
    }
    refs.table.innerHTML = `
      <div class="table-wrap csm-table-wrap conciliacion-table-wrap">
        <table class="csm-table mis-comprobantes-table conciliacion-table arca-table">
          <thead><tr>
            <th>Facturado en ARCA</th><th>Cliente</th><th>DNI / CUIT</th><th>Responsable</th><th>Producto</th><th>Acreditación</th>
            <th>Comprobante</th><th>Cash collected ARS</th><th>TC (ARS / USD)</th><th>Medio</th><th>Conciliación</th><th>Notas para el closer</th>
          </tr></thead>
          <tbody>${visible.map((row) => {
            const saving = state.saving.has(row.id);
            const [stateKey, stateText] = conciliationLabel(row);
            const who = row.facturado_arca ? [row.facturado_arca_por, formatDateTime(row.fecha_facturado)].filter(Boolean).join(' · ') : '';
            const name = row.cliente_format || 'Sin nombre';
            return `<tr data-arca-row="${escapeHtml(row.id)}">
              <td><label class="arca-check"><input type="checkbox" data-arca-check="${escapeHtml(row.id)}" ${row.facturado_arca ? 'checked' : ''} ${saving ? 'disabled' : ''} aria-label="Facturado en ARCA: ${escapeHtml(name)}" /> ${saving ? 'Guardando…' : 'Facturado'}</label>${who ? `<br><small>${escapeHtml(who)}</small>` : ''}</td>
              <td>${window.metricasGhl?.renderContactCell(name, row.ghlid || '') || escapeHtml(name)}</td>
              <td>${escapeHtml(row.dni_cuit || 'Sin informar')}</td>
              <td>${escapeHtml(responsibleOf(row) || '—')}</td>
              <td>${escapeHtml(row.producto_format || '—')}${row.tipo ? `<br><small>${escapeHtml(row.tipo)}</small>` : ''}</td>
              <td>${escapeHtml(formatDate(row.f_acreditacion))}</td>
              <td><button type="button" class="metricas-secondary-button" data-arca-files="${escapeHtml(row.id)}" data-arca-name="${escapeHtml(name)}">Ver comprobante</button></td>
              <td>${cashAr(row) ? escapeHtml(money(cashAr(row))) : '—'}</td>
              <td>${parseNumber(row.tc) > 0 ? escapeHtml(new Intl.NumberFormat('es-AR', { maximumFractionDigits: 6 }).format(parseNumber(row.tc))) : 'Sin informar'}</td>
              <td>${escapeHtml(row.medios_de_pago_format || '—')}</td>
              <td><span class="conciliacion-state-badge is-${stateKey}">${stateText}</span></td>
              <td><p style="white-space:pre-wrap;min-width:180px;max-width:280px;margin:0">${escapeHtml(row.nota_conciliacion || '—')}</p></td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>`;
  }

  async function load() {
    if (state.loading) return;
    state.loading = true;
    refs.reload.disabled = true;
    setStatus('Cargando comprobantes para facturar...', 'loading');
    try {
      const response = await http.getJson('/api/metricas/comprobantes-reconciliation/arca');
      state.rows = Array.isArray(response.rows) ? response.rows : [];
      state.startDate = response.startDate || state.startDate;
      state.loaded = true;
      populateResponsibles();
      setStatus('');
      render();
    } catch (error) {
      setStatus(error.message || 'No pude cargar Facturación ARCA.', 'error');
      refs.table.innerHTML = '<div class="table-wrap csm-table-wrap"><div class="report-empty">No se pudo cargar Facturación ARCA.</div></div>';
    } finally {
      state.loading = false;
      refs.reload.disabled = false;
    }
  }

  async function mark(ids, billed, { undo = true } = {}) {
    ids.forEach((id) => state.saving.add(id));
    render();
    try {
      const response = await http.postJson('/api/metricas/comprobantes-reconciliation/arca/billed', { ids, billed });
      const changed = new Map((response.rows || []).map((row) => [row.id, row]));
      state.rows = state.rows.map((row) => (changed.has(row.id) ? { ...row, ...changed.get(row.id) } : row));
      state.lastChange = undo ? { ids, billed } : null;
      setStatus(response.message || 'Listo.', '', undo);
    } catch (error) {
      setStatus(error.message || 'No pude guardar la facturación.', 'error');
    } finally {
      ids.forEach((id) => state.saving.delete(id));
      render();
    }
  }

  function showView(view) {
    const arca = view === 'arca';
    refs.views.forEach((button) => {
      const active = button.dataset.conciliacionView === view;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    refs.panel.hidden = !arca;
    if (refs.conciliacionPanel) refs.conciliacionPanel.hidden = arca;
    const url = new URL(window.location.href);
    if (arca) url.searchParams.set('vista', 'arca'); else url.searchParams.delete('vista');
    window.history.replaceState(null, '', url);
    if (arca && !state.loaded) load();
  }

  refs.views.forEach((button) => button.addEventListener('click', () => showView(button.dataset.conciliacionView)));
  refs.tabs.addEventListener('click', (event) => {
    const button = event.target.closest('[data-arca-filter]');
    if (!button) return;
    state.filter = button.dataset.arcaFilter;
    render();
  });
  [refs.responsible, refs.month].forEach((node) => node.addEventListener('change', render));
  refs.search.addEventListener('input', render);
  refs.reload.addEventListener('click', load);
  refs.table.addEventListener('change', (event) => {
    const box = event.target.closest('[data-arca-check]');
    if (box) mark([box.dataset.arcaCheck], box.checked);
  });
  refs.table.addEventListener('click', (event) => {
    const files = event.target.closest('[data-arca-files]');
    if (files && window.conciliacionOpenFiles) window.conciliacionOpenFiles(files.dataset.arcaFiles, files.dataset.arcaName);
  });
  refs.status.addEventListener('click', (event) => {
    if (!event.target.closest('[data-arca-undo]') || !state.lastChange) return;
    const { ids, billed } = state.lastChange;
    mark(ids, !billed, { undo: false });
  });

  // El contador de pendientes se ve en la solapa aunque se entre por Conciliación.
  if (new URLSearchParams(window.location.search).get('vista') === 'arca') showView('arca'); else load();
})();
