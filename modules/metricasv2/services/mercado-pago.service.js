const axios = require('axios');
const env = require('../config/env');
const arcaInvoicingService = require('./arca-invoicing.service');

const API_BASE_URL = 'https://api.mercadopago.com';
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGES = 30;
const WORKFLOW_TABLE = 'mercado_pago_club_workflow';
let invoiceRequestQueue = Promise.resolve();

function validateManualInvoiceFields(payload) {
  const vatConditionId = Number(payload.vatConditionId);
  const expectedInvoiceType = vatConditionId === 5 ? 'B' : [1, 6].includes(vatConditionId) ? 'A' : '';
  const invoiceType = String(payload.invoiceType || expectedInvoiceType).toUpperCase();
  const identificationType = String(payload.identificationType || '').toUpperCase();
  const identificationNumber = String(payload.identificationNumber || '').replace(/\D/g, '');
  const amount = Number(payload.amount);
  const payer = String(payload.payer || '').trim();
  const payerAddress = String(payload.payerAddress || '').trim();
  const description = String(payload.description || '').trim();
  if (!expectedInvoiceType) throw Object.assign(new Error('Elegí Consumidor Final, Monotributo o Responsable Inscripto'), { statusCode: 400 });
  if (invoiceType !== expectedInvoiceType) throw Object.assign(new Error(`${vatConditionId === 5 ? 'Consumidor Final requiere Factura B' : 'Monotributo y Responsable Inscripto requieren Factura A'}`), { statusCode: 400 });
  if (!payer || !payerAddress || !description || !Number.isFinite(amount) || amount <= 0) throw Object.assign(new Error('Completá receptor, domicilio comercial, concepto e importe'), { statusCode: 400 });
  if (expectedInvoiceType === 'A' && (identificationType !== 'CUIT' || identificationNumber.length !== 11)) throw Object.assign(new Error('Factura A requiere un CUIT válido'), { statusCode: 400 });
  return { vatConditionId, invoiceType, identificationType, identificationNumber, amount, payer, payerAddress, description };
}

function validateRecipientFields(payload, invoiced = false) {
  const payer = String(payload.payer || '').trim();
  const payerAddress = String(payload.payerAddress || '').trim();
  if (!payer || !payerAddress) {
    throw Object.assign(new Error('Completá Apellido y Nombre / Razón Social y Domicilio Comercial'), { statusCode: 400 });
  }
  if (invoiced) return { payer, payerAddress };

  const vatConditionId = Number(payload.vatConditionId);
  const identificationType = String(payload.identificationType || '').toUpperCase();
  const identificationNumber = String(payload.identificationNumber || '').replace(/\D/g, '');
  if (![1, 5, 6].includes(vatConditionId)) {
    throw Object.assign(new Error('Elegí Consumidor Final, Monotributo o Responsable Inscripto'), { statusCode: 400 });
  }
  if ([1, 6].includes(vatConditionId) && (identificationType !== 'CUIT' || identificationNumber.length !== 11)) {
    throw Object.assign(new Error('Monotributo y Responsable Inscripto requieren un CUIT válido'), { statusCode: 400 });
  }
  return {
    payer,
    payerAddress,
    vatConditionId,
    identificationType,
    identificationNumber,
    requestedInvoiceType: vatConditionId === 5 ? 'B' : 'A'
  };
}

function supabaseHeaders(extra = {}) {
  if (!env.supabaseUrl || !env.supabaseKey) {
    const error = new Error('Falta configurar Supabase para guardar la conciliación');
    error.statusCode = 503;
    throw error;
  }
  return {
    apikey: env.supabaseKey,
    Authorization: `Bearer ${env.supabaseKey}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

async function getWorkflowRows() {
  const response = await axios.get(`${env.supabaseUrl}/rest/v1/${WORKFLOW_TABLE}`, {
    headers: supabaseHeaders(),
    params: { select: '*' }
  });
  return Array.isArray(response.data) ? response.data : [];
}

async function getStoredWorkflowRecords(month, requestedStatus) {
  const bounds = monthBounds(month);
  if (!['reconciled', 'invoiced', 'credit_notes'].includes(requestedStatus)) {
    const error = new Error('Estado de workflow inválido');
    error.statusCode = 400;
    throw error;
  }
  const rows = await getWorkflowRows();
  const inRequestedMonth = (row) => dateInMonth(row.record_snapshot?.date || row.record_snapshot?.createdAt, bounds);
  const monthRows = rows.filter(inRequestedMonth);
  const records = monthRows
    .filter((row) => requestedStatus === 'credit_notes'
      ? Boolean(row.arca_credit_note_cae)
      : row.status === requestedStatus)
    .map((row) => ({
      ...(row.record_snapshot || {}), workflowStatus: requestedStatus === 'credit_notes' ? requestedStatus : row.status,
      reconciledAt: row.reconciled_at || null, invoicedAt: row.invoiced_at || null,
      arcaCae: row.arca_cae || null, arcaInvoiceNumber: row.arca_invoice_number || null,
      arcaInvoiceType: row.arca_response?.invoiceType || null,
      arcaVatCondition: row.arca_response?.vatCondition || null,
      arcaTaxTreatment: row.arca_response?.taxTreatment || null,
      arcaDescription: row.arca_response?.description || null,
      arcaAmounts: row.arca_response?.amounts || null,
      creditNoteNumber: row.arca_credit_note_number || null,
      creditNoteCae: row.arca_credit_note_cae || null,
      creditNoteType: row.arca_credit_note_type || null
    }))
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  return {
    month, records,
    totals: {
      records: records.length,
      payments: records.filter((row) => row.kind === 'payment').length,
      subscriptions: records.filter((row) => row.kind === 'subscription').length,
      approvedAmount: records.filter((row) => row.status === 'approved').reduce((sum, row) => sum + Number(row.amount || 0), 0)
    },
    workflowCounts: {
      reconciled: monthRows.filter((row) => row.status === 'reconciled').length,
      invoiced: monthRows.filter((row) => row.status === 'invoiced').length,
      credit_notes: monthRows.filter((row) => Boolean(row.arca_credit_note_cae)).length
    }
  };
}

async function createManualInvoiceRecord(payload, user) {
  const { vatConditionId, invoiceType, identificationType, identificationNumber, amount, payer, payerAddress, description } = validateManualInvoiceFields(payload);
  const now = new Date();
  const id = `manual-${require('crypto').randomUUID()}`;
  const snapshot = {
    kind: 'manual', id, source: 'manual', date: now.toISOString(), createdAt: now.toISOString(),
    description, externalReference: 'Carga manual', payer, payerAddress,
    payerEmail: String(payload.email || '').trim(), identificationType, identificationNumber,
    amount, currency: 'ARS', status: 'manual', paymentMethod: String(payload.paymentMethod || 'Manual').trim(),
    requestedInvoiceType: invoiceType, vatConditionId
  };
  await axios.post(`${env.supabaseUrl}/rest/v1/${WORKFLOW_TABLE}`, {
    record_kind: 'manual', record_id: id, status: 'reconciled', record_snapshot: snapshot,
    reconciled_at: now.toISOString(), reconciled_by_email: String(user?.email || '').trim().toLowerCase() || null,
    created_at: now.toISOString(), updated_at: now.toISOString()
  }, { headers: supabaseHeaders({ Prefer: 'return=minimal' }) });
  return snapshot;
}

async function updateManualInvoiceRecord(id, payload) {
  const current = await axios.get(`${env.supabaseUrl}/rest/v1/${WORKFLOW_TABLE}`, { headers: supabaseHeaders(), params: { select: '*', record_kind: 'eq.manual', record_id: `eq.${id}`, status: 'eq.reconciled', limit: 1 } });
  const row = current.data?.[0];
  if (!row) throw Object.assign(new Error('La carga manual no existe o ya fue facturada'), { statusCode: 409 });
  const { vatConditionId, invoiceType, identificationType, identificationNumber, amount, payer, payerAddress, description } = validateManualInvoiceFields(payload);
  const snapshot = { ...row.record_snapshot, payer, payerAddress, payerEmail: String(payload.email || '').trim(), description, identificationType, identificationNumber, amount, paymentMethod: String(payload.paymentMethod || 'Manual').trim(), requestedInvoiceType: invoiceType, vatConditionId };
  await axios.patch(`${env.supabaseUrl}/rest/v1/${WORKFLOW_TABLE}`, { record_snapshot: snapshot, updated_at: new Date().toISOString() }, { headers: supabaseHeaders({ Prefer: 'return=minimal' }), params: { record_kind: 'eq.manual', record_id: `eq.${id}`, status: 'eq.reconciled' } });
  return snapshot;
}

async function deleteManualInvoiceRecord(id) {
  const response = await axios.delete(`${env.supabaseUrl}/rest/v1/${WORKFLOW_TABLE}`, { headers: supabaseHeaders({ Prefer: 'return=representation' }), params: { record_kind: 'eq.manual', record_id: `eq.${id}`, status: 'eq.reconciled' } });
  if (!response.data?.length) throw Object.assign(new Error('La carga manual no existe o ya fue facturada'), { statusCode: 409 });
  return { deleted: true };
}

async function updateInvoiceRecipient(kind, id, payload) {
  const recordKind = String(kind || '').trim();
  const recordId = String(id || '').trim();
  if (!['payment', 'subscription', 'manual'].includes(recordKind) || !recordId) {
    throw Object.assign(new Error('Registro inválido'), { statusCode: 400 });
  }
  const current = await axios.get(`${env.supabaseUrl}/rest/v1/${WORKFLOW_TABLE}`, {
    headers: supabaseHeaders(),
    params: { select: '*', record_kind: `eq.${recordKind}`, record_id: `eq.${recordId}`, limit: 1 }
  });
  const row = current.data?.[0];
  if (!row || !['reconciled', 'invoiced'].includes(row.status)) {
    throw Object.assign(new Error('Los datos fiscales solo se pueden completar en registros conciliados o facturados'), { statusCode: 409 });
  }
  const fields = validateRecipientFields(payload, row.status === 'invoiced');
  const recordSnapshot = { ...(row.record_snapshot || {}), ...fields };
  const body = {
    record_snapshot: recordSnapshot,
    updated_at: new Date().toISOString()
  };
  if (row.status === 'invoiced') {
    body.arca_response = {
      ...(row.arca_response || {}),
      recipientName: fields.payer,
      recipientAddress: fields.payerAddress
    };
  }
  await axios.patch(`${env.supabaseUrl}/rest/v1/${WORKFLOW_TABLE}`, body, {
    headers: supabaseHeaders({ Prefer: 'return=minimal' }),
    params: { record_kind: `eq.${recordKind}`, record_id: `eq.${recordId}` }
  });
  return recordSnapshot;
}

async function getInvoiceRecord(kind, id) {
  const response = await axios.get(`${env.supabaseUrl}/rest/v1/${WORKFLOW_TABLE}`, {
    headers: supabaseHeaders(),
    params: { select: '*', record_kind: `eq.${kind}`, record_id: `eq.${id}`, limit: 1 }
  });
  const row = response.data?.[0];
  if (!row || row.status !== 'invoiced') {
    const error = new Error('No existe una factura emitida para esta operación');
    error.statusCode = 404;
    throw error;
  }
  return row;
}

async function reconcileRecords(records, user) {
  if (!Array.isArray(records) || !records.length || records.length > 500) {
    const error = new Error('Seleccioná entre 1 y 500 registros para conciliar');
    error.statusCode = 400;
    throw error;
  }
  const now = new Date().toISOString();
  const email = String(user?.email || '').trim().toLowerCase() || null;
  const body = records.map((record) => {
    const kind = String(record?.kind || '');
    const id = String(record?.id || '').trim();
    if (!['payment', 'subscription'].includes(kind) || !id) {
      const error = new Error('Hay un registro inválido en la selección');
      error.statusCode = 400;
      throw error;
    }
    return {
      record_kind: kind,
      record_id: id,
      status: 'reconciled',
      record_snapshot: record,
      reconciled_at: now,
      reconciled_by_email: email,
      updated_at: now
    };
  });
  await axios.post(`${env.supabaseUrl}/rest/v1/${WORKFLOW_TABLE}`, body, {
    headers: supabaseHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
    params: { on_conflict: 'record_kind,record_id' }
  });
  return { updated: body.length };
}

async function unreconcileRecord(key) {
  const kind = String(key?.kind || '');
  const id = String(key?.id || '').trim();
  if (!['payment', 'subscription'].includes(kind) || !id) throw Object.assign(new Error('Registro inválido'), { statusCode: 400 });
  const response = await axios.delete(`${env.supabaseUrl}/rest/v1/${WORKFLOW_TABLE}`, {
    headers: supabaseHeaders({ Prefer: 'return=representation' }),
    params: { record_kind: `eq.${kind}`, record_id: `eq.${id}`, status: 'eq.reconciled' }
  });
  if (!Array.isArray(response.data) || !response.data.length) throw Object.assign(new Error('No se puede quitar: el registro no está conciliado o ya fue facturado'), { statusCode: 409 });
  return { removed: true };
}

async function previewInvoiceRecords(keys) {
  if (!Array.isArray(keys) || !keys.length || keys.length > 50) {
    throw Object.assign(new Error('Seleccioná entre 1 y 50 registros conciliados para previsualizar'), { statusCode: 400 });
  }
  const previews = [];
  for (const key of keys) {
    const kind = String(key?.kind || '');
    const id = String(key?.id || '').trim();
    if (!['payment', 'subscription', 'manual'].includes(kind) || !id) {
      throw Object.assign(new Error('Hay un registro inválido en la selección'), { statusCode: 400 });
    }
    const response = await axios.get(`${env.supabaseUrl}/rest/v1/${WORKFLOW_TABLE}`, {
      headers: supabaseHeaders(),
      params: { select: 'record_kind,record_id,status,record_snapshot', record_kind: `eq.${kind}`, record_id: `eq.${id}`, limit: 1 }
    });
    const workflow = response.data?.[0];
    if (!workflow || workflow.status !== 'reconciled') {
      throw Object.assign(new Error(`La operación ${id} ya no está conciliada`), { statusCode: 409 });
    }
    previews.push({
      kind,
      id,
      ...(workflow.record_snapshot || {}),
      proposedInvoice: await arcaInvoicingService.previewInvoice(workflow.record_snapshot || {})
    });
  }
  return { previews };
}

async function executeInvoiceRecords(keys, user) {
  if (!Array.isArray(keys) || !keys.length || keys.length > 50) {
    const error = new Error('Seleccioná entre 1 y 50 registros conciliados para facturar');
    error.statusCode = 400;
    throw error;
  }
  const results = [];
  for (const key of keys) {
    const kind = String(key?.kind || '');
    const id = String(key?.id || '').trim();
    const claim = await axios.post(`${env.supabaseUrl}/rest/v1/rpc/claim_mp_invoice`, { p_kind: kind, p_id: id }, { headers: supabaseHeaders() });
    const workflow = claim.data?.[0];
    if (!workflow) {
      const current = await axios.get(`${env.supabaseUrl}/rest/v1/${WORKFLOW_TABLE}`, { headers: supabaseHeaders(), params: { select: '*', record_kind: `eq.${kind}`, record_id: `eq.${id}`, limit: 1 } });
      const row = current.data?.[0];
      if (row?.status === 'invoiced') { results.push({ id, alreadyInvoiced: true, invoiceNumber: row.arca_invoice_number, cae: row.arca_cae }); continue; }
      throw Object.assign(new Error(`La operación ${id} ya está siendo procesada o no está conciliada`), { statusCode: 409 });
    }
    let invoice;
    try {
      invoice = await arcaInvoicingService.issueInvoice(workflow.record_snapshot || {});
    } catch (error) {
      await axios.post(`${env.supabaseUrl}/rest/v1/rpc/release_mp_invoice`, { p_kind: kind, p_id: id }, { headers: supabaseHeaders() });
      throw error;
    }
    const now = new Date().toISOString();
    await axios.patch(`${env.supabaseUrl}/rest/v1/${WORKFLOW_TABLE}`, {
      status: 'invoiced', invoiced_at: now,
      invoiced_by_email: String(user?.email || '').trim().toLowerCase() || null,
      arca_cae: invoice.cae,
      arca_invoice_number: `${String(invoice.pointOfSale).padStart(5, '0')}-${String(invoice.invoiceNumber).padStart(8, '0')}`,
      arca_response: invoice,
      updated_at: now
    }, {
      headers: supabaseHeaders({ Prefer: 'return=minimal' }),
      params: { record_kind: `eq.${kind}`, record_id: `eq.${id}`, status: 'eq.invoicing' }
    });
    results.push({ id, invoiceNumber: invoice.invoiceNumber, pointOfSale: invoice.pointOfSale, cae: invoice.cae });
  }
  return { invoiced: results.length, results };
}

function invoiceRecords(keys, user) {
  const queued = invoiceRequestQueue.then(() => executeInvoiceRecords(keys, user));
  invoiceRequestQueue = queued.catch(() => undefined);
  return queued;
}

async function issueCreditNote(key, user) {
  const kind = String(key?.kind || '');
  const id = String(key?.id || '').trim();
  const claim = await axios.post(`${env.supabaseUrl}/rest/v1/rpc/claim_mp_credit_note`, { p_kind: kind, p_id: id }, { headers: supabaseHeaders() });
  const workflow = claim.data?.[0];
  if (!workflow) {
    const current = await axios.get(`${env.supabaseUrl}/rest/v1/${WORKFLOW_TABLE}`, { headers: supabaseHeaders(), params: { select: '*', record_kind: `eq.${kind}`, record_id: `eq.${id}`, limit: 1 } });
    const row = current.data?.[0];
    if (row?.arca_credit_note_cae) return { alreadyIssued: true, number: row.arca_credit_note_number, cae: row.arca_credit_note_cae };
    throw Object.assign(new Error('La nota de crédito ya está siendo procesada o la factura no existe'), { statusCode: 409 });
  }
  let note;
  try { note = await arcaInvoicingService.issueCreditNote(workflow.record_snapshot || {}, workflow.arca_response || {}); }
  catch (error) {
    await axios.patch(`${env.supabaseUrl}/rest/v1/${WORKFLOW_TABLE}`, { credit_note_processing_at: null }, { headers: supabaseHeaders(), params: { record_kind: `eq.${kind}`, record_id: `eq.${id}` } });
    throw error;
  }
  const number = `${String(note.pointOfSale).padStart(5, '0')}-${String(note.number).padStart(8, '0')}`;
  await axios.patch(`${env.supabaseUrl}/rest/v1/${WORKFLOW_TABLE}`, {
    credit_note_issued_at: note.issuedAt,
    credit_note_issued_by_email: String(user?.email || '').trim().toLowerCase() || null,
    arca_credit_note_type: note.type, arca_credit_note_number: number,
    arca_credit_note_cae: note.cae, arca_credit_note_response: note,
    credit_note_processing_at: null, updated_at: new Date().toISOString()
  }, { headers: supabaseHeaders({ Prefer: 'return=minimal' }), params: { record_kind: `eq.${kind}`, record_id: `eq.${id}`, arca_credit_note_cae: 'is.null' } });
  return { number, cae: note.cae, type: note.type };
}

function getAccessToken() {
  const token = String(process.env.MERCADO_PAGO_ACCESS_TOKEN || '').trim();
  if (!token) {
    const error = new Error('Falta configurar MERCADO_PAGO_ACCESS_TOKEN');
    error.statusCode = 503;
    throw error;
  }
  return token;
}

function apiClient() {
  return axios.create({
    baseURL: API_BASE_URL,
    timeout: 20000,
    headers: { Authorization: `Bearer ${getAccessToken()}` }
  });
}

function normalizeText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function containsClub(values) {
  return values.some((value) => normalizeText(value).includes('club'));
}

function monthBounds(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || ''))) {
    const error = new Error('El mes debe tener formato YYYY-MM');
    error.statusCode = 400;
    throw error;
  }
  const [year, monthNumber] = month.split('-').map(Number);
  const from = new Date(Date.UTC(year, monthNumber - 1, 1));
  const to = new Date(Date.UTC(year, monthNumber, 1));
  return { from, to };
}

function dateInMonth(value, bounds) {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date >= bounds.from && date < bounds.to;
}

async function fetchAll(path, params = {}) {
  const client = apiClient();
  const rows = [];
  let offset = 0;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = await client.get(path, {
      params: { ...params, offset, limit: DEFAULT_PAGE_SIZE }
    });
    const results = Array.isArray(response.data?.results) ? response.data.results : [];
    rows.push(...results);
    const total = Number(response.data?.paging?.total || rows.length);
    if (!results.length || rows.length >= total || results.length < DEFAULT_PAGE_SIZE) break;
    offset += results.length;
  }

  return rows;
}

function paymentClubFields(payment) {
  return [
    payment.description,
    payment.external_reference,
    payment.statement_descriptor,
    payment.metadata?.product,
    payment.metadata?.product_name,
    payment.metadata?.description,
    payment.additional_info?.items?.map((item) => `${item.title || ''} ${item.description || ''}`).join(' ')
  ];
}

function payerAddress(payer = {}) {
  const address = payer.address || {};
  const street = [address.street_name, address.street_number].filter(Boolean).join(' ').trim();
  return [street, address.zip_code].filter(Boolean).join(' - ');
}

function mapPayment(payment) {
  const identification = payment.payer?.identification || payment.additional_info?.payer?.identification || {};
  const payer = {
    ...(payment.payer || {}),
    ...(payment.additional_info?.payer || {}),
    address: payment.additional_info?.payer?.address || payment.payer?.address || {}
  };
  const payerName = [payer.first_name, payer.last_name].filter(Boolean).join(' ').trim();
  return {
    kind: 'payment',
    id: String(payment.id || ''),
    date: payment.date_approved || payment.date_created || null,
    createdAt: payment.date_created || null,
    description: payment.description || payment.additional_info?.items?.[0]?.title || 'Pago',
    externalReference: payment.external_reference || '',
    payer: payerName || payment.payer?.email || '',
    payerEmail: payment.payer?.email || '',
    payerAddress: payerAddress(payer),
    identificationType: identification.type || '',
    identificationNumber: identification.number || '',
    amount: Number(payment.transaction_amount || 0),
    currency: payment.currency_id || 'ARS',
    status: payment.status || '',
    statusDetail: payment.status_detail || '',
    paymentMethod: payment.payment_method_id || payment.payment_type_id || '',
    subscriptionId: payment.metadata?.preapproval_id || payment.preapproval_id || ''
  };
}

function mapSubscription(subscription) {
  const payer = subscription.payer || {};
  return {
    kind: 'subscription',
    id: String(subscription.id || ''),
    date: subscription.date_created || null,
    createdAt: subscription.date_created || null,
    description: subscription.reason || 'Suscripción',
    externalReference: subscription.external_reference || '',
    payer: [payer.first_name, payer.last_name].filter(Boolean).join(' ').trim() || subscription.payer_email || String(subscription.payer_id || ''),
    payerEmail: subscription.payer_email || '',
    payerAddress: payerAddress(payer),
    identificationType: subscription.payer?.identification?.type || '',
    identificationNumber: subscription.payer?.identification?.number || '',
    amount: Number(subscription.auto_recurring?.transaction_amount || 0),
    currency: subscription.auto_recurring?.currency_id || 'ARS',
    status: subscription.status || '',
    statusDetail: '',
    paymentMethod: subscription.payment_method_id || '',
    subscriptionId: String(subscription.id || ''),
    nextPaymentDate: subscription.next_payment_date || null,
    lastChargedDate: subscription.summarized?.last_charged_date || null,
    chargedAmount: Number(subscription.summarized?.charged_amount || 0)
  };
}

async function getClubRecords(month) {
  const bounds = monthBounds(month);
  const beginDate = bounds.from.toISOString();
  const endDate = new Date(bounds.to.getTime() - 1).toISOString();

  try {
    const [payments, subscriptions] = await Promise.all([
      fetchAll('/v1/payments/search', {
        sort: 'date_created', criteria: 'desc', range: 'date_created', begin_date: beginDate, end_date: endDate
      }),
      fetchAll('/preapproval/search')
    ]);

    const paymentRows = payments
      .filter((payment) => payment.status === 'approved')
      .filter((payment) => dateInMonth(payment.date_created, bounds) && containsClub(paymentClubFields(payment)))
      .map(mapPayment);

    const subscriptionRows = subscriptions
      .filter((subscription) => containsClub([subscription.reason, subscription.external_reference]))
      .filter((subscription) => [subscription.date_created, subscription.summarized?.last_charged_date].some((date) => dateInMonth(date, bounds)))
      .map(mapSubscription);

    const workflowRows = await getWorkflowRows();
    const workflowByKey = new Map(workflowRows.map((row) => [`${row.record_kind}:${row.record_id}`, row]));
    const records = [...paymentRows, ...subscriptionRows]
      .map((record) => {
        const workflow = workflowByKey.get(`${record.kind}:${record.id}`);
        return {
          ...record,
          workflowStatus: workflow?.status || 'pending',
          reconciledAt: workflow?.reconciled_at || null,
          invoicedAt: workflow?.invoiced_at || null,
          arcaCae: workflow?.arca_cae || null,
          arcaInvoiceNumber: workflow?.arca_invoice_number || null,
          arcaInvoiceType: workflow?.arca_response?.invoiceType || null,
          arcaVatCondition: workflow?.arca_response?.vatCondition || null,
          arcaTaxTreatment: workflow?.arca_response?.taxTreatment || null,
          arcaDescription: workflow?.arca_response?.description || null,
          arcaAmounts: workflow?.arca_response?.amounts || null,
          creditNoteNumber: workflow?.arca_credit_note_number || null,
          creditNoteCae: workflow?.arca_credit_note_cae || null,
          creditNoteType: workflow?.arca_credit_note_type || null
        };
      })
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

    return {
      month,
      records,
      totals: {
        records: records.length,
        payments: paymentRows.length,
        subscriptions: subscriptionRows.length,
        approvedAmount: paymentRows.filter((row) => row.status === 'approved').reduce((sum, row) => sum + row.amount, 0)
      }
    };
  } catch (error) {
    if (error.response) {
      const wrapped = new Error(error.response.data?.message || error.response.data?.error || 'Mercado Pago rechazó la consulta');
      wrapped.statusCode = error.response.status >= 400 && error.response.status < 500 ? 502 : error.response.status;
      throw wrapped;
    }
    throw error;
  }
}

module.exports = { getClubRecords, getStoredWorkflowRecords, createManualInvoiceRecord, updateManualInvoiceRecord, deleteManualInvoiceRecord, updateInvoiceRecipient, validateRecipientFields, reconcileRecords, unreconcileRecord, previewInvoiceRecords, invoiceRecords, getInvoiceRecord, issueCreditNote };
