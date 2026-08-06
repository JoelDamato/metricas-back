(function initMisComprobantesPage() {
  const api = window.metricasApi;
  if (!api) return;

  const state = {
    ownerName: '',
    canViewAll: false,
    canViewBySetter: false,
    scope: 'mine',
    reconciliation: 'all',
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
    scopeTabs: document.getElementById('misComprobantesScopeTabs'),
    reconciliationTabs: document.getElementById('misComprobantesReconciliationTabs'),
    clubFilter: document.getElementById('misComprobantesClubFilter'),
    search: document.getElementById('misComprobantesSearch'),
    ownerChip: document.getElementById('misComprobantesOwnerChip'),
    editor: document.getElementById('misComprobantesEditor'),
    editorBody: document.getElementById('misComprobantesEditorBody')
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

  function isBouncedRow(row) {
    return normalizeText(row?.estado).includes('rebot') || row?.rebotar_pago === true;
  }

  function getReconciliationLabel(value) {
    if (value === 'conciliated') return 'Conciliadas';
    if (value === 'not_conciliated') return 'No conciliadas';
    if (value === 'bounced') return 'Rebotadas';
    return 'Todas';
  }

  function setActiveTab(container, attribute, value) {
    container?.querySelectorAll(`[${attribute}]`).forEach((button) => {
      const isActive = button.getAttribute(attribute) === value;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-selected', String(isActive));
    });
  }

  function renderScopeTabs() {
    if (!refs.scopeTabs) return;
    refs.scopeTabs.hidden = !state.canViewBySetter;
    if (state.canViewBySetter) {
      setActiveTab(refs.scopeTabs, 'data-comprobante-scope', state.scope);
    }
    setActiveTab(refs.reconciliationTabs, 'data-reconciliation', state.reconciliation);
  }

  function getRowAccessScope(row) {
    if (row?.accessScope === 'mine' || row?.accessScope === 'setter') {
      return row.accessScope;
    }

    return normalizeText(row?.responsable_venta) === normalizeText(state.ownerName)
      ? 'mine'
      : 'setter';
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
    const reconciliationMode = state.reconciliation;
    const selectedClubMode = String(refs.clubFilter?.value || 'all').trim();
    state.filteredRows = state.rows.filter((row) => {
      if (state.canViewBySetter && getRowAccessScope(row) !== state.scope) return false;
      if (selectedMonth && getRowMonthValue(row) !== selectedMonth) return false;
      if (reconciliationMode === 'conciliated' && !isConciliatedRow(row)) return false;
      if (reconciliationMode === 'not_conciliated' && (isConciliatedRow(row) || isBouncedRow(row))) return false;
      if (reconciliationMode === 'bounced' && !isBouncedRow(row)) return false;
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
    const totalCashArs = state.filteredRows.reduce((sum, row) => sum + resolveCashAr(row), 0);

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
        <span>Cash AR</span>
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
              <th>Setter</th>
              <th>Tipo</th>
              <th>Producto</th>
              <th>Fecha</th>
              <th>Facturación USD</th>
              <th>Cash USD</th>
              <th>Cash AR</th>
              <th>Estado</th>
              <th>GHL ID</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${state.filteredRows.map((row) => `
              <tr>
                <td>${renderDetailCell(row.cliente_format || 'Sin nombre', row.ghlid || '')}</td>
                <td>${escapeHtml(row.responsable_venta || row.creado_por || '-')}</td>
                <td>${escapeHtml(row.setter || '-')}</td>
                <td>${escapeHtml(row.tipo || '-')}</td>
                <td>${escapeHtml(row.producto_format || '-')}</td>
                <td>${escapeHtml(formatDate(row.f_venta || row.f_acreditacion || row.fecha_creado || row.created_at))}</td>
                <td>${escapeHtml(row.facturacion ? formatCurrency(row.facturacion, 'USD') : '-')}</td>
                <td>${escapeHtml(resolveCashUsd(row) ? formatCurrency(resolveCashUsd(row), 'USD') : '-')}</td>
                <td>${escapeHtml(resolveCashAr(row) ? formatCurrency(resolveCashAr(row), 'ARS') : '-')}</td>
                <td>${escapeHtml(row.estado || 'Sin estado')}</td>
                <td>${escapeHtml(row.ghlid || '-')}</td>
                <td>${row.canManage === true
                  ? `<button type="button" class="mis-comprobantes-manage-button" data-edit-comprobante="${escapeHtml(row.id)}">Editar / borrar</button>`
                  : '<span class="mis-comprobantes-readonly">—</span>'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function editorOption(value, selectedValue, label = value) {
    const selected = String(value) === String(selectedValue) ? ' selected' : '';
    return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(label)}</option>`;
  }

  function renderEditor(comprobante) {
    const isVenta = comprobante.tipo === 'Venta';
    const isDevolucion = comprobante.tipo === 'Devolución';
    const paymentOptions = [...new Set([comprobante.medioPago, ...(comprobante.mediosDePagoOptions || [])].filter(Boolean))];
    const productOptions = [...new Set([comprobante.productName, ...(comprobante.products || [])].filter(Boolean))];
    const paymentCountOptions = [...new Set([comprobante.cantidadPagos, ...(comprobante.cantidadPagosOptions || [])].filter(Boolean))];
    refs.editorBody.innerHTML = `
      <div class="mis-comprobantes-editor-head">
        <div>
          <span class="carga-creating-kicker">Edición habilitada</span>
          <h2 id="misComprobantesEditorTitle">Editar comprobante</h2>
          <p>${comprobante.isCheque ? 'Cheque individual: los cambios se aplican sólo a este comprobante.' : 'Podés corregir los datos operativos de este comprobante.'}</p>
        </div>
        <button type="button" class="mis-comprobantes-editor-close" data-editor-action="close" aria-label="Cerrar">×</button>
      </div>
      <div class="mis-comprobantes-editor-context">
        <span><strong>Cliente:</strong> ${escapeHtml(comprobante.clientName || '—')}</span>
        <span><strong>GHL:</strong> ${escapeHtml(comprobante.ghlId || '—')}</span>
        <span><strong>Responsable:</strong> ${escapeHtml(comprobante.responsibleName || '—')}</span>
        <span><strong>Tipo:</strong> ${escapeHtml(comprobante.tipo || '—')}</span>
      </div>
      <p class="mis-comprobantes-editor-note">Cliente, GHL, responsable, venta relacionada, adjuntos y los demás cheques no se modifican desde acá.</p>
      <form id="misComprobantesEditorForm" class="mis-comprobantes-editor-form" data-comprobante-id="${escapeHtml(comprobante.id)}">
        <div class="carga-grid carga-grid--three">
          ${isVenta ? `<label class="carga-field"><span>Fecha de venta</span><input name="fechaVenta" type="date" value="${escapeHtml(comprobante.fechaVenta)}" required /></label>` : ''}
          <label class="carga-field"><span>Fecha de acreditación</span><input name="fechaAcreditacion" type="date" value="${escapeHtml(comprobante.fechaAcreditacion)}" required /></label>
          <label class="carga-field"><span>DNI / CUIT</span><input name="dniCuit" value="${escapeHtml(comprobante.dniCuit)}" required /></label>
          <label class="carga-field"><span>Medio de pago</span><select name="medioPago" required>${paymentOptions.map((item) => editorOption(item, comprobante.medioPago)).join('')}</select></label>
          <label class="carga-field"><span>Tasa de cambio</span><input name="tc" inputmode="decimal" value="${escapeHtml(comprobante.tc)}" required /></label>
          <label class="carga-field"><span>Cash AR</span><input name="cashCollectedArs" inputmode="decimal" value="${escapeHtml(comprobante.cashCollectedArs)}" required /></label>
          ${isVenta ? `<label class="carga-field carga-field--full"><span>Producto adquirido</span><select name="productName" required>${productOptions.map((item) => editorOption(item, comprobante.productName)).join('')}</select></label>` : ''}
          ${(isVenta || isDevolucion) ? `<label class="carga-field"><span>Facturación USD</span><input name="facturacionUsd" inputmode="decimal" value="${escapeHtml(comprobante.facturacionUsd)}" ${isVenta ? 'required' : ''} /></label>` : ''}
          ${isVenta && !comprobante.isCheque ? `<label class="carga-field"><span>Cantidad de pagos</span><select name="cantidadPagos" required>${paymentCountOptions.map((item) => editorOption(item, comprobante.cantidadPagos)).join('')}</select></label>` : ''}
          <label class="carga-field carga-field--full"><span>Info Comprobantes</span><textarea name="infoComprobantes" rows="4">${escapeHtml(comprobante.infoComprobantes)}</textarea></label>
        </div>
        <p id="misComprobantesEditorStatus" class="mis-comprobantes-editor-status">Revisá los datos antes de guardar.</p>
        <div class="mis-comprobantes-editor-actions">
          <button type="button" class="metricas-secondary-button" data-editor-action="close">Cancelar</button>
          <button type="button" class="mis-comprobantes-delete-button" data-editor-action="delete">Eliminar comprobante</button>
          <button type="submit" class="metricas-primary-button">Guardar cambios</button>
        </div>
      </form>
    `;
    refs.editor.hidden = false;
  }

  function closeEditor() {
    refs.editor.hidden = true;
    refs.editorBody.innerHTML = '';
  }

  function updateLocalRow(id, updated) {
    state.rows = state.rows.map((row) => {
      if (row.id !== id) return row;
      return {
        ...row,
        f_venta: updated.fechaVenta || row.f_venta,
        f_acreditacion: updated.fechaAcreditacion || row.f_acreditacion,
        dni_cuit: updated.dniCuit,
        medios_de_pago_format: updated.medioPago,
        tc: updated.tc,
        cash_ar: updated.cashCollectedArs,
        producto_format: updated.productName || row.producto_format,
        facturacion: updated.facturacionUsd ?? row.facturacion,
        cantidad_de_pagos: updated.cantidadPagos || row.cantidad_de_pagos,
        info_comprobantes: updated.infoComprobantes
      };
    });
  }

  async function openEditor(id) {
    try {
      refs.status.hidden = false;
      refs.status.querySelector('span').textContent = 'Preparando el comprobante para editar...';
      const response = await api.fetchEditableComprobante(id);
      refs.status.hidden = true;
      renderEditor(response.comprobante);
    } catch (error) {
      refs.status.hidden = false;
      refs.status.querySelector('span').textContent = error.message || 'No pude abrir el editor del comprobante.';
    }
  }

  async function submitEditor(form) {
    const id = form.dataset.comprobanteId;
    const status = document.getElementById('misComprobantesEditorStatus');
    const submit = form.querySelector('[type="submit"]');
    const payload = Object.fromEntries(new FormData(form).entries());
    submit.disabled = true;
    status.textContent = 'Guardando cambios en Notion...';
    try {
      const response = await api.updateEditableComprobante(id, payload);
      updateLocalRow(id, response.updated || {});
      renderAll();
      closeEditor();
      refs.hint.textContent = response.message || 'Cambios guardados.';
    } catch (error) {
      status.textContent = error.message || 'No pude guardar los cambios.';
      submit.disabled = false;
    }
  }

  async function deleteFromEditor(form) {
    const id = form.dataset.comprobanteId;
    if (!window.confirm('¿Eliminar este comprobante? Esta acción lo archivará en Notion.')) return;
    const status = document.getElementById('misComprobantesEditorStatus');
    status.textContent = 'Archivando comprobante...';
    try {
      const response = await api.deleteEditableComprobante(id);
      state.rows = state.rows.filter((row) => row.id !== id);
      renderAll();
      closeEditor();
      refs.hint.textContent = response.message || 'Comprobante archivado.';
    } catch (error) {
      status.textContent = error.message || 'No pude eliminar el comprobante.';
    }
  }

  function renderAll() {
    renderScopeTabs();
    filterRows();
    renderSummary();
    renderTable();
    const selectedMonth = String(refs.month?.value || '').trim();
    const reconciliationLabel = getReconciliationLabel(state.reconciliation);
    const clubLabel = refs.clubFilter?.selectedOptions?.[0]?.textContent || 'Todos';
    const scopeLabel = state.canViewAll
      ? (state.selectedResponsible ? state.selectedResponsible : 'todos los responsables')
      : state.canViewBySetter && state.scope === 'setter'
        ? `${state.ownerName || 'tu usuario'} como setter`
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
      state.canViewBySetter = response?.canViewBySetter === true;
      if (!state.canViewBySetter) state.scope = 'mine';
      state.selectedResponsible = String(response?.selectedResponsible || '').trim();
      state.responsibleOptions = Array.isArray(response?.responsibleOptions) ? response.responsibleOptions : [];
      refs.ownerChip.textContent = state.canViewAll
        ? `Vista global: ${state.selectedResponsible || 'todos'}`
        : state.canViewBySetter
          ? `Responsable + setter: ${state.ownerName || 'sin asignar'}`
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
  refs.scopeTabs?.querySelectorAll('[data-comprobante-scope]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!state.canViewBySetter) return;
      state.scope = button.dataset.comprobanteScope === 'setter' ? 'setter' : 'mine';
      renderAll();
    });
  });
  refs.reconciliationTabs?.querySelectorAll('[data-reconciliation]').forEach((button) => {
    button.addEventListener('click', () => {
      state.reconciliation = button.dataset.reconciliation || 'all';
      renderAll();
    });
  });
  refs.clubFilter?.addEventListener('change', renderAll);
  refs.search?.addEventListener('input', renderAll);
  refs.table?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-edit-comprobante]');
    if (button) openEditor(button.dataset.editComprobante);
  });
  refs.editor?.addEventListener('click', (event) => {
    if (event.target === refs.editor || event.target.closest('[data-editor-action="close"]')) closeEditor();
    const deleteButton = event.target.closest('[data-editor-action="delete"]');
    if (deleteButton) deleteFromEditor(document.getElementById('misComprobantesEditorForm'));
  });
  refs.editor?.addEventListener('submit', (event) => {
    if (event.target.id !== 'misComprobantesEditorForm') return;
    event.preventDefault();
    submitEditor(event.target);
  });

  ensureDefaultMonth();
  loadPage();
})();
