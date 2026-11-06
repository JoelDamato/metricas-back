// Trae "Estado de pago" (Deudor / Apurar / Situacion normal) de GHL a csm.estado_pago.
// Uso: node scripts/backfill_csm_estado_pago_from_ghl.js [--dry-run]
require('dotenv').config();
const axios = require('axios');
const FIELD = '0hjtUW5o2FzZodVWjJQd', dry = process.argv.includes('--dry-run');
const {GHL_API_KEY: key, GHL_LOCATION_ID: loc, SUPABASE_URL: sb, SUPABASE_SERVICE_ROLE_KEY: sk} = process.env;
const sbh = {apikey: sk, Authorization: `Bearer ${sk}`};
async function ghlIds(value) {
  const ids = [];
  for (let page = 1; ; page++) {
    const {data} = await axios.post('https://services.leadconnectorhq.com/contacts/search',
      {locationId: loc, page, pageLimit: 100, filters: [{field: `customFields.${FIELD}`, operator: 'eq', value}]},
      {headers: {Authorization: `Bearer ${key}`, Version: '2021-07-28'}});
    ids.push(...data.contacts.map(c => c.id));
    if (data.contacts.length < 100) return ids;
  }
}
(async () => {
  const flagged = {Deudor: await ghlIds('Deudor'), Apurar: await ghlIds('Apurar')};
  console.log('GHL:', Object.fromEntries(Object.entries(flagged).map(([k, v]) => [k, v.length])));
  const {data: current} = await axios.get(`${sb}/rest/v1/csm`, {headers: sbh, params: {select: 'ghlid,estado_pago', estado_pago: 'in.(Deudor,Apurar)'}});
  const all = new Set([...flagged.Deudor, ...flagged.Apurar]);
  const clear = current.filter(r => !all.has(r.ghlid)).map(r => r.ghlid);
  // csm está protegida por un trigger: la única vía de escritura es la RPC oficial de ingesta de GHL.
  const write = async (ghlid, value) => {
    const {data} = await axios.post(`${sb}/rest/v1/rpc/metricas_csm_ghl_ingest`, {
      p_event: require('crypto').randomUUID(), p_ghlid: ghlid, p_location: loc,
      p_payload: {backfill: 'estado_pago', contact_id: ghlid, 'Estado de pago': value}, p_patch: {estado_pago: value}, p_warnings: []
    }, {headers: sbh, timeout: 30000});
    return data.status;
  };
  for (const [value, ids] of Object.entries(flagged)) {
    for (const id of ids) console.log(value, id, dry ? '(dry-run)' : await write(id, value));
  }
  console.log('Limpiar (ya no están marcados en GHL):', clear.length);
  if (!dry) for (const id of clear) console.log('Situacion normal', id, await write(id, 'Situacion normal'));
})().catch(e => { console.error(e.response?.data || e.message); process.exit(1); });
