const monthInput = document.querySelector('#month');
const reloadButton = document.querySelector('#reload');
const statusNode = document.querySelector('#status');
const summaryNode = document.querySelector('#summary');
const rowsNode = document.querySelector('#rows');
const countNode = document.querySelector('#count');
const emptyNode = document.querySelector('#empty');
const recordsTableNode = document.querySelector('#recordsTable');
const selectedCountNode = document.querySelector('#selectedCount');
const reconcileButton = document.querySelector('#reconcileSelected');
const invoiceButton = document.querySelector('#invoiceSelected');
const selectAllNode = document.querySelector('#selectAll');
const loadingNode = document.querySelector('#loading');
const loadingTextNode = document.querySelector('#loadingText');
const newManualButton = document.querySelector('#newManual');
let allRecords = [];
let activeWorkflow = 'pending';
const selectedKeys = new Set();

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function formatMoney(value, currency = 'ARS') {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function recordKey(row) { return `${row.kind}:${row.id}`; }

function recipientDataButton(row) {
  return `<button class="recipient-data-button" type="button" data-recipient-key="${escapeHtml(recordKey(row))}">Datos fiscales</button>`;
}

function renderRowActions(row) {
  if (row.workflowStatus === 'reconciled' && row.kind !== 'manual') {
    return `<button class="unreconcile-button" type="button" data-unreconcile-key="${escapeHtml(recordKey(row))}">Quitar conciliación</button>${recipientDataButton(row)}`;
  }
  if (row.workflowStatus === 'reconciled' && row.kind === 'manual') {
    return `<button class="edit-manual-button" type="button" data-manual-key="${escapeHtml(recordKey(row))}">Editar</button><button class="delete-manual-button" type="button" data-manual-key="${escapeHtml(recordKey(row))}">Eliminar</button>`;
  }
  if (row.workflowStatus === 'invoiced') {
    const creditNote = row.creditNoteCae
      ? `<span class="credit-note-issued">Nota de Crédito ${escapeHtml(row.creditNoteType)}<small>${escapeHtml(row.creditNoteNumber)}</small></span>`
      : `<button class="credit-note-button" type="button" data-credit-key="${escapeHtml(recordKey(row))}">Nota de crédito</button>`;
    return `${recipientDataButton(row)}${creditNote}`;
  }
  if (row.workflowStatus === 'credit_notes') {
    return `<span class="credit-note-issued">Emitida<small>Factura original ${escapeHtml(row.arcaInvoiceNumber || '')}</small></span>`;
  }
  return '—';
}

function updateSelectionUi() {
  const selected = allRecords.filter((row) => selectedKeys.has(recordKey(row)));
  selectedCountNode.textContent = `${selected.length} seleccionada${selected.length === 1 ? '' : 's'}`;
  reconcileButton.hidden = activeWorkflow !== 'pending';
  reconcileButton.disabled = activeWorkflow !== 'pending' || !selected.length;
  invoiceButton.hidden = activeWorkflow !== 'reconciled';
  invoiceButton.disabled = activeWorkflow !== 'reconciled' || !selected.length;
}

function proposedInvoiceType(row) {
  if (row.proposedInvoice?.invoiceType) return `Factura ${row.proposedInvoice.invoiceType}`;
  const vatConditionId = Number(row.vatConditionId);
  const byCondition = vatConditionId === 5 ? 'B' : [1, 6].includes(vatConditionId) ? 'A' : '';
  return `Factura ${row.requestedInvoiceType || byCondition || (String(row.identificationType || '').toUpperCase() === 'CUIT' ? 'A' : 'B')}`;
}

function proposedTaxTreatment(row) {
  if (row.proposedInvoice) return `${row.proposedInvoice.vatCondition} · ${row.proposedInvoice.taxTreatment}`;
  if (Number(row.vatConditionId) === 1) return 'IVA 21%';
  if ([5, 6].includes(Number(row.vatConditionId))) return 'IVA exento';
  return String(row.identificationType || '').toUpperCase() === 'CUIT' ? 'Condición según Padrón ARCA' : 'IVA exento';
}

function closeInvoicePreview() {
  document.querySelector('#invoicePreview')?.remove();
}

function isPadronAuthorizationError(message) {
  const text = String(message || '');
  return /consulta automática al Padrón de ARCA no está autorizada/i.test(text)
    || /ws_sr_constancia_inscripcion/i.test(text);
}

async function openResolvedInvoicePreview(records, options = {}) {
  const allowManualFallback = options.allowManualFallback !== false;
  invoiceButton.disabled = true;
  statusNode.textContent = 'Validando condición fiscal en ARCA…';
  try {
    const response = await fetch('/api/metricas/mercado-pago/club/invoice-preview', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: records.map((row) => ({ kind: row.kind, id: row.id })) })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'No se pudo validar la previsualización');
    showInvoicePreview(data.previews || []);
    statusNode.textContent = 'Condición fiscal validada; revisá la previsualización antes de emitir';
  } catch (error) {
    if (allowManualFallback && isPadronAuthorizationError(error.message)) {
      statusNode.textContent = error.message;
      window.alert(`${error.message}\n\nNo hace falta cargar el domicilio manualmente: corregí el certificado de ARCA y volvé a intentar.`);
      return null;
    }
    statusNode.textContent = error.message;
    window.alert(error.message);
  } finally {
    updateSelectionUi();
  }
}

function confirmArcaEmission(count) {
  return new Promise((resolve) => {
    document.querySelector('#arcaConfirm')?.remove();
    const popup = document.createElement('div');
    popup.id = 'arcaConfirm';
    popup.className = 'arca-confirm';
    popup.innerHTML = `
      <section class="arca-confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="arcaConfirmTitle">
        <span class="arca-confirm-icon" aria-hidden="true">!</span>
        <h3 id="arcaConfirmTitle">Confirmar emisión en ARCA</h3>
        <p>Vas a solicitar <strong>${count} CAE real${count === 1 ? '' : 'es'}</strong>. La factura quedará registrada y esta acción no se puede deshacer.</p>
        <div class="arca-confirm-actions">
          <button type="button" class="arca-confirm-cancel">Cancelar</button>
          <button type="button" class="arca-confirm-accept">Confirmar emisión</button>
        </div>
      </section>`;
    document.body.appendChild(popup);
    const finish = (accepted) => { popup.remove(); resolve(accepted); };
    popup.querySelector('.arca-confirm-cancel').addEventListener('click', () => finish(false));
    popup.querySelector('.arca-confirm-accept').addEventListener('click', () => finish(true));
    popup.addEventListener('click', (event) => { if (event.target === popup) finish(false); });
  });
}

function showInvoicePreview(records) {
  closeInvoicePreview();
  const totals = records.reduce((map, row) => {
    const currency = row.currency || 'ARS';
    map[currency] = (map[currency] || 0) + Number(row.amount || 0);
    return map;
  }, {});
  const modal = document.createElement('div');
  modal.id = 'invoicePreview';
  modal.className = 'invoice-preview';
  modal.innerHTML = `
    <section class="invoice-preview-card" role="dialog" aria-modal="true" aria-labelledby="invoicePreviewTitle">
      <div class="invoice-preview-head">
        <div><span class="eyebrow">Paso obligatorio</span><h2 id="invoicePreviewTitle">Previsualización ARCA</h2></div>
        <button type="button" data-close-preview aria-label="Cerrar">×</button>
      </div>
      <p class="invoice-preview-warning">Revisá todo antes de emitir. El proceso aplica Factura B a Consumidor Final y Factura A a Monotributo o Responsable Inscripto; nunca Factura C.</p>
      <div class="invoice-preview-summary"><strong>${records.length}</strong> comprobante${records.length === 1 ? '' : 's'} · ${Object.entries(totals).map(([currency, amount]) => formatMoney(amount, currency)).join(' + ')}</div>
      <div class="invoice-preview-scroll">
        <table><thead><tr><th>Comprobante</th><th>Receptor</th><th>Documento</th><th>Concepto</th><th>Importe</th></tr></thead>
        <tbody>${records.map((row) => `
          <tr>
            <td><strong class="invoice-kind">${proposedInvoiceType(row)}</strong><small>${escapeHtml(proposedTaxTreatment(row))} · Operación ${escapeHtml(row.id)}</small></td>
            <td>${escapeHtml(row.proposedInvoice?.recipientName || row.payer || 'Sin nombre')}<small>${escapeHtml(row.proposedInvoice?.recipientAddress || row.payerAddress || 'Domicilio no informado')}</small></td>
            <td>${escapeHtml(row.identificationType || 'Sin tipo')} ${escapeHtml(row.identificationNumber || 'No informado')}</td>
            <td>${escapeHtml(row.proposedInvoice?.description || row.description || 'Club')}<small>${escapeHtml(row.proposedInvoice?.taxTreatment || '')}</small></td>
            <td class="amount">${formatMoney(row.proposedInvoice?.amounts?.total ?? row.amount, row.currency)}${row.proposedInvoice?.amounts?.vat ? `<small>Neto ${formatMoney(row.proposedInvoice.amounts.net, row.currency)} · IVA ${formatMoney(row.proposedInvoice.amounts.vat, row.currency)}</small>` : ''}</td>
          </tr>`).join('')}</tbody></table>
      </div>
      <p class="invoice-preview-note">Los datos fiscales se completan antes de solicitar el CAE. Consumidor Final y Monotributo usan el concepto fijo; Responsable Inscripto usa el nombre de la membresía.</p>
      <div class="invoice-preview-actions">
        <button type="button" class="preview-cancel" data-close-preview>Volver</button>
        <button type="button" class="preview-confirm">Confirmar y facturar</button>
      </div>
    </section>`;
  document.body.appendChild(modal);
  modal.querySelectorAll('[data-close-preview]').forEach((button) => button.addEventListener('click', closeInvoicePreview));
  modal.addEventListener('click', (event) => { if (event.target === modal) closeInvoicePreview(); });
  modal.querySelector('.preview-confirm').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    if (!await confirmArcaEmission(records.length)) return;
    button.disabled = true;
    button.textContent = 'Facturando…';
    try {
      const response = await fetch('/api/metricas/mercado-pago/club/invoice', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: records.map((row) => ({ kind: row.kind, id: row.id })) })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'No se pudo emitir en ARCA');
      closeInvoicePreview();
      activeWorkflow = 'invoiced';
      document.querySelectorAll('.workflow-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.workflow === activeWorkflow));
      await loadRecords();
      statusNode.textContent = `${data.invoiced} factura${data.invoiced === 1 ? '' : 's'} autorizada${data.invoiced === 1 ? '' : 's'} por ARCA`;
    } catch (error) {
      button.disabled = false;
      button.textContent = 'Confirmar y facturar';
      window.alert(error.message);
    }
  });
}

function renderRecords() {
  const records = allRecords.filter((row) => row.workflowStatus === activeWorkflow);
  recordsTableNode.classList.toggle('compact', activeWorkflow === 'invoiced');
  countNode.textContent = `${records.length} resultado${records.length === 1 ? '' : 's'}`;
  emptyNode.hidden = records.length > 0;
  selectAllNode.checked = records.length > 0 && records.every((row) => selectedKeys.has(recordKey(row)));
  rowsNode.innerHTML = records.map((row) => `
    <tr>
      <td><input class="record-check" type="checkbox" data-key="${escapeHtml(recordKey(row))}" ${selectedKeys.has(recordKey(row)) ? 'checked' : ''} /></td>
      <td>${formatDate(row.date)}</td>
      <td><span class="type ${escapeHtml(row.kind)}">${row.kind === 'subscription' ? 'Suscripción' : row.kind === 'manual' ? 'Manual' : 'Pago'}</span></td>
      <td><strong>${escapeHtml(row.arcaDescription || row.description)}</strong><small>${escapeHtml(row.externalReference || '')}</small>${row.arcaTaxTreatment ? `<small>${escapeHtml(row.arcaTaxTreatment)}</small>` : ''}${['invoiced', 'credit_notes'].includes(row.workflowStatus) ? `<a class="invoice-link" href="/api/metricas/mercado-pago/club/invoice/${encodeURIComponent(row.kind)}/${encodeURIComponent(row.id)}?format=pdf" target="_blank" rel="noopener">Ver factura</a>` : ''}</td>
      <td>${escapeHtml(row.payer || '—')}</td>
      <td><strong>${escapeHtml(row.identificationNumber || '—')}</strong><small>${escapeHtml(row.identificationType || 'No informado')}</small></td>
      <td><span class="workflow-state ${escapeHtml(row.workflowStatus)}">${row.workflowStatus === 'reconciled' ? 'Conciliada' : row.workflowStatus === 'invoiced' ? `Factura ${escapeHtml(row.arcaInvoiceType || '—')}` : row.workflowStatus === 'credit_notes' ? `Nota de Crédito ${escapeHtml(row.creditNoteType || '—')}` : 'Pendiente'}</span><small>${row.workflowStatus === 'reconciled' ? formatDate(row.reconciledAt) : row.workflowStatus === 'invoiced' ? `${escapeHtml(row.arcaInvoiceNumber || '')} · ${escapeHtml(row.arcaVatCondition || '')} · CAE ${escapeHtml(row.arcaCae || '')}` : row.workflowStatus === 'credit_notes' ? `${escapeHtml(row.creditNoteNumber || '')} · CAE ${escapeHtml(row.creditNoteCae || '')}` : ''}</small></td>
      <td><span class="state ${escapeHtml(row.status)}">${escapeHtml(row.status || '—')}</span></td>
      <td>${escapeHtml(row.paymentMethod || '—')}</td>
      <td class="amount">${formatMoney(row.amount, row.currency)}</td>
      <td><code>${escapeHtml(row.id)}</code></td>
      <td class="row-actions">${renderRowActions(row)}</td>
    </tr>`).join('');
  updateSelectionUi();
}

function render(data) {
  const totals = data.totals || {};
  summaryNode.innerHTML = `
    <article><span>Registros</span><strong>${totals.records || 0}</strong></article>
    <article><span>Pagos</span><strong>${totals.payments || 0}</strong></article>
    <article><span>Suscripciones</span><strong>${totals.subscriptions || 0}</strong></article>
    <article><span>Pagos aprobados</span><strong>${formatMoney(totals.approvedAmount || 0)}</strong></article>`;

  allRecords = data.records || [];
  ['pending', 'reconciled', 'invoiced', 'credit_notes'].forEach((status) => {
    const node = document.querySelector(`[data-count="${status}"]`);
    const suppliedCount = status === 'pending'
      ? (activeWorkflow === 'pending' ? allRecords.filter((row) => row.workflowStatus === status).length : null)
      : data.workflowCounts?.[status];
    if (node && suppliedCount !== null && suppliedCount !== undefined) node.textContent = suppliedCount;
  });
  selectedKeys.clear();
  renderRecords();
}

document.querySelectorAll('.workflow-tab').forEach((button) => button.addEventListener('click', () => {
  activeWorkflow = button.dataset.workflow;
  selectedKeys.clear();
  document.querySelectorAll('.workflow-tab').forEach((tab) => tab.classList.toggle('active', tab === button));
  loadRecords();
}));

rowsNode.addEventListener('change', (event) => {
  if (!event.target.classList.contains('record-check')) return;
  if (event.target.checked) selectedKeys.add(event.target.dataset.key);
  else selectedKeys.delete(event.target.dataset.key);
  updateSelectionUi();
});

rowsNode.addEventListener('click', async (event) => {
  const recipientButton = event.target.closest('.recipient-data-button');
  if (recipientButton) {
    const row = allRecords.find((record) => recordKey(record) === recipientButton.dataset.recipientKey);
    if (row) openRecipientForm(row);
    return;
  }
  const editManualButton = event.target.closest('.edit-manual-button');
  if (editManualButton) {
    const row = allRecords.find((record) => recordKey(record) === editManualButton.dataset.manualKey);
    if (row) openManualForm(row);
    return;
  }
  const deleteManualButton = event.target.closest('.delete-manual-button');
  if (deleteManualButton) {
    const row = allRecords.find((record) => recordKey(record) === deleteManualButton.dataset.manualKey);
    if (!row) return;
    const popup = document.createElement('div');
    popup.className = 'arca-confirm';
    popup.innerHTML = `<section class="arca-confirm-card" role="dialog" aria-modal="true"><span class="arca-confirm-icon">?</span><h3>Eliminar carga manual</h3><p>Se eliminará la carga <strong>${escapeHtml(row.description)}</strong>. Esto solo es posible antes de facturar.</p><div class="arca-confirm-actions"><button class="arca-confirm-cancel" type="button">Cancelar</button><button class="arca-confirm-accept" type="button">Eliminar</button></div></section>`;
    document.body.appendChild(popup);
    popup.querySelector('.arca-confirm-cancel').addEventListener('click', () => popup.remove());
    popup.querySelector('.arca-confirm-accept').addEventListener('click', async (clickEvent) => {
      clickEvent.currentTarget.disabled = true;
      try {
        const response = await fetch(`/api/metricas/mercado-pago/club/manual/${encodeURIComponent(row.id)}`, { method: 'DELETE', credentials: 'same-origin' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'No se pudo eliminar');
        popup.remove(); await loadRecords(); statusNode.textContent = 'Carga manual eliminada';
      } catch (error) { clickEvent.currentTarget.disabled = false; window.alert(error.message); }
    });
    return;
  }
  const unreconcileButton = event.target.closest('.unreconcile-button');
  if (unreconcileButton) {
    const row = allRecords.find((record) => recordKey(record) === unreconcileButton.dataset.unreconcileKey);
    if (!row) return;
    const popup = document.createElement('div');
    popup.className = 'arca-confirm';
    popup.innerHTML = `<section class="arca-confirm-card" role="dialog" aria-modal="true"><span class="arca-confirm-icon">?</span><h3>Quitar conciliación</h3><p>El pago volverá a Pendientes y podrás conciliarlo nuevamente más adelante.</p><div class="arca-confirm-actions"><button class="arca-confirm-cancel" type="button">Cancelar</button><button class="arca-confirm-accept" type="button">Quitar conciliación</button></div></section>`;
    document.body.appendChild(popup);
    popup.querySelector('.arca-confirm-cancel').addEventListener('click', () => popup.remove());
    popup.querySelector('.arca-confirm-accept').addEventListener('click', async (clickEvent) => {
      const confirmButton = clickEvent.currentTarget;
      confirmButton.disabled = true;
      try {
        const response = await fetch('/api/metricas/mercado-pago/club/unreconcile', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: row.kind, id: row.id }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'No se pudo quitar la conciliación');
        popup.remove(); await loadRecords(); statusNode.textContent = 'Conciliación quitada; el pago volvió a Pendientes';
      } catch (error) { confirmButton.disabled = false; window.alert(error.message); }
    });
    return;
  }
  const button = event.target.closest('.credit-note-button');
  if (!button) return;
  const row = allRecords.find((record) => recordKey(record) === button.dataset.creditKey);
  if (!row) return;
  const modal = document.createElement('div');
  modal.className = 'arca-confirm';
  modal.innerHTML = `<section class="arca-confirm-card" role="dialog" aria-modal="true"><span class="arca-confirm-icon">!</span><h3>Previsualización de Nota de Crédito ${escapeHtml(row.arcaInvoiceType)}</h3><p>Se anulará por el total la factura <strong>${escapeHtml(row.arcaInvoiceNumber)}</strong> por <strong>${formatMoney(row.amount, row.currency)}</strong>. La nota quedará asociada a la factura original.</p><div class="arca-confirm-actions"><button class="arca-confirm-cancel" type="button">Cancelar</button><button class="arca-confirm-accept" type="button">Emitir nota de crédito</button></div></section>`;
  document.body.appendChild(modal);
  modal.querySelector('.arca-confirm-cancel').addEventListener('click', () => modal.remove());
  modal.querySelector('.arca-confirm-accept').addEventListener('click', async (clickEvent) => {
    const confirmButton = clickEvent.currentTarget;
    if (!await confirmArcaEmission(1)) return;
    confirmButton.disabled = true; confirmButton.textContent = 'Emitiendo…';
    try {
      const response = await fetch('/api/metricas/mercado-pago/club/credit-note', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: row.kind, id: row.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'No se pudo emitir la nota de crédito');
      modal.remove(); await loadRecords(); statusNode.textContent = `Nota de Crédito ${data.type || ''} ${data.number || ''} autorizada por ARCA`;
    } catch (error) { confirmButton.disabled = false; confirmButton.textContent = 'Emitir nota de crédito'; window.alert(error.message); }
  });
});

selectAllNode.addEventListener('change', () => {
  allRecords.filter((row) => row.workflowStatus === activeWorkflow).forEach((row) => {
    if (selectAllNode.checked) selectedKeys.add(recordKey(row));
    else selectedKeys.delete(recordKey(row));
  });
  renderRecords();
});

reconcileButton.addEventListener('click', async () => {
  const records = allRecords.filter((row) => selectedKeys.has(recordKey(row)) && row.workflowStatus === 'pending');
  if (!records.length) return;
  reconcileButton.disabled = true;
  statusNode.textContent = 'Guardando conciliación…';
  try {
    const response = await fetch('/api/metricas/mercado-pago/club/reconcile', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'No se pudo guardar la conciliación');
    activeWorkflow = 'reconciled';
    document.querySelectorAll('.workflow-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.workflow === activeWorkflow));
    await loadRecords();
  } catch (error) {
    statusNode.textContent = error.message;
    updateSelectionUi();
  }
});

invoiceButton.addEventListener('click', async () => {
  const records = allRecords.filter((row) => selectedKeys.has(recordKey(row)) && row.workflowStatus === 'reconciled');
  if (!records.length) return;
  await openResolvedInvoicePreview(records);
});

function recipientDataIsIncomplete(row) {
  const vatConditionId = Number(row.vatConditionId);
  const identificationType = String(row.identificationType || '').toUpperCase();
  const identificationNumber = String(row.identificationNumber || '').replace(/\D/g, '');
  if (!String(row.payer || '').trim() || !String(row.payerAddress || '').trim()) return true;
  if (![1, 5, 6].includes(vatConditionId)) return true;
  return [1, 6].includes(vatConditionId)
    && (identificationType !== 'CUIT' || identificationNumber.length !== 11);
}

async function completeRecipientData(records) {
  const incomplete = records.filter(recipientDataIsIncomplete);
  for (let index = 0; index < incomplete.length; index += 1) {
    const row = incomplete[index];
    statusNode.textContent = `Completá los datos fiscales (${index + 1} de ${incomplete.length}) antes de facturar`;
    const saved = await openRecipientForm(row, {
      reloadAfterSave: false,
      stepLabel: `Comprobante ${index + 1} de ${incomplete.length} · Operación ${row.id}`
    });
    if (!saved) {
      statusNode.textContent = 'Facturación cancelada: faltan datos fiscales';
      return null;
    }
    Object.assign(row, saved, { workflowStatus: 'reconciled' });
  }
  return records;
}

function openRecipientForm(existing, options = {}) {
  const reloadAfterSave = options.reloadAfterSave !== false;
  const stepLabel = String(options.stepLabel || '').trim();
  const isInvoiced = existing.workflowStatus === 'invoiced';
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    let finished = false;
    const finish = (value) => {
      if (finished) return;
      finished = true;
      modal.remove();
      resolve(value);
    };
    modal.className = 'invoice-preview';
    modal.innerHTML = `<form class="invoice-preview-card manual-form"><div class="invoice-preview-head"><div><span class="eyebrow">Datos del receptor</span><h2>Datos fiscales</h2>${stepLabel ? `<p class="invoice-preview-note">${escapeHtml(stepLabel)}</p>` : ''}</div><button type="button" data-close-preview>×</button></div><div class="manual-grid"><label class="manual-wide">Apellido y Nombre / Razón Social<input name="payer" required placeholder="Nombre o razón social"></label><label class="manual-wide">Domicilio comercial<input name="payerAddress" required placeholder="Calle, número, localidad y provincia"></label>${isInvoiced ? '' : `<label>Condición IVA<select name="vatConditionId"><option value="5">Consumidor Final</option><option value="6">Monotributo</option><option value="1">Responsable Inscripto</option></select></label><label>Tipo de documento<select name="identificationType"><option value="">Consumidor final</option><option value="DNI">DNI</option><option value="CUIT">CUIT</option></select></label><label>Número de documento<input name="identificationNumber" inputmode="numeric"></label>`}</div><p class="invoice-preview-note">${isInvoiced ? 'La factura ya fue autorizada: solo se actualizarán el nombre y el domicilio visibles. El CAE, CUIT y condición IVA no se modifican.' : 'Confirmá la condición IVA y el domicilio antes de solicitar el CAE. Para Monotributo y Responsable Inscripto se requiere CUIT.'}</p><div class="invoice-preview-actions"><button type="button" class="preview-cancel" data-close-preview>Cancelar</button><button class="preview-confirm" type="submit">Guardar datos</button></div></form>`;
    document.body.appendChild(modal);
    const form = modal.querySelector('form');
    const values = {
      payer: existing.payer,
      payerAddress: existing.payerAddress,
      vatConditionId: existing.vatConditionId,
      identificationType: existing.identificationType,
      identificationNumber: existing.identificationNumber
    };
    Object.entries(values).forEach(([name, value]) => {
      const input = form.elements.namedItem(name);
      if (input && value !== null && value !== undefined) input.value = value;
    });
    if (!isInvoiced) {
      form.elements.namedItem('vatConditionId').addEventListener('change', (event) => {
        if (Number(event.currentTarget.value) !== 5) form.elements.namedItem('identificationType').value = 'CUIT';
      });
    }
    modal.querySelectorAll('[data-close-preview]').forEach((button) => button.addEventListener('click', () => finish(null)));
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submit = event.submitter;
      submit.disabled = true;
      try {
        const response = await fetch(`/api/metricas/mercado-pago/club/recipient/${encodeURIComponent(existing.kind)}/${encodeURIComponent(existing.id)}`, {
          method: 'PATCH',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget)))
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'No se pudieron guardar los datos fiscales');
        Object.assign(existing, data.record || {});
        if (reloadAfterSave) await loadRecords();
        statusNode.textContent = 'Datos fiscales actualizados';
        finish(data.record || existing);
      } catch (error) {
        submit.disabled = false;
        window.alert(error.message);
      }
    });
  });
}

function openManualForm(existing = null) {
  const modal = document.createElement('div');
  modal.className = 'invoice-preview';
  modal.innerHTML = `<form class="invoice-preview-card manual-form"><div class="invoice-preview-head"><div><span class="eyebrow">Origen manual</span><h2>${existing ? 'Editar carga manual' : 'Facturar manual'}</h2></div><button type="button" data-close-preview>×</button></div><div class="manual-grid"><label>Condición IVA<select name="vatConditionId"><option value="5">Consumidor Final</option><option value="6">Monotributo</option><option value="1">Responsable Inscripto</option></select></label><label>Tipo de factura<input name="invoiceType" value="B" readonly></label><label>Receptor<input name="payer" required placeholder="Nombre o razón social"></label><label>Email<input name="email" type="email"></label><label class="manual-wide">Domicilio comercial<input name="payerAddress" required placeholder="Calle, número, localidad y provincia"></label><label>Tipo de documento<select name="identificationType"><option value="DNI">DNI</option><option value="CUIT">CUIT</option><option value="">Consumidor final</option></select></label><label>Número de documento<input name="identificationNumber" inputmode="numeric"></label><label class="manual-wide">Concepto / nombre de membresía<input name="description" required placeholder="Descripción del servicio"></label><label>Importe ARS<input name="amount" type="number" min="0.01" step="0.01" required></label><label>Medio de pago<input name="paymentMethod" placeholder="Transferencia, efectivo…"></label></div><p class="invoice-preview-note">El tipo se determina automáticamente: B para Consumidor Final; A para Monotributo y Responsable Inscripto.</p><div class="invoice-preview-actions"><button type="button" class="preview-cancel" data-close-preview>Cancelar</button><button class="preview-confirm" type="submit">${existing ? 'Guardar cambios' : 'Guardar y previsualizar'}</button></div></form>`;
  document.body.appendChild(modal);
  const form = modal.querySelector('form');
  const syncManualInvoiceType = () => {
    const vatConditionId = Number(form.elements.namedItem('vatConditionId').value);
    form.elements.namedItem('invoiceType').value = vatConditionId === 5 ? 'B' : 'A';
    if (vatConditionId !== 5) form.elements.namedItem('identificationType').value = 'CUIT';
  };
  if (existing) {
    const values = { invoiceType: existing.requestedInvoiceType || proposedInvoiceType(existing).slice(-1), payer: existing.payer, email: existing.payerEmail, payerAddress: existing.payerAddress, identificationType: existing.identificationType, identificationNumber: existing.identificationNumber, vatConditionId: existing.vatConditionId, description: existing.description, amount: existing.amount, paymentMethod: existing.paymentMethod };
    Object.entries(values).forEach(([name, value]) => { const input = form.elements.namedItem(name); if (input && value !== null && value !== undefined) input.value = value; });
  }
  syncManualInvoiceType();
  form.elements.namedItem('vatConditionId').addEventListener('change', syncManualInvoiceType);
  modal.querySelectorAll('[data-close-preview]').forEach((button) => button.addEventListener('click', () => modal.remove()));
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); const submit = event.submitter; submit.disabled = true;
    try {
      const payload = Object.fromEntries(new FormData(event.currentTarget));
      const endpoint = existing ? `/api/metricas/mercado-pago/club/manual/${encodeURIComponent(existing.id)}` : '/api/metricas/mercado-pago/club/manual';
      const response = await fetch(endpoint, { method: existing ? 'PATCH' : 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'No se pudo guardar');
      modal.remove();
      activeWorkflow = 'reconciled';
      document.querySelectorAll('.workflow-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.workflow === activeWorkflow));
      await loadRecords();
      const saved = allRecords.find((row) => row.id === data.record.id) || { ...data.record, workflowStatus: 'reconciled' };
      if (existing) statusNode.textContent = 'Carga manual actualizada';
      else await openResolvedInvoicePreview([saved]);
    } catch (error) { submit.disabled = false; window.alert(error.message); }
  });
}

newManualButton.addEventListener('click', () => openManualForm());

async function loadRecords() {
  reloadButton.disabled = true;
  loadingNode.hidden = false;
  loadingTextNode.textContent = activeWorkflow === 'pending' ? 'Consultando pagos en Mercado Pago…' : 'Cargando registros guardados…';
  statusNode.textContent = '';
  try {
    const endpoint = activeWorkflow === 'pending'
      ? `/api/metricas/mercado-pago/club?month=${encodeURIComponent(monthInput.value)}`
      : `/api/metricas/mercado-pago/club/workflow?month=${encodeURIComponent(monthInput.value)}&status=${encodeURIComponent(activeWorkflow)}`;
    const response = await fetch(endpoint, { credentials: 'same-origin' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'No se pudo consultar Mercado Pago');
    render(data);
    statusNode.textContent = `Actualizado ${new Intl.DateTimeFormat('es-AR', { timeStyle: 'short' }).format(new Date())}`;
  } catch (error) {
    statusNode.textContent = error.message;
    summaryNode.innerHTML = '';
    rowsNode.innerHTML = '';
    emptyNode.hidden = false;
  } finally {
    reloadButton.disabled = false;
    loadingNode.hidden = true;
  }
}

const now = new Date();
monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
reloadButton.addEventListener('click', loadRecords);
monthInput.addEventListener('change', loadRecords);
loadRecords();
