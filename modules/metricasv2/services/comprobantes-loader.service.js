const axios = require('axios');
const env = require('../config/env');

const DEFAULT_PRODUCTS = [
  'MEG',
  'MEG Premium',
  'MEG Full',
  'Club',
  'Renovacion',
  'Consultoria',
  'Onboarding',
  'Mentoria'
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

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
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

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const normalized = String(value)
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
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

function requiredDate(value, label) {
  const text = requiredString(value, label);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const error = new Error(`${label} debe venir en formato YYYY-MM-DD`);
    error.statusCode = 400;
    throw error;
  }
  return text;
}

function ensureFileSize(file, maxBytes = 20 * 1024 * 1024) {
  const size = Number(file?.size || 0);
  if (size > maxBytes) {
    const error = new Error(`El archivo ${file.name || ''} supera el límite de 20 MB`.trim());
    error.statusCode = 400;
    throw error;
  }
}

function parseRelationId(value) {
  const text = String(value || '').replace(/-/g, '').trim();
  if (!/^[a-f0-9]{32}$/i.test(text)) return null;
  return text.toLowerCase();
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
    .map((id) => parseRelationId(id))
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
        headers: buildNotionHeaders()
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
        headers: buildNotionHeaders()
      }
    );

    return (response.data?.results || [])
      .map((page) => {
        const properties = page.properties || {};
        const titleProperty = Object.values(properties).find((property) => property?.type === 'title');
        const name = titleProperty?.title?.map((item) => item.plain_text).join('') || '';
        return { id: page.id, name };
      })
      .filter((item) => item.name);
  } catch (error) {
    return [];
  }
}

async function fetchNotionUsers() {
  if (!env.notionApiKey) return [];

  try {
    const response = await axios.get('https://api.notion.com/v1/users', {
      headers: buildNotionHeaders()
    });

    return (response.data?.results || [])
      .filter((user) => user?.type === 'person' && user?.name)
      .map((user) => ({ id: user.id, name: user.name, email: user.person?.email || '' }));
  } catch (error) {
    return [];
  }
}

async function fetchComprobantesDatabaseSchema() {
  const databaseId = getComprobantesDatabaseId();
  if (!env.notionApiKey || !databaseId) return null;

  try {
    const response = await axios.get(
      `https://api.notion.com/v1/databases/${databaseId}`,
      {
        headers: buildNotionHeaders()
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
  const fallbackProducts = notionProducts.length ? [] : await fetchHistoricalProducts();
  const products = notionProducts.length ? notionProducts.map((item) => item.name) : fallbackProducts;
  const paymentOptions = notionPaymentMethods.length
    ? notionPaymentMethods.map((item) => item.name)
    : DEFAULT_PAYMENT_METHODS;

  return {
    responsibleVentaDefault: standardizeResponsibleVenta(user),
    tipoOptions: DEFAULT_TYPES,
    mediosDePagoOptions: paymentOptions.length ? paymentOptions : DEFAULT_PAYMENT_METHODS,
    cantidadPagosOptions: [1, 2, 3, 4],
    productsSource: notionProducts.length ? 'notion' : 'fallback',
    products,
    uploadAcceptedTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  };
}

async function lookupClientByGhlId(rawGhlInput) {
  const ghlId = parseGhlIdFromInput(rawGhlInput);
  if (!ghlId) {
    const error = new Error('No pude encontrar un GHL ID válido en el valor ingresado');
    error.statusCode = 400;
    throw error;
  }

  const response = await supabaseRequest('leads_raw', {
    select: 'id,ghlid,nombre,mail,telefono,etapa',
    ghlid: `eq.${ghlId}`,
    order: 'last_edited_time.desc',
    limit: 5
  });

  const row = (response.data || [])[0];
  if (!row) {
    const error = new Error('No encontré un cliente con ese GHL ID');
    error.statusCode = 404;
    throw error;
  }

  const latestSale = await findLatestVentaByGhlId(ghlId);

  return {
    pageId: row.id || null,
    ghlId,
    nombre: row.nombre || '',
    mail: row.mail || '',
    telefono: row.telefono || '',
    etapa: row.etapa || '',
    latestSale
  };
}

async function findLatestVentaByGhlId(ghlId) {
  if (!ghlId) return null;

  const response = await supabaseRequest('comprobantes', {
    select: 'id,cliente,ghlid,producto_format,f_venta,fecha_creado,f_acreditacion,facturacion,cash_collected_ars,tipo',
    ghlid: `eq.${ghlId}`,
    tipo: 'eq.Venta',
    order: 'f_venta.desc.nullslast,fecha_creado.desc.nullslast',
    limit: 10
  });

  const row = (response.data || [])[0];
  if (!row) return null;

  return {
    notionPageId: row.id || null,
    cliente: row.cliente || '',
    producto: row.producto_format || '',
    fechaVenta: row.f_venta || null,
    fechaAcreditacion: row.f_acreditacion || null,
    facturacionUsd: toNumber(row.facturacion),
    cashCollectedArs: toNumber(row.cash_collected_ars)
  };
}

function buildChequeRows(payload) {
  const rows = Array.isArray(payload.cheques) ? payload.cheques : [];
  return rows
    .map((row, index) => ({
      index,
      montoArs: toNumber(row?.montoArs),
      archivoNombre: optionalString(row?.archivoNombre)
    }))
    .filter((row) => row.montoArs !== null);
}

function validateChequeRows(chequeRows, expectedCount, totalCashArs) {
  if (!expectedCount || expectedCount < 1) {
    const error = new Error('Si el medio de pago es cheque tenés que indicar la cantidad de cheques');
    error.statusCode = 400;
    throw error;
  }

  if (chequeRows.length !== expectedCount) {
    const error = new Error('La cantidad de cheques cargados no coincide con la cantidad indicada');
    error.statusCode = 400;
    throw error;
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
  if (normalized.responsableVenta) parts.push(`Responsable venta: ${normalized.responsableVenta}`);
  if (normalized.infoComprobantes) parts.push(normalized.infoComprobantes);
  if (normalized.mesesSoporte !== null) parts.push(`Meses de soporte: ${normalized.mesesSoporte}`);
  if (normalized.sesiones !== null) parts.push(`Sesiones: ${normalized.sesiones}`);
  if (normalized.bonusMati) parts.push('Bonus Mati: Sí');
  if (normalized.attachmentNames.length) parts.push(`Adjuntos: ${normalized.attachmentNames.join(', ')}`);
  return parts.join(' | ');
}

async function createNotionFileUpload(file) {
  const createResponse = await axios.post(
    'https://api.notion.com/v1/file_uploads',
    {},
    {
      headers: buildNotionHeaders({ 'Notion-Version': '2025-09-03' })
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
      headers: buildNotionHeaders({ 'Notion-Version': '2025-09-03' })
    }
  );
}

function normalizePayload(payload = {}, user) {
  const tipo = requiredString(payload.tipo, 'el tipo');
  if (!DEFAULT_TYPES.includes(tipo)) {
    const error = new Error('Tipo inválido para el comprobante');
    error.statusCode = 400;
    throw error;
  }

  const ghlId = requiredString(payload.ghlId, 'el GHL ID');
  const clientName = requiredString(payload.clientName, 'el cliente');
  const clientPageId = optionalString(payload.clientPageId);
  const responsableVenta = requiredString(
    standardizeResponsibleVenta(user, payload.responsableVenta),
    'el responsable de venta'
  );
  const fechaVenta = requiredDate(payload.fechaVenta, 'la fecha de venta');
  const fechaAcreditacion = requiredDate(payload.fechaAcreditacion, 'la fecha de acreditación');
  const tc = requiredNumber(payload.tc, 'la tasa de cambio');
  const cashCollectedArs = requiredNumber(payload.cashCollectedArs, 'cash collected ARS');
  const medioPago = requiredString(payload.medioPago, 'el medio de pago');
  const dniCuit = optionalString(payload.dniCuit);
  const infoComprobantes = optionalString(payload.infoComprobantes);
  const mesesSoporte = payload.mesesSoporte === '' || payload.mesesSoporte === null || payload.mesesSoporte === undefined
    ? null
    : toInteger(payload.mesesSoporte);
  const sesiones = payload.sesiones === '' || payload.sesiones === null || payload.sesiones === undefined
    ? null
    : toInteger(payload.sesiones);
  const bonusMati = Boolean(payload.bonusMati);
  const attachmentNames = Array.isArray(payload.attachmentNames)
    ? payload.attachmentNames.map((item) => optionalString(item)).filter(Boolean)
    : [];
  const attachmentFiles = Array.isArray(payload.attachmentFiles)
    ? payload.attachmentFiles
        .map((file) => ({
          name: requiredString(file?.name, 'el nombre del archivo'),
          type: optionalString(file?.type) || 'application/octet-stream',
          size: Number(file?.size || 0),
          base64: requiredString(file?.base64, 'el contenido del archivo')
        }))
    : [];

  attachmentFiles.forEach((file) => ensureFileSize(file));

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
    autoFinalizar: Boolean(payload.autoFinalizar)
  };

  if (tipo === 'Venta') {
    normalized.productName = requiredString(payload.productName, 'el producto adquirido');
    normalized.facturacionUsd = requiredNumber(payload.facturacionUsd, 'la facturación USD');
    normalized.cantidadPagos = toInteger(payload.cantidadPagos);

    if (!normalized.cantidadPagos || normalized.cantidadPagos < 1 || normalized.cantidadPagos > 4) {
      const error = new Error('Cantidad de pagos inválida');
      error.statusCode = 400;
      throw error;
    }

    const maxAllowedCash = normalized.facturacionUsd + 5;
    const cashUsd = normalized.cashCollectedArs / tc;
    if (cashUsd > maxAllowedCash) {
      const error = new Error('Cash collected ARS no puede ser mayor a la facturación con un margen de hasta 5 USD');
      error.statusCode = 400;
      throw error;
    }

    if (normalizeText(medioPago) === 'cheque') {
      normalized.chequeCount = toInteger(payload.chequeCount);
      normalized.cheques = buildChequeRows(payload);
      validateChequeRows(normalized.cheques, normalized.chequeCount, normalized.cashCollectedArs);
    }
  }

  if (tipo === 'Cobranza' || tipo === 'Devolución') {
    normalized.autoFinalizar = true;
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
      Productos: notionRelationArrayValue(overrides.productIds || normalized.productIds || []),
      Facturacion: operationType === 'Venta' ? notionNumberValue(normalized.facturacionUsd) : undefined,
      'Cash collected': notionNumberValue(cashUsd),
      'Cash collected AR': notionNumberValue(amountArs),
      TC: notionNumberValue(normalized.tc),
      'Dni/cuit': notionRichTextValue(normalized.dniCuit),
      'Info Comprobantes': notionRichTextValue(commonInfo),
      'Medios de pago': notionRelationArrayValue(overrides.medioPagoIds || normalized.medioPagoIds || []),
      'Fecha de acreditacion': notionDateValue(overrides.fechaAcreditacion || normalized.fechaAcreditacion),
      'F.venta respaldo': notionDateValue(overrides.fechaVenta || normalized.fechaVenta),
      'Venta relacionada': notionRelationValue(overrides.ventaRelacionada || normalized.latestSaleId)
    };

    if (operationType === 'Venta') {
      Object.assign(properties, {
        'Cantidad de pagos': notionSelectValue(`${normalized.cantidadPagos} ${normalized.cantidadPagos === 1 ? 'Pago' : 'Pagos'}`),
        'Cheque?': notionCheckboxValue(overrides.cheque ?? (normalizeText(normalized.medioPago) === 'cheque'))
      });
    }

    if (normalized.mesesSoporte !== null) properties['Meses de soporte'] = notionRichTextValue(String(normalized.mesesSoporte));
    if (normalized.sesiones !== null) properties.Sesiones = notionNumberValue(normalized.sesiones);
    if (normalized.bonusMati) properties['Bonus Mati'] = notionCheckboxValue(true);
    if (operationType !== 'Venta') properties.Finalizado = notionCheckboxValue(Boolean(overrides.finalizar ?? normalized.autoFinalizar));

    return Object.fromEntries(Object.entries(properties).filter(([, value]) => value !== undefined));
  }

  if (normalized.tipo === 'Venta' && normalizeText(normalized.medioPago) === 'cheque' && normalized.cheques.length > 1) {
    return normalized.cheques.map((cheque, index) => ({
      localType: index === 0 ? 'Venta' : 'Cobranza',
      properties: buildOperationPayload(index === 0 ? 'Venta' : 'Cobranza', {
        cashCollectedArs: cheque.montoArs,
        cheque: true,
        finalizar: index > 0
      }),
      attachmentNames: cheque.archivoNombre ? [cheque.archivoNombre] : []
    }));
  }

  return [{
    localType: normalized.tipo,
    properties: buildOperationPayload(normalized.tipo, {
      cheque: normalizeText(normalized.medioPago) === 'cheque',
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
      headers: buildNotionHeaders()
    }
  );

  return response.data;
}

async function createComprobante(payload, user) {
  const normalized = normalizePayload(payload, user);
  const schema = await fetchComprobantesDatabaseSchema();
  const productsDatabaseId = schema?.properties?.Productos?.relation?.database_id || env.notionProductsDatabaseId;
  const mediosDatabaseId = schema?.properties?.['Medios de pago']?.relation?.database_id || null;
  const [productOptions, mediosOptions, notionUsers] = await Promise.all([
    fetchRelationOptions(productsDatabaseId),
    fetchRelationOptions(mediosDatabaseId),
    fetchNotionUsers()
  ]);

  normalized.productIds = normalized.productName ? [findBestOptionIdByName(productOptions, normalized.productName)].filter(Boolean) : [];
  normalized.medioPagoIds = normalized.medioPago ? [findBestOptionIdByName(mediosOptions, normalized.medioPago)].filter(Boolean) : [];
  const responsibleMatch = notionUsers.find((item) => normalizeText(item.name) === normalizeText(normalized.responsableVenta));
  normalized.responsableVentaUserIds = responsibleMatch ? [responsibleMatch.id] : [];

  if ((normalized.tipo === 'Cobranza' || (normalized.tipo === 'Venta' && normalizeText(normalized.medioPago) === 'cheque' && normalized.cheques.length > 1)) && !normalized.latestSaleId) {
    const latestSale = await findLatestVentaByGhlId(normalized.ghlId);
    normalized.latestSaleId = latestSale?.notionPageId || null;
  }

  const operations = buildDraftOperations(normalized);

  try {
    const results = [];
    for (const operation of operations) {
      const created = await createNotionPage(operation.properties);
      if (normalized.attachmentFiles.length && operation.localType === normalized.tipo) {
        await attachFilesToNotionPage(created.id, normalized.attachmentFiles);
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
    const wrapped = new Error(
      error.response?.data?.message
      || 'No pude crear el comprobante en Notion. Revisá token, propiedades y permisos de la base.'
    );
    wrapped.statusCode = error.response?.status || error.statusCode || 502;
    wrapped.details = {
      notion: error.response?.data || null,
      operations
    };
    throw wrapped;
  }
}

module.exports = {
  getBootstrap,
  lookupClientByGhlId,
  createComprobante
};
