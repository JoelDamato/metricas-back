const axios = require('axios');
const env = require('../metricasv2/config/env');
const access = require('../auth/access');
const COLUMNS = 'ghlid,nombre,telefono,mail,closer,estado_pago,fecha_final,fecha_final_renovacion,productos_adquiridos,ultimo_producto_adquirido,actividad,abandono,pausa,proximo_contacto_csm,ultima_respuesta';
const DAY = 86400000;
const norm = v => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const dayOf = v => { const s = String(v || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null; };

async function readAll(params) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const {data} = await axios.get(`${env.supabaseUrl}/rest/v1/csm`, {
      headers: {apikey: env.supabaseKey, Authorization: `Bearer ${env.supabaseKey}`},
      params: {select: COLUMNS, order: 'id', ...params, limit: 1000, offset}, timeout: 20000
    });
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

function shape(row, today) {
  const end = dayOf(row.fecha_final);
  return {
    ghlid: row.ghlid, nombre: row.nombre, telefono: row.telefono, mail: row.mail, closer: row.closer,
    producto: row.ultimo_producto_adquirido || row.productos_adquiridos || null,
    estado_pago: row.estado_pago || null, fecha_final: end,
    dias_para_fin: end ? Math.round((Date.parse(end) - Date.parse(today)) / DAY) : null,
    proximo_contacto_csm: dayOf(row.proximo_contacto_csm), ultima_respuesta: dayOf(row.ultima_respuesta)
  };
}

// Deudor = Estado de pago "Deudor"; Moroso = "Apurar"; En negociación = no renovó, ya cursó MEG y su
// fecha final cae entre 15 días atrás y 30 días adelante (misma ventana que Renovaciones).
function classify(rows, today = new Date().toISOString().slice(0, 10)) {
  const debtorIds = new Set(), out = {deudores: [], morosos: [], negociacion: []};
  for (const row of rows) {
    const status = norm(row.estado_pago);
    if (status === 'deudor') { out.deudores.push(shape(row, today)); debtorIds.add(row.ghlid || row.nombre); }
    else if (status === 'apurar') { out.morosos.push(shape(row, today)); debtorIds.add(row.ghlid || row.nombre); }
  }
  for (const row of rows) {
    if (debtorIds.has(row.ghlid || row.nombre)) continue;
    const item = shape(row, today);
    if (item.dias_para_fin === null || item.dias_para_fin < -15 || item.dias_para_fin > 30) continue;
    if (dayOf(row.fecha_final_renovacion) || row.abandono) continue;
    if (!/meg/i.test(`${row.productos_adquiridos || ''} ${row.ultimo_producto_adquirido || ''}`)) continue;
    out.negociacion.push(item);
  }
  out.deudores.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
  out.morosos.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
  out.negociacion.sort((a, b) => a.dias_para_fin - b.dias_para_fin);
  return out;
}

async function list(req, res, next) {
  try {
    if (!req.authUser || !access.canAccessPageForUser(req.authUser, 'csm-deudores.html') || !access.canAccessResourceForUser(req.authUser, 'csm'))
      return res.status(403).json({message: 'Sin acceso a Deudores y renovaciones'});
    const today = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 16 * DAY).toISOString().slice(0, 10), to = new Date(Date.now() + 31 * DAY).toISOString().slice(0, 10);
    const [flagged, renewing] = await Promise.all([
      readAll({estado_pago: 'in.(Deudor,Apurar)'}),
      readAll({and: `(fecha_final.gte.${from},fecha_final.lte.${to})`})
    ]);
    const rows = [...new Map([...flagged, ...renewing].map(r => [r.ghlid || r.nombre, r])).values()];
    res.set('Cache-Control', 'no-store').json({generado: new Date().toISOString(), ...classify(rows, today)});
  } catch (error) { next(error); }
}

module.exports = {list, classify};
