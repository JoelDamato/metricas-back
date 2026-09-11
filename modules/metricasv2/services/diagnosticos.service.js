const axios = require('axios');
const crypto = require('crypto');
const env = require('../config/env');

const CSM_NAMES = ['Valeria Calmet', 'Belén Herrera', 'Gabriela Costarelli', 'Sofía Gallardo'];
const CSM_NAME_ALIASES = {
  vale: 'Valeria Calmet',
  valeria: 'Valeria Calmet',
  'lidia calmet': 'Valeria Calmet',
  sofia: 'Sofía Gallardo',
  sofi: 'Sofía Gallardo',
  sofie: 'Sofía Gallardo'
};

function headers(extra = {}) {
  if (!env.supabaseUrl || !env.supabaseKey) {
    const error = new Error('Faltan las credenciales de datos para Diagnósticos');
    error.statusCode = 500;
    throw error;
  }
  return { apikey: env.supabaseKey, Authorization: `Bearer ${env.supabaseKey}`, 'Content-Type': 'application/json', ...extra };
}

function cleanText(value, limit = 400) { return String(value || '').trim().slice(0, limit); }
function cleanData(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function tableUrl() { return `${env.supabaseUrl}/rest/v1/csm_diagnosticos`; }
function safeId(value) { return String(value || '').replace(/[^a-f0-9-]/gi, ''); }

function normalizeCsmName(value) {
  const current = cleanText(value, 180).replace(/\s+/g, ' ');
  if (!current) return '';
  const key = current.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
  const canonical = CSM_NAMES.find((name) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es') === key);
  return canonical || CSM_NAME_ALIASES[key] || current;
}

function normalizeDiagnosticData(value, fallbackCsm = '') {
  const data = cleanData(value);
  const checkpoints = cleanData(data.checkpoints);
  if (!Object.keys(checkpoints).length) return data;
  return {
    ...data,
    checkpoints: Object.fromEntries(Object.entries(checkpoints).map(([stage, checkpointValue]) => {
      const checkpoint = cleanData(checkpointValue);
      return [stage, { ...checkpoint, csm: normalizeCsmName(checkpoint.csm || fallbackCsm) }];
    }))
  };
}

function normalizeSearchTerm(value) {
  return String(value || '')
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s@._-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

function buildNameSearchParams(value) {
  const terms = normalizeSearchTerm(value).split(' ').filter(Boolean);
  if (!terms.length) return {};
  const filters = terms.map((term) => `nombre.ilike.*${term}*`);
  return filters.length === 1
    ? { or: `(${filters[0]})` }
    : { and: `(${filters.join(',')})` };
}

function normalizeDiagnosticClient(row = {}, source = 'csm') {
  return {
    ghlId: cleanText(row.ghlid, 180),
    name: cleanText(row.nombre, 180),
    businessName: cleanText(row.modelo_negocio, 180),
    source
  };
}

function mergeDiagnosticClients(csmRows = [], leadRows = []) {
  const clientsByGhlId = new Map();

  leadRows.forEach((row) => {
    const client = normalizeDiagnosticClient(row, 'leads_raw');
    if (!client.ghlId || !client.name || clientsByGhlId.has(client.ghlId)) return;
    clientsByGhlId.set(client.ghlId, client);
  });

  csmRows.forEach((row) => {
    const client = normalizeDiagnosticClient(row, 'csm');
    if (!client.ghlId || !client.name) return;
    const lead = clientsByGhlId.get(client.ghlId);
    clientsByGhlId.set(client.ghlId, {
      ...client,
      businessName: client.businessName || lead?.businessName || ''
    });
  });

  return [...clientsByGhlId.values()]
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

async function listDiagnosticClients(rawQuery) {
  const query = normalizeSearchTerm(rawQuery);
  const csmParams = {
    select: 'nombre,ghlid,modelo_negocio',
    limit: query ? 100 : 1000
  };
  const leadParams = {
    select: 'nombre,ghlid,modelo_negocio,last_edited_time',
    archived: 'eq.false',
    order: 'last_edited_time.desc',
    limit: query ? 100 : 0
  };

  if (query) {
    Object.assign(csmParams, buildNameSearchParams(query));
    Object.assign(leadParams, buildNameSearchParams(query));
  }

  const csmRequest = axios.get(`${env.supabaseUrl}/rest/v1/csm`, {
    headers: headers(),
    params: csmParams
  });
  const leadRequest = query
    ? axios.get(`${env.supabaseUrl}/rest/v1/leads_raw`, { headers: headers(), params: leadParams })
    : Promise.resolve({ data: [] });
  const [csmResponse, leadResponse] = await Promise.all([csmRequest, leadRequest]);

  return mergeDiagnosticClients(csmResponse.data || [], leadResponse.data || []);
}

function normalize(row) {
  if (!row) return null;
  const csmName = normalizeCsmName(row.csm_name);
  return {
    id: row.id,
    clientGhlId: row.client_ghlid || '',
    clientName: row.client_name || '',
    businessName: row.business_name || '',
    csmName,
    data: normalizeDiagnosticData(row.data, csmName),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  };
}

function payloadFrom(input = {}, user = {}) {
  const clientGhlId = cleanText(input.clientGhlId, 180);
  const clientName = cleanText(input.clientName, 180);
  const csmName = normalizeCsmName(input.csmName);
  if (!clientGhlId || !clientName) {
    const error = new Error('Elegí un cliente válido de la base CSM');
    error.statusCode = 400;
    throw error;
  }
  return {
    client_ghlid: clientGhlId,
    client_name: clientName,
    business_name: cleanText(input.businessName, 180) || null,
    csm_name: csmName || null,
    data: normalizeDiagnosticData(input.data, csmName),
    updated_by_email: cleanText(user.email, 180).toLowerCase() || null,
    updated_at: new Date().toISOString()
  };
}

async function listDiagnosticos() {
  const response = await axios.get(tableUrl(), { headers: headers(), params: { select: 'id,client_ghlid,client_name,business_name,csm_name,data,created_at,updated_at', order: 'updated_at.desc', limit: 500 } });
  return (response.data || []).map(normalize).filter(Boolean);
}

async function createDiagnostico(input, user) {
  const body = { ...payloadFrom(input, user), public_token: crypto.randomBytes(24).toString('base64url'), created_by_email: cleanText(user.email, 180).toLowerCase() || null };
  try {
    const response = await axios.post(tableUrl(), body, { headers: headers({ Prefer: 'return=representation' }) });
    return normalize(response.data?.[0]);
  } catch (error) {
    if (error.response?.status === 409) {
      const exists = new Error('Ese cliente ya tiene un diagnóstico. Abrilo desde el listado para continuarlo.');
      exists.statusCode = 409;
      throw exists;
    }
    throw error;
  }
}

async function updateDiagnostico(id, input, user) {
  const recordId = safeId(id);
  if (!recordId) { const error = new Error('Diagnóstico inválido'); error.statusCode = 400; throw error; }
  const response = await axios.patch(tableUrl(), payloadFrom(input, user), { headers: headers({ Prefer: 'return=representation' }), params: { id: `eq.${recordId}` } });
  if (!response.data?.[0]) { const error = new Error('No encontré ese diagnóstico'); error.statusCode = 404; throw error; }
  return normalize(response.data[0]);
}

async function deleteDiagnostico(id) {
  const safe = safeId(id);
  const response = await axios.delete(tableUrl(), { headers: headers({ Prefer: 'return=representation' }), params: { id: `eq.${safe}` } });
  if (!response.data?.[0]) { const error = new Error('No encontré ese diagnóstico'); error.statusCode = 404; throw error; }
  return { deleted: true };
}

async function getPublicDiagnosticoByGhlId(ghlId) {
  const safeGhlId = String(ghlId || '').replace(/[^A-Za-z0-9_-]/g, '');
  if (!safeGhlId) { const error = new Error('GHL ID inválido'); error.statusCode = 404; throw error; }
  const response = await axios.get(tableUrl(), { headers: headers(), params: { select: 'client_name,business_name,csm_name,data,updated_at', client_ghlid: `eq.${safeGhlId}`, limit: 1 } });
  const row = response.data?.[0];
  if (!row) { const error = new Error('Este cliente todavía no tiene un diagnóstico'); error.statusCode = 404; throw error; }
  const csmName = normalizeCsmName(row.csm_name);
  return { clientName: row.client_name || '', businessName: row.business_name || '', csmName, data: normalizeDiagnosticData(row.data, csmName), updatedAt: row.updated_at || null };
}

module.exports = {
  listDiagnosticos,
  listDiagnosticClients,
  createDiagnostico,
  updateDiagnostico,
  deleteDiagnostico,
  getPublicDiagnosticoByGhlId,
  _test: { normalizeSearchTerm, buildNameSearchParams, mergeDiagnosticClients, normalizeCsmName, normalizeDiagnosticData }
};
