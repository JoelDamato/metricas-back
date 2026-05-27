(function initCargaComprobantesPage() {
  const api = window.metricasApi;
  if (!api) return;

  const state = {
    bootstrap: null,
    client: null,
    attachments: [],
    loading: false,
    previewPayload: null
  };

  const refs = {
    form: document.getElementById('comprobanteForm'),
    status: document.getElementById('comprobanteLoaderStatus'),
    hint: document.getElementById('comprobanteLoaderHint'),
    reloadBtn: document.getElementById('reloadComprobanteLoader'),
    ghlInput: document.getElementById('ghlInput'),
    searchClientBtn: document.getElementById('searchClientBtn'),
    clientName: document.getElementById('clientName'),
    ghlId: document.getElementById('ghlId'),
    clientPageId: document.getElementById('clientPageId'),
    identificador: document.getElementById('identificador'),
    responsableVenta: document.getElementById('responsableVenta'),
    clientSummary: document.getElementById('clientSummary'),
    tipo: document.getElementById('tipo'),
    fechaCreacionAutoView: document.getElementById('fechaCreacionAutoView'),
    fechaVenta: document.getElementById('fechaVenta'),
    fechaAcreditacion: document.getElementById('fechaAcreditacion'),
    dniCuit: document.getElementById('dniCuit'),
    medioPago: document.getElementById('medioPago'),
    tc: document.getElementById('tc'),
    ventaFields: document.getElementById('ventaFields'),
    productName: document.getElementById('productName'),
    productsSourceText: document.getElementById('productsSourceText'),
    facturacionUsd: document.getElementById('facturacionUsd'),
    cantidadPagos: document.getElementById('cantidadPagos'),
    cashCollectedArs: document.getElementById('cashCollectedArs'),
    cashCollectedUsd: document.getElementById('cashCollectedUsd'),
    cashValidationCard: document.getElementById('cashValidationCard'),
    chequeFields: document.getElementById('chequeFields'),
    chequeCount: document.getElementById('chequeCount'),
    chequeRows: document.getElementById('chequeRows'),
    attachments: document.getElementById('attachments'),
    attachmentsDropzone: document.getElementById('attachmentsDropzone'),
    attachmentsList: document.getElementById('attachmentsList'),
    mesesSoporte: document.getElementById('mesesSoporte'),
    sesiones: document.getElementById('sesiones'),
    bonusMati: document.getElementById('bonusMati'),
    infoComprobantes: document.getElementById('infoComprobantes'),
    cobranzaLinkSection: document.getElementById('cobranzaLinkSection'),
    latestSaleId: document.getElementById('latestSaleId'),
    latestSaleSummary: document.getElementById('latestSaleSummary'),
    submitStatus: document.getElementById('submitStatus'),
    submitBtn: document.getElementById('submitComprobanteBtn'),
    previewSection: document.getElementById('previewSection'),
    previewAlerts: document.getElementById('previewAlerts'),
    previewGrid: document.getElementById('previewGrid'),
    editPreviewBtn: document.getElementById('editPreviewBtn'),
    confirmSubmitBtn: document.getElementById('confirmSubmitBtn')
  };

  function todayIso() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date());
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;
    return `${year}-${month}-${day}`;
  }

  function syncAutomaticDates() {
    const today = todayIso();
    if (refs.fechaVenta) refs.fechaVenta.value = today;
    if (refs.fechaAcreditacion) refs.fechaAcreditacion.value = today;
    if (refs.fechaCreacionAutoView) refs.fechaCreacionAutoView.value = today;
  }

  function formatCurrency(value, currency = 'USD') {
    const amount = Number(value || 0);
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2
    }).format(amount);
  }

  function escapeHtml(value) {
    return String(value || '')
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

  function parseLocaleNumber(value) {
    const raw = String(value || '').trim();
    if (!raw) return 0;
    const clean = raw.replace(/[^\d,.-]/g, '');
    const separators = clean.match(/[.,]/g) || [];
    if (!separators.length) {
      return Number(clean.replace(/[^\d-]/g, '')) || 0;
    }

    const lastComma = clean.lastIndexOf(',');
    const lastDot = clean.lastIndexOf('.');
    const decimalIndex = Math.max(lastComma, lastDot);
    const digitsAfterSeparator = decimalIndex >= 0
      ? clean.slice(decimalIndex + 1).replace(/[^\d]/g, '')
      : '';
    const hasDecimalPart = digitsAfterSeparator.length > 0 && digitsAfterSeparator.length <= 2;

    if (decimalIndex >= 0 && hasDecimalPart) {
      const integerPart = clean.slice(0, decimalIndex).replace(/[^\d-]/g, '');
      const decimalPart = digitsAfterSeparator;
      return Number(`${integerPart || '0'}.${decimalPart}`) || 0;
    }

    return Number(clean.replace(/[^\d-]/g, '')) || 0;
  }

  function formatNumberInputValue(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const clean = raw.replace(/[^\d,.-]/g, '');
    const lastComma = clean.lastIndexOf(',');
    const lastDot = clean.lastIndexOf('.');
    const decimalIndex = Math.max(lastComma, lastDot);

    if (decimalIndex >= 0) {
      const integerDigits = clean.slice(0, decimalIndex).replace(/[^\d]/g, '');
      const decimalDigits = clean.slice(decimalIndex + 1).replace(/[^\d]/g, '').slice(0, 2);
      const formattedInteger = new Intl.NumberFormat('es-AR').format(Number(integerDigits || 0));
      return decimalDigits ? `${formattedInteger},${decimalDigits}` : `${formattedInteger},`;
    }

    const integerDigits = clean.replace(/[^\d]/g, '');
    if (!integerDigits) return '';
    return new Intl.NumberFormat('es-AR').format(Number(integerDigits));
  }

  function bindFormattedNumberInput(node) {
    if (!node || node.dataset.formattedBound === 'true') return;
    node.dataset.formattedBound = 'true';
    node.addEventListener('input', () => {
      const raw = String(node.value || '');
      node.value = raw.replace(/[^\d,.-]/g, '');
    });
    node.addEventListener('blur', () => {
      node.value = formatNumberInputValue(node.value);
    });
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = () => reject(new Error(`No pude leer el archivo ${file?.name || ''}`.trim()));
      reader.readAsDataURL(file);
    });
  }

  async function serializeAttachments() {
    return Promise.all(
      state.attachments.map(async (file) => ({
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: Number(file.size || 0),
        base64: await readFileAsBase64(file)
      }))
    );
  }

  function setLoading(isLoading, message = '') {
    state.loading = isLoading;
    refs.reloadBtn.disabled = isLoading;
    refs.searchClientBtn.disabled = isLoading;
    refs.submitBtn.disabled = isLoading;
    refs.status.hidden = !isLoading;
    refs.status.classList.toggle('is-loading', isLoading);
    refs.form.hidden = isLoading;
    refs.hint.textContent = message || (isLoading ? 'Preparando formulario...' : 'Formulario listo para cargar.');
    const statusLabel = refs.status.querySelector('span');
    if (statusLabel) {
      statusLabel.textContent = isLoading ? 'Preparando formulario...' : '';
    }
  }

  function invalidatePreview() {
    state.previewPayload = null;
    refs.previewSection.hidden = true;
  }

  function populateSelect(selectNode, values, placeholder) {
    if (!selectNode) return;
    const options = [];
    if (placeholder) {
      options.push(`<option value="">${placeholder}</option>`);
    }
    values.forEach((value) => {
      options.push(`<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`);
    });
    selectNode.innerHTML = options.join('');
  }

  function updateIdentificador() {
    const clientName = refs.clientName.value.trim();
    refs.identificador.value = clientName ? `Transaccion de ${clientName}` : '';
  }

  function setClientSummary(client) {
    if (!client) {
      refs.clientSummary.innerHTML = '<strong>Sin cliente cargado todavía.</strong>';
      refs.latestSaleId.value = '';
      refs.latestSaleSummary.innerHTML = '<strong>Todavía no encontré una venta previa.</strong>';
      return;
    }

    const clientCard = window.metricasGhl?.renderContactCell(client.nombre || 'Sin nombre', client.ghlid || '') || `<strong>${escapeHtml(client.nombre || 'Sin nombre')}</strong>`;
    refs.clientSummary.innerHTML = `
      ${clientCard}
      <span>Mail: ${escapeHtml(client.mail || '-')}</span>
      <span>Teléfono: ${escapeHtml(client.telefono || '-')}</span>
      <span>Etapa: ${escapeHtml(client.etapa || '-')}</span>
    `;

    const sale = client.latestSale;
    refs.latestSaleId.value = sale?.notionPageId || '';
    if (!sale) {
      refs.latestSaleSummary.innerHTML = '<strong>No encontré una venta previa cargada para este cliente.</strong>';
      return;
    }

    refs.latestSaleSummary.innerHTML = `
      <strong>Última venta encontrada</strong>
      <span>Producto: ${escapeHtml(sale.producto || '-')}</span>
      <span>Fecha venta: ${escapeHtml(sale.fechaVenta || '-')}</span>
      <span>Facturación USD: ${sale.facturacionUsd ? formatCurrency(sale.facturacionUsd) : '-'}</span>
    `;
  }

  function renderAttachments() {
    if (!state.attachments.length) {
      refs.attachmentsList.innerHTML = '<li class="is-empty">Todavía no cargaste archivos.</li>';
      return;
    }

    refs.attachmentsList.innerHTML = state.attachments
      .map((file, index) => `
        <li>
          <span>${escapeHtml(file.name)}</span>
          <button type="button" data-remove-attachment="${index}">Quitar</button>
        </li>
      `)
      .join('');
  }

  function syncFiles(files) {
    state.attachments = [...state.attachments, ...Array.from(files || [])];
    renderAttachments();
  }

  function renderChequeRows() {
    const count = Number(refs.chequeCount.value || 0);
    if (!count || count < 1) {
      refs.chequeRows.innerHTML = '';
      return;
    }

    refs.chequeRows.innerHTML = Array.from({ length: count }, (_, index) => `
      <article class="carga-cheque-row">
        <h4>Cheque ${index + 1}</h4>
        <div class="carga-grid carga-grid--two">
          <label class="carga-field">
            <span>Monto ARS</span>
            <input type="text" inputmode="decimal" data-cheque-monto="${index}" placeholder="Ej: 250.000" />
          </label>
          <label class="carga-field">
            <span>Archivo / foto</span>
            <input type="text" data-cheque-file="${index}" placeholder="Nombre del archivo o referencia" />
          </label>
        </div>
      </article>
    `).join('');

    refs.chequeRows.querySelectorAll('[data-cheque-monto]').forEach(bindFormattedNumberInput);
  }

  function updateVisibility() {
    const tipo = refs.tipo.value;
    const isVenta = tipo === 'Venta';
    const isCobranza = tipo === 'Cobranza';
    const isDevolucion = tipo === 'Devolución';
    const isCheque = normalizeText(refs.medioPago.value) === 'cheque';

    refs.ventaFields.hidden = !isVenta;
    refs.chequeFields.hidden = !(isVenta && isCheque);
    refs.cobranzaLinkSection.hidden = !(isCobranza || (isVenta && isCheque));

    refs.productName.disabled = !isVenta;
    refs.cantidadPagos.disabled = !isVenta;

    if (isDevolucion) {
      refs.facturacionUsd.value = '';
      refs.cantidadPagos.value = '';
      refs.productName.value = '';
    }

    updateCashValidation();
    invalidatePreview();
  }

  function updateCashValidation() {
    const tc = parseLocaleNumber(refs.tc.value);
    const cashArs = parseLocaleNumber(refs.cashCollectedArs.value);
    const facturacionUsd = parseLocaleNumber(refs.facturacionUsd.value);
    const tipo = refs.tipo.value;

    refs.cashCollectedUsd.value = tc > 0 && cashArs > 0 ? formatCurrency(cashArs / tc) : '';

    if (tipo !== 'Venta') {
      refs.cashValidationCard.innerHTML = '<strong>Validación</strong><p>Para cobranzas y devoluciones solo controlo que cash ARS y TC estén completos.</p>';
      return;
    }

    if (!tc || !cashArs || !facturacionUsd) {
      refs.cashValidationCard.innerHTML = '<strong>Validación</strong><p>Completá TC, cash ARS y facturación USD para validar el margen.</p>';
      return;
    }

    const cashUsd = cashArs / tc;
    const diff = cashUsd - facturacionUsd;
    const isOk = diff <= 5;
    refs.cashValidationCard.className = `carga-validation-card ${isOk ? 'is-ok' : 'is-error'}`;
    refs.cashValidationCard.innerHTML = `
      <strong>${isOk ? 'Validación OK' : 'Revisar monto'}</strong>
      <p>Facturación USD: ${formatCurrency(facturacionUsd)} | Cash USD: ${formatCurrency(cashUsd)}</p>
      <p>Margen actual: ${formatCurrency(diff)} ${isOk ? '(dentro de +5 USD)' : '(supera el margen permitido)'}</p>
    `;
  }

  function buildPreviewWarnings(payload) {
    const warnings = [];

    if (!payload.clientName) warnings.push('Falta buscar y vincular el cliente.');
    if (!payload.ghlId) warnings.push('Falta el GHL ID.');
    if (!payload.tipo) warnings.push('Falta elegir el tipo.');
    if (!payload.fechaVenta) warnings.push('Falta la fecha de venta / transacción.');
    if (!payload.fechaAcreditacion) warnings.push('Falta la fecha de acreditación.');
    if (!payload.tc) warnings.push('Falta la tasa de cambio.');
    if (!payload.cashCollectedArs) warnings.push('Falta el cash collected ARS.');
    if (!payload.medioPago) warnings.push('Falta el medio de pago.');
    if (!payload.responsableVenta) warnings.push('Falta el responsable de venta.');

    if (payload.tipo === 'Venta') {
      if (!payload.productName) warnings.push('Falta elegir el producto adquirido.');
      if (!payload.facturacionUsd) warnings.push('Falta la facturación USD.');
      if (!payload.cantidadPagos) warnings.push('Falta la cantidad de pagos.');
      if (normalizeText(payload.medioPago) === 'cheque') {
        if (!payload.chequeCount) warnings.push('Falta la cantidad de cheques.');
        const chequeRows = Array.isArray(payload.cheques) ? payload.cheques : [];
        if (!chequeRows.length) warnings.push('Faltan los cheques cargados.');
      }
    }

    const tc = parseLocaleNumber(payload.tc);
    const cashArs = parseLocaleNumber(payload.cashCollectedArs);
    const facturacionUsd = parseLocaleNumber(payload.facturacionUsd);
    if (payload.tipo === 'Venta' && tc > 0 && cashArs > 0 && facturacionUsd > 0) {
      const cashUsd = cashArs / tc;
      if (cashUsd - facturacionUsd > 5) {
        warnings.push('El cash supera la facturación permitida por más de 5 USD.');
      }
    }

    return warnings;
  }

  function previewRowsFromPayload(payload) {
    const rows = [
      ['Cliente', {
        type: 'ghl-contact',
        label: payload.clientName || '-',
        ghlid: payload.ghlId || ''
      }],
      ['GHL ID', payload.ghlId || '-'],
      ['Page ID CRM 2.0', payload.clientPageId || '-'],
      ['Identificador', payload.identificador || '-'],
      ['Responsable venta', payload.responsableVenta || '-'],
      ['Tipo', payload.tipo || '-'],
      ['Fecha de venta', payload.fechaVenta || '-'],
      ['Fecha de acreditación', payload.fechaAcreditacion || '-'],
      ['DNI / CUIT', payload.dniCuit || '-'],
      ['Medio de pago', payload.medioPago || '-'],
      ['TC', payload.tc || '-'],
      ['Cash collected ARS', payload.cashCollectedArs ? formatCurrency(parseLocaleNumber(payload.cashCollectedArs), 'ARS') : '-']
    ];

    if (payload.tc && payload.cashCollectedArs) {
      rows.push(['Cash collected USD', formatCurrency(parseLocaleNumber(payload.cashCollectedArs) / parseLocaleNumber(payload.tc))]);
    }

    if (payload.tipo === 'Venta') {
      rows.push(['Producto adquirido', payload.productName || '-']);
      rows.push(['Facturación USD', payload.facturacionUsd ? formatCurrency(parseLocaleNumber(payload.facturacionUsd)) : '-']);
      rows.push(['Cantidad de pagos', payload.cantidadPagos || '-']);
    }

    if (payload.latestSaleId) {
      rows.push(['Venta relacionada', payload.latestSaleId]);
    }

    if (payload.mesesSoporte) rows.push(['Meses de soporte', payload.mesesSoporte]);
    if (payload.sesiones) rows.push(['Sesiones', payload.sesiones]);
    rows.push(['Bonus Mati', payload.bonusMati ? 'Sí' : 'No']);
    rows.push(['Adjuntos', payload.attachmentNames?.length ? payload.attachmentNames.join(', ') : 'Sin adjuntos']);
    rows.push(['Info comprobantes', payload.infoComprobantes || '-']);

    if (normalizeText(payload.medioPago) === 'cheque' && Array.isArray(payload.cheques) && payload.cheques.length) {
      payload.cheques.forEach((cheque, index) => {
        rows.push([
          `Cheque ${index + 1}`,
          `${cheque.montoArs ? formatCurrency(parseLocaleNumber(cheque.montoArs), 'ARS') : '-'}${cheque.archivoNombre ? ` | ${cheque.archivoNombre}` : ''}`
        ]);
      });
    }

    return rows;
  }

  function renderPreview(payload) {
    const warnings = buildPreviewWarnings(payload);
    refs.previewAlerts.hidden = warnings.length === 0;
    refs.previewAlerts.className = `carga-preview-alerts ${warnings.length ? 'has-warnings' : ''}`;
    refs.previewAlerts.innerHTML = warnings.length
      ? `<strong>Revisá esto antes de confirmar</strong><ul>${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('')}</ul>`
      : '<strong>Todo listo.</strong><p>No vi inconsistencias obvias en la carga previa.</p>';

    refs.previewGrid.innerHTML = previewRowsFromPayload(payload)
      .map(([label, value]) => `
        <article class="carga-preview-item">
          <span>${escapeHtml(label)}</span>
          ${value && typeof value === 'object' && value.type === 'ghl-contact'
            ? (window.metricasGhl?.renderContactCell(value.label, value.ghlid) || `<strong>${escapeHtml(value.label)}</strong>`)
            : `<strong>${escapeHtml(value)}</strong>`}
        </article>
      `)
      .join('');

    refs.previewSection.hidden = false;
    refs.previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function closeSuccessPopup() {
    document.getElementById('comprobanteSuccessPopup')?.remove();
  }

  function closeValidationPopup() {
    document.getElementById('comprobanteValidationPopup')?.remove();
  }

  function showValidationPopup(warnings = []) {
    closeValidationPopup();
    const popup = document.createElement('div');
    popup.id = 'comprobanteValidationPopup';
    popup.className = 'kpi-popup error metric-info-popup';
    popup.innerHTML = `
      <div class="kpi-popup-card metric-info-card carga-validation-popup-card">
        <h3>Revisá esto antes de continuar</h3>
        <p>Corregí estos puntos para poder crear el comprobante.</p>
        <ul class="carga-validation-popup-list">
          ${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('')}
        </ul>
        <div class="carga-success-actions">
          <button type="button" class="metricas-primary-button" id="closeComprobanteValidationPopup">Entendido</button>
        </div>
      </div>
    `;

    document.body.appendChild(popup);
    const close = () => closeValidationPopup();
    popup.addEventListener('click', (event) => {
      if (event.target === popup) close();
    });
    popup.querySelector('#closeComprobanteValidationPopup')?.addEventListener('click', close);
  }

  function showSuccessPopup(response) {
    closeSuccessPopup();

    const created = Array.isArray(response?.created) ? response.created : [];
    const mainRecord = created[0] || null;
    const popup = document.createElement('div');
    popup.id = 'comprobanteSuccessPopup';
    popup.className = 'kpi-popup success metric-info-popup';

    const createdList = created.length
      ? `
        <div class="carga-success-list">
          ${created.map((item, index) => `
            <article class="carga-success-item">
              <span>Registro ${index + 1}</span>
              <strong>${escapeHtml(item.type || 'Comprobante')}</strong>
              <p>${escapeHtml(item.id || '-')}</p>
            </article>
          `).join('')}
        </div>
      `
      : '';

    const openButton = mainRecord?.url
      ? `<a class="metricas-primary-button carga-success-link" href="${escapeHtml(mainRecord.url)}" target="_blank" rel="noreferrer">Abrir en Notion</a>`
      : '';

    popup.innerHTML = `
      <div class="kpi-popup-card metric-info-card carga-success-card">
        <h3>Comprobante creado</h3>
        <p>Se generaron <strong>${created.length}</strong> registro${created.length === 1 ? '' : 's'} correctamente.</p>
        ${createdList}
        <div class="carga-success-actions">
          ${openButton}
          <button type="button" class="metricas-secondary-button" id="closeComprobanteSuccessPopup">Cerrar</button>
        </div>
      </div>
    `;

    document.body.appendChild(popup);

    const close = () => closeSuccessPopup();
    popup.addEventListener('click', (event) => {
      if (event.target === popup) close();
    });
    popup.querySelector('#closeComprobanteSuccessPopup')?.addEventListener('click', close);
  }

  async function bootstrap() {
    setLoading(true, 'Cargando opciones, responsable y catálogo...');
    try {
      const response = await api.fetchComprobantesLoaderBootstrap();
      state.bootstrap = response.bootstrap;

      populateSelect(refs.tipo, response.bootstrap.tipoOptions || [], 'Elegí el tipo');
      populateSelect(refs.medioPago, response.bootstrap.mediosDePagoOptions || [], 'Elegí el medio');
      populateSelect(refs.cantidadPagos, (response.bootstrap.cantidadPagosOptions || []).map(String), 'Elegí pagos');
      populateSelect(refs.productName, response.bootstrap.products || [], 'Elegí un producto');

      refs.responsableVenta.value = response.bootstrap.responsibleVentaDefault || '';
      refs.productsSourceText.textContent = response.bootstrap.productsSource === 'notion'
        ? 'Catálogo cargado desde Notion.'
        : 'Catálogo de respaldo armado con productos históricos mientras Notion no responde.';

      syncAutomaticDates();
      updateVisibility();
      renderAttachments();
      setLoading(false, 'Formulario listo para probar.');
      refs.form.hidden = false;
      invalidatePreview();
    } catch (error) {
      refs.status.innerHTML = `<span>No pude preparar la pantalla. ${escapeHtml(error.message || 'Error desconocido')}</span>`;
      refs.hint.textContent = 'No pude cargar el formulario.';
      refs.status.hidden = false;
    }
  }

  async function searchClient() {
    const rawInput = refs.ghlInput.value.trim();
    if (!rawInput) {
      refs.submitStatus.textContent = 'Pegá una URL o GHL ID antes de buscar.';
      return;
    }

    refs.searchClientBtn.disabled = true;
    refs.submitStatus.textContent = 'Buscando cliente...';
    try {
      const response = await api.lookupComprobantesLoaderClient(rawInput);
      state.client = response.client;
      refs.clientName.value = response.client.nombre || '';
      refs.ghlId.value = response.client.ghlId || '';
      refs.clientPageId.value = response.client.pageId || '';
      updateIdentificador();
      setClientSummary(response.client);
      refs.submitStatus.textContent = 'Cliente encontrado y relación lista.';
      invalidatePreview();
    } catch (error) {
      state.client = null;
      refs.clientName.value = '';
      refs.ghlId.value = '';
      refs.clientPageId.value = '';
      updateIdentificador();
      setClientSummary(null);
      refs.submitStatus.textContent = error.message || 'No pude encontrar al cliente.';
    } finally {
      refs.searchClientBtn.disabled = false;
    }
  }

  function collectChequeRows() {
    return Array.from(refs.chequeRows.querySelectorAll('.carga-cheque-row')).map((row, index) => ({
      montoArs: row.querySelector(`[data-cheque-monto="${index}"]`)?.value || '',
      archivoNombre: row.querySelector(`[data-cheque-file="${index}"]`)?.value || ''
    }));
  }

  async function buildPayload() {
    const attachmentFiles = await serializeAttachments();
    return {
      tipo: refs.tipo.value,
      ghlId: refs.ghlId.value || refs.ghlInput.value.trim(),
      clientName: refs.clientName.value,
      clientPageId: refs.clientPageId.value,
      identificador: refs.identificador.value,
      responsableVenta: refs.responsableVenta.value,
      fechaVenta: refs.fechaVenta.value || todayIso(),
      fechaAcreditacion: refs.fechaAcreditacion.value || todayIso(),
      dniCuit: refs.dniCuit.value,
      medioPago: refs.medioPago.value,
      tc: refs.tc.value,
      productName: refs.productName.value,
      facturacionUsd: refs.facturacionUsd.value,
      cantidadPagos: refs.cantidadPagos.value,
      cashCollectedArs: refs.cashCollectedArs.value,
      chequeCount: refs.chequeCount.value,
      cheques: collectChequeRows(),
      latestSaleId: refs.latestSaleId.value,
      attachmentNames: state.attachments.map((file) => file.name),
      attachmentFiles,
      mesesSoporte: refs.mesesSoporte.value,
      sesiones: refs.sesiones.value,
      bonusMati: refs.bonusMati.checked,
      infoComprobantes: refs.infoComprobantes.value
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    refs.submitBtn.disabled = true;
    refs.submitStatus.textContent = 'Preparando la revisión...';
    try {
      const payload = await buildPayload();
      const warnings = buildPreviewWarnings(payload);
      if (warnings.length) {
        refs.previewSection.hidden = true;
        refs.submitStatus.textContent = 'Faltan datos para continuar.';
        showValidationPopup(warnings);
        return;
      }
      state.previewPayload = payload;
      renderPreview(payload);
      refs.submitStatus.textContent = 'Revisá el detalle y confirmá si está todo bien.';
    } catch (error) {
      refs.submitStatus.textContent = error.message || 'No pude preparar la revisión del comprobante.';
    } finally {
      refs.submitBtn.disabled = false;
    }
  }

  async function confirmSubmit() {
    refs.submitBtn.disabled = true;
    refs.confirmSubmitBtn.disabled = true;
    refs.submitStatus.textContent = 'Creando comprobante...';

    try {
      const payload = state.previewPayload || await buildPayload();
      const warnings = buildPreviewWarnings(payload);
      if (warnings.length) {
        refs.submitStatus.textContent = 'Faltan datos para continuar.';
        refs.previewSection.hidden = true;
        showValidationPopup(warnings);
        return;
      }
      const response = await api.createComprobanteManual(payload);
      refs.submitStatus.textContent = `Comprobante creado. Registros generados: ${response.created.length}.`;
      showSuccessPopup(response);
      refs.form.reset();
      syncAutomaticDates();
      state.attachments = [];
      state.client = null;
      renderAttachments();
      setClientSummary(null);
      updateIdentificador();
      renderChequeRows();
      updateVisibility();
      invalidatePreview();
    } catch (error) {
      refs.submitStatus.textContent = error.message || 'No pude crear el comprobante.';
    } finally {
      refs.submitBtn.disabled = false;
      refs.confirmSubmitBtn.disabled = false;
    }
  }

  refs.reloadBtn?.addEventListener('click', bootstrap);
  refs.searchClientBtn?.addEventListener('click', searchClient);
  refs.ghlInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      searchClient();
    }
  });
  refs.clientName?.addEventListener('input', updateIdentificador);
  refs.tipo?.addEventListener('change', updateVisibility);
  refs.medioPago?.addEventListener('change', updateVisibility);
  refs.tipo?.addEventListener('change', syncAutomaticDates);
  refs.tc?.addEventListener('input', updateCashValidation);
  refs.cashCollectedArs?.addEventListener('input', updateCashValidation);
  refs.facturacionUsd?.addEventListener('input', updateCashValidation);
  bindFormattedNumberInput(refs.tc);
  bindFormattedNumberInput(refs.cashCollectedArs);
  bindFormattedNumberInput(refs.facturacionUsd);
  refs.chequeCount?.addEventListener('input', () => {
    renderChequeRows();
    invalidatePreview();
  });
  refs.form?.addEventListener('submit', handleSubmit);
  refs.editPreviewBtn?.addEventListener('click', () => {
    refs.previewSection.hidden = true;
    refs.submitStatus.textContent = 'Podés seguir editando antes de confirmar.';
  });
  refs.confirmSubmitBtn?.addEventListener('click', confirmSubmit);

  [
    refs.responsableVenta,
    refs.fechaVenta,
    refs.fechaAcreditacion,
    refs.dniCuit,
    refs.tc,
    refs.productName,
    refs.facturacionUsd,
    refs.cantidadPagos,
    refs.cashCollectedArs,
    refs.mesesSoporte,
    refs.sesiones,
    refs.infoComprobantes,
    refs.latestSaleId
  ].forEach((node) => {
    node?.addEventListener('input', invalidatePreview);
    node?.addEventListener('change', invalidatePreview);
  });
  refs.bonusMati?.addEventListener('change', invalidatePreview);

  refs.attachments?.addEventListener('change', (event) => {
    syncFiles(event.target.files);
    refs.attachments.value = '';
    invalidatePreview();
  });

  refs.attachmentsList?.addEventListener('click', (event) => {
    const removeIndex = event.target?.dataset?.removeAttachment;
    if (removeIndex === undefined) return;
    state.attachments.splice(Number(removeIndex), 1);
    renderAttachments();
    invalidatePreview();
  });

  refs.attachmentsDropzone?.addEventListener('click', () => refs.attachments.click());
  refs.attachmentsDropzone?.addEventListener('dragover', (event) => {
    event.preventDefault();
    refs.attachmentsDropzone.classList.add('is-dragover');
  });
  refs.attachmentsDropzone?.addEventListener('dragleave', () => {
    refs.attachmentsDropzone.classList.remove('is-dragover');
  });
  refs.attachmentsDropzone?.addEventListener('drop', (event) => {
    event.preventDefault();
    refs.attachmentsDropzone.classList.remove('is-dragover');
    syncFiles(event.dataTransfer?.files);
    invalidatePreview();
  });

  syncAutomaticDates();
  bootstrap();
})();
