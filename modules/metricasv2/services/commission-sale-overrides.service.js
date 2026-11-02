const axios = require('axios');
const env = require('../config/env');
const canManage = (user) => String(user?.email || '').trim().toLowerCase() === 'nadia.cavallini@gmail.com';
const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const headers = () => ({ apikey: env.supabaseKey, Authorization: `Bearer ${env.supabaseKey}` });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function relatedId(row) {
  const raw = String(row.venta_relacionada || row.cobranza_relacionada || '');
  const ids = [...new Set((raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) || []).map(id => id.toLowerCase()))];
  return ids.length === 1 ? ids[0] : null;
}
function saleIdFor(row, rowsById) {
  const visited = new Set();
  const original = row;
  while (row && !visited.has(row.id) && visited.size < 32) {
    visited.add(row.id);
    if (row !== original && !((original.ghlid && original.ghlid === row.ghlid) || (original.cliente && original.cliente === row.cliente))) return null;
    if (String(row.tipo).toLowerCase() === 'venta') return row.id;
    if (String(row.tipo).toLowerCase() !== 'cobranza') return null;
    row = rowsById.get(relatedId(row));
  }
  return null;
}
function applyOverrides(details, rows, overrides = []) {
  const byId = new Map(rows.map(row => [row.id, row]));
  const bySale = new Map(overrides.map(item => [item.sale_id, item]));
  return details.map(detail => {
    if (detail.isBonus) return detail;
    const saleId = saleIdFor(byId.get(detail.transactionId), byId);
    const override = bySale.get(saleId);
    const field = detail.role === 'Closer' ? 'closer_pct' : detail.role === 'Setter' ? 'setter_pct' : null;
    if (!field || override?.[field] == null) return detail;
    const pct = Number(override[field]);
    if (!Number.isFinite(pct) || pct < 0 || pct > 1) return detail;
    return { ...detail, commissionPct: pct, commissionAmount: detail.baseAmount * pct,
      commissionSaleId: saleId, sourceRule: 'Porcentaje especial de la venta',
      sourceRuleNote: override.reason || 'La venta y sus cobranzas comparten este porcentaje.' };
  });
}
function validate(user, receiptId, data) {
  if (!canManage(user)) throw fail('Sólo Nadia puede modificar los porcentajes especiales por venta.', 403);
  if (!UUID.test(String(receiptId || ''))) throw fail('El comprobante no es válido.');
  if (!data) return;
  for (const key of ['closer_pct', 'setter_pct']) {
    if (data[key] !== null && (typeof data[key] !== 'number' || !Number.isFinite(data[key]) || data[key] < 0 || data[key] > 1)) throw fail('Los porcentajes deben estar entre 0 y 100; dejá vacío para usar la escalera.');
  }
  if (!Number.isInteger(data.revision) || data.revision < 0) throw fail('Recargá el porcentaje antes de guardar.');
  if (typeof data.reason !== 'string' || data.reason.trim().length < 3 || data.reason.trim().length > 500) throw fail('Indicá un motivo de entre 3 y 500 caracteres.');
}
async function rpc(name, payload) {
  try {
    return (await axios.post(`${env.supabaseUrl}/rest/v1/rpc/${name}`, payload, { headers: headers(), timeout: 20000 })).data;
  } catch (error) {
    throw fail(error.response?.data?.message || 'No se pudo consultar o guardar el porcentaje especial.', 409);
  }
}
async function read(receiptId, user) {
  validate(user, receiptId);
  return rpc('commission_sale_override_context', { p_receipt_id: receiptId });
}
async function write(receiptId, user, data) {
  validate(user, receiptId, data);
  return rpc('commission_sale_override_write', { p_receipt_id: receiptId, p_actor: user.email.trim().toLowerCase(), p_data: data });
}
function createRouter() {
  const router = require('express').Router();
  router.get('/:id', async (req, res, next) => { try { res.json({ ok: true, data: await read(req.params.id, req.authUser) }); } catch (error) { next(error); } });
  router.patch('/:id', async (req, res, next) => { try { res.json({ ok: true, data: await write(req.params.id, req.authUser, req.body) }); } catch (error) { next(error); } });
  return router;
}
module.exports = { canManage, read, write, createRouter, applyOverrides, saleIdFor, validate };
