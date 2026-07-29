const axios = require('axios');
const {
  CUIT,
  POINT_OF_SALE,
  ARCA_HTTPS_AGENT,
  xmlValue,
  xmlEscape,
  getWsaaCredentials,
  getLastAuthorizedInvoice
} = require('../../../scripts/arca_wsfe_probe');
const {
  buildClubInvoicePolicy,
  invoiceAmounts,
  arcaAmountsXml
} = require('./club-invoice-policy.service');

const WSFE_URL = 'https://servicios1.afip.gov.ar/wsfev1/service.asmx';
const PADRON_URL = 'https://aws.afip.gov.ar/sr-padron/webservices/personaServiceA5';
const FACTURA_A = 1;
const FACTURA_B = 6;
const CONSUMIDOR_FINAL = 5;
let invoiceQueue = Promise.resolve();

function formatArcaDate(date) {
  return date.toISOString().slice(0, 10).replaceAll('-', '');
}

function invoiceDates(date = new Date()) {
  const issued = new Date(date);
  const serviceFrom = new Date(Date.UTC(issued.getUTCFullYear(), issued.getUTCMonth(), 1));
  const serviceTo = new Date(Date.UTC(issued.getUTCFullYear(), issued.getUTCMonth() + 1, 0));
  return {
    issued,
    serviceFrom,
    serviceTo,
    paymentDueDate: new Date(issued)
  };
}

function recipientNameFromPadron(xml) {
  const businessName = xmlValue(xml, 'razonSocial');
  if (businessName) return businessName;
  return [xmlValue(xml, 'apellido'), xmlValue(xml, 'nombre')].filter(Boolean).join(' ').trim();
}

function recipientAddressFromPadron(xml) {
  const domicile = xmlValue(xml, 'domicilioFiscal');
  if (!domicile) return '';
  const values = [
    xmlValue(domicile, 'direccion'),
    xmlValue(domicile, 'localidad'),
    xmlValue(domicile, 'descripcionProvincia')
  ].map((value) => String(value || '').trim()).filter(Boolean);
  return [...new Set(values)].join(' - ');
}

function getErrors(xml) {
  const errorsXml = xmlValue(xml, 'Errors');
  if (!errorsXml) return [];
  const codes = [...errorsXml.matchAll(/<(?:\w+:)?Code[^>]*>(.*?)<\/(?:\w+:)?Code>/gi)].map((match) => match[1]);
  const messages = [...errorsXml.matchAll(/<(?:\w+:)?Msg[^>]*>(.*?)<\/(?:\w+:)?Msg>/gi)].map((match) => match[1]);
  return codes.map((code, index) => ({ code, message: messages[index] || '' }));
}

async function postWsfe(action, body) {
  const envelope = `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>${body}</soap:Body></soap:Envelope>`;
  const response = await axios.post(WSFE_URL, envelope, {
    headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `http://ar.gov.afip.dif.FEV1/${action}` },
    httpsAgent: ARCA_HTTPS_AGENT,
    timeout: 30000
  });
  const errors = getErrors(response.data);
  if (errors.length) throw new Error(errors.map((error) => `ARCA ${error.code}: ${error.message}`).join(' | '));
  return response.data;
}

function validateRecord(record) {
  if (String(record.currency || 'ARS') !== 'ARS') throw new Error('Solo se pueden facturar importes en ARS');
  if (!Number.isFinite(Number(record.amount)) || Number(record.amount) <= 0) throw new Error('El importe a facturar es inválido');
}

function consumerFinalRecipient(record = {}, raw = '') {
  const hasDni = /^\d{7,8}$/.test(raw);
  return {
    invoiceType: 'B',
    invoiceTypeCode: FACTURA_B,
    documentType: hasDni ? 96 : 99,
    documentNumber: hasDni ? raw : '0',
    vatConditionId: CONSUMIDOR_FINAL,
    vatCondition: 'Consumidor Final',
    recipientName: String(record.payer || '').trim(),
    recipientAddress: String(record.payerAddress || '').trim()
  };
}

function manualRecipient(record, raw) {
  const vatConditionId = Number(record.vatConditionId);
  if (![1, 5, 6].includes(vatConditionId)) return null;
  const hasCompleteRecipientData = String(record.payer || '').trim()
    && String(record.payerAddress || '').trim();
  if (record.source !== 'manual' && !hasCompleteRecipientData) return null;
  const requestedInvoiceType = String(record.requestedInvoiceType || '').toUpperCase();
  if (vatConditionId === CONSUMIDOR_FINAL) {
    if (requestedInvoiceType && requestedInvoiceType !== 'B') throw new Error('Consumidor Final requiere Factura B');
    return consumerFinalRecipient(record, raw);
  }
  if (![1, 6].includes(vatConditionId)) throw new Error('Club del Costo solo admite Consumidor Final, Monotributo o Responsable Inscripto');
  if (requestedInvoiceType && requestedInvoiceType !== 'A') throw new Error('Monotributo y Responsable Inscripto requieren Factura A');
  if (String(record.identificationType || '').toUpperCase() !== 'CUIT' || raw.length !== 11) {
    throw new Error('Factura A requiere un CUIT válido');
  }
  return {
    invoiceType: 'A',
    invoiceTypeCode: FACTURA_A,
    documentType: 80,
    documentNumber: raw,
    vatConditionId,
    vatCondition: vatConditionId === 6 ? 'Responsable Monotributo' : 'Responsable Inscripto',
    recipientName: String(record.payer || '').trim(),
    recipientAddress: String(record.payerAddress || '').trim()
  };
}

function buildPadronEnvelope(auth, documentNumber) {
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><a5:getPersona_v2 xmlns:a5="http://a5.soap.ws.server.puc.sr/"><token>${xmlEscape(auth.token)}</token><sign>${xmlEscape(auth.sign)}</sign><cuitRepresentada>${CUIT}</cuitRepresentada><idPersona>${xmlEscape(documentNumber)}</idPersona></a5:getPersona_v2></soap:Body></soap:Envelope>`;
}

async function resolveRecipient(record) {
  const raw = String(record.identificationNumber || '').replace(/\D/g, '');
  const selectedRecipient = manualRecipient(record, raw);
  if (selectedRecipient) return selectedRecipient;
  if (String(record.identificationType || '').toUpperCase() !== 'CUIT' || raw.length !== 11) {
    return consumerFinalRecipient(record, raw);
  }
  let auth;
  try {
    auth = await getWsaaCredentials('ws_sr_constancia_inscripcion');
  } catch (error) {
    const causeMessage = String(error?.message || '').trim();
    const missingCredential = /Falta la credencial ARCA/i.test(causeMessage);
    const wrapped = new Error(missingCredential
      ? causeMessage
      : 'La consulta automática al Padrón de ARCA no está autorizada para el certificado activo. Revisá que Render use el certificado RANDAZZO2026.');
    wrapped.statusCode = 409;
    wrapped.cause = error;
    throw wrapped;
  }
  const envelope = buildPadronEnvelope(auth, raw);
  const response = await axios.post(PADRON_URL, envelope, {
    headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '' },
    httpsAgent: ARCA_HTTPS_AGENT,
    timeout: 30000
  });
  const descriptions = [...String(response.data).matchAll(/<(?:\w+:)?descripcionImpuesto[^>]*>(.*?)<\/(?:\w+:)?descripcionImpuesto>/gi)].map((match) => match[1].toUpperCase());
  const isMonotributo = descriptions.some((value) => value.includes('MONOTRIBUTO'));
  const isRegisteredVat = descriptions.some((value) => value === 'IVA' || value.includes('VALOR AGREGADO'));
  if (!isMonotributo && !isRegisteredVat) throw new Error('El CUIT no figura activo en IVA ni Monotributo; no se puede determinar una Factura A segura');
  return {
    invoiceType: 'A',
    invoiceTypeCode: FACTURA_A,
    documentType: 80,
    documentNumber: raw,
    vatConditionId: isMonotributo ? 6 : 1,
    vatCondition: isMonotributo ? 'Responsable Monotributo' : 'Responsable Inscripto',
    recipientName: recipientNameFromPadron(response.data) || String(record.payer || '').trim(),
    recipientAddress: recipientAddressFromPadron(response.data) || String(record.payerAddress || '').trim()
  };
}

async function previewInvoice(record) {
  validateRecord(record);
  const recipient = await resolveRecipient(record);
  const policy = buildClubInvoicePolicy(record, recipient);
  const dates = invoiceDates();
  return {
    invoiceType: recipient.invoiceType,
    invoiceTypeCode: recipient.invoiceTypeCode,
    vatConditionId: recipient.vatConditionId,
    vatCondition: recipient.vatCondition,
    documentType: recipient.documentType,
    documentNumber: recipient.documentNumber,
    recipientName: recipient.recipientName,
    recipientAddress: recipient.recipientAddress,
    issuedAt: dates.issued.toISOString(),
    serviceFrom: dates.serviceFrom.toISOString().slice(0, 10),
    serviceTo: dates.serviceTo.toISOString().slice(0, 10),
    paymentDueDate: dates.paymentDueDate.toISOString().slice(0, 10),
    description: policy.description,
    taxTreatment: policy.taxTreatment,
    amounts: policy.amounts,
    legends: policy.legends
  };
}

async function issueElectronicInvoice(record) {
  validateRecord(record);
  const recipient = await resolveRecipient(record);
  const policy = buildClubInvoicePolicy(record, recipient);
  const auth = await getWsaaCredentials();
  const invoiceNumber = (await getLastAuthorizedInvoice(auth, recipient.invoiceTypeCode)) + 1;
  const dates = invoiceDates();
  const detail = `<FECAEDetRequest><Concepto>2</Concepto><DocTipo>${recipient.documentType}</DocTipo><DocNro>${recipient.documentNumber}</DocNro><CbteDesde>${invoiceNumber}</CbteDesde><CbteHasta>${invoiceNumber}</CbteHasta><CbteFch>${formatArcaDate(dates.issued)}</CbteFch>${arcaAmountsXml(policy.amounts)}<FchServDesde>${formatArcaDate(dates.serviceFrom)}</FchServDesde><FchServHasta>${formatArcaDate(dates.serviceTo)}</FchServHasta><FchVtoPago>${formatArcaDate(dates.paymentDueDate)}</FchVtoPago><MonId>PES</MonId><MonCotiz>1.000000</MonCotiz><CondicionIVAReceptorId>${recipient.vatConditionId}</CondicionIVAReceptorId></FECAEDetRequest>`;
  const body = `<FECAESolicitar xmlns="http://ar.gov.afip.dif.FEV1/"><Auth><Token>${xmlEscape(auth.token)}</Token><Sign>${xmlEscape(auth.sign)}</Sign><Cuit>${CUIT}</Cuit></Auth><FeCAEReq><FeCabReq><CantReg>1</CantReg><PtoVta>${POINT_OF_SALE}</PtoVta><CbteTipo>${recipient.invoiceTypeCode}</CbteTipo></FeCabReq><FeDetReq>${detail}</FeDetReq></FeCAEReq></FECAESolicitar>`;
  const xml = await postWsfe('FECAESolicitar', body);
  const result = xmlValue(xml, 'Resultado');
  const cae = xmlValue(xml, 'CAE');
  if (result !== 'A' || !cae) throw new Error(`ARCA no autorizó el comprobante. Resultado: ${result || 'sin resultado'}`);
  return {
    invoiceType: recipient.invoiceType, invoiceTypeCode: recipient.invoiceTypeCode, pointOfSale: POINT_OF_SALE,
    invoiceNumber, cae, caeExpiration: xmlValue(xml, 'CAEFchVto'),
    issuedAt: dates.issued.toISOString(),
    serviceFrom: dates.serviceFrom.toISOString().slice(0, 10),
    serviceTo: dates.serviceTo.toISOString().slice(0, 10),
    paymentDueDate: dates.paymentDueDate.toISOString().slice(0, 10),
    documentType: recipient.documentType,
    documentNumber: recipient.documentNumber,
    recipientName: recipient.recipientName,
    recipientAddress: recipient.recipientAddress,
    vatConditionId: recipient.vatConditionId,
    vatCondition: recipient.vatCondition,
    concept: 'Servicios',
    description: policy.description,
    taxTreatment: policy.taxTreatment,
    amounts: policy.amounts,
    legends: policy.legends,
    showTransparency: policy.showTransparency,
    showMonotributoLegend: policy.showMonotributoLegend,
    amount: Number(record.amount),
    currency: 'ARS'
  };
}

function issueInvoice(record) {
  const queued = invoiceQueue.then(() => issueElectronicInvoice(record));
  invoiceQueue = queued.catch(() => undefined);
  return queued;
}

async function issueCreditNoteInternal(record, original) {
  const originalType = Number(original?.invoiceTypeCode);
  const noteType = originalType === 1 ? 3 : originalType === 6 ? 8 : null;
  if (!noteType) throw new Error('Solo se admiten notas de crédito A o B');
  const auth = await getWsaaCredentials();
  const number = (await getLastAuthorizedInvoice(auth, noteType)) + 1;
  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
  const amounts = original.amounts || invoiceAmounts(
    original.amount || record.amount,
    original.taxTreatment === 'Gravado 21%' ? 'Gravado 21%' : 'Exento'
  );
  const associated = `<CbtesAsoc><CbteAsoc><Tipo>${originalType}</Tipo><PtoVta>${original.pointOfSale}</PtoVta><Nro>${original.invoiceNumber}</Nro><Cuit>${CUIT}</Cuit></CbteAsoc></CbtesAsoc>`;
  const detail = `<FECAEDetRequest><Concepto>2</Concepto><DocTipo>${original.documentType}</DocTipo><DocNro>${original.documentNumber}</DocNro><CbteDesde>${number}</CbteDesde><CbteHasta>${number}</CbteHasta><CbteFch>${formatArcaDate(today)}</CbteFch>${arcaAmountsXml(amounts)}<FchServDesde>${formatArcaDate(start)}</FchServDesde><FchServHasta>${formatArcaDate(end)}</FchServHasta><FchVtoPago>${formatArcaDate(today)}</FchVtoPago><MonId>PES</MonId><MonCotiz>1.000000</MonCotiz>${associated}<CondicionIVAReceptorId>${original.vatConditionId}</CondicionIVAReceptorId></FECAEDetRequest>`;
  const body = `<FECAESolicitar xmlns="http://ar.gov.afip.dif.FEV1/"><Auth><Token>${xmlEscape(auth.token)}</Token><Sign>${xmlEscape(auth.sign)}</Sign><Cuit>${CUIT}</Cuit></Auth><FeCAEReq><FeCabReq><CantReg>1</CantReg><PtoVta>${POINT_OF_SALE}</PtoVta><CbteTipo>${noteType}</CbteTipo></FeCabReq><FeDetReq>${detail}</FeDetReq></FeCAEReq></FECAESolicitar>`;
  const xml = await postWsfe('FECAESolicitar', body);
  const cae = xmlValue(xml, 'CAE');
  if (xmlValue(xml, 'Resultado') !== 'A' || !cae) throw new Error('ARCA no autorizó la nota de crédito');
  return { type: originalType === 1 ? 'A' : 'B', typeCode: noteType, pointOfSale: POINT_OF_SALE, number, cae, caeExpiration: xmlValue(xml, 'CAEFchVto'), issuedAt: today.toISOString(), amount: amounts.total, amounts, originalInvoice: original };
}

function issueCreditNote(record, original) {
  const queued = invoiceQueue.then(() => issueCreditNoteInternal(record, original));
  invoiceQueue = queued.catch(() => undefined);
  return queued;
}

module.exports = {
  issueInvoice,
  issueCreditNote,
  previewInvoice,
  resolveRecipient,
  invoiceDates,
  buildPadronEnvelope
};
