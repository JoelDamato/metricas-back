// Modelo de negocio y rubro de cada cliente, completados por el CCM desde el panel.
// Las listas son las mismas de GHL («Modelo de negocio (lista)» y un «Rubro - <modelo>» por cada modelo).
// Guarda en GHL (fuente del dato) y en csm_business_segments (para que el panel lo muestre al instante).
const axios = require('axios');
const env = require('../metricasv2/config/env');
const access = require('../auth/access');

const LOCATION_ID = process.env.GHL_LOCATION_ID || 'WU2z8kl23Dr3IyBW1hv5';
const MODEL_FIELD = {id: 'pGc4HWnyqDYZlu1LzuYh', name: 'Modelo de negocio (lista)'};
const CATALOG = {
  'Gastronomía': {id: 'Znnsjrhao49MoKrxtS36', name: 'Rubro - Gastronomía', options: ['Restaurante y comidas', 'Panadería', 'Pastelería', 'Cafetería', 'Heladería', 'Bar y bebidas', 'Otros']},
  'Fabricación': {id: 'MNxCrACMLiGHaibQZrge', name: 'Rubro - Fabricación', options: ['Alimentos y bebidas', 'Frigorífico', 'Metalúrgica', 'Ferretería, herrajes y herrería', 'Construcción y aberturas', 'Muebles y mobiliario', 'Hogar, decoración y bazar', 'Cortinas y toldos', 'Indumentaria, calzado y accesorios', 'Cueros y marroquinería', 'Plásticos, envases y bolsas', 'Librería, papelería, cotillón e imprenta', 'Juguetería', 'Ortopedia, estética y salud', 'Automotriz', 'Cosmética y perfumería', 'Química y productos de limpieza', 'Artesanías y regalos', 'Otros']},
  'Reventa': {id: 'BxdcPnDR3Km3eTPJeRnY', name: 'Rubro - Reventa', options: ['Supermercado y verdulería', 'Kiosco, regalería y polirrubro', 'Dietética', 'Carnicería y pollería', 'Indumentaria, calzado y accesorios', 'Hogar, decoración y bazar', 'Ferretería, pinturería y corralón', 'Librería, papelería, cotillón e imprenta', 'Plásticos, envases y bolsas', 'Seguridad y limpieza', 'Farmacia, droguería y salud', 'Tecnología, computación y electro', 'Automotriz', 'Mascotas', 'Agropecuario', 'Juguetería', 'Perfumería y cosmética', 'Óptica, joyería y relojería', 'Materiales eléctricos e iluminación', 'Deportes, camping, caza y pesca', 'Bebidas y vinoteca', 'Vivero y florería', 'Otros']},
  'Servicios': {id: 'P58rW80KJGB8iGaH9QvE', name: 'Rubro - Servicios', options: ['Financieras', 'Marketing digital', 'Gráfica e imprenta', 'Tecnología y electricidad', 'Salud y bienestar', 'Clínica estética', 'Odontología', 'Construcción, arquitectura y reformas', 'Mantenimiento y limpieza', 'Climatización', 'Transporte', 'Estación de servicio y taller mecánico', 'Agencia de viajes', 'Excursiones y experiencias', 'Agropecuario', 'Estudios profesionales', 'Educación y capacitación', 'Inmobiliaria', 'Peluquería y barbería', 'Gimnasio y deportes', 'Veterinaria', 'Hotelería y alojamiento', 'Otros']},
  'Eventos': {id: 'gD623hcjviGwKQx3cdtF', name: 'Rubro - Eventos', options: ['Ambientación y decoración', 'Producción de espectáculos', 'Salón de eventos', 'Organización de eventos', 'Fotografía y video', 'Sonido e iluminación', 'Alquiler de mobiliario y vajilla', 'Otros']}
};

const sbHeaders = () => ({apikey: env.supabaseKey, Authorization: `Bearer ${env.supabaseKey}`});
const allowed = req => ['total', 'csm'].includes(req.authUser?.role) && access.canAccessPageForUser(req.authUser, 'csm-tiempo.html');
const validId = id => /^[a-zA-Z0-9]{1,100}$/.test(String(id || ''));

function validate(modelo, rubro) {
  if (!Object.hasOwn(CATALOG, modelo)) return 'Elegí un modelo de negocio de la lista.';
  if (!CATALOG[modelo].options.includes(rubro)) return 'Elegí un rubro de la lista de ese modelo de negocio.';
  return '';
}

// Modelo y rubro tal como quedaron en GHL (los que vienen del formulario nuevo o los que ya cargó alguien).
function fromGhlFields(fields = {}) {
  const modelo = String(fields[MODEL_FIELD.name] || '').trim();
  const rubro = Object.hasOwn(CATALOG, modelo) ? String(fields[CATALOG[modelo].name] || '').trim() : '';
  return Object.hasOwn(CATALOG, modelo) ? {modelo, rubro} : {modelo: '', rubro: ''};
}

// Payload de GHL: el modelo elegido, su rubro, y los rubros de los otros modelos vacíos (que no quede uno viejo colgado).
function ghlCustomFields(modelo, rubro) {
  return [{id: MODEL_FIELD.id, field_value: modelo},
    ...Object.entries(CATALOG).map(([m, f]) => ({id: f.id, field_value: m === modelo ? rubro : ''}))];
}

async function readAll(table, select, extra = {}) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const {data} = await axios.get(`${env.supabaseUrl}/rest/v1/${table}`, {headers: sbHeaders(), params: {select, order: 'ghlid', limit: 1000, offset, ...extra}, timeout: 30000});
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

// Lee sólo lo que cargó el CCM desde el panel. No se leen los campos de GHL de toda la base:
// esa consulta tarda ~8 s sobre csm_ghl_contacts (restaura el catálogo de cada contacto).
async function list(req, res, next) {
  try {
    if (!allowed(req)) return res.status(403).json({message: 'Sin permiso para seguimiento CSM'});
    const manual = await readAll('csm_business_segments', 'ghlid,modelo,rubro,updated_by,updated_at');
    res.json({catalog: Object.fromEntries(Object.entries(CATALOG).map(([m, f]) => [m, f.options])), segments: manual.map(row => ({...row, source: 'panel'}))});
  } catch (e) { next(e); }
}

async function save(req, res, next, deps = {}) {
  try {
    if (!allowed(req)) return res.status(403).json({message: 'Sin permiso para seguimiento CSM'});
    const ghlid = req.params.ghlid;
    const {modelo, rubro} = req.body || {};
    if (!validId(ghlid)) return res.status(400).json({message: 'Cliente inválido'});
    const error = validate(modelo, rubro);
    if (error) return res.status(400).json({message: error});
    const key = deps.ghlKey ?? process.env.GHL_API_KEY;
    if (!key) return res.status(503).json({message: 'No hay conexión con GHL para guardar el rubro.'});
    const http = deps.http || axios;
    const base = 'https://services.leadconnectorhq.com';
    const ghlHeaders = {Authorization: `Bearer ${key}`, Version: '2021-07-28'};
    const {data: current} = await http.get(`${base}/contacts/${encodeURIComponent(ghlid)}`, {headers: ghlHeaders, timeout: 10000});
    if (current?.contact?.locationId !== LOCATION_ID) return res.status(404).json({message: 'No encontré el cliente en GHL'});
    await http.put(`${base}/contacts/${encodeURIComponent(ghlid)}`, {customFields: ghlCustomFields(modelo, rubro)}, {headers: ghlHeaders, timeout: 10000});
    const row = {ghlid, modelo, rubro, updated_by: req.authUser.email, updated_at: new Date().toISOString()};
    await http.post(`${env.supabaseUrl}/rest/v1/csm_business_segments`, row, {headers: {...sbHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal'}, params: {on_conflict: 'ghlid'}, timeout: 30000});
    res.json({...row, source: 'panel'});
  } catch (e) {
    if (e.response?.status === 404 || e.response?.status === 400) return res.status(404).json({message: 'No encontré el cliente en GHL'});
    next(e);
  }
}

module.exports = {CATALOG, MODEL_FIELD, validate, fromGhlFields, ghlCustomFields, list, save};
