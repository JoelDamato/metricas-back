const axios = require('axios');
const summary = require('../modules/csm/contact-summary');
const {fetchContactMaterials} = require('../modules/csm/contact-materials');

// Explicit public projection: never return CRM fields, receipts, contact details,
// raw notes or the internal contact-status response to the client portal.
function publicPortal(ghlId, row, materials, hasRoadmap) {
  return {
    name: row.nombre || 'Tu portal',
    roadmapUrl: hasRoadmap ? `/diagnostico/?ghl_id=${encodeURIComponent(ghlId)}&vista=rumbo` : null,
    csmProgress: {sessions: summary.progress(row).sessions},
    csmMaterials: {
      available: materials.available,
      appointments: materials.appointments.map(({label,date,status,links}) => ({
        label, title: label, date, status,
        links: links.map(({url,label}) => ({url,label}))
      }))
    }
  };
}

async function getClientPortal(req, res, next) {
  const ghlId = String(req.params.ghlId || '');
  res.set({'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'});
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(ghlId)) return res.status(400).json({ok:false,message:'Enlace de portal inválido'});
  try {
    const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw Error('Falta configuración del portal');
    const get = async (table,params) => (await axios.get(`${url}/rest/v1/${table}`, {
      headers:{apikey:key,Authorization:`Bearer ${key}`},params,timeout:15000
    })).data;
    const [rows, leads, roadmaps, materials] = await Promise.all([
      get('csm',{select:['nombre',...summary.fields].join(','),ghlid:`eq.${ghlId}`,order:'updated_at.desc',limit:1}),
      get('leads_raw',{select:'nombre',ghlid:`eq.${ghlId}`,limit:1}),
      get('csm_diagnosticos',{select:'id',client_ghlid:`eq.${ghlId}`,limit:1}),
      fetchContactMaterials(ghlId)
    ]);
    const row = rows[0] || leads[0];
    if (!row) return res.status(404).json({ok:false,message:'No encontramos este portal'});
    res.json({ok:true,portal:publicPortal(ghlId,row,materials,roadmaps.length > 0)});
  } catch (error) { next(error); }
}

module.exports = {getClientPortal,publicPortal};
