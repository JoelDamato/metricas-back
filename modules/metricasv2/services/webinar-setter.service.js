const axios = require('axios');
const env = require('../config/env');
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const isNahuel = name => ['nahuel iasci', 'nahuel', 'nahue'].includes(normalize(name));
function extractWebinarSetters(fields = {}) {
  const names = [];
  for (const [key, field] of Object.entries(fields || {})) {
    const label = normalize(field?.label || key);
    if (!label.includes('webinar') || !/setter|setting/.test(label) || /turno|whatsapp|asesor|telefono/.test(label)) continue;
    for (const name of Array.isArray(field?.value) ? field.value : [field?.value]) {
      if (typeof name === 'string' && name.trim()) names.push(name.trim());
    }
  }
  return [...new Set(names)];
}
function effectiveSetter(row) {
  const names = row.webinarSetters || [];
  if (!names.length) return row.setter || '';
  if (names.every(isNahuel)) return 'Nahuel Iasci';
  // Conflicting webinar assignments must never fall back to an old setter.
  const unique = [...new Map(names.map(name => [normalize(name), name])).values()];
  return unique.length === 1 ? unique[0] : '';
}
const belongsToOtherWebinarSetter = row => row.webinarSetters?.length > 0 && !row.webinarSetters.every(isNahuel);
// Club has its own seller and commission. A webinar assignment on the contact
// must not hide a Club sale explicitly recorded with Nahuel as its seller.
const isNahuelClubSale = row => normalize(row.tipo) === 'venta'
  && ['club', 'club del costo'].includes(normalize(row.producto_format))
  && isNahuel(Object.hasOwn(row, 'responsable_venta_db') ? row.responsable_venta_db : row.responsable_venta);
async function retryRead(read) {
  try { return await read(); } catch (error) {
    if (!/ECONNRESET|ETIMEDOUT|ECONNABORTED|socket hang up|timeout/i.test(`${error.code || ''} ${error.message || ''}`) && ![502,503,504].includes(error.response?.status || error.statusCode)) throw error;
    return read();
  }
}
async function attachWebinarSetters(rows) {
  const ids = [...new Set(rows.map(row => String(row.ghlid || '').trim()).filter(id => /^[a-zA-Z0-9_-]+$/.test(id)))];
  const byId = new Map();
  for (let i = 0; i < ids.length; i += 200) {
    const response = await retryRead(() => axios.get(`${env.supabaseUrl}/rest/v1/leads_ghl_contacts`, {
      headers: { apikey: env.supabaseKey, Authorization: `Bearer ${env.supabaseKey}` },
      params: { select: 'ghlid,fields', ghlid: `in.(${ids.slice(i, i + 200).join(',')})`, limit: 1000 }, timeout: 20000
    }));
    for (const row of response.data || []) byId.set(String(row.ghlid).toLowerCase(), extractWebinarSetters(row.fields));
  }
  return rows.map(row => ({ ...row, webinarSetters: byId.get(String(row.ghlid || '').toLowerCase()) || row.webinarSetters || [] }));
}
module.exports = { extractWebinarSetters, effectiveSetter, belongsToOtherWebinarSetter, isNahuelClubSale, attachWebinarSetters, retryRead, isNahuel };
