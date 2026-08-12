const axios = require('axios');
const env = require('../config/env');
const submissionCache = new Map();
const SUBMISSION_TTL_MS = 15 * 60 * 1000;
const MAX_CHEQUES = 6;
const MAX_PAYMENT_COUNT = 6;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 30 * 1024 * 1024;
const NOTION_REQUEST_TIMEOUT_MS = 30 * 1000;
const NOTION_UPLOAD_TIMEOUT_MS = 60 * 1000;
const ACCEPTED_ATTACHMENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf'
]);
const ACCEPTED_ATTACHMENT_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf']);

const DEFAULT_PRODUCTS = [
  'Club',
  'Meg 2.1',
  'Renovacion Meg 2.1',
  'Meg personalizado',
  'Renovacion personalizado'
];

const DEFAULT_PAYMENT_METHODS = [
  'Transferencia',
  'Tarjeta',
  'Efectivo',
  'Cheque',
  'Cripto',
  'Otro'
];

const DEFAULT_TYPES = ['Venta', 'Cobranza', 'Devolución'];

const RESPONSABLE_VENTA_BY_EMAIL = {
  'charliecarlostu@gmail.com': 'Carlos Tu',
  'meg.claudionicolini@gmail.com': 'Claudio Nicolini',
  'fran@romsconsultora.com': 'Fran',
  'juanma@romsconsultora.com': 'Juanma',
  'leonardoalaniz19@gmail.com': 'Leonardo Alaniz',
  'matirandazzo@gmail.com': 'Mati Randazzo',
  'gaitanmauro23@gmail.com': 'Mauro Gaitan',
  'nahuerandazzo@gmail.com': 'Nahue Randazzo',
  'iascinahuel@gmail.com': 'Nahuel Iasci',
  'pmbutera1234@gmail.com': 'Pablo Butera',
  'posadaelmontecito@gmail.com': 'Patricia Conti',
  'robertoboero83@gmail.com': 'Rober',
  'tomas@romsconsultora.com': 'Tomas',
  'walteralegre56@gmail.com': 'Walter Alegre',
  'belenherrera.gestion@gmail.com': 'Belen Herrera',
  'glcosta.gc11@gmail.com': 'Gl Costa',
  'valecalmet@gmail.com': 'Vale Calmet'
};

function requiredSupabaseEnv() {
  if (!env.supabaseUrl || !env.supabaseKey) {
    const error = new Error('Faltan variables de Supabase para carga de comprobantes');
    error.statusCode = 500;
    throw error;
  }
}

function buildSupabaseHeaders(extra = {}) {
  requiredSupabaseEnv();
  return {
    apikey: env.supabaseKey,
    Authorization: `Bearer ${env.supabaseKey}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

function buildNotionHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${env.notionApiKey}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
    ...extra
  };
}

function getComprobantesDatabaseId() {
  return env.notionComprobantesDatabaseId || env.notionDatabaseId;
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

function isChequePaymentMethod(value) {
  const compact = normalizeText(value).replace(/[^a-z0-9]+/g, '');
  return compact.includes('cheque')
    || compact.includes('echeq')
    || compact.includes('echeck');
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
}

function findNotionProperty(properties = {}, expectedName = '') {
  const target = normalizeText(expectedName);
  return Object.entries(properties).find(([name]) => normalizeText(name) === target)?.[1] || null;
}

function notionPropertyDisplayText(property) {
  if (!property) return '';
  if (property.formula?.string != null) return String(property.formula.string);
  if (property.formula?.number != null) return String(property.formula.number);
  if (typeof property.formula?.boolean === 'boolean') return String(property.formula.boolean);
  if (property.rollup?.type === 'number' && property.rollup.number != null) return String(property.rollup.number);
  if (property.select?.name) return String(property.select.name);
  if (property.status?.name) return String(property.status.name);
  if (Array.isArray(property.multi_select)) return property.multi_select.map((item) => item?.name || '').filter(Boolean).join(', ');
  if (property.number != null) return String(property.number);
  if (property.email) return String(property.email);
  if (property.phone_number) return String(property.phone_number);
  if (property.url) return String(property.url);
  for (const key of ['title', 'rich_text']) {
    if (Array.isArray(property[key])) {
      return property[key].map((item) => item.plain_text || item.text?.content || '').join('');
    }
  }
  return '';
}

function isNotionPaymentMethodActive(properties = {}) {
  const activeProperty = [
    'Activo',
    'Activo / no activo',
    'Activo/no activo',
    'Status'
  ].map((name) => findNotionProperty(properties, name)).find(Boolean);
  // Mantiene compatibles las bases antiguas que todavía no tienen la columna.
  if (!activeProperty) return true;
  if (typeof activeProperty.checkbox === 'boolean') return activeProperty.checkbox;
  if (typeof activeProperty.formula?.boolean === 'boolean') return activeProperty.formula.boolean;

  const value = normalizeText(notionPropertyDisplayText(activeProperty));
  if (!value) return false;
  return ['activo', 'activa', 'si', 'sí', 'true', '1', 'yes'].includes(value);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

const COMPROBANTES_GLOBAL_VIEWER_EMAILS = new Set([
  'matirandazzo@gmail.com',
  'nadia.cavallini@gmail.com'
]);

const COMPROBANTES_SETTER_VIEWER_NAMES_BY_EMAIL = {
  'nahuerandazzo@gmail.com': ['Nahue Randazzo', 'Nahue', 'Nahuel'],
  'iascinahuel@gmail.com': ['Nahuel Iasci', 'Nahuel']
};

function canViewAllComprobantes(user = {}) {
  return COMPROBANTES_GLOBAL_VIEWER_EMAILS.has(normalizeEmail(user?.email));
}

function getComprobantesSetterNames(user = {}) {
  return uniqueSorted(
    COMPROBANTES_SETTER_VIEWER_NAMES_BY_EMAIL[normalizeEmail(user?.email)] || []
  );
}

function titleCaseName(value) {
  const source = String(value || '').trim();
  if (!source) return '';
  return source
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function extractResponsibleVenta(infoComprobantes = '') {
  const raw = String(infoComprobantes || '').trim();
  if (!raw) return '';
  const match = raw.match(/responsable venta:\s*([^|]+)/i);
  return titleCaseName(match?.[1] || '');
}

function extractComprobanteUploader(infoComprobantes = '') {
  const raw = String(infoComprobantes || '').trim();
  if (!raw) return '';
  const match = raw.match(/cargado por:\s*([^|]+)/i);
  return titleCaseName(match?.[1] || '');
}

function resolveComprobanteResponsible(row = {}) {
  return titleCaseName(
    row.responsable_venta
    || extractResponsibleVenta(row.info_comprobantes)
    || row.responsable_actual
    || row.creado_por
  );
}

function resolveComprobanteResponsibleVentaOnly(row = {}) {
  return titleCaseName(
    row.responsable_venta
    || extractResponsibleVenta(row.info_comprobantes)
  );
}

function isComprobanteConciliated(row = {}) {
  const status = normalizeText(row.estado);
  return Boolean(status) && !status.includes('sin conciliar') && status.includes('concili');
}

function canEditComprobanteStatus(row = {}) {
  return row.rebotar_pago === true || !isComprobanteConciliated(row);
}

function canManageOwnComprobante(row = {}, user = {}) {
  const uploader = normalizeText(
    extractComprobanteUploader(row.info_comprobantes)
    || resolveComprobanteResponsibleVentaOnly(row)
  );
  const userNames = new Set([
    normalizeText(user.nombre),
    normalizeText(standardizeResponsibleVenta(user))
  ].filter(Boolean));
  return userNames.has(uploader) && canEditComprobanteStatus(row);
}

function validComprobanteId(value) {
  const id = parseNotionUuid(value);
  if (!id) {
    const error = new Error('El comprobante indicado no es válido');
    error.statusCode = 400;
    throw error;
  }
  return id;
}

async function getComprobanteForManagement(id) {
  const response = await supabaseRequest('comprobantes', {
    select: 'id,cliente_format,ghlid,tipo,producto_format,medios_de_pago_format,f_venta,f_acreditacion,facturacion,cash_ar,cash_collected_ar,cash_collected_ars,tc,dni_cuit,cantidad_de_pagos,info_comprobantes,estado,rebotar_pago,cheque,venta_relacionada,responsable_venta,creado_por',
    id: `eq.${id}`,
    limit: 1
  });
  const row = response.data?.[0] || null;
  if (!row) {
    const error = new Error('No encontré ese comprobante');
    error.statusCode = 404;
    throw error;
  }
  return row;
}

async function assertCanManageOwnComprobante(id, user) {
  const row = await getComprobanteForManagement(validComprobanteId(id));
  if (!canManageOwnComprobante(row, user)) {
    const error = new Error('Sólo quien cargó un comprobante no conciliado o rebotado puede editarlo o eliminarlo');
    error.statusCode = 403;
    throw error;
  }
  return row;
}

function parsePaymentCount(value) {
  const match = String(value || '').match(/\d+/);
  return match ? Number(match[0]) : null;
}

function editableComprobanteData(row = {}, bootstrap = {}) {
  const tipo = String(row.tipo || '').replace('Devolucion', 'Devolución');
  return {
    id: row.id,
    tipo,
    clientName: row.cliente_format || '',
    ghlId: row.ghlid || '',
    responsibleName: row.responsable_venta || '',
    createdBy: row.creado_por || '',
    isCheque: row.cheque === true,
    fechaVenta: String(row.f_venta || '').slice(0, 10),
    fechaAcreditacion: String(row.f_acreditacion || '').slice(0, 10),
    dniCuit: row.dni_cuit || '',
    medioPago: row.medios_de_pago_format || '',
    tc: row.tc ?? '',
    cashCollectedArs: row.cash_ar ?? row.cash_collected_ar ?? row.cash_collected_ars ?? '',
    productName: row.producto_format || '',
    facturacionUsd: row.facturacion ?? '',
    cantidadPagos: parsePaymentCount(row.cantidad_de_pagos) || '',
    infoComprobantes: row.info_comprobantes || '',
    mediosDePagoOptions: bootstrap.mediosDePagoOptions || DEFAULT_PAYMENT_METHODS,
    products: bootstrap.products || DEFAULT_PRODUCTS,
    cantidadPagosOptions: bootstrap.cantidadPagosOptions || Array.from({ length: MAX_PAYMENT_COUNT }, (_, index) => index + 1)
  };
}

async function getEditableComprobante(id, user) {
  const row = await assertCanManageOwnComprobante(id, user);
  return editableComprobanteData(row, await getBootstrap(user));
}

async function updateEditableComprobante(id, payload, user) {
  const row = await assertCanManageOwnComprobante(id, user);
  const tipo = String(row.tipo || '').replace('Devolucion', 'Devolución');
  if (!DEFAULT_TYPES.includes(tipo)) {
    const error = new Error('El tipo actual del comprobante no permite edición desde esta vista');
    error.statusCode = 409;
    throw error;
  }

  const fechaAcreditacion = requiredDate(payload.fechaAcreditacion, 'la fecha de acreditación');
  const fechaVenta = tipo === 'Venta' ? requiredDate(payload.fechaVenta, 'la fecha de venta') : null;
  const tc = requiredPositiveNumber(payload.tc, 'La tasa de cambio');
  const cashCollectedArs = requiredPositiveNumber(payload.cashCollectedArs, 'Cash collected ARS');
  const medioPago = requiredString(payload.medioPago, 'el medio de pago');
  const dniCuit = requiredString(payload.dniCuit, 'el DNI / CUIT');
  const infoComprobantes = preserveComprobanteAuditInfo(
    row.info_comprobantes,
    optionalString(payload.infoComprobantes),
    user
  );
  const facturacionUsd = tipo === 'Venta'
    ? requiredPositiveNumber(payload.facturacionUsd, 'La facturación USD')
    : tipo === 'Devolución' && optionalString(payload.facturacionUsd)
      ? requiredPositiveNumber(payload.facturacionUsd, 'La facturación USD')
      : null;
  const productName = tipo === 'Venta'
    ? requiredString(payload.productName, 'el producto adquirido')
    : '';
  const editChequePuntual = row.cheque === true;
  const cantidadPagos = tipo === 'Venta' && !editChequePuntual ? toInteger(payload.cantidadPagos) : null;
  if (tipo === 'Venta' && !editChequePuntual && (!cantidadPagos || cantidadPagos < 1 || cantidadPagos > MAX_PAYMENT_COUNT)) {
    const error = new Error(`La cantidad de pagos debe ser un número entero entre 1 y ${MAX_PAYMENT_COUNT}`);
    error.statusCode = 400;
    throw error;
  }

  const schema = await fetchComprobantesDatabaseSchema();
  const productsDatabaseId = schema?.properties?.Productos?.relation?.database_id || env.notionProductsDatabaseId;
  const mediosDatabaseId = schema?.properties?.['Medios de pago']?.relation?.database_id || null;
  if (!mediosDatabaseId) {
    const error = new Error('No pude leer los medios de pago para actualizar el comprobante');
    error.statusCode = 502;
    throw error;
  }

  const [productOptions, medioPagoOptions] = await Promise.all([
    tipo === 'Venta' ? fetchRelationOptions(productsDatabaseId) : Promise.resolve([]),
    fetchRelationOptions(mediosDatabaseId)
  ]);
  const medioPagoOption = medioPagoOptions.find(
    (option) => normalizeText(option.name) === normalizeText(medioPago)
  );
  const medioPagoId = medioPagoOption?.active ? medioPagoOption.id : null;
  const productId = tipo === 'Venta' ? findBestOptionIdByName(productOptions, productName) : null;
  if (!medioPagoId || (tipo === 'Venta' && !productId)) {
    const error = new Error('El producto no existe o el medio de pago elegido no está activo en Notion');
    error.statusCode = 400;
    throw error;
  }

  const properties = {
    'Fecha de acreditacion': notionDateValue(fechaAcreditacion),
    'Cash collected': notionNumberValue(Number((cashCollectedArs / tc).toFixed(2))),
    'Cash AR': notionNumberValue(cashCollectedArs),
    TC: notionNumberValue(tc),
    'Dni/cuit': notionRichTextValue(dniCuit),
    'Info Comprobantes': notionRichTextValue(infoComprobantes),
    'Medios de pago': notionRelationArrayValue([medioPagoId]),
    'Cheque?': notionCheckboxValue(isChequePaymentMethod(medioPago))
  };
  if (tipo === 'Venta') {
    Object.assign(properties, {
      Productos: notionRelationArrayValue([productId]),
      Facturacion: notionNumberValue(facturacionUsd),
      'Fecha respaldo': notionDateValue(fechaVenta),
      'F.venta respaldo': notionDateValue(fechaVenta)
    });
    if (!editChequePuntual) {
      properties['Cantidad de pagos'] = notionSelectValue(`${cantidadPagos} ${cantidadPagos === 1 ? 'Pago' : 'Pagos'}`);
    }
  } else if (tipo === 'Devolución') {
    properties.Facturacion = notionNumberValue(facturacionUsd);
  }

  await updateNotionPageProperties(row.id, Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined)
  ));

  return {
    id: row.id,
    message: 'Cambios guardados. La vista se actualizará con la sincronización de Notion.',
    updated: {
      fechaVenta,
      fechaAcreditacion,
      dniCuit,
      medioPago,
      tc,
      cashCollectedArs,
      productName,
      facturacionUsd,
      cantidadPagos,
      infoComprobantes
    }
  };
}

async function deleteEditableComprobante(id, user) {
  const row = await assertCanManageOwnComprobante(id, user);
  await archiveNotionPage(row.id);
  return {
    id: row.id,
    message: 'Comprobante archivado. Se eliminará de la vista al sincronizar Notion.'
  };
}

function cleanupSubmissionCache(now = Date.now()) {
  for (const [key, entry] of submissionCache.entries()) {
    if (!entry || entry.expiresAt <= now) submissionCache.delete(key);
  }
}

function getSubmissionCacheEntry(key) {
  cleanupSubmissionCache();
  return submissionCache.get(key) || null;
}

function setSubmissionCachePending(key, promise) {
  if (!key) return;
  submissionCache.set(key, {
    status: 'pending',
    promise,
    expiresAt: Date.now() + SUBMISSION_TTL_MS
  });
}

function setSubmissionCacheDone(key, result) {
  if (!key) return;
  submissionCache.set(key, {
    status: 'done',
    result,
    expiresAt: Date.now() + SUBMISSION_TTL_MS
  });
}

function clearSubmissionCache(key) {
  if (!key) return;
  submissionCache.delete(key);
}

function standardizeResponsibleVenta(user = {}, rawValue = '') {
  const email = normalizeEmail(user?.email);
  if (email && RESPONSABLE_VENTA_BY_EMAIL[email]) {
    return RESPONSABLE_VENTA_BY_EMAIL[email];
  }

  const value = String(rawValue || user?.nombre || user?.email || '').trim();
  if (!value) return '';
  if (normalizeText(value) === 'pablo butera vie') return 'Pablo Butera';
  return value;
}

function splitNameTokens(value) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/i)
    .map((item) => item.trim())
    .filter(Boolean);
}

function levenshteinDistance(a = '', b = '') {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const rows = Array.from({ length: a.length + 1 }, (_, index) => index);
  for (let column = 1; column <= b.length; column += 1) {
    let previousDiagonal = rows[0];
    rows[0] = column;
    for (let row = 1; row <= a.length; row += 1) {
      const current = rows[row];
      const substitutionCost = a[row - 1] === b[column - 1] ? 0 : 1;
      rows[row] = Math.min(
        rows[row] + 1,
        rows[row - 1] + 1,
        previousDiagonal + substitutionCost
      );
      previousDiagonal = current;
    }
  }

  return rows[a.length];
}

function similarityRatio(a = '', b = '') {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const maxLength = Math.max(left.length, right.length);
  if (!maxLength) return 1;
  return 1 - (levenshteinDistance(left, right) / maxLength);
}

function tokenSimilarity(a = '', b = '') {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.startsWith(right) || right.startsWith(left)) return 0.92;
  if (left.includes(right) || right.includes(left)) return 0.86;
  return similarityRatio(left, right);
}

function nameSimilarityScore(leftName = '', rightName = '') {
  const left = normalizeText(leftName);
  const right = normalizeText(rightName);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.97;

  const leftTokens = splitNameTokens(leftName);
  const rightTokens = splitNameTokens(rightName);
  if (!leftTokens.length || !rightTokens.length) {
    return similarityRatio(left, right);
  }

  const tokenScores = leftTokens.map((leftToken) => {
    let best = 0;
    rightTokens.forEach((rightToken) => {
      best = Math.max(best, tokenSimilarity(leftToken, rightToken));
    });
    return best;
  });

  const reverseScores = rightTokens.map((rightToken) => {
    let best = 0;
    leftTokens.forEach((leftToken) => {
      best = Math.max(best, tokenSimilarity(rightToken, leftToken));
    });
    return best;
  });

  const averageTokenScore = (
    tokenScores.reduce((sum, value) => sum + value, 0)
    + reverseScores.reduce((sum, value) => sum + value, 0)
  ) / (tokenScores.length + reverseScores.length);

  return Math.max(averageTokenScore, similarityRatio(left, right));
}

function findBestNotionUserMatch(notionUsers = [], responsibleVenta = '', authUser = {}) {
  if (!Array.isArray(notionUsers) || !notionUsers.length) return null;

  const targetName = standardizeResponsibleVenta(authUser, responsibleVenta);
  const targetEmail = normalizeEmail(authUser?.email);
  if (targetEmail) {
    const emailMatch = notionUsers.find((item) => normalizeEmail(item?.email) === targetEmail);
    if (emailMatch) return emailMatch;
  }

  const normalizedTarget = normalizeText(targetName);
  if (!normalizedTarget) return null;

  let bestMatch = null;
  let bestScore = 0;

  notionUsers.forEach((item) => {
    const score = nameSimilarityScore(targetName, item?.name || '');
    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  });

  return bestScore >= 0.72 ? bestMatch : null;
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const raw = String(value).replace(/\s+/g, '');
  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');
  const decimalIndex = Math.max(lastComma, lastDot);
  const digitsAfterSeparator = decimalIndex >= 0
    ? raw.slice(decimalIndex + 1).replace(/[^\d]/g, '')
    : '';
  const hasDecimalPart = digitsAfterSeparator.length > 0 && digitsAfterSeparator.length <= 2;
  const normalized = hasDecimalPart
    ? `${raw.slice(0, decimalIndex).replace(/[^\d-]/g, '') || '0'}.${digitsAfterSeparator}`
    : raw.replace(/[^\d-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function requiredString(value, label) {
  const text = String(value || '').trim();
  if (!text) {
    const error = new Error(`Falta ${label}`);
    error.statusCode = 400;
    throw error;
  }
  return text;
}

function optionalString(value) {
  const text = String(value || '').trim();
  return text || null;
}

function requiredNumber(value, label) {
  const parsed = toNumber(value);
  if (parsed === null) {
    const error = new Error(`Falta ${label}`);
    error.statusCode = 400;
    throw error;
  }
  return parsed;
}

function requiredPositiveNumber(value, label) {
  const parsed = requiredNumber(value, label);
  if (parsed <= 0) {
    const error = new Error(`${label} debe ser mayor a cero`);
    error.statusCode = 400;
    throw error;
  }
  return parsed;
}

function requiredDate(value, label) {
  const text = requiredString(value, label);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = match
    ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
    : null;
  const isValid = Boolean(
    match
    && date
    && date.getUTCFullYear() === Number(match[1])
    && date.getUTCMonth() === Number(match[2]) - 1
    && date.getUTCDate() === Number(match[3])
  );
  if (!isValid) {
    const error = new Error(`${label} debe venir en formato YYYY-MM-DD`);
    error.statusCode = 400;
    throw error;
  }
  return text;
}

function attachmentExtension(fileName = '') {
  const match = String(fileName).trim().toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match?.[1] || '';
}

function decodedBase64Size(base64 = '') {
  try {
    const source = String(base64).replace(/\s+/g, '');
    if (!source || source.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(source)) return 0;
    const buffer = Buffer.from(source, 'base64');
    if (!buffer.length || buffer.toString('base64') !== source) return 0;
    return buffer.length;
  } catch (error) {
    return 0;
  }
}

function ensureAttachmentIsValid(file, maxBytes = MAX_FILE_BYTES) {
  const type = String(file?.type || '').trim().toLowerCase();
  const extension = attachmentExtension(file?.name);
  if (!ACCEPTED_ATTACHMENT_TYPES.has(type) || !ACCEPTED_ATTACHMENT_EXTENSIONS.has(extension)) {
    const error = new Error(`El archivo ${file?.name || ''} debe ser JPG, PNG, WEBP o PDF`.trim());
    error.statusCode = 400;
    throw error;
  }

  const size = decodedBase64Size(file?.base64);
  if (!size) {
    const error = new Error(`El archivo ${file?.name || ''} está vacío o no se pudo leer`.trim());
    error.statusCode = 400;
    throw error;
  }
  if (size > maxBytes) {
    const error = new Error(`El archivo ${file.name || ''} supera el límite de 20 MB`.trim());
    error.statusCode = 400;
    throw error;
  }
  file.size = size;
  return size;
}

function parseRelationId(value) {
  const text = String(value || '').replace(/-/g, '').trim();
  if (!/^[a-f0-9]{32}$/i.test(text)) return null;
  return text.toLowerCase();
}

function parseNotionUuid(value) {
  const compact = String(value || '').replace(/-/g, '').trim().toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(compact)) return null;
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
}

function notionDateValue(value) {
  return value ? { date: { start: value } } : undefined;
}

function notionTitleValue(value) {
  return {
    title: [{ type: 'text', text: { content: String(value || '').slice(0, 2000) } }]
  };
}

function notionRichTextValue(value) {
  if (!value) return undefined;
  return {
    rich_text: [{ type: 'text', text: { content: String(value).slice(0, 2000) } }]
  };
}

function notionNumberValue(value) {
  if (value === null || value === undefined || value === '') return undefined;
  return {
    number: Number(value)
  };
}

function notionCheckboxValue(value) {
  if (value === null || value === undefined) return undefined;
  return {
    checkbox: Boolean(value)
  };
}

function notionSelectValue(value) {
  if (!value) return undefined;
  return {
    select: { name: String(value).slice(0, 100) }
  };
}

function notionRelationValue(id) {
  const relationId = parseRelationId(id);
  if (!relationId) return undefined;
  return {
    relation: [{ id: relationId }]
  };
}

function notionRelationArrayValue(ids = []) {
  const relation = ids
    .map((id) => parseRelationId(id))
    .filter(Boolean)
    .map((id) => ({ id }));
  if (!relation.length) return undefined;
  return { relation };
}

function notionPeopleValue(ids = []) {
  const people = ids
    .map((id) => parseNotionUuid(id))
    .filter(Boolean)
    .map((id) => ({ id }));
  if (!people.length) return undefined;
  return { people };
}

function findBestOptionIdByName(options, rawName) {
  const target = normalizeText(rawName);
  if (!target) return null;
  const exact = options.find((option) => normalizeText(option.name) === target);
  if (exact) return exact.id;
  const partial = options.find((option) => normalizeText(option.name).includes(target) || target.includes(normalizeText(option.name)));
  return partial?.id || null;
}

function parseGhlIdFromInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  if (/^[A-Za-z0-9_-]{8,}$/.test(raw) && !raw.includes('http')) {
    return raw;
  }

  try {
    const url = new URL(raw);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const lastPathPart = pathParts[pathParts.length - 1] || '';
    if (/^[A-Za-z0-9_-]{8,}$/.test(lastPathPart)) return lastPathPart;
    const contactId = url.searchParams.get('contactId') || url.searchParams.get('id');
    if (contactId && /^[A-Za-z0-9_-]{8,}$/.test(contactId)) return contactId;
  } catch (error) {
    return '';
  }

  return '';
}

function supabaseRequest(resource, params = {}) {
  return axios.get(`${env.supabaseUrl}/rest/v1/${resource}`, {
    headers: buildSupabaseHeaders(),
    params
  });
}

async function fetchHistoricalProducts() {
  const productNames = new Set(DEFAULT_PRODUCTS);

  try {
    const [comprobantesResponse, leadsResponse] = await Promise.all([
      supabaseRequest('comprobantes', {
        select: 'producto_format,productos',
        order: 'fecha_creado.desc',
        limit: 500
      }),
      supabaseRequest('leads_raw', {
        select: 'producto_adq,u_product_adquirido',
        order: 'last_edited_time.desc',
        limit: 500
      })
    ]);

    const comprobantesRows = comprobantesResponse.data || [];
    comprobantesRows.forEach((row) => {
      [row.producto_format, row.productos].forEach((value) => {
        String(value || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
          .forEach((item) => productNames.add(item));
      });
    });

    const leadsRows = leadsResponse.data || [];
    leadsRows.forEach((row) => {
      [row.producto_adq, row.u_product_adquirido].forEach((value) => {
        String(value || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
          .forEach((item) => productNames.add(item));
      });
    });
  } catch (error) {
    // fallback to defaults
  }

  return uniqueSorted([...productNames]);
}

async function fetchProductsFromNotion() {
  if (!env.notionApiKey || !env.notionProductsDatabaseId) {
    return [];
  }

  try {
    const response = await axios.post(
      `https://api.notion.com/v1/databases/${env.notionProductsDatabaseId}/query`,
      {
        page_size: 100
      },
      {
        headers: buildNotionHeaders(),
        timeout: NOTION_REQUEST_TIMEOUT_MS
      }
    );

    return uniqueSorted(
      (response.data?.results || [])
        .map((page) => {
          const properties = page.properties || {};
          const titleProperty = Object.values(properties).find((property) => property?.type === 'title');
          return titleProperty?.title?.map((item) => item.plain_text).join('') || '';
        })
        .filter(Boolean)
    );
  } catch (error) {
    return [];
  }
}

async function fetchRelationOptions(databaseId) {
  if (!env.notionApiKey || !databaseId) return [];

  try {
    const response = await axios.post(
      `https://api.notion.com/v1/databases/${databaseId}/query`,
      {
        page_size: 100
      },
      {
        headers: buildNotionHeaders(),
        timeout: NOTION_REQUEST_TIMEOUT_MS
      }
    );

    return (response.data?.results || [])
      .map((page) => {
        const properties = page.properties || {};
        const titleProperty = Object.values(properties).find((property) => property?.type === 'title');
        const name = titleProperty?.title?.map((item) => item.plain_text).join('') || '';
        return {
          id: page.id,
          name,
          active: isNotionPaymentMethodActive(properties),
          account: notionPropertyDisplayText(findNotionProperty(properties, 'Cuenta'))
        };
      })
      .filter((item) => item.name);
  } catch (error) {
    return [];
  }
}

async function fetchNotionUsers() {
  if (!env.notionApiKey) return [];

  try {
    const users = [];
    let nextCursor = null;

    do {
      const response = await axios.get('https://api.notion.com/v1/users', {
        headers: buildNotionHeaders(),
        params: nextCursor ? { start_cursor: nextCursor } : {},
        timeout: NOTION_REQUEST_TIMEOUT_MS
      });

      users.push(...(response.data?.results || []));
      nextCursor = response.data?.has_more ? response.data?.next_cursor || null : null;
    } while (nextCursor);

    return users
      .filter((user) => user?.type === 'person' && user?.name)
      .map((user) => ({ id: user.id, name: user.name, email: user.person?.email || '' }));
  } catch (error) {
    return [];
  }
}

async function fetchAssignedResponsibleVentaCandidates() {
  const databaseId = getComprobantesDatabaseId();
  if (!env.notionApiKey || !databaseId) return [];

  try {
    const people = [];
    let nextCursor = null;
    let pagesFetched = 0;

    do {
      const response = await axios.post(
        `https://api.notion.com/v1/databases/${databaseId}/query`,
        {
          page_size: 100,
          ...(nextCursor ? { start_cursor: nextCursor } : {})
        },
        {
          headers: buildNotionHeaders(),
          timeout: NOTION_REQUEST_TIMEOUT_MS
        }
      );

      (response.data?.results || []).forEach((page) => {
        const assigned = page?.properties?.['Responsable venta']?.people || [];
        assigned.forEach((person) => {
          if (person?.id && person?.name) {
            people.push({
              id: person.id,
              name: person.name,
              email: person.person?.email || ''
            });
          }
        });
      });

      pagesFetched += (response.data?.results || []).length;
      nextCursor = response.data?.has_more ? response.data?.next_cursor || null : null;
    } while (nextCursor && pagesFetched < 500);

    return Array.from(
      new Map(people.map((person) => [person.id, person])).values()
    );
  } catch (error) {
    return [];
  }
}

async function fetchResponsibleVentaCandidates() {
  const [notionUsers, assignedPeople] = await Promise.all([
    fetchNotionUsers(),
    fetchAssignedResponsibleVentaCandidates()
  ]);

  return Array.from(
    new Map(
      [...notionUsers, ...assignedPeople]
        .filter((person) => person?.id && person?.name)
        .map((person) => [person.id, person])
    ).values()
  );
}

async function fetchComprobantesDatabaseSchema() {
  const databaseId = getComprobantesDatabaseId();
  if (!env.notionApiKey || !databaseId) return null;

  try {
    const response = await axios.get(
      `https://api.notion.com/v1/databases/${databaseId}`,
      {
        headers: buildNotionHeaders(),
        timeout: NOTION_REQUEST_TIMEOUT_MS
      }
    );

    return response.data || null;
  } catch (error) {
    return null;
  }
}

async function getBootstrap(user) {
  const schema = await fetchComprobantesDatabaseSchema();
  const productsDatabaseId = schema?.properties?.Productos?.relation?.database_id || env.notionProductsDatabaseId;
  const mediosDatabaseId = schema?.properties?.['Medios de pago']?.relation?.database_id || null;
  const notionProducts = await fetchRelationOptions(productsDatabaseId);
  const notionPaymentMethods = await fetchRelationOptions(mediosDatabaseId);
  const products = notionProducts.length
    ? uniqueSorted([
      ...DEFAULT_PRODUCTS,
      ...notionProducts.map((item) => item.name).filter((name) => DEFAULT_PRODUCTS.includes(name))
    ])
    : DEFAULT_PRODUCTS.slice();
  const activePaymentMethods = notionPaymentMethods.filter((item) => item.active);
  const paymentOptions = notionPaymentMethods.length
    ? activePaymentMethods.map((item) => item.name)
    : DEFAULT_PAYMENT_METHODS;

  return {
    responsibleVentaDefault: standardizeResponsibleVenta(user),
    tipoOptions: DEFAULT_TYPES,
    mediosDePagoOptions: notionPaymentMethods.length ? paymentOptions : DEFAULT_PAYMENT_METHODS,
    mediosDePago: notionPaymentMethods.length ? activePaymentMethods : DEFAULT_PAYMENT_METHODS.map((name) => ({
      id: '', name, active: true, account: ''
    })),
    cantidadPagosOptions: Array.from({ length: MAX_PAYMENT_COUNT }, (_, index) => index + 1),
    productsSource: notionProducts.length ? 'notion' : 'fixed',
    products,
    uploadAcceptedTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  };
}

function sameGhlId(left, right) {
  const first = String(left || '').trim();
  const second = String(right || '').trim();
  return Boolean(first && second && first === second);
}

function uniqueRelationIds(values = []) {
  return [...new Set(
    values
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .map((value) => parseRelationId(value))
      .filter(Boolean)
  )];
}

function extractNotionPageIds(values = []) {
  const flattened = values.flatMap((value) => (Array.isArray(value) ? value : [value]));
  const matches = flattened.flatMap((value) => {
    if (value && typeof value === 'object' && value.id) return [value.id];
    return String(value || '').match(
      /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|[a-f0-9]{32}/gi
    ) || [];
  });
  return uniqueRelationIds(matches);
}

function clientIdentity(client = {}) {
  return {
    ghlId: String(client.ghlId || '').trim(),
    clientPageIds: uniqueRelationIds([client.pageId, client.pageIds || []])
  };
}

function saleClientPageIds(sale = {}) {
  return uniqueRelationIds([
    sale.clientPageId,
    sale.clientPageIds || [],
    sale.cliente
  ]);
}

function hasSaleOwnership(sale, identity, relatedClientGhlIds = []) {
  const expectedPageIds = new Set(uniqueRelationIds(identity?.clientPageIds || []));
  const relatedPageIds = saleClientPageIds(sale);
  if (relatedPageIds.length) {
    if (relatedPageIds.length !== 1) return false;
    if (relatedPageIds.some((id) => expectedPageIds.has(id))) return true;
    return relatedClientGhlIds.some((ghlId) => sameGhlId(ghlId, identity?.ghlId));
  }
  return sameGhlId(sale?.ghlId, identity?.ghlId);
}

function notionPropertyText(property) {
  if (!property) return '';
  if (property.formula?.string != null) return String(property.formula.string);
  if (property.rollup?.type === 'array') {
    return property.rollup.array.map((item) => notionPropertyText(item)).filter(Boolean).join('');
  }
  for (const key of ['title', 'rich_text']) {
    if (Array.isArray(property[key])) {
      return property[key].map((item) => item.plain_text || '').join('');
    }
  }
  return '';
}

function notionPropertyRelationIds(property) {
  return uniqueRelationIds([
    (property?.relation || []).map((item) => item.id),
    extractNotionPageIds([
      notionPropertyText(property),
      property?.url
    ])
  ]);
}

async function resolveCsmCrmClientPageIds(csmRows, expectedGhlId) {
  const directPageIds = extractNotionPageIds(csmRows.map((row) => row.crm_2_0));
  const rowsMissingCrmId = csmRows.filter(
    (row) => !extractNotionPageIds([row.crm_2_0]).length
  );
  const discoveredPageIds = [...directPageIds];
  let csmLookupFailed = false;

  if (rowsMissingCrmId.length && env.notionApiKey) {
    const csmPages = await Promise.allSettled(
      rowsMissingCrmId.map((row) => axios.get(`https://api.notion.com/v1/pages/${row.id}`, {
        headers: buildNotionHeaders(),
        timeout: NOTION_REQUEST_TIMEOUT_MS
      }))
    );
    csmPages.forEach((result) => {
      if (result.status !== 'fulfilled') {
        csmLookupFailed = true;
        return;
      }
      const property = result.value.data?.properties?.['Crm 2.0'];
      discoveredPageIds.push(...notionPropertyRelationIds(property));
    });
  }

  const candidatePageIds = uniqueRelationIds(discoveredPageIds);
  if (!candidatePageIds.length) {
    const error = new Error(
      csmLookupFailed
        ? 'No pude verificar la relación del cliente de CSM con CRM 2.0'
        : 'El cliente está en CSM pero no tiene una relación válida con CRM 2.0'
    );
    error.statusCode = csmLookupFailed ? 502 : 409;
    throw error;
  }
  if (!env.notionApiKey) {
    const error = new Error('No pude verificar la relación del cliente de CSM con CRM 2.0');
    error.statusCode = 502;
    throw error;
  }

  const crmPages = await Promise.allSettled(
    candidatePageIds.map((id) => axios.get(`https://api.notion.com/v1/pages/${id}`, {
      headers: buildNotionHeaders(),
      timeout: NOTION_REQUEST_TIMEOUT_MS
    }))
  );
  const verifiedPageIds = [];
  let failedLookup = false;
  crmPages.forEach((result) => {
    if (result.status !== 'fulfilled') {
      failedLookup = true;
      return;
    }
    const crmGhlId = notionPropertyText(result.value.data?.properties?.['GHL ID']);
    if (sameGhlId(crmGhlId, expectedGhlId)) {
      verifiedPageIds.push(result.value.data?.id);
    }
  });

  if (!verifiedPageIds.length) {
    const error = new Error(
      failedLookup
        ? 'No pude verificar la relación del cliente de CSM con CRM 2.0'
        : 'La relación CRM 2.0 del cliente de CSM pertenece a otro GHL ID'
    );
    error.statusCode = failedLookup ? 502 : 409;
    throw error;
  }

  return uniqueRelationIds(verifiedPageIds);
}

function mapSupabaseSale(row = {}) {
  const relatedClientIds = uniqueRelationIds([row.cliente]);
  return {
    notionPageId: row.id || null,
    ghlId: row.ghlid || null,
    clientPageId: relatedClientIds[0] || null,
    clientPageIds: relatedClientIds,
    cliente: row.cliente_format || '',
    producto: row.producto_format || '',
    fechaVenta: row.f_venta || null,
    fechaAcreditacion: row.f_acreditacion || null,
    fechaCreado: row.fecha_creado || null,
    facturacionUsd: toNumber(row.facturacion),
    cashCollectedArs: toNumber(row.cash_ar ?? row.cash_collected_ar ?? row.cash_collected_ars),
    cashCollectedTotal: toNumber(row.cash_collected_total)
  };
}

function mapNotionSalePage(page = {}) {
  const properties = page.properties || {};
  const relatedClientIds = uniqueRelationIds(
    (properties.Cliente?.relation || []).map((item) => item.id)
  );
  return {
    notionPageId: page.id || null,
    ghlId: notionPropertyText(properties['GHL ID']) || null,
    clientPageId: relatedClientIds[0] || null,
    clientPageIds: relatedClientIds,
    cliente: notionPropertyText(properties.Identificador) || '',
    producto: properties['Producto Format']?.formula?.string || '',
    // Algunas ventas históricas no tienen F.venta respaldo, pero sí conservan
    // la fecha equivalente en el respaldo o en la fórmula Fecha correspondiente.
    // Cualquiera de ellas sirve para relacionar una cobranza sin bloquear la carga.
    fechaVenta: properties['F.venta respaldo']?.date?.start
      || properties['Fecha respaldo']?.date?.start
      || properties['Fecha correspondiente']?.formula?.date?.start
      || properties['Fecha correspondiente']?.date?.start
      || null,
    fechaAcreditacion: properties['Fecha de acreditacion']?.date?.start || null,
    fechaCreado: page.created_time || null,
    facturacionUsd: properties.Facturacion?.number ?? null,
    cashCollectedArs: properties['Cash AR']?.number
      ?? properties['Cash collected AR']?.number
      ?? properties['Cash collected ARS']?.number
      ?? null,
    cashCollectedTotal: properties['Cash collected Total']?.formula?.number ?? null
  };
}

async function lookupClientRecordByGhlId(rawGhlInput) {
  const ghlId = parseGhlIdFromInput(rawGhlInput);
  if (!ghlId) {
    const error = new Error('No pude encontrar un GHL ID válido en el valor ingresado');
    error.statusCode = 400;
    throw error;
  }

  const leadsResponse = await supabaseRequest('leads_raw', {
    select: 'id,ghlid,nombre,mail,telefono,etapa',
    ghlid: `eq.${ghlId}`,
    order: 'last_edited_time.desc',
    limit: 100
  });

  let matchingRows = leadsResponse.data || [];
  let row = matchingRows[0] || null;
  let source = 'leads_raw';

  if (!row) {
    const csmResponse = await supabaseRequest('csm', {
      select: 'id,ghlid,nombre,mail,telefono,actividad,crm_2_0',
      ghlid: `eq.${ghlId}`,
      order: 'updated_at.desc.nullslast,created_at.desc.nullslast',
      limit: 5
    });

    const csmRows = csmResponse.data || [];
    const csmRow = csmRows[0] || null;
    if (csmRow) {
      const crmClientPageIds = await resolveCsmCrmClientPageIds(csmRows, ghlId);
      matchingRows = crmClientPageIds.map((id) => ({ ...csmRow, id }));
      row = {
        ...csmRow,
        id: crmClientPageIds[0],
        etapa: csmRow.actividad || ''
      };
      source = 'csm';
    }
  }

  if (!row) {
    const error = new Error('No encontré un cliente con ese GHL ID');
    error.statusCode = 404;
    throw error;
  }

  return {
    pageId: row.id || null,
    pageIds: uniqueRelationIds(matchingRows.map((item) => item.id)),
    ghlId,
    nombre: row.nombre || '',
    mail: row.mail || '',
    telefono: row.telefono || '',
    etapa: row.etapa || '',
    source
  };
}

async function fetchRelatedClientGhlIds(pageIds = []) {
  const notionIds = uniqueRelationIds(pageIds).map((id) => parseNotionUuid(id)).filter(Boolean);
  if (!notionIds.length) return [];

  const response = await supabaseRequest('leads_raw', {
    select: 'id,ghlid',
    id: `in.(${notionIds.join(',')})`,
    limit: notionIds.length
  });
  const resolvedById = new Map();
  (response.data || []).forEach((row) => {
    const rowId = parseRelationId(row.id);
    const rowGhlId = String(row.ghlid || '').trim();
    if (rowId && rowGhlId) resolvedById.set(rowId, rowGhlId);
  });
  const missingIds = notionIds.filter((id) => !resolvedById.has(parseRelationId(id)));

  if (missingIds.length && env.notionApiKey) {
    const notionResults = await Promise.allSettled(
      missingIds.map((id) => axios.get(`https://api.notion.com/v1/pages/${id}`, {
        headers: buildNotionHeaders(),
        timeout: NOTION_REQUEST_TIMEOUT_MS
      }))
    );
    notionResults.forEach((result, index) => {
      if (result.status !== 'fulfilled') return;
      const relatedGhlId = notionPropertyText(result.value.data?.properties?.['GHL ID']);
      if (relatedGhlId) resolvedById.set(parseRelationId(missingIds[index]), relatedGhlId);
    });
  }

  return [...resolvedById.values()].filter(Boolean);
}

async function saleBelongsToClient(sale, identity) {
  const relatedPageIds = saleClientPageIds(sale);
  if (!relatedPageIds.length) return hasSaleOwnership(sale, identity);
  if (relatedPageIds.length !== 1) return false;
  const expectedPageIds = new Set(uniqueRelationIds(identity?.clientPageIds || []));
  if (relatedPageIds.some((id) => expectedPageIds.has(id))) return true;
  const relatedGhlIds = await fetchRelatedClientGhlIds(relatedPageIds);
  return hasSaleOwnership(sale, identity, relatedGhlIds);
}

function assertRequestedClientPage(client, requestedPageId) {
  const requestedId = parseRelationId(requestedPageId);
  const validIds = new Set(clientIdentity(client).clientPageIds);
  if (!requestedId || !validIds.has(requestedId)) {
    const error = new Error('La relación del cliente no coincide con el GHL ID buscado');
    error.statusCode = 400;
    throw error;
  }
}

async function assertSaleOwnership(sale, client) {
  if (await saleBelongsToClient(sale, clientIdentity(client))) return;
  const error = new Error('La venta relacionada pertenece a otro cliente');
  error.statusCode = 400;
  throw error;
}

async function lookupRelatedSaleById(rawSaleId, expectedClient = null) {
  const saleId = parseRelationId(rawSaleId);
  if (!saleId) {
    const error = new Error('No pude leer un Notion ID válido para la venta relacionada');
    error.statusCode = 400;
    throw error;
  }

  const supabaseResponse = await supabaseRequest('comprobantes', {
    select: 'id,cliente,cliente_format,ghlid,producto_format,f_venta,fecha_creado,f_acreditacion,facturacion,cash_ar,cash_collected_ar,cash_collected_ars,cash_collected_total,tipo',
    id: `eq.${saleId}`,
    tipo: 'eq.Venta',
    limit: 1
  });

  const supabaseRow = (supabaseResponse.data || [])[0];
  let sale = supabaseRow ? mapSupabaseSale(supabaseRow) : null;

  if (!sale) {
    const response = await axios.get(`https://api.notion.com/v1/pages/${saleId}`, {
      headers: buildNotionHeaders(),
      timeout: NOTION_REQUEST_TIMEOUT_MS
    });
    const properties = response.data?.properties || {};
    const tipo = properties.Tipo?.select?.name || '';
    if (normalizeText(tipo) !== 'venta') {
      const error = new Error('La página relacionada no es una venta');
      error.statusCode = 400;
      throw error;
    }
    sale = mapNotionSalePage(response.data);
  }

  if (expectedClient) {
    const verifiedClient = expectedClient.verifiedClient
      || await lookupClientRecordByGhlId(expectedClient.ghlId);
    assertRequestedClientPage(
      verifiedClient,
      expectedClient.clientPageId || verifiedClient.pageId
    );
    await assertSaleOwnership(sale, verifiedClient);
  }

  return sale;
}

function saleSortTime(sale = {}) {
  const parsed = Date.parse(sale.fechaVenta || sale.fechaCreado || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareSalesNewestFirst(left = {}, right = {}) {
  const leftHasSaleDate = Number.isFinite(Date.parse(left.fechaVenta || ''));
  const rightHasSaleDate = Number.isFinite(Date.parse(right.fechaVenta || ''));
  if (leftHasSaleDate !== rightHasSaleDate) return leftHasSaleDate ? -1 : 1;
  return saleSortTime(right) - saleSortTime(left);
}

async function findLatestVentaForClient(client) {
  const identity = clientIdentity(client);
  const notionPageIds = identity.clientPageIds.map((id) => parseNotionUuid(id)).filter(Boolean);
  const baseSelect = 'id,cliente,cliente_format,ghlid,producto_format,f_venta,fecha_creado,f_acreditacion,facturacion,cash_ar,cash_collected_ar,cash_collected_ars,cash_collected_total,tipo';
  const queryPromises = [];

  if (identity.ghlId) {
    queryPromises.push(supabaseRequest('comprobantes', {
      select: baseSelect,
      ghlid: `eq.${identity.ghlId}`,
      tipo: 'eq.Venta',
      order: 'f_venta.desc.nullslast,fecha_creado.desc.nullslast',
      limit: 20
    }));
  }
  if (notionPageIds.length) {
    queryPromises.push(supabaseRequest('comprobantes', {
      select: baseSelect,
      cliente: `in.(${notionPageIds.join(',')})`,
      tipo: 'eq.Venta',
      order: 'f_venta.desc.nullslast,fecha_creado.desc.nullslast',
      limit: 20
    }));
  }

  const supabaseResults = await Promise.all(queryPromises);
  const supabaseCandidates = [...new Map(
    supabaseResults
      .flatMap((response) => response.data || [])
      .map((row) => [parseRelationId(row.id), mapSupabaseSale(row)])
  ).values()].sort(compareSalesNewestFirst);

  for (const candidate of supabaseCandidates) {
    if (await saleBelongsToClient(candidate, identity)) return candidate;
  }

  const databaseId = getComprobantesDatabaseId();
  if (!env.notionApiKey || !databaseId || !notionPageIds.length) return null;

  try {
    const relationFilters = notionPageIds.map((id) => ({
      property: 'Cliente',
      relation: { contains: id }
    }));
    const response = await axios.post(
      `https://api.notion.com/v1/databases/${databaseId}/query`,
      {
        page_size: 20,
        filter: {
          and: [
            { property: 'Tipo', select: { equals: 'Venta' } },
            relationFilters.length === 1 ? relationFilters[0] : { or: relationFilters }
          ]
        },
        sorts: [{ property: 'Fecha creado', direction: 'descending' }]
      },
      {
        headers: buildNotionHeaders(),
        timeout: NOTION_REQUEST_TIMEOUT_MS
      }
    );
    const candidates = (response.data?.results || [])
      .map(mapNotionSalePage)
      .sort(compareSalesNewestFirst);
    for (const candidate of candidates) {
      if (await saleBelongsToClient(candidate, identity)) return candidate;
    }
    return null;
  } catch (error) {
    const wrapped = new Error('No pude verificar las ventas relacionadas en Notion');
    wrapped.statusCode = 502;
    wrapped.cause = error;
    throw wrapped;
  }
}

async function lookupClientByGhlId(rawGhlInput) {
  const client = await lookupClientRecordByGhlId(rawGhlInput);
  try {
    return {
      ...client,
      latestSale: await findLatestVentaForClient(client),
      latestSaleLookupError: null
    };
  } catch (error) {
    console.error('[comprobantes-loader] Falló la búsqueda de venta relacionada:', error.message);
    return {
      ...client,
      latestSale: null,
      latestSaleLookupError: error.message || 'No pude verificar las ventas relacionadas'
    };
  }
}

function buildChequeRows(payload) {
  const rows = Array.isArray(payload.cheques) ? payload.cheques : [];
  return rows
    .map((row, index) => ({
      index,
      montoArs: toNumber(row?.montoArs),
      archivoNombre: optionalString(row?.archivoNombre),
      fechaAcreditacion: requiredDate(
        row?.fechaAcreditacion || payload.fechaAcreditacion,
        `la fecha de acreditación del cheque ${index + 1}`
      )
    }));
}

function validateChequeRows(chequeRows, expectedCount, totalCashArs, attachmentFiles = [], options = {}) {
  if (!Array.isArray(attachmentFiles)) {
    options = attachmentFiles || {};
    attachmentFiles = [];
  }
  if (!Number.isInteger(expectedCount) || expectedCount < 1 || expectedCount > MAX_CHEQUES) {
    const error = new Error(`La cantidad de cheques debe ser un número entero entre 1 y ${MAX_CHEQUES}`);
    error.statusCode = 400;
    throw error;
  }

  if (chequeRows.length !== expectedCount) {
    const error = new Error('La cantidad de cheques cargados no coincide con la cantidad indicada');
    error.statusCode = 400;
    throw error;
  }

  const invalidAmountIndex = chequeRows.findIndex((row) => row.montoArs === null || row.montoArs <= 0);
  if (invalidAmountIndex >= 0) {
    const error = new Error(`El monto del cheque ${invalidAmountIndex + 1} debe ser mayor a cero`);
    error.statusCode = 400;
    throw error;
  }

  if (options.requireFiles !== false && chequeRows.some((row) => !row.archivoNombre)) {
    const error = new Error('Tenés que adjuntar el archivo o foto de cada cheque');
    error.statusCode = 400;
    throw error;
  }

  if (options.requireFiles !== false) {
    const fileNames = attachmentFiles.map((file) => file.name);
    const uniqueFileNames = new Set(fileNames);
    if (uniqueFileNames.size !== fileNames.length) {
      const error = new Error('Los archivos adjuntos deben tener nombres únicos');
      error.statusCode = 400;
      throw error;
    }

    const chequeFileNames = chequeRows.map((row) => row.archivoNombre);
    if (new Set(chequeFileNames).size !== chequeFileNames.length) {
      const error = new Error('Cada cheque debe tener un archivo distinto');
      error.statusCode = 400;
      throw error;
    }

    const missingFileName = chequeFileNames.find((name) => !uniqueFileNames.has(name));
    if (missingFileName) {
      const error = new Error(`No encontré el archivo ${missingFileName} entre los adjuntos enviados`);
      error.statusCode = 400;
      throw error;
    }
  }

  const totalCheques = chequeRows.reduce((sum, row) => sum + Number(row.montoArs || 0), 0);
  if (Math.abs(totalCheques - totalCashArs) > 1) {
    const error = new Error('La suma de los cheques no coincide con el cash collected ARS total');
    error.statusCode = 400;
    throw error;
  }
}

function buildInfoComprobantesText(normalized) {
  const parts = [];
  if (normalized.submissionKey) parts.push(`Carga ID: ${normalized.submissionKey}`);
  if (normalized.cargadoPor) parts.push(`Cargado por: ${normalized.cargadoPor}`);
  if (normalized.responsableVenta) parts.push(`Responsable venta: ${normalized.responsableVenta}`);
  if (normalized.infoComprobantes) parts.push(normalized.infoComprobantes);
  if (normalized.mesesSoporte !== null) parts.push(`Meses de soporte: ${normalized.mesesSoporte}`);
  if (normalized.sesiones !== null) parts.push(`Sesiones: ${normalized.sesiones}`);
  if (normalized.bonusMati) parts.push('Bonus Mati: Sí');
  if (normalized.attachmentNames.length) parts.push(`Adjuntos: ${normalized.attachmentNames.join(', ')}`);
  return parts.join(' | ');
}

function preserveComprobanteAuditInfo(originalInfo, requestedInfo, user) {
  const auditPattern = /^(carga id|cargado por|responsable venta):/i;
  const originalSegments = String(originalInfo || '')
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
  const auditSegments = originalSegments.filter((item) => auditPattern.test(item));
  if (!auditSegments.some((item) => /^cargado por:/i.test(item))) {
    auditSegments.push(`Cargado por: ${standardizeResponsibleVenta(user)}`);
  }
  const requestedSegments = String(requestedInfo || '')
    .split('|')
    .map((item) => item.trim())
    .filter((item) => item && !auditPattern.test(item));
  return [...auditSegments, ...requestedSegments].join(' | ');
}

async function createNotionFileUpload(file) {
  const createResponse = await axios.post(
    'https://api.notion.com/v1/file_uploads',
    {},
    {
      headers: buildNotionHeaders({ 'Notion-Version': '2025-09-03' }),
      timeout: NOTION_REQUEST_TIMEOUT_MS
    }
  );

  const upload = createResponse.data;
  const fileBuffer = Buffer.from(file.base64, 'base64');
  const form = new FormData();
  form.append(
    'file',
    new Blob([fileBuffer], { type: file.type || 'application/octet-stream' }),
    file.name || 'comprobante'
  );

  const sendResponse = await fetch(upload.upload_url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.notionApiKey}`,
      'Notion-Version': '2025-09-03'
    },
    signal: AbortSignal.timeout(NOTION_UPLOAD_TIMEOUT_MS),
    body: form
  });

  if (!sendResponse.ok) {
    const body = await sendResponse.text().catch(() => '');
    const error = new Error(body || `No pude subir el archivo ${file.name || ''} a Notion`.trim());
    error.statusCode = sendResponse.status || 502;
    throw error;
  }

  return upload.id;
}

async function attachFilesToNotionPage(pageId, files = []) {
  if (!pageId || !Array.isArray(files) || !files.length) return;

  const uploadedFiles = [];
  for (const file of files) {
    const fileUploadId = await createNotionFileUpload(file);
    uploadedFiles.push({
      name: file.name || 'Comprobante',
      type: 'file_upload',
      file_upload: { id: fileUploadId }
    });
  }

  await axios.patch(
    `https://api.notion.com/v1/pages/${pageId}`,
    {
      properties: {
        Comprobante: {
          files: uploadedFiles
        }
      }
    },
    {
      headers: buildNotionHeaders({ 'Notion-Version': '2025-09-03' }),
      timeout: NOTION_REQUEST_TIMEOUT_MS
    }
  );
}

function normalizePayload(payload = {}, user, options = {}) {
  const tipo = requiredString(payload.tipo, 'el tipo');
  if (!DEFAULT_TYPES.includes(tipo)) {
    const error = new Error('Tipo inválido para el comprobante');
    error.statusCode = 400;
    throw error;
  }

  const ghlId = requiredString(payload.ghlId, 'el GHL ID');
  const clientName = requiredString(payload.clientName, 'el cliente');
  const clientPageId = requiredString(payload.clientPageId, 'la relación con el cliente');
  if (!parseRelationId(clientPageId)) {
    const error = new Error('La relación con el cliente no tiene un Notion ID válido');
    error.statusCode = 400;
    throw error;
  }
  const responsableVenta = requiredString(
    standardizeResponsibleVenta(user, payload.responsableVenta),
    'el responsable de venta'
  );
  const fechaVenta = tipo === 'Venta'
    ? requiredDate(payload.fechaVenta, 'la fecha de venta')
    : (optionalString(payload.fechaVenta)
      ? requiredDate(payload.fechaVenta, 'la fecha de venta')
      : null);
  const fechaAcreditacion = requiredDate(payload.fechaAcreditacion, 'la fecha de acreditación');
  const tc = requiredPositiveNumber(payload.tc, 'La tasa de cambio');
  const cashCollectedArs = requiredPositiveNumber(payload.cashCollectedArs, 'Cash collected ARS');
  const medioPago = requiredString(payload.medioPago, 'el medio de pago');
  const rawProductName = optionalString(payload.productName);
  const dniCuit = tipo === 'Venta' && isClubProduct(rawProductName)
    ? optionalString(payload.dniCuit)
    : requiredString(payload.dniCuit, 'el DNI / CUIT');
  const infoComprobantes = optionalString(payload.infoComprobantes);
  const mesesSoporte = payload.mesesSoporte === '' || payload.mesesSoporte === null || payload.mesesSoporte === undefined
    ? null
    : toInteger(payload.mesesSoporte);
  const sesiones = payload.sesiones === '' || payload.sesiones === null || payload.sesiones === undefined
    ? null
    : toInteger(payload.sesiones);
  const bonusMati = Boolean(payload.bonusMati);
  const attachmentFiles = Array.isArray(payload.attachmentFiles)
    ? payload.attachmentFiles
        .map((file) => ({
          name: requiredString(file?.name, 'el nombre del archivo'),
          type: optionalString(file?.type) || 'application/octet-stream',
          size: Number(file?.size || 0),
          base64: requiredString(file?.base64, 'el contenido del archivo')
        }))
    : [];

  const attachmentNames = attachmentFiles.map((file) => file.name);
  if (new Set(attachmentNames).size !== attachmentNames.length) {
    const error = new Error('Los archivos adjuntos deben tener nombres únicos');
    error.statusCode = 400;
    throw error;
  }

  const totalAttachmentBytes = attachmentFiles.reduce(
    (total, file) => total + ensureAttachmentIsValid(file),
    0
  );
  if (totalAttachmentBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
    const error = new Error('El total de archivos supera el límite de 30 MB por carga');
    error.statusCode = 400;
    throw error;
  }

  if (!attachmentFiles.length && !options.allowMissingAttachments) {
    const error = new Error('Debés adjuntar el comprobante para crear el registro');
    error.statusCode = 400;
    throw error;
  }

  if (mesesSoporte !== null && mesesSoporte < 0) {
    const error = new Error('Meses de soporte no puede ser negativo');
    error.statusCode = 400;
    throw error;
  }

  if (sesiones !== null && sesiones < 0) {
    const error = new Error('Sesiones no puede ser negativo');
    error.statusCode = 400;
    throw error;
  }

  const normalized = {
    tipo,
    ghlId,
    clientName,
    clientPageId,
    responsableVenta,
    cargadoPor: standardizeResponsibleVenta(user),
    fechaVenta,
    fechaAcreditacion,
    tc,
    cashCollectedArs,
    medioPago,
    dniCuit,
    infoComprobantes,
    mesesSoporte,
    sesiones,
    bonusMati,
    attachmentNames,
    attachmentFiles,
    facturacionUsd: null,
    productName: null,
    cantidadPagos: null,
    chequeCount: null,
    cheques: [],
    latestSaleId: optionalString(payload.latestSaleId),
    autoFinalizar: Boolean(payload.autoFinalizar),
    submissionKey: optionalString(payload.submissionKey)
  };

  if (tipo === 'Venta') {
    normalized.productName = requiredString(payload.productName, 'el producto adquirido');
    normalized.facturacionUsd = requiredPositiveNumber(payload.facturacionUsd, 'La facturación USD');
    normalized.cantidadPagos = toInteger(payload.cantidadPagos);

    if (!normalized.cantidadPagos || normalized.cantidadPagos < 1 || normalized.cantidadPagos > MAX_PAYMENT_COUNT) {
      const error = new Error(`La cantidad de pagos debe ser un número entero entre 1 y ${MAX_PAYMENT_COUNT}`);
      error.statusCode = 400;
      throw error;
    }
  }

  const hasChequeFlow = (tipo === 'Venta' || tipo === 'Cobranza') && isChequePaymentMethod(medioPago);
  if (hasChequeFlow) {
    normalized.chequeCount = toInteger(payload.chequeCount);
    normalized.cheques = buildChequeRows(payload);
    validateChequeRows(
      normalized.cheques,
      normalized.chequeCount,
      normalized.cashCollectedArs,
      normalized.attachmentFiles,
      { requireFiles: !options.allowMissingAttachments }
    );
    if (tipo === 'Venta') normalized.cantidadPagos = normalized.chequeCount;
  }

  if (tipo === 'Devolución') {
    normalized.facturacionUsd = payload.facturacionUsd === '' || payload.facturacionUsd === null || payload.facturacionUsd === undefined
      ? null
      : requiredPositiveNumber(payload.facturacionUsd, 'La facturación USD');
  }

  if (tipo === 'Cobranza' || tipo === 'Devolución') {
    normalized.autoFinalizar = true;
    normalized.mesesSoporte = null;
    normalized.sesiones = null;
    normalized.bonusMati = false;
  }

  return normalized;
}

function buildDraftOperations(normalized) {
  const commonInfo = buildInfoComprobantesText(normalized);

  function buildOperationPayload(operationType, overrides = {}) {
    const amountArs = overrides.cashCollectedArs ?? normalized.cashCollectedArs;
    const cashUsd = Number((Number(amountArs || 0) / Number(normalized.tc || 1)).toFixed(2));
    const operationTipo = operationType === 'Devolución' ? 'Devolucion' : operationType;
    const properties = {
      Identificador: notionTitleValue(normalized.identificador || `Transaccion de ${normalized.clientName}`),
      Cliente: notionRelationValue(normalized.clientPageId),
      'Responsable venta': notionPeopleValue(normalized.responsableVentaUserIds || []),
      Tipo: notionSelectValue(operationTipo),
      // En una venta con varios cheques, sólo el primer registro es la venta.
      // Los restantes son cobranzas vinculadas y no deben heredar el producto.
      Productos: notionRelationArrayValue(
        operationType === 'Venta' ? (overrides.productIds || normalized.productIds || []) : []
      ),
      Facturacion: (operationType === 'Venta' || operationType === 'Devolución') ? notionNumberValue(normalized.facturacionUsd) : undefined,
      'Cash collected': notionNumberValue(cashUsd),
      'Cash AR': notionNumberValue(amountArs),
      TC: notionNumberValue(normalized.tc),
      'Dni/cuit': notionRichTextValue(normalized.dniCuit),
      'Info Comprobantes': notionRichTextValue(commonInfo),
      'Medios de pago': notionRelationArrayValue(overrides.medioPagoIds || normalized.medioPagoIds || []),
      'Cheque?': notionCheckboxValue(overrides.cheque ?? isChequePaymentMethod(normalized.medioPago)),
      'Fecha de acreditacion': notionDateValue(overrides.fechaAcreditacion || normalized.fechaAcreditacion),
      'Fecha respaldo': notionDateValue(overrides.fechaVenta || normalized.fechaVenta),
      'F.venta respaldo': notionDateValue(overrides.fechaVenta || normalized.fechaVenta),
      'Venta relacionada': notionRelationValue(overrides.ventaRelacionada || normalized.latestSaleId)
    };

    if (operationType === 'Venta') {
      Object.assign(properties, {
        'Cantidad de pagos': notionSelectValue(`${normalized.cantidadPagos} ${normalized.cantidadPagos === 1 ? 'Pago' : 'Pagos'}`)
      });
    }

    if (normalized.mesesSoporte !== null) properties['Meses de soporte'] = notionRichTextValue(String(normalized.mesesSoporte));
    if (normalized.sesiones !== null) properties.Sesiones = notionNumberValue(normalized.sesiones);
    if (normalized.bonusMati) properties['Bonus Mati'] = notionCheckboxValue(true);
    if (operationType !== 'Venta') properties.Finalizado = notionCheckboxValue(Boolean(overrides.finalizar ?? normalized.autoFinalizar));

    return Object.fromEntries(Object.entries(properties).filter(([, value]) => value !== undefined));
  }

  const hasChequeFlow = (normalized.tipo === 'Venta' || normalized.tipo === 'Cobranza')
    && isChequePaymentMethod(normalized.medioPago)
    && normalized.cheques.length > 0;

  if (hasChequeFlow) {
    const chequeAttachmentNames = new Set(
      normalized.cheques.map((cheque) => cheque.archivoNombre).filter(Boolean)
    );
    const supplementalAttachmentNames = normalized.attachmentNames.filter(
      (name) => !chequeAttachmentNames.has(name)
    );

    return normalized.cheques.map((cheque, index) => ({
      localType: normalized.tipo === 'Venta' && index === 0 ? 'Venta' : 'Cobranza',
      properties: buildOperationPayload(
        normalized.tipo === 'Venta' && index === 0 ? 'Venta' : 'Cobranza',
        {
        cashCollectedArs: cheque.montoArs,
        fechaAcreditacion: cheque.fechaAcreditacion,
        cheque: true,
        finalizar: normalized.tipo === 'Cobranza' || index > 0
        }
      ),
      attachmentNames: [
        ...(cheque.archivoNombre ? [cheque.archivoNombre] : []),
        ...(index === 0 ? supplementalAttachmentNames : [])
      ]
    }));
  }

  return [{
    localType: normalized.tipo,
    properties: buildOperationPayload(normalized.tipo, {
      cheque: isChequePaymentMethod(normalized.medioPago),
      finalizar: normalized.autoFinalizar
    }),
    attachmentNames: normalized.attachmentNames
  }];
}

async function createNotionPage(properties) {
  const databaseId = getComprobantesDatabaseId();
  if (!env.notionApiKey || !databaseId) {
    const error = new Error('Faltan NOTION_API_KEY o NOTION_COMPROBANTES_DATABASE_ID para crear comprobantes');
    error.statusCode = 500;
    throw error;
  }

  const response = await axios.post(
    'https://api.notion.com/v1/pages',
    {
      parent: {
        database_id: databaseId
      },
      properties
    },
    {
      headers: buildNotionHeaders(),
      timeout: NOTION_REQUEST_TIMEOUT_MS
    }
  );

  return response.data;
}

async function updateNotionPageProperties(pageId, properties) {
  if (!pageId || !properties || typeof properties !== 'object') return null;

  const response = await axios.patch(
    `https://api.notion.com/v1/pages/${pageId}`,
    { properties },
    {
      headers: buildNotionHeaders(),
      timeout: NOTION_REQUEST_TIMEOUT_MS
    }
  );

  return response.data;
}

async function archiveNotionPage(pageId) {
  if (!pageId) return null;
  const response = await axios.patch(
    `https://api.notion.com/v1/pages/${pageId}`,
    { archived: true },
    {
      headers: buildNotionHeaders(),
      timeout: NOTION_REQUEST_TIMEOUT_MS
    }
  );
  return response.data;
}

async function archiveNotionPages(pageIds = []) {
  const uniqueIds = [...new Set(pageIds.filter(Boolean))];
  if (!uniqueIds.length) return;
  const results = await Promise.allSettled(uniqueIds.map((pageId) => archiveNotionPage(pageId)));
  const failedIds = results
    .map((result, index) => (result.status === 'rejected' ? uniqueIds[index] : null))
    .filter(Boolean);
  if (failedIds.length) {
    const error = new Error('No pude revertir todos los registros parciales de la carga');
    error.statusCode = 502;
    error.rollbackFailedIds = failedIds;
    throw error;
  }
}

async function findNotionPagesBySubmissionKey(submissionKey) {
  if (!submissionKey) return [];
  const databaseId = getComprobantesDatabaseId();
  const response = await axios.post(
    `https://api.notion.com/v1/databases/${databaseId}/query`,
    {
      page_size: 100,
      filter: {
        property: 'Info Comprobantes',
        rich_text: { contains: submissionKey }
      },
      sorts: [{ timestamp: 'created_time', direction: 'ascending' }]
    },
    {
      headers: buildNotionHeaders(),
      timeout: NOTION_REQUEST_TIMEOUT_MS
    }
  );
  return response.data?.results || [];
}

function notionSubmissionIsComplete(pages, operations) {
  if (pages.length !== operations.length) return false;
  return pages.every((page, index) => {
    const operation = operations[index];
    const properties = page?.properties || {};
    const notionType = normalizeText(properties.Tipo?.select?.name);
    const expectedType = normalizeText(operation.localType === 'Devolución' ? 'Devolucion' : operation.localType);
    const files = properties.Comprobante?.files || [];
    const expectedCashArs = operation.properties?.['Cash AR']?.number;
    const actualCashArs = properties['Cash AR']?.number;
    const relation = properties['Venta relacionada']?.relation || [];
    const needsRelation = operation.localType === 'Venta' || operation.localType === 'Cobranza';
    return notionType === expectedType
      && files.length === operation.attachmentNames.length
      && Math.abs(Number(actualCashArs || 0) - Number(expectedCashArs || 0)) <= 1
      && (!needsRelation || relation.length > 0);
  });
}

function buildExistingSubmissionResult(pages, operations) {
  return {
    created: pages.map((page, index) => ({
      id: page.id,
      url: page.url,
      type: operations[index].localType
    })),
    operations,
    dryRun: false,
    idempotentReplay: true
  };
}

async function resolveRelatedSale(normalized, verifiedClient) {
  if (normalized.tipo !== 'Cobranza' && normalized.tipo !== 'Devolución') return null;

  let sale = null;
  if (normalized.latestSaleId) {
    if (!parseRelationId(normalized.latestSaleId)) {
      const error = new Error('La venta relacionada no tiene un Notion ID válido');
      error.statusCode = 400;
      throw error;
    }
    sale = await lookupRelatedSaleById(normalized.latestSaleId, {
      ghlId: normalized.ghlId,
      clientPageId: normalized.clientPageId,
      verifiedClient
    });
  } else {
    sale = await findLatestVentaForClient(verifiedClient);
  }

  if (!sale?.notionPageId) {
    const error = new Error('No encontré una venta relacionada para este cliente');
    error.statusCode = 400;
    throw error;
  }
  if (!sale.fechaVenta) {
    const error = new Error('La venta relacionada no tiene fecha de venta');
    error.statusCode = 400;
    throw error;
  }

  normalized.latestSaleId = sale.notionPageId;
  normalized.fechaVenta = requiredDate(
    String(sale.fechaVenta).slice(0, 10),
    'la fecha de la venta relacionada'
  );
  return sale;
}

async function createComprobante(payload, user, options = {}) {
  const normalized = normalizePayload(payload, user, options);
  const submissionKey = normalized.submissionKey;
  if (!submissionKey) {
    const error = new Error('Falta el identificador único de la carga; recargá la pantalla e intentá de nuevo');
    error.statusCode = 400;
    throw error;
  }
  if (!/^[A-Za-z0-9-]{16,100}$/.test(submissionKey)) {
    const error = new Error('El identificador único de la carga no es válido; recargá la pantalla e intentá de nuevo');
    error.statusCode = 400;
    throw error;
  }
  const cached = submissionKey ? getSubmissionCacheEntry(submissionKey) : null;
  if (cached?.status === 'done') return cached.result;
  if (cached?.status === 'pending' && cached.promise) return cached.promise;

  const run = (async () => {
    const createdPageIds = [];
    let operations = [];
    try {
      const verifiedClient = await lookupClientRecordByGhlId(normalized.ghlId);
      assertRequestedClientPage(verifiedClient, normalized.clientPageId);
      normalized.ghlId = verifiedClient.ghlId;
      normalized.clientName = verifiedClient.nombre || normalized.clientName;

      const schema = await fetchComprobantesDatabaseSchema();
      if (!schema?.properties) {
        const error = new Error('No pude leer la estructura de Comprobantes en Notion');
        error.statusCode = 502;
        throw error;
      }

      const productsDatabaseId = schema.properties?.Productos?.relation?.database_id || env.notionProductsDatabaseId;
      const mediosDatabaseId = schema.properties?.['Medios de pago']?.relation?.database_id || null;
      if (!mediosDatabaseId) {
        const error = new Error('La propiedad Medios de pago de Notion no está configurada como relación');
        error.statusCode = 502;
        throw error;
      }

      const [productOptions, mediosOptions, notionUsers] = await Promise.all([
        fetchRelationOptions(productsDatabaseId),
        fetchRelationOptions(mediosDatabaseId),
        fetchResponsibleVentaCandidates()
      ]);

      const productId = normalized.productName
        ? findBestOptionIdByName(productOptions, normalized.productName)
        : null;
      if (normalized.tipo === 'Venta' && !productId) {
        const error = new Error(`No encontré el producto ${normalized.productName} en Notion`);
        error.statusCode = 400;
        throw error;
      }
      normalized.productIds = productId ? [productId] : [];

      const medioPagoOption = mediosOptions.find(
        (option) => normalizeText(option.name) === normalizeText(normalized.medioPago)
      );
      const medioPagoId = medioPagoOption?.active ? medioPagoOption.id : null;
      if (!medioPagoId) {
        const error = new Error(`El medio de pago ${normalized.medioPago} no existe o está inactivo en Notion`);
        error.statusCode = 400;
        throw error;
      }
      normalized.medioPagoIds = [medioPagoId];

      const responsibleMatch = findBestNotionUserMatch(notionUsers, normalized.responsableVenta, user);
      if (!responsibleMatch) {
        const error = new Error(`No encontré a ${normalized.responsableVenta} como responsable en Notion`);
        error.statusCode = 400;
        throw error;
      }
      normalized.responsableVentaUserIds = [responsibleMatch.id];

      await resolveRelatedSale(normalized, verifiedClient);
      operations = buildDraftOperations(normalized);

      for (const operation of operations) {
        const availableNames = new Set(normalized.attachmentFiles.map((file) => file.name));
        const missingName = operation.attachmentNames.find((name) => !availableNames.has(name));
        if (missingName) {
          const error = new Error(`No encontré el archivo ${missingName} para una de las operaciones`);
          error.statusCode = 400;
          throw error;
        }
      }

      const existingPages = await findNotionPagesBySubmissionKey(submissionKey);
      if (notionSubmissionIsComplete(existingPages, operations)) {
        return buildExistingSubmissionResult(existingPages, operations);
      }
      if (existingPages.length) {
        await archiveNotionPages(existingPages.map((page) => page.id));
      }

      const results = [];
      let createdVentaId = null;
      for (const operation of operations) {
        if (operation.localType === 'Cobranza' && createdVentaId) {
          operation.properties['Venta relacionada'] = notionRelationValue(createdVentaId);
        }
        const created = await createNotionPage(operation.properties);
        if (!created?.id) {
          const error = new Error('Notion no devolvió el ID del comprobante creado');
          error.statusCode = 502;
          throw error;
        }
        createdPageIds.push(created.id);
        const operationFiles = normalized.attachmentFiles.filter(
          (file) => operation.attachmentNames.includes(file.name)
        );
        if (operationFiles.length) {
          await attachFilesToNotionPage(created.id, operationFiles);
        }
        if (operation.localType === 'Venta') {
          createdVentaId = created.id;
          await updateNotionPageProperties(created.id, {
            Finalizado: notionCheckboxValue(true),
            'Venta relacionada': notionRelationValue(created.id)
          });
        }
        results.push({
          id: created.id,
          url: created.url,
          type: operation.localType
        });
      }

      return {
        created: results,
        operations,
        dryRun: false
      };
    } catch (error) {
      let rollbackError = null;
      if (createdPageIds.length) {
        try {
          await archiveNotionPages(createdPageIds);
        } catch (caughtRollbackError) {
          rollbackError = caughtRollbackError;
        }
      }

      const wrapped = new Error(
        error.response?.data?.message
        || error.message
        || 'No pude crear el comprobante en Notion. Revisá token, propiedades y permisos de la base.'
      );
      wrapped.statusCode = rollbackError
        ? 502
        : (error.response?.status || error.statusCode || 502);
      wrapped.details = {
        notion: error.response?.data || null,
        operations,
        rolledBackPageIds: rollbackError ? [] : createdPageIds,
        rollbackFailedIds: rollbackError?.rollbackFailedIds || []
      };
      throw wrapped;
    }
  })();

  setSubmissionCachePending(submissionKey, run);

  try {
    const result = await run;
    setSubmissionCacheDone(submissionKey, result);
    return result;
  } catch (error) {
    clearSubmissionCache(submissionKey);
    throw error;
  }
}

async function listMyComprobantes(user, options = {}) {
  const responsibleName = standardizeResponsibleVenta(user);
  const requestedResponsible = titleCaseName(optionalString(options.responsible));
  const allowAll = canViewAllComprobantes(user);
  const setterNames = allowAll ? [] : getComprobantesSetterNames(user);
  if (!responsibleName && !allowAll && !setterNames.length) {
    return {
      responsibleName: '',
      canViewAll: allowAll,
      canViewBySetter: false,
      selectedResponsible: requestedResponsible || '',
      rows: []
    };
  }

  const pageSize = Math.min(Math.max(Number(options.limit || 500), 1), 1000);
  const rows = [];
  let offset = 0;

  while (true) {
    const params = {
      select: 'id,cliente_format,ghlid,tipo,producto_format,f_venta,f_acreditacion,fecha_creado,created_at,facturacion,cash_collected,cash_ar,cash_collected_ar,cash_collected_ars,tc,estado,rebotar_pago,creado_por,responsable_venta,responsable_actual,setter,info_comprobantes',
      order: 'fecha_creado.desc.nullslast,created_at.desc.nullslast',
      limit: pageSize,
      offset
    };

    if (!allowAll) {
      const visibilityFilters = [
        ...(responsibleName ? [`responsable_venta.eq.${responsibleName}`] : []),
        ...setterNames.map((name) => `setter.eq.${name}`)
      ];
      if (visibilityFilters.length === 1) {
        const [column, operator, value] = visibilityFilters[0].split('.');
        params[column] = `${operator}.${value}`;
      } else {
        params.or = `(${visibilityFilters.join(',')})`;
      }
    }

    const response = await supabaseRequest('comprobantes', params);

    const chunk = response.data || [];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
    offset += pageSize;
  }

  const normalizedResponsibleName = normalizeText(responsibleName);
  const selectedResponsible = allowAll
    ? titleCaseName(requestedResponsible)
    : responsibleName;
  const normalizedSelectedResponsible = normalizeText(selectedResponsible);
  const resolvedRows = rows.flatMap((row) => {
    const resolvedResponsible = normalizeText(resolveComprobanteResponsibleVentaOnly(row));
    if (allowAll) {
      return !normalizedSelectedResponsible || resolvedResponsible === normalizedSelectedResponsible
        ? [{ ...row, accessScope: 'all', canManage: canManageOwnComprobante(row, user) }]
        : [];
    }
    const isOwnComprobante = resolvedResponsible === normalizedResponsibleName;
    const isAssignedSetter = setterNames.includes(titleCaseName(row.setter));
    if (isOwnComprobante) return [{ ...row, accessScope: 'mine', canManage: canManageOwnComprobante(row, user) }];
    if (isAssignedSetter) return [{ ...row, accessScope: 'setter', canManage: canManageOwnComprobante(row, user) }];
    return [];
  });

  const responsibleOptions = uniqueSorted(
    rows
      .map((row) => resolveComprobanteResponsibleVentaOnly(row))
      .filter(Boolean)
  );

  return {
    responsibleName,
    canViewAll: allowAll,
    canViewBySetter: setterNames.length > 0,
    selectedResponsible,
    responsibleOptions,
    rows: resolvedRows
  };
}

module.exports = {
  getBootstrap,
  lookupClientByGhlId,
  lookupRelatedSaleById,
  createComprobante,
  getEditableComprobante,
  updateEditableComprobante,
  deleteEditableComprobante,
  listMyComprobantes,
  _test: {
    isChequePaymentMethod,
    isNotionPaymentMethodActive,
    notionPropertyDisplayText,
    buildChequeRows,
    buildDraftOperations,
    validateChequeRows,
    normalizePayload,
    hasSaleOwnership,
    canViewAllComprobantes,
    getComprobantesSetterNames,
    canManageOwnComprobante,
    canEditComprobanteStatus,
    mapNotionSalePage
  }
};
