// Buscador del «Estado del contacto»: encuentra la ficha por nombre, mail o teléfono
// (TA-10138). El equipo trabaja desde los mails y WhatsApp y no tiene el GHL ID a mano.
const axios = require('axios');

const LIMIT = 15;

function digitsOf(value) {
  return String(value || '').replace(/\D/g, '');
}

// Qué escribió la persona: un mail (o parte), un teléfono o un nombre.
function classifyQuery(raw) {
  const q = String(raw || '').trim().replace(/\s+/g, ' ').slice(0, 120);
  if (q.length < 3) return null;
  if (q.includes('@')) return { kind: 'email', q: q.toLowerCase() };
  const digits = digitsOf(q);
  if (/^[+\d\s().-]+$/.test(q) && digits.length >= 6) {
    // Los teléfonos se guardan con distintos prefijos (+54 9, 0, 15); los últimos 7 dígitos (el número local sin característica ni 15)
    // alcanzan para encontrarlo sin depender de cómo lo cargaron.
    return { kind: 'phone', q: digits.slice(-7) };
  }
  // Los GHL ID son 20 letras y números mezclando mayúsculas y minúsculas.
  if (/^[a-zA-Z0-9]{20}$/.test(q) && /[A-Z]/.test(q) && /[a-z]/.test(q)) return { kind: 'ghlId', q };
  return { kind: 'name', q };
}

// Caracteres que rompen la sintaxis de los filtros de PostgREST.
function clean(term) {
  return String(term).replace(/[,()*%\\"]/g, ' ').trim();
}

// Sin depender de los acentos: «agustin» encuentra «Agustín» y «munoz» a «Muñoz»
// (en ilike, «_» vale por una letra cualquiera).
function accentFree(word) {
  return word.length < 4 ? word : word.replace(/[aeiouáéíóúüAEIOUÁÉÍÓÚÜnñNÑ]/g, '_');
}

function plain(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function filtersFor(query) {
  if (query.kind === 'email') return { mail: `ilike.*${clean(query.q)}*` };
  if (query.kind === 'phone') return { telefono: `ilike.*${query.q}*` };
  if (query.kind === 'ghlId') return { ghlid: `eq.${query.q}` };
  const words = clean(query.q).split(' ').filter(w => w.length >= 2).slice(0, 4);
  if (!words.length) return null;
  // Cada palabra tiene que aparecer en el nombre o en el mail, en cualquier orden.
  return { and: `(${words.map(w => `or(nombre.ilike.*${accentFree(w)}*,mail.ilike.*${w}*)`).join(',')})` };
}

function reallyMatches(row, query) {
  if (query.kind !== 'name') return true;
  const name = plain(row.nombre);
  const mail = plain(row.mail);
  return plain(query.q).split(' ').filter(w => w.length >= 2).every(w => name.includes(w) || mail.includes(w));
}

function rank(row, query) {
  const name = plain(row.nombre);
  const mail = plain(row.mail);
  const q = plain(query.q);
  let score = row.esCliente ? 4 : 0;
  if (query.kind === 'email' && mail === q) score += 10;
  if (query.kind === 'phone' && digitsOf(row.telefono).endsWith(q)) score += 6;
  if (query.kind === 'name' && name === q) score += 10;
  if (query.kind === 'name' && name.startsWith(q)) score += 3;
  return score;
}

async function searchContacts(raw, { supabaseUrl, headers }) {
  const query = classifyQuery(raw);
  if (!query) return { query: null, results: [] };
  const filters = filtersFor(query);
  if (!filters) return { query, results: [] };
  const get = (table, select) => axios.get(`${supabaseUrl}/rest/v1/${table}`, {
    headers, timeout: 15000,
    params: { select, ghlid: 'not.is.null', ...filters, order: 'id.desc', limit: query.kind === 'name' ? 100 : 40 }
  }).then(r => r.data || []);
  const [csmRows, leadRows] = await Promise.all([
    get('csm', 'ghlid,nombre,mail,telefono,ultimo_producto_adquirido'),
    get('leads_raw', 'ghlid,nombre,mail,telefono,etapa')
  ]);
  const byId = new Map();
  for (const row of csmRows) {
    if (!row.ghlid || byId.has(row.ghlid)) continue;
    byId.set(row.ghlid, { ghlId: row.ghlid, nombre: row.nombre || '', email: row.mail || '', telefono: row.telefono || '', etapa: row.ultimo_producto_adquirido ? `Cliente · ${row.ultimo_producto_adquirido}` : 'Cliente CSM', esCliente: true });
  }
  for (const row of leadRows) {
    if (!row.ghlid) continue;
    const prev = byId.get(row.ghlid);
    if (prev) {
      prev.email ||= row.mail || '';
      prev.telefono ||= row.telefono || '';
      prev.nombre ||= row.nombre || '';
      continue;
    }
    byId.set(row.ghlid, { ghlId: row.ghlid, nombre: row.nombre || '', email: row.mail || '', telefono: row.telefono || '', etapa: row.etapa || 'Sin estado', esCliente: false });
  }
  const results = [...byId.values()]
    // Lo que entró sólo por el comodín de acentos y no coincide de verdad, afuera.
    .filter(r => reallyMatches(r, query))
    .map(r => ({ ...r, _score: rank(r, query) }))
    .filter(r => !/^TEST-/i.test(r.ghlId))
    .sort((a, b) => b._score - a._score || a.nombre.localeCompare(b.nombre, 'es'))
    .slice(0, LIMIT)
    .map(({ _score, ...r }) => r);
  return { query, results };
}

module.exports = { searchContacts, _test: { classifyQuery, filtersFor, rank } };
