(function initCargaComprobantesPage() {
  const api = window.metricasApi;
  if (!api) return;

  const MAX_CHEQUES = 6;
  const MAX_FILE_BYTES = 20 * 1024 * 1024;
  const MAX_TOTAL_FILE_BYTES = 30 * 1024 * 1024;
  const ALLOWED_FILE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'pdf']);
  const ALLOWED_FILE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

  const state = {
    bootstrap: null,
    client: null,
    relatedSale: null,
    attachments: [],
    chequeDrafts: [],
    chequeFiles: [],
    loading: false,
    relatedSaleLookupInFlight: false,
    previewPayload: null,
    submissionKey: null,
    isSubmitting: false
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
    productNameField: document.getElementById('productNameField'),
    productName: document.getElementById('productName'),
    productsSourceText: document.getElementById('productsSourceText'),
    facturacionUsdField: document.getElementById('facturacionUsdField'),
    facturacionUsd: document.getElementById('facturacionUsd'),
    cantidadPagosField: document.getElementById('cantidadPagosField'),
    cantidadPagos: document.getElementById('cantidadPagos'),
    cashCollectedArs: document.getElementById('cashCollectedArs'),
    cashCollectedUsd: document.getElementById('cashCollectedUsd'),
    cashValidationCard: document.getElementById('cashValidationCard'),
    chequeFields: document.getElementById('chequeFields'),
    chequeHelpText: document.getElementById('chequeHelpText'),
    chequeCount: document.getElementById('chequeCount'),
    chequeRows: document.getElementById('chequeRows'),
    attachments: document.getElementById('attachments'),
    attachmentsDropzone: document.getElementById('attachmentsDropzone'),
    attachmentsList: document.getElementById('attachmentsList'),
    mesesSoporteField: document.getElementById('mesesSoporteField'),
    mesesSoporte: document.getElementById('mesesSoporte'),
    sesionesField: document.getElementById('sesionesField'),
    sesiones: document.getElementById('sesiones'),
    bonusMatiField: document.getElementById('bonusMatiField'),
    bonusMati: document.getElementById('bonusMati'),
    infoComprobantes: document.getElementById('infoComprobantes'),
    cobranzaLinkSection: document.getElementById('cobranzaLinkSection'),
    latestSaleId: document.getElementById('latestSaleId'),
    searchRelatedSaleBtn: document.getElementById('searchRelatedSaleBtn'),
    latestSaleSummary: document.getElementById('latestSaleSummary'),
    submitStatus: document.getElementById('submitStatus'),
    submitBtn: document.getElementById('submitComprobanteBtn'),
    previewSection: document.getElementById('previewSection'),
    previewAlerts: document.getElementById('previewAlerts'),
    previewGrid: document.getElementById('previewGrid'),
    editPreviewBtn: document.getElementById('editPreviewBtn'),
    confirmSubmitBtn: document.getElementById('confirmSubmitBtn'),
    creatingPopup: document.getElementById('comprobanteCreatingPopup'),
    clientSection: document.getElementById('clientSection'),
    baseSection: document.getElementById('baseSection'),
    cashSection: document.getElementById('cashSection'),
    attachmentsSection: document.getElementById('attachmentsSection'),
    submitSection: document.getElementById('submitSection')
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

  function toDateInputValue(value) {
    const raw = String(value || '').trim();
    const datePrefix = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (datePrefix) return datePrefix[1];
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(parsed);
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;
    return year && month && day ? `${year}-${month}-${day}` : '';
  }

  function syncAutomaticDates() {
    const today = todayIso();
    const usesRelatedSale = refs.tipo?.value === 'Cobranza' || refs.tipo?.value === 'Devolución';
    const relatedSaleDate = usesRelatedSale ? toDateInputValue(state.relatedSale?.fechaVenta) : '';
    if (refs.fechaVenta) refs.fechaVenta.value = usesRelatedSale ? relatedSaleDate : today;
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

  function isClubProduct(value) {
    return normalizeText(value) === 'club';
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
    const separators = clean.match(/[.,]/g) || [];
    if (!separators.length) {
      const integerDigits = clean.replace(/[^\d]/g, '');
      if (!integerDigits) return '';
      return new Intl.NumberFormat('es-AR').format(Number(integerDigits));
    }

    const lastComma = clean.lastIndexOf(',');
    const lastDot = clean.lastIndexOf('.');
    const decimalIndex = Math.max(lastComma, lastDot);
    const decimalDigitsRaw = decimalIndex >= 0
      ? clean.slice(decimalIndex + 1).replace(/[^\d]/g, '')
      : '';
    const hasDecimalPart = decimalDigitsRaw.length > 0 && decimalDigitsRaw.length <= 2;

    if (decimalIndex >= 0 && hasDecimalPart) {
      const integerDigits = clean.slice(0, decimalIndex).replace(/[^\d]/g, '');
      const decimalDigits = decimalDigitsRaw.slice(0, 2);
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
  }

  function bindDigitsOnlyInput(node) {
    if (!node || node.dataset.digitsOnlyBound === 'true') return;
    node.dataset.digitsOnlyBound = 'true';
    node.addEventListener('input', () => {
      node.value = String(node.value || '').replace(/\D/g, '');
    });
  }

  function isPositiveNumber(value) {
    const parsed = parseLocaleNumber(value);
    return Number.isFinite(parsed) && parsed > 0;
  }

  function isIsoDate(value) {
    const raw = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
    const parsed = new Date(`${raw}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === raw;
  }

  function getChequeCount() {
    const count = Number(refs.chequeCount?.value || 0);
    return Number.isInteger(count) && count >= 1 && count <= MAX_CHEQUES ? count : 0;
  }

  function getFileExtension(fileName) {
    const parts = String(fileName || '').toLowerCase().split('.');
    return parts.length > 1 ? parts.pop() : '';
  }

  function formatFileSize(bytes) {
    return `${(Number(bytes || 0) / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  }

  function validateAttachmentFiles(files = []) {
    const entries = Array.from(files || []).filter(Boolean);
    const errors = [];
    const namesSeen = new Map();

    entries.forEach((file) => {
      const normalizedName = String(file.name || '').trim().toLowerCase();
      if (normalizedName) {
        namesSeen.set(normalizedName, (namesSeen.get(normalizedName) || 0) + 1);
      }
      const extension = getFileExtension(file.name);
      const mimeType = String(file.type || '').toLowerCase();
      const allowedExtension = ALLOWED_FILE_EXTENSIONS.has(extension);
      const allowedMime = !mimeType || mimeType === 'application/octet-stream' || ALLOWED_FILE_TYPES.has(mimeType);
      if (!allowedExtension || !allowedMime) {
        errors.push(`${file.name || 'El archivo'} no es JPG, PNG, WEBP ni PDF.`);
      }
      if (Number(file.size || 0) <= 0) {
        errors.push(`${file.name || 'El archivo'} está vacío.`);
      }
      if (Number(file.size || 0) > MAX_FILE_BYTES) {
        errors.push(`${file.name || 'El archivo'} pesa ${formatFileSize(file.size)} y supera el máximo de 20 MB.`);
      }
    });

    const duplicateNames = [...namesSeen.entries()]
      .filter(([, count]) => count > 1)
      .map(([name]) => name);
    if (duplicateNames.length) {
      errors.push(`Hay nombres de archivo repetidos (${duplicateNames.join(', ')}). Renombrá los archivos para continuar.`);
    }

    const totalBytes = entries.reduce((sum, file) => sum + Number(file.size || 0), 0);
    if (totalBytes > MAX_TOTAL_FILE_BYTES) {
      errors.push(`Los archivos pesan ${formatFileSize(totalBytes)} en total y superan el máximo de 30 MB.`);
    }

    return [...new Set(errors)];
  }

  function reportFileErrors(errors = []) {
    if (!errors.length) return;
    refs.submitStatus.textContent = errors[0];
    showValidationPopup(errors);
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

  function getAllAttachments() {
    const activeChequeCount = getChequeCount();
    return [
      ...state.attachments,
      ...state.chequeFiles
        .slice(0, activeChequeCount)
        .map((entry) => entry?.uploadFile)
        .filter(Boolean)
    ];
  }

  async function serializeAttachments() {
    const files = getAllAttachments();
    const fileErrors = validateAttachmentFiles(files);
    if (fileErrors.length) {
      throw new Error(fileErrors.join(' '));
    }
    return Promise.all(
      files.map(async (file) => ({
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
    state.submissionKey = null;
    refs.previewSection.hidden = true;
  }

  function generateSubmissionKey() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `cmp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function isChequePaymentMethod(value) {
    const compact = normalizeText(value).replace(/[^a-z0-9]+/g, '');
    return compact.includes('cheque')
      || compact.includes('echeq')
      || compact.includes('echeck');
  }

  function isChequeFlow(tipo = refs.tipo?.value, medioPago = refs.medioPago?.value) {
    return (tipo === 'Venta' || tipo === 'Cobranza') && isChequePaymentMethod(medioPago);
  }

  function compactNotionId(value) {
    return String(value || '').replace(/-/g, '').trim().toLowerCase();
  }

  function hasValidatedRelatedSale() {
    const inputId = compactNotionId(refs.latestSaleId?.value);
    const saleId = compactNotionId(state.relatedSale?.notionPageId);
    const saleDate = toDateInputValue(state.relatedSale?.fechaVenta);
    return Boolean(inputId && saleId && inputId === saleId && isIsoDate(saleDate));
  }

  function setCreatingPopup(isVisible) {
    if (!refs.creatingPopup) return;
    refs.creatingPopup.hidden = !isVisible;
  }

  function setSectionVisibility(node, isVisible) {
    if (!node) return;
    node.hidden = !isVisible;
  }

  function getStepState() {
    const tipo = refs.tipo.value;
    const isVenta = tipo === 'Venta';
    const isCobranza = tipo === 'Cobranza';
    const isDevolucion = tipo === 'Devolución';
    const isCheque = isChequePaymentMethod(refs.medioPago.value);
    const chequeFlow = isChequeFlow(tipo, refs.medioPago.value);
    const isClubSale = isVenta && isClubProduct(refs.productName.value);
    const clientReady = Boolean(refs.clientName.value && refs.ghlId.value && refs.clientPageId.value);
    const baseReady = clientReady
      && Boolean(tipo)
      && (isClubSale || Boolean(refs.dniCuit.value.trim()))
      && Boolean(refs.medioPago.value)
      && isPositiveNumber(refs.tc.value)
      && Boolean(refs.responsableVenta.value);
    const ventaReady = isVenta
      ? (
          Boolean(refs.productName.value)
          && isPositiveNumber(refs.facturacionUsd.value)
          && Boolean(refs.cantidadPagos.value)
        )
      : true;
    const cashReady = baseReady && isPositiveNumber(refs.cashCollectedArs.value);
    const chequeCount = getChequeCount();
    const chequeRows = collectChequeRows();
    const chequeAmountsReady = chequeRows.every((row) => isPositiveNumber(row.montoArs));
    const chequeDatesReady = chequeRows.every((row) => isIsoDate(row.fechaAcreditacion));
    const chequeFilesReady = chequeCount > 0
      && Array.from(
        { length: chequeCount },
        (_, index) => Boolean(state.chequeFiles[index]?.uploadFile)
      ).every(Boolean);
    const chequeTotal = chequeRows.reduce((sum, row) => sum + parseLocaleNumber(row.montoArs), 0);
    const chequeTotalMatchesCash = Math.abs(chequeTotal - parseLocaleNumber(refs.cashCollectedArs.value)) <= 1;
    const chequeReady = !chequeFlow || (
      chequeCount > 0
      && chequeRows.length === chequeCount
      && chequeAmountsReady
      && chequeDatesReady
      && chequeFilesReady
      && chequeTotalMatchesCash
    );
    const attachmentFilesValid = validateAttachmentFiles(getAllAttachments()).length === 0;
    const attachmentReady = (chequeFlow
      ? chequeFilesReady
      : state.attachments.length > 0) && attachmentFilesValid;
    const needsRelatedSale = tipo === 'Cobranza' || tipo === 'Devolución';
    const relationReady = !needsRelatedSale || hasValidatedRelatedSale();
    const readyToReview = baseReady && ventaReady && relationReady && cashReady && chequeReady && attachmentReady;

    return {
      tipo,
      isVenta,
      isCobranza,
      isDevolucion,
      isCheque,
      chequeFlow,
      clientReady,
      baseReady,
      ventaReady,
      cashReady,
      chequeReady,
      chequeCount,
      chequeTotalMatchesCash,
      attachmentFilesValid,
      attachmentReady,
      relationReady,
      readyToReview
    };
  }

  function updateStepFlow() {
    const stepState = getStepState();

    setSectionVisibility(refs.baseSection, stepState.clientReady);
    setSectionVisibility(refs.ventaFields, stepState.baseReady && (stepState.isVenta || stepState.isDevolucion));
    setSectionVisibility(
      refs.cobranzaLinkSection,
      stepState.baseReady
        && (!stepState.isVenta || stepState.ventaReady)
        && (stepState.tipo === 'Cobranza' || stepState.tipo === 'Devolución')
    );
    setSectionVisibility(
      refs.cashSection,
      stepState.baseReady
        && (!stepState.isVenta || stepState.ventaReady)
        && (stepState.relationReady || !(stepState.tipo === 'Cobranza' || stepState.tipo === 'Devolución'))
    );
    setSectionVisibility(
      refs.chequeFields,
      stepState.baseReady && stepState.chequeFlow && stepState.ventaReady && stepState.relationReady && stepState.cashReady
    );
    setSectionVisibility(
      refs.attachmentsSection,
      stepState.baseReady && (!stepState.isVenta || stepState.ventaReady) && stepState.relationReady && stepState.cashReady && stepState.chequeReady
    );
    setSectionVisibility(
      refs.submitSection,
      stepState.baseReady
        && (!stepState.isVenta || stepState.ventaReady)
        && stepState.relationReady
        && stepState.cashReady
        && stepState.chequeReady
        && stepState.attachmentReady
    );

    refs.submitBtn.disabled = !stepState.readyToReview;

    if (!stepState.clientReady) {
      refs.submitStatus.textContent = 'Primero buscá y vinculá el cliente.';
      return;
    }
    if (!stepState.baseReady) {
      refs.submitStatus.textContent = 'Completá tipo, DNI/CUIT, medio de pago, TC mayor a cero y responsable para seguir.';
      return;
    }
    if (stepState.isVenta && !stepState.ventaReady) {
      refs.submitStatus.textContent = 'Completá producto, facturación USD y cantidad de pagos para seguir.';
      return;
    }
    if (!stepState.relationReady) {
      refs.submitStatus.textContent = 'Necesitás cargar la venta relacionada para seguir.';
      return;
    }
    if (!stepState.cashReady) {
      refs.submitStatus.textContent = 'Completá el cash collected ARS con un importe mayor a cero para seguir.';
      return;
    }
    if (!stepState.chequeReady) {
      refs.submitStatus.textContent = !stepState.chequeCount
        ? `Elegí entre 1 y ${MAX_CHEQUES} cheques para seguir.`
        : stepState.chequeTotalMatchesCash
        ? 'Completá monto, fecha y archivo de cada cheque para seguir.'
        : 'La suma de los cheques debe coincidir con el cash collected ARS.';
      return;
    }
    if (!stepState.attachmentReady) {
      refs.submitStatus.textContent = stepState.attachmentFilesValid
        ? 'Adjuntá el comprobante para seguir.'
        : validateAttachmentFiles(getAllAttachments())[0];
      return;
    }
    refs.submitStatus.textContent = 'Todo completo. Ya podés revisar antes de enviar.';
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

  function renderLatestSaleSummary(sale, emptyText = 'Todavía no encontré una venta previa.') {
    if (!sale) {
      refs.latestSaleSummary.innerHTML = `<strong>${escapeHtml(emptyText)}</strong>`;
      return;
    }

    refs.latestSaleSummary.innerHTML = `
      <strong>Venta relacionada encontrada</strong>
      <span>Producto: ${escapeHtml(sale.producto || '-')}</span>
      <span>Fecha venta: ${escapeHtml(toDateInputValue(sale.fechaVenta) || '-')}</span>
      <span>Facturación USD: ${sale.facturacionUsd ? formatCurrency(sale.facturacionUsd) : '-'}</span>
      <span>Cash collected total: ${sale.cashCollectedTotal ? formatCurrency(sale.cashCollectedTotal) : '-'}</span>
    `;
  }

  function resetChequeDraft() {
    state.chequeDrafts = [];
    state.chequeFiles = [];
    if (refs.chequeCount) refs.chequeCount.value = '';
    if (refs.chequeRows) refs.chequeRows.innerHTML = '';
  }

  function resetTransactionForClientChange() {
    state.attachments = [];
    resetChequeDraft();
    refs.tc.value = '';
    refs.cashCollectedArs.value = '';
    refs.cashCollectedUsd.value = '';
    refs.facturacionUsd.value = '';
    refs.cantidadPagos.value = '';
    renderAttachments();
    updateCashValidation();
    invalidatePreview();
  }

  function setClientSummary(client) {
    if (!client) {
      state.relatedSale = null;
      refs.clientSummary.innerHTML = '<strong>Sin cliente cargado todavía.</strong>';
      refs.latestSaleId.value = '';
      renderLatestSaleSummary(null);
      syncAutomaticDates();
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
    state.relatedSale = sale || null;
    refs.latestSaleId.value = sale?.notionPageId || '';
    if (!sale) {
      renderLatestSaleSummary(null, 'No encontré una venta previa cargada para este cliente.');
      syncAutomaticDates();
      return;
    }

    renderLatestSaleSummary(sale);
    syncAutomaticDates();
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
    const incomingFiles = Array.from(files || []).filter(Boolean);
    const nextFiles = [...getAllAttachments(), ...incomingFiles];
    const errors = validateAttachmentFiles(nextFiles);
    if (errors.length) {
      reportFileErrors(errors);
      return false;
    }
    state.attachments = [...state.attachments, ...incomingFiles];
    renderAttachments();
    return true;
  }

  function renderChequeRows() {
    const count = getChequeCount();
    if (!count) {
      if (refs.tipo.value === 'Venta' && isChequePaymentMethod(refs.medioPago.value)) {
        refs.cantidadPagos.disabled = false;
      }
      refs.chequeRows.innerHTML = '';
      updateCashValidation();
      return;
    }

    Array.from({ length: count }, (_, index) => index).forEach((index) => {
      if (!state.chequeDrafts[index]) {
        state.chequeDrafts[index] = {
          montoArs: '',
          fechaAcreditacion: refs.fechaAcreditacion.value || todayIso()
        };
      }
    });
    if (refs.tipo.value === 'Venta') {
      refs.cantidadPagos.value = String(count);
      refs.cantidadPagos.disabled = true;
    }

    refs.chequeRows.innerHTML = Array.from({ length: count }, (_, index) => `
      <article class="carga-cheque-row" data-cheque-index="${index}">
        <h4>Cheque ${index + 1}</h4>
        <div class="carga-grid carga-grid--two">
          <label class="carga-field">
            <span>Monto ARS</span>
            <input type="text" inputmode="decimal" data-cheque-monto="${index}" value="${escapeHtml(state.chequeDrafts[index].montoArs)}" placeholder="Ej: 250.000" />
          </label>
          <label class="carga-field">
            <span>Archivo / foto</span>
            <input type="file" data-cheque-file="${index}" accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf" />
            <small class="carga-cheque-file-name" data-cheque-file-name="${index}">
              ${state.chequeFiles[index]?.originalName ? escapeHtml(state.chequeFiles[index].originalName) : 'Sin archivo seleccionado'}
            </small>
          </label>
          <label class="carga-field">
            <span>Fecha de acreditación</span>
            <input type="date" data-cheque-fecha="${index}" value="${escapeHtml(state.chequeDrafts[index].fechaAcreditacion)}" />
          </label>
        </div>
      </article>
    `).join('');

    refs.chequeRows.querySelectorAll('[data-cheque-monto]').forEach(bindFormattedNumberInput);
    refs.chequeRows.querySelectorAll('[data-cheque-file]').forEach((node) => {
      node.addEventListener('change', (event) => {
        const index = Number(event.currentTarget.dataset.chequeFile);
        const file = event.currentTarget.files?.[0] || null;
        if (file) {
          const uploadName = `cheque-${index + 1}-${file.name}`;
          const uploadFile = new File([file], uploadName, {
            type: file.type || 'application/octet-stream',
            lastModified: file.lastModified
          });
          const existingFiles = [
            ...state.attachments,
            ...state.chequeFiles
              .slice(0, count)
              .filter((_, fileIndex) => fileIndex !== index)
              .map((entry) => entry?.uploadFile)
              .filter(Boolean)
          ];
          const errors = validateAttachmentFiles([...existingFiles, uploadFile]);
          if (errors.length) {
            event.currentTarget.value = '';
            reportFileErrors(errors);
            const currentLabel = refs.chequeRows.querySelector(`[data-cheque-file-name="${index}"]`);
            if (currentLabel) currentLabel.textContent = state.chequeFiles[index]?.originalName || 'Sin archivo seleccionado';
            return;
          }
          state.chequeFiles[index] = {
            originalName: file.name,
            uploadFile
          };
        } else {
          state.chequeFiles[index] = null;
        }

        const label = refs.chequeRows.querySelector(`[data-cheque-file-name="${index}"]`);
        if (label) label.textContent = file?.name || 'Sin archivo seleccionado';
        updateCashValidation();
        updateStepFlow();
        invalidatePreview();
      });
    });

    refs.chequeRows.querySelectorAll('[data-cheque-monto]').forEach((node) => {
      node.addEventListener('input', (event) => {
        const index = Number(event.currentTarget.dataset.chequeMonto);
        state.chequeDrafts[index].montoArs = event.currentTarget.value;
        updateCashValidation();
        updateStepFlow();
        invalidatePreview();
      });
    });
    refs.chequeRows.querySelectorAll('[data-cheque-fecha]').forEach((node) => {
      node.addEventListener('change', (event) => {
        const index = Number(event.currentTarget.dataset.chequeFecha);
        state.chequeDrafts[index].fechaAcreditacion = event.currentTarget.value;
        updateCashValidation();
        updateStepFlow();
        invalidatePreview();
      });
    });
    updateCashValidation();
  }

  function updateVisibility() {
    const tipo = refs.tipo.value;
    const isVenta = tipo === 'Venta';
    const isCobranza = tipo === 'Cobranza';
    const isDevolucion = tipo === 'Devolución';
    const isCheque = isChequePaymentMethod(refs.medioPago.value);
    const chequeFlow = isChequeFlow(tipo, refs.medioPago.value);

    refs.ventaFields.hidden = !(isVenta || isDevolucion);
    refs.chequeFields.hidden = !chequeFlow;
    refs.cobranzaLinkSection.hidden = !(isCobranza || isDevolucion);
    setSectionVisibility(refs.mesesSoporteField, isVenta);
    setSectionVisibility(refs.sesionesField, isVenta);
    setSectionVisibility(refs.bonusMatiField, isVenta);
    setSectionVisibility(refs.productNameField, isVenta);
    setSectionVisibility(refs.cantidadPagosField, isVenta);
    setSectionVisibility(refs.facturacionUsdField, isVenta || isDevolucion);

    refs.productName.disabled = !isVenta;
    refs.dniCuit.required = !(isVenta && isClubProduct(refs.productName.value));
    refs.cantidadPagos.disabled = !isVenta || (isVenta && isCheque && getChequeCount() > 0);
    refs.latestSaleId.readOnly = !(isCobranza || isDevolucion);
    if (refs.searchRelatedSaleBtn) refs.searchRelatedSaleBtn.hidden = !(isCobranza || isDevolucion);
    if (refs.chequeHelpText) {
      refs.chequeHelpText.textContent = isVenta
        ? 'Subí monto, fecha y archivo de cada cheque. El primero crea la venta y los siguientes crean cobranzas relacionadas.'
        : 'Subí monto, fecha y archivo de cada cheque. Todos crean cobranzas vinculadas a la venta relacionada.';
    }

    if (!isVenta && !isDevolucion) {
      refs.facturacionUsd.value = '';
      refs.cantidadPagos.value = '';
      refs.productName.value = '';
      refs.mesesSoporte.value = '';
      refs.sesiones.value = '';
      refs.bonusMati.checked = false;
    }

    if (isDevolucion) {
      refs.cantidadPagos.value = '';
      refs.productName.value = '';
    }

    if (!chequeFlow) {
      resetChequeDraft();
    } else if (isVenta && getChequeCount()) {
      refs.cantidadPagos.value = String(getChequeCount());
    }

    if ((isCobranza || isDevolucion) && !refs.latestSaleId.value) {
      renderLatestSaleSummary(null, 'Pegá el Notion ID de la venta para traer la referencia.');
    }

    syncAutomaticDates();
    updateCashValidation();
    updateStepFlow();
    invalidatePreview();
  }

  function updateCashValidation() {
    const tc = parseLocaleNumber(refs.tc.value);
    const cashArs = parseLocaleNumber(refs.cashCollectedArs.value);
    const tipo = refs.tipo.value;
    const chequeFlow = isChequeFlow(tipo, refs.medioPago.value);

    refs.cashCollectedUsd.value = tc > 0 && cashArs > 0 ? formatCurrency(cashArs / tc) : '';
    refs.cashValidationCard.className = 'carga-validation-card';

    if (!(tc > 0) || !(cashArs > 0)) {
      refs.cashValidationCard.innerHTML = '<strong>Cash informativo</strong><p>Completá TC y cash ARS con valores mayores a cero para calcular el equivalente en USD.</p>';
      return;
    }

    const cashUsd = cashArs / tc;
    if (!chequeFlow) {
      refs.cashValidationCard.innerHTML = `
        <strong>Cash informativo</strong>
        <p>Cash USD calculado: ${formatCurrency(cashUsd)}.</p>
        <p>No se compara ni se limita contra la facturación.</p>
      `;
      return;
    }

    const count = getChequeCount();
    if (!count) {
      refs.cashValidationCard.innerHTML = `
        <strong>Cash informativo</strong>
        <p>Cash USD calculado: ${formatCurrency(cashUsd)}.</p>
        <p>Elegí entre 1 y ${MAX_CHEQUES} cheques para controlar la suma.</p>
      `;
      return;
    }

    const chequeRows = collectChequeRows();
    const amountsReady = chequeRows.length === count && chequeRows.every((row) => isPositiveNumber(row.montoArs));
    const chequeTotal = chequeRows.reduce((sum, row) => sum + parseLocaleNumber(row.montoArs), 0);
    const differenceArs = chequeTotal - cashArs;
    const totalMatches = amountsReady && Math.abs(differenceArs) <= 1;
    refs.cashValidationCard.className = `carga-validation-card ${totalMatches ? 'is-ok' : 'is-error'}`;
    refs.cashValidationCard.innerHTML = `
      <strong>${totalMatches ? 'Suma de cheques OK' : 'Revisar suma de cheques'}</strong>
      <p>Cash: ${formatCurrency(cashArs, 'ARS')} | Cheques: ${formatCurrency(chequeTotal, 'ARS')}</p>
      <p>${amountsReady ? `Diferencia: ${formatCurrency(differenceArs, 'ARS')} (tolerancia ARS 1).` : 'Completá todos los montos con valores mayores a cero.'}</p>
      <p>Cash USD informativo: ${formatCurrency(cashUsd)}.</p>
    `;
  }

  function buildPreviewWarnings(payload) {
    const warnings = [];
    const isClubSale = payload.tipo === 'Venta' && isClubProduct(payload.productName);
    const chequeFlow = isChequeFlow(payload.tipo, payload.medioPago);
    const needsRelatedSale = payload.tipo === 'Cobranza' || payload.tipo === 'Devolución';

    if (!payload.clientName) warnings.push('Falta buscar y vincular el cliente.');
    if (!payload.ghlId) warnings.push('Falta el GHL ID.');
    if (!payload.tipo) warnings.push('Falta elegir el tipo.');
    if (!isIsoDate(payload.fechaVenta)) warnings.push('Falta una fecha de venta / transacción válida.');
    if (!isIsoDate(payload.fechaAcreditacion)) warnings.push('Falta una fecha de acreditación válida.');
    if (!payload.dniCuit && !isClubSale) warnings.push('Falta el DNI / CUIT.');
    if (!isPositiveNumber(payload.tc)) warnings.push('La tasa de cambio debe ser mayor a cero.');
    if (!isPositiveNumber(payload.cashCollectedArs)) warnings.push('El cash collected ARS debe ser mayor a cero.');
    if (!payload.medioPago) warnings.push('Falta el medio de pago.');
    if (!payload.responsableVenta) warnings.push('Falta el responsable de venta.');
    if (!Array.isArray(payload.attachmentFiles) || !payload.attachmentFiles.length) warnings.push('Falta adjuntar el comprobante.');
    if (needsRelatedSale && (!payload.latestSaleId || !hasValidatedRelatedSale())) {
      warnings.push('Falta buscar y validar la venta relacionada.');
    }
    warnings.push(...validateAttachmentFiles(payload.attachmentFiles || []));

    if (payload.tipo === 'Venta') {
      if (!payload.productName) warnings.push('Falta elegir el producto adquirido.');
      if (!isPositiveNumber(payload.facturacionUsd)) warnings.push('La facturación USD debe ser mayor a cero.');
      if (!payload.cantidadPagos) warnings.push('Falta la cantidad de pagos.');
    }

    if (chequeFlow) {
      const chequeCount = Number(payload.chequeCount || 0);
      const chequeRows = Array.isArray(payload.cheques) ? payload.cheques : [];
      if (!Number.isInteger(chequeCount) || chequeCount < 1 || chequeCount > MAX_CHEQUES) {
        warnings.push(`La cantidad de cheques debe ser un entero entre 1 y ${MAX_CHEQUES}.`);
      }
      if (chequeRows.length !== chequeCount) warnings.push('La cantidad de cheques cargados no coincide con la seleccionada.');
      if (chequeRows.some((row) => !isPositiveNumber(row.montoArs))) warnings.push('Cada cheque debe tener un monto ARS mayor a cero.');
      if (chequeRows.some((row) => !isIsoDate(row.fechaAcreditacion))) warnings.push('Falta una fecha de acreditación válida en algún cheque.');
      if (chequeRows.some((row) => !row.archivoNombre)) warnings.push('Falta el archivo o foto de algún cheque.');
      const chequeTotal = chequeRows.reduce((sum, row) => sum + parseLocaleNumber(row.montoArs), 0);
      if (Math.abs(chequeTotal - parseLocaleNumber(payload.cashCollectedArs)) > 1) {
        warnings.push('La suma de los cheques debe coincidir con el cash collected ARS, con tolerancia de ARS 1.');
      }
      if (payload.tipo === 'Venta' && Number(payload.cantidadPagos) !== chequeCount) {
        warnings.push('La cantidad de pagos debe coincidir con la cantidad de cheques.');
      }
    }

    return [...new Set(warnings)];
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
      ['Cash AR', payload.cashCollectedArs ? formatCurrency(parseLocaleNumber(payload.cashCollectedArs), 'ARS') : '-']
    ];

    if (payload.tc && payload.cashCollectedArs) {
      rows.push(['Cash USD', formatCurrency(parseLocaleNumber(payload.cashCollectedArs) / parseLocaleNumber(payload.tc))]);
    }

    if (payload.tipo === 'Venta' || payload.tipo === 'Devolución') {
      if (payload.tipo === 'Venta') rows.push(['Producto adquirido', payload.productName || '-']);
      rows.push(['Facturación USD', payload.facturacionUsd ? formatCurrency(parseLocaleNumber(payload.facturacionUsd)) : '-']);
      if (payload.tipo === 'Venta') rows.push(['Cantidad de pagos', payload.cantidadPagos || '-']);
    }

    if (payload.latestSaleId) {
      rows.push(['Venta relacionada', payload.latestSaleId]);
    }

    if (payload.mesesSoporte) rows.push(['Meses de soporte', payload.mesesSoporte]);
    if (payload.sesiones) rows.push(['Sesiones', payload.sesiones]);
    rows.push(['Bonus Mati', payload.bonusMati ? 'Sí' : 'No']);
    rows.push(['Adjuntos', payload.attachmentNames?.length ? payload.attachmentNames.join(', ') : 'Sin adjuntos']);
    rows.push(['Info comprobantes', payload.infoComprobantes || '-']);

    if (isChequePaymentMethod(payload.medioPago) && Array.isArray(payload.cheques) && payload.cheques.length) {
      payload.cheques.forEach((cheque, index) => {
        rows.push([
          `Cheque ${index + 1}`,
          `${cheque.montoArs ? formatCurrency(parseLocaleNumber(cheque.montoArs), 'ARS') : '-'} | ${cheque.fechaAcreditacion || 'Sin fecha'}${cheque.archivoNombre ? ` | ${cheque.archivoNombre}` : ''}`
        ]);
      });
    }

    return rows;
  }

  function countDraftOperations(payload) {
    if (
      isChequeFlow(payload.tipo, payload.medioPago)
      && Array.isArray(payload.cheques)
      && payload.cheques.length > 0
    ) {
      return payload.cheques.length;
    }
    return 1;
  }

  function renderPreview(payload) {
    const warnings = buildPreviewWarnings(payload);
    const operationCount = countDraftOperations(payload);
    refs.previewAlerts.hidden = warnings.length === 0;
    refs.previewAlerts.className = `carga-preview-alerts ${warnings.length ? 'has-warnings' : ''}`;
    refs.previewAlerts.innerHTML = warnings.length
      ? `<strong>Revisá esto antes de confirmar</strong><ul>${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('')}</ul>`
      : `<strong>Todo listo.</strong><p>No vi inconsistencias obvias en la carga previa.</p><p>Esta confirmación va a crear ${operationCount} ${operationCount === 1 ? 'registro' : 'registros'} en Notion.</p>`;

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
      const cantidadPagosOptions = [...new Set([
        ...(response.bootstrap.cantidadPagosOptions || []).map(Number),
        ...Array.from({ length: MAX_CHEQUES }, (_, index) => index + 1)
      ])]
        .filter((value) => Number.isInteger(value) && value >= 1 && value <= MAX_CHEQUES)
        .sort((left, right) => left - right)
        .map(String);
      populateSelect(refs.cantidadPagos, cantidadPagosOptions, 'Elegí pagos');
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
      updateStepFlow();
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
      const previousClientId = normalizeText(state.client?.ghlId || refs.ghlId.value);
      const nextClientId = normalizeText(response.client?.ghlId);
      if (previousClientId && previousClientId !== nextClientId) {
        resetTransactionForClientChange();
      }
      state.client = response.client;
      refs.clientName.value = response.client.nombre || '';
      refs.ghlId.value = response.client.ghlId || '';
      refs.clientPageId.value = response.client.pageId || '';
      updateIdentificador();
      setClientSummary(response.client);
      refs.submitStatus.textContent = 'Cliente encontrado y relación lista.';
      updateStepFlow();
      invalidatePreview();
    } catch (error) {
      if (!state.client) {
        refs.ghlInput.value = '';
        refs.clientName.value = '';
        refs.ghlId.value = '';
        refs.clientPageId.value = '';
        updateIdentificador();
        setClientSummary(null);
      } else {
        refs.ghlInput.value = state.client.ghlId || refs.ghlId.value;
      }
      refs.submitStatus.textContent = error.message || 'No pude encontrar al cliente.';
      updateStepFlow();
    } finally {
      refs.searchClientBtn.disabled = false;
    }
  }

  async function lookupRelatedSaleFromInput() {
    if (refs.tipo.value !== 'Cobranza' && refs.tipo.value !== 'Devolución') return;
    if (state.relatedSaleLookupInFlight) return;

    const saleId = String(refs.latestSaleId.value || '').trim();
    if (!saleId) {
      state.relatedSale = null;
      renderLatestSaleSummary(null, 'Pegá el Notion ID de la venta para traer la referencia.');
      syncAutomaticDates();
      updateStepFlow();
      invalidatePreview();
      return;
    }

    state.relatedSaleLookupInFlight = true;
    refs.searchRelatedSaleBtn.disabled = true;
    refs.submitStatus.textContent = 'Buscando venta relacionada...';
    try {
      const response = await api.lookupComprobantesLoaderRelatedSale(saleId);
      state.relatedSale = response.sale || null;
      refs.latestSaleId.value = response.sale?.notionPageId || saleId;
      renderLatestSaleSummary(response.sale);
      syncAutomaticDates();
      refs.submitStatus.textContent = 'Venta relacionada cargada como referencia.';
    } catch (error) {
      state.relatedSale = null;
      refs.latestSaleId.value = '';
      renderLatestSaleSummary(null, error.message || 'No pude encontrar la venta relacionada.');
      syncAutomaticDates();
      refs.submitStatus.textContent = error.message || 'No pude encontrar la venta relacionada.';
    } finally {
      state.relatedSaleLookupInFlight = false;
      refs.searchRelatedSaleBtn.disabled = false;
      updateStepFlow();
      invalidatePreview();
    }
  }

  function collectChequeRows() {
    refs.chequeRows.querySelectorAll('.carga-cheque-row').forEach((row) => {
      const index = Number(row.dataset.chequeIndex);
      if (!Number.isInteger(index) || !state.chequeDrafts[index]) return;
      state.chequeDrafts[index].montoArs = row.querySelector(`[data-cheque-monto="${index}"]`)?.value || '';
      state.chequeDrafts[index].fechaAcreditacion = row.querySelector(`[data-cheque-fecha="${index}"]`)?.value || '';
    });
    const count = getChequeCount();
    return state.chequeDrafts.slice(0, count).map((row, index) => ({
      montoArs: row.montoArs || '',
      archivoNombre: state.chequeFiles[index]?.uploadFile?.name || '',
      fechaAcreditacion: row.fechaAcreditacion || ''
    }));
  }

  async function buildPayload() {
    const attachmentFiles = await serializeAttachments();
    const usesRelatedSaleDate = refs.tipo.value === 'Cobranza' || refs.tipo.value === 'Devolución';
    return {
      tipo: refs.tipo.value,
      ghlId: refs.ghlId.value || refs.ghlInput.value.trim(),
      clientName: refs.clientName.value,
      clientPageId: refs.clientPageId.value,
      identificador: refs.identificador.value,
      responsableVenta: refs.responsableVenta.value,
      fechaVenta: usesRelatedSaleDate ? refs.fechaVenta.value : (refs.fechaVenta.value || todayIso()),
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
      attachmentNames: getAllAttachments().map((file) => file.name),
      attachmentFiles,
      mesesSoporte: refs.tipo.value === 'Venta' ? refs.mesesSoporte.value : '',
      sesiones: refs.tipo.value === 'Venta' ? refs.sesiones.value : '',
      bonusMati: refs.tipo.value === 'Venta' ? refs.bonusMati.checked : false,
      infoComprobantes: refs.infoComprobantes.value,
      submissionKey: state.submissionKey || generateSubmissionKey()
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
      state.submissionKey = payload.submissionKey;
      renderPreview(payload);
      refs.submitStatus.textContent = 'Revisá el detalle y confirmá si está todo bien.';
    } catch (error) {
      refs.submitStatus.textContent = error.message || 'No pude preparar la revisión del comprobante.';
    } finally {
      refs.submitBtn.disabled = false;
    }
  }

  async function confirmSubmit() {
    if (state.isSubmitting) return;
    state.isSubmitting = true;
    refs.submitBtn.disabled = true;
    refs.confirmSubmitBtn.disabled = true;
    refs.submitStatus.textContent = 'Creando comprobante...';
    setCreatingPopup(true);

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
      refs.responsableVenta.value = state.bootstrap?.responsibleVentaDefault || '';
      syncAutomaticDates();
      state.attachments = [];
      state.chequeDrafts = [];
      state.chequeFiles = [];
      state.client = null;
      state.relatedSale = null;
      renderAttachments();
      setClientSummary(null);
      updateIdentificador();
      renderChequeRows();
      updateVisibility();
      updateStepFlow();
      invalidatePreview();
    } catch (error) {
      refs.submitStatus.textContent = error.message || 'No pude crear el comprobante.';
    } finally {
      state.isSubmitting = false;
      setCreatingPopup(false);
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
  refs.searchRelatedSaleBtn?.addEventListener('click', lookupRelatedSaleFromInput);
  refs.latestSaleId?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      lookupRelatedSaleFromInput();
    }
  });
  refs.latestSaleId?.addEventListener('input', () => {
    if (hasValidatedRelatedSale()) return;
    state.relatedSale = null;
    syncAutomaticDates();
    renderLatestSaleSummary(null, 'Presioná Buscar venta para validar el Notion ID.');
  });
  refs.latestSaleId?.addEventListener('blur', lookupRelatedSaleFromInput);
  refs.clientName?.addEventListener('input', updateIdentificador);
  refs.tipo?.addEventListener('change', updateVisibility);
  refs.medioPago?.addEventListener('change', () => {
    if (!isChequePaymentMethod(refs.medioPago.value)) {
      resetChequeDraft();
    }
    updateVisibility();
  });
  refs.tipo?.addEventListener('change', syncAutomaticDates);
  refs.tc?.addEventListener('input', updateCashValidation);
  refs.cashCollectedArs?.addEventListener('input', updateCashValidation);
  refs.facturacionUsd?.addEventListener('input', updateCashValidation);
  bindFormattedNumberInput(refs.tc);
  bindFormattedNumberInput(refs.cashCollectedArs);
  bindFormattedNumberInput(refs.facturacionUsd);
  bindDigitsOnlyInput(refs.dniCuit);
  refs.chequeCount?.addEventListener('change', () => {
    renderChequeRows();
    const fileErrors = validateAttachmentFiles(getAllAttachments());
    if (fileErrors.length) reportFileErrors(fileErrors);
    updateStepFlow();
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
    node?.addEventListener('input', updateStepFlow);
    node?.addEventListener('change', updateStepFlow);
  });
  refs.bonusMati?.addEventListener('change', invalidatePreview);
  refs.bonusMati?.addEventListener('change', updateStepFlow);

  refs.attachments?.addEventListener('change', (event) => {
    const didSync = syncFiles(event.target.files);
    refs.attachments.value = '';
    if (didSync) {
      updateStepFlow();
      invalidatePreview();
    }
  });

  refs.attachmentsList?.addEventListener('click', (event) => {
    const removeIndex = event.target?.dataset?.removeAttachment;
    if (removeIndex === undefined) return;
    state.attachments.splice(Number(removeIndex), 1);
    renderAttachments();
    updateStepFlow();
    invalidatePreview();
  });

  refs.attachmentsDropzone?.addEventListener('click', (event) => {
    if (event.target === refs.attachments) return;
    refs.attachments.click();
  });
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
    if (syncFiles(event.dataTransfer?.files)) {
      updateStepFlow();
      invalidatePreview();
    }
  });

  syncAutomaticDates();
  bootstrap();
})();
