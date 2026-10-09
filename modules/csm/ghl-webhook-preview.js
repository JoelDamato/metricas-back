const crypto = require('crypto');
const axios = require('axios');

const isObject = value => value && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';

function identifyGhlPayload(payload) {
  if (!isObject(payload)) return null;
  const data = isObject(payload.data) ? payload.data : payload;
  // Notion events keep their existing processing path.
  if (data.object === 'page' || payload.type === 'page.deleted') return null;
  const contact = isObject(data.contact) ? data.contact : {};
  const declared = ['ghl', 'gohighlevel', 'highlevel'].includes(text(payload.source || data.source).toLowerCase());
  const locationId = text(data.locationId || data.location_id || data.location?.id || contact.locationId);
  const contactId = text(data.contact_id || data.contactId || contact.id || data.ghlid || data.ghl_id || (declared || locationId ? data.id : ''));
  if (!contactId && !declared) return null;
  return { contactId, locationId: locationId || null, fieldNames: Object.keys(data).sort() };
}

async function receivePreview(payload, identity) {
  const receiptId = crypto.randomUUID();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Falta configuración para registrar la prueba CSM');
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  let assessment = { operation: 'needs_contact_id', mappingReady: false };
  if (identity.contactId) {
    try {
      const { data: matches } = await axios.get(`${url}/rest/v1/csm`, {
        headers, params: { select: 'id,ghlid', ghlid: `eq.${identity.contactId}`, limit: 2 }, timeout: 15000
      });
      assessment = { operation: matches.length > 1 ? 'ambiguous' : matches.length ? 'would_update' : 'would_create', matchingRecords: matches.length, mappingReady: false };
    } catch {
      assessment = { operation: 'lookup_unavailable', mappingReady: false };
    }
  }
  // Acknowledge only after durable capture. Never feed a GHL payload to the Notion mapper.
  await axios.post(`${url}/rest/v1/webhook_logs`, {
    webhook_type: 'csm', type: 'ghl_preview_received',
    message: `Prueba GHL CSM ${receiptId}: ${assessment.operation}; pendiente de mapeo`,
    notion_id: null, ghl_id: identity.contactId || null,
    payload: JSON.stringify(payload),
    attempted_data: JSON.stringify({ receiptId, source: 'ghl', fieldNames: identity.fieldNames, locationId: identity.locationId, ...assessment }),
    created_at: new Date().toISOString()
  }, { headers, timeout: 15000 });
  return { status: 'received_for_review', source: 'ghl', receiptId, ghlId: identity.contactId || null,
    captured: true, csmWritten: false, ...assessment,
    message: 'Prueba GHL registrada. No se creó ni actualizó CSM; falta validar el mapeo de campos.' };
}
module.exports = { identifyGhlPayload, receivePreview };
