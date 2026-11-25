// Modelo de negocio y rubro de cada cliente, completados por el CCM desde el panel.
// Las listas son las mismas de GHL («Modelo de negocio (lista)» y un «Rubro - <modelo>» por cada modelo).
// Guarda en GHL (fuente del dato) y en csm_business_segments (para que el panel lo muestre al instante).
const axios = require('axios');
const env = require('../metricasv2/config/env');
const access = require('../auth/access');

const LOCATION_ID = process.env.GHL_LOCATION_ID || 'WU2z8kl23Dr3IyBW1hv5';
const MODEL_FIELD = {id: 'pGc4HWnyqDYZlu1LzuYh', name: 'Modelo de negocio (lista)'};

// Código fijo de cada modelo y rubro (TA-8962). GHL guarda en el contacto sólo el TEXTO de la opción
// (los campos de contacto no admiten una clave aparte), así que el código vive acá:
// - Un código no se cambia ni se reutiliza nunca. Una opción nueva lleva el siguiente número libre.
// - Para renombrar una opción: cambiar `nombre`, pasar el nombre viejo a `antes` y renombrarla en GHL.
//   Los contactos que quedaron con el texto viejo se siguen reconociendo con el mismo código.
// - Para unificar dos opciones: la que queda suma el nombre de la otra en `antes` y su código en `codigosAntes`.
// - «Otros» lleva siempre el 99 de su modelo.
const r = (codigo, nombre, extra = {}) => ({codigo, nombre, antes: [], codigosAntes: [], ...extra});
const MODELOS = [
  {codigo: 'GAS', nombre: 'Gastronomía', antes: [], campo: {id: 'Znnsjrhao49MoKrxtS36', name: 'Rubro - Gastronomía'}, rubros: [
    r('GAS-01', 'Restaurante y comidas'), r('GAS-02', 'Panadería'), r('GAS-03', 'Pastelería'), r('GAS-04', 'Cafetería'),
    r('GAS-05', 'Heladería'), r('GAS-06', 'Bar y bebidas'), r('GAS-99', 'Otros')]},
  {codigo: 'FAB', nombre: 'Fabricación', antes: [], campo: {id: 'MNxCrACMLiGHaibQZrge', name: 'Rubro - Fabricación'}, rubros: [
    r('FAB-01', 'Alimentos y bebidas'), r('FAB-02', 'Frigorífico'), r('FAB-03', 'Metalúrgica'), r('FAB-04', 'Ferretería, herrajes y herrería'),
    r('FAB-05', 'Construcción y aberturas'), r('FAB-06', 'Muebles y mobiliario'), r('FAB-07', 'Hogar, decoración y bazar'), r('FAB-08', 'Cortinas y toldos'),
    r('FAB-09', 'Indumentaria, calzado y accesorios'), r('FAB-10', 'Cueros y marroquinería'), r('FAB-11', 'Plásticos, envases y bolsas'),
    r('FAB-12', 'Librería, papelería, cotillón e imprenta'), r('FAB-13', 'Juguetería'), r('FAB-14', 'Ortopedia, estética y salud'), r('FAB-15', 'Automotriz'),
    r('FAB-16', 'Cosmética y perfumería'), r('FAB-17', 'Química y productos de limpieza'), r('FAB-18', 'Artesanías y regalos'), r('FAB-99', 'Otros')]},
  {codigo: 'REV', nombre: 'Reventa', antes: [], campo: {id: 'BxdcPnDR3Km3eTPJeRnY', name: 'Rubro - Reventa'}, rubros: [
    r('REV-01', 'Supermercado y verdulería'), r('REV-02', 'Kiosco, regalería y polirrubro'), r('REV-03', 'Dietética'), r('REV-04', 'Carnicería y pollería'),
    r('REV-05', 'Indumentaria, calzado y accesorios'), r('REV-06', 'Hogar, decoración y bazar'), r('REV-07', 'Ferretería, pinturería y corralón'),
    r('REV-08', 'Librería, papelería, cotillón e imprenta'), r('REV-09', 'Plásticos, envases y bolsas'), r('REV-10', 'Seguridad y limpieza'),
    r('REV-11', 'Farmacia, droguería y salud'), r('REV-12', 'Tecnología, computación y electro'), r('REV-13', 'Automotriz'), r('REV-14', 'Mascotas'),
    r('REV-15', 'Agropecuario'), r('REV-16', 'Juguetería'), r('REV-17', 'Perfumería y cosmética'), r('REV-18', 'Óptica, joyería y relojería'),
    r('REV-19', 'Materiales eléctricos e iluminación'), r('REV-20', 'Deportes, camping, caza y pesca'), r('REV-21', 'Bebidas y vinoteca'),
    r('REV-22', 'Vivero y florería'), r('REV-99', 'Otros')]},
  {codigo: 'SER', nombre: 'Servicios', antes: [], campo: {id: 'P58rW80KJGB8iGaH9QvE', name: 'Rubro - Servicios'}, rubros: [
    r('SER-01', 'Financieras'), r('SER-02', 'Marketing digital'), r('SER-03', 'Gráfica e imprenta'), r('SER-04', 'Tecnología y electricidad'),
    r('SER-05', 'Salud y bienestar'), r('SER-06', 'Clínica estética'), r('SER-07', 'Odontología'), r('SER-08', 'Construcción, arquitectura y reformas'),
    r('SER-09', 'Mantenimiento y limpieza'), r('SER-10', 'Climatización'), r('SER-11', 'Transporte'), r('SER-12', 'Estación de servicio y taller mecánico'),
    r('SER-13', 'Agencia de viajes'), r('SER-14', 'Excursiones y experiencias'), r('SER-15', 'Agropecuario'), r('SER-16', 'Estudios profesionales'),
    r('SER-17', 'Educación y capacitación'), r('SER-18', 'Inmobiliaria'), r('SER-19', 'Peluquería y barbería'), r('SER-20', 'Gimnasio y deportes'),
    r('SER-21', 'Veterinaria'), r('SER-22', 'Hotelería y alojamiento'), r('SER-99', 'Otros')]},
  {codigo: 'EVE', nombre: 'Eventos', antes: [], campo: {id: 'gD623hcjviGwKQx3cdtF', name: 'Rubro - Eventos'}, rubros: [
    r('EVE-01', 'Ambientación y decoración'), r('EVE-02', 'Producción de espectáculos'), r('EVE-03', 'Salón de eventos'), r('EVE-04', 'Organización de eventos'),
    r('EVE-05', 'Fotografía y video'), r('EVE-06', 'Sonido e iluminación'), r('EVE-07', 'Alquiler de mobiliario y vajilla'), r('EVE-99', 'Otros')]}
];

// Vista por nombre actual, compatible con lo que ya usaba el panel: {modelo: {id, name, options}}.
const CATALOG = Object.fromEntries(MODELOS.map(m => [m.nombre, {id: m.campo.id, name: m.campo.name, codigo: m.codigo, options: m.rubros.map(x => x.nombre)}]));

const norm = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
const modeloPor = t => { const n = norm(t); return n ? MODELOS.find(m => m.codigo.toLowerCase() === n || [m.nombre, ...m.antes].some(x => norm(x) === n)) : undefined; };
const rubroPor = (m, t) => { const n = norm(t); return m && n ? m.rubros.find(x => [x.codigo, ...x.codigosAntes].some(c => c.toLowerCase() === n) || [x.nombre, ...x.antes].some(y => norm(y) === n)) : undefined; };

// Reconoce un modelo y rubro por su código, su nombre actual o un nombre anterior.
// Devuelve siempre los nombres de HOY y los códigos fijos; vacío si no está en la lista.
function resolve(modelo, rubro) {
  const m = modeloPor(modelo);
  if (!m) return {modelo: '', rubro: '', modelo_codigo: '', rubro_codigo: ''};
  const x = rubroPor(m, rubro);
  return {modelo: m.nombre, rubro: x ? x.nombre : '', modelo_codigo: m.codigo, rubro_codigo: x ? x.codigo : ''};
}

const sbHeaders = () => ({apikey: env.supabaseKey, Authorization: `Bearer ${env.supabaseKey}`});
const allowed = req => ['total', 'csm'].includes(req.authUser?.role) && access.canAccessPageForUser(req.authUser, 'csm-tiempo.html');
const validId = id => /^[a-zA-Z0-9]{1,100}$/.test(String(id || ''));

function validate(modelo, rubro) {
  const seg = resolve(modelo, rubro);
  if (!seg.modelo_codigo) return 'Elegí un modelo de negocio de la lista.';
  if (!seg.rubro_codigo) return 'Elegí un rubro de la lista de ese modelo de negocio.';
  return '';
}

// Modelo y rubro tal como quedaron en GHL (los que vienen del formulario nuevo o los que ya cargó alguien).
// Con nombres viejos (opción renombrada en GHL) devuelve el nombre de hoy y el mismo código.
function fromGhlFields(fields = {}) {
  const m = modeloPor(fields[MODEL_FIELD.name]);
  if (!m) return {modelo: '', rubro: '', modelo_codigo: '', rubro_codigo: ''};
  const seg = resolve(m.codigo, fields[m.campo.name]);
  return seg.rubro_codigo ? seg : {...seg, rubro: String(fields[m.campo.name] || '').trim()};
}

// Payload de GHL: el modelo elegido, su rubro, y los rubros de los otros modelos vacíos (que no quede uno viejo colgado).
// Siempre con el nombre de HOY (lo que GHL tiene como opción), aunque llegue un código o un nombre viejo.
function ghlCustomFields(modelo, rubro) {
  const seg = resolve(modelo, rubro);
  return [{id: MODEL_FIELD.id, field_value: seg.modelo},
    ...MODELOS.map(m => ({id: m.campo.id, field_value: m.codigo === seg.modelo_codigo ? seg.rubro : ''}))];
}

// Fila guardada → nombres de hoy a partir del código (si la opción se renombró, el panel muestra el nombre nuevo).
function fromRow(row = {}) {
  const seg = row.rubro_codigo ? resolve(row.modelo_codigo || String(row.rubro_codigo).split('-')[0], row.rubro_codigo) : resolve(row.modelo, row.rubro);
  return seg.rubro_codigo ? {...row, ...seg} : {...row, modelo_codigo: seg.modelo_codigo || '', rubro_codigo: ''};
}

const catalogo = () => MODELOS.map(m => ({codigo: m.codigo, nombre: m.nombre, rubros: m.rubros.map(x => ({codigo: x.codigo, nombre: x.nombre}))}));

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
    const manual = await readAll('csm_business_segments', 'ghlid,modelo,rubro,modelo_codigo,rubro_codigo,updated_by,updated_at');
    res.json({catalog: Object.fromEntries(Object.entries(CATALOG).map(([m, f]) => [m, f.options])), catalogo: catalogo(), segments: manual.map(row => ({...fromRow(row), source: 'panel'}))});
  } catch (e) { next(e); }
}

async function save(req, res, next, deps = {}) {
  try {
    if (!allowed(req)) return res.status(403).json({message: 'Sin permiso para seguimiento CSM'});
    const ghlid = req.params.ghlid;
    const body = req.body || {};
    if (!validId(ghlid)) return res.status(400).json({message: 'Cliente inválido'});
    const error = validate(body.modelo_codigo || body.modelo, body.rubro_codigo || body.rubro);
    if (error) return res.status(400).json({message: error});
    const seg = resolve(body.modelo_codigo || body.modelo, body.rubro_codigo || body.rubro);
    const key = deps.ghlKey ?? process.env.GHL_API_KEY;
    if (!key) return res.status(503).json({message: 'No hay conexión con GHL para guardar el rubro.'});
    const http = deps.http || axios;
    const base = 'https://services.leadconnectorhq.com';
    const ghlHeaders = {Authorization: `Bearer ${key}`, Version: '2021-07-28'};
    const {data: current} = await http.get(`${base}/contacts/${encodeURIComponent(ghlid)}`, {headers: ghlHeaders, timeout: 10000});
    if (current?.contact?.locationId !== LOCATION_ID) return res.status(404).json({message: 'No encontré el cliente en GHL'});
    await http.put(`${base}/contacts/${encodeURIComponent(ghlid)}`, {customFields: ghlCustomFields(seg.modelo_codigo, seg.rubro_codigo)}, {headers: ghlHeaders, timeout: 10000});
    const row = {ghlid, ...seg, updated_by: req.authUser.email, updated_at: new Date().toISOString()};
    await http.post(`${env.supabaseUrl}/rest/v1/csm_business_segments`, row, {headers: {...sbHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal'}, params: {on_conflict: 'ghlid'}, timeout: 30000});
    res.json({...row, source: 'panel'});
  } catch (e) {
    if (e.response?.status === 404 || e.response?.status === 400) return res.status(404).json({message: 'No encontré el cliente en GHL'});
    next(e);
  }
}

module.exports = {MODELOS, CATALOG, MODEL_FIELD, resolve, validate, fromGhlFields, fromRow, catalogo, ghlCustomFields, list, save};
