// «Info comprobantes» se guarda como un solo texto: datos de auditoría (Carga ID,
// Cargado por, Responsable venta, precio Club, meses de soporte, adjuntos…) más las
// observaciones que escribe el closer. Acá se separa lo que escribió el closer.
// Tope acordado con Nadia (25-11-2026): 150 caracteres, sólo para cargas o
// ediciones nuevas; lo ya cargado no se toca.
const OBSERVACIONES_MAX = 150;
const META = '\nTEST_METADATA=';
const SOURCE_PREFIX = /^\[(TEST SUPABASE LOCAL|SUPABASE DIRECT)\] [^|]*\|\s*/;
const HEAD_SEGMENT = /^(carga id|cargado por|responsable venta):/i;
const PRICE_SEGMENT = /^precio [^:|]{0,60}: ARS [\d.,]+$/i;
const TAIL_SEGMENT = /^[.\s]*(meses de soporte|sesiones|bonus mati|adjuntos):/i;

function cleanInfo(raw) {
  return String(raw || '').split(META)[0].replace(SOURCE_PREFIX, '').trim();
}

function splitInfo(raw) {
  const head = [];
  const free = [];
  const tail = [];
  for (const segment of cleanInfo(raw).split(' | ')) {
    const value = segment.trim();
    if (!value) continue;
    if (HEAD_SEGMENT.test(value) || PRICE_SEGMENT.test(value)) head.push(value);
    else if (TAIL_SEGMENT.test(value)) tail.push(value);
    else free.push(value);
  }
  return { head, free: free.join(' | '), tail };
}

function extractObservaciones(raw) {
  return splitInfo(raw).free;
}

function mergeObservaciones(raw, observaciones) {
  const { head, tail } = splitInfo(raw);
  const free = String(observaciones || '').trim();
  return [...head, free, ...tail].filter(Boolean).join(' | ');
}

function validateObservaciones(value, previous = '') {
  const text = String(value || '').trim();
  if (text.length > OBSERVACIONES_MAX && text !== String(previous || '').trim()) {
    const error = new Error(`Las observaciones pueden tener hasta ${OBSERVACIONES_MAX} caracteres (escribiste ${text.length})`);
    error.statusCode = 400;
    throw error;
  }
  return text;
}

module.exports = {
  OBSERVACIONES_MAX,
  cleanInfo,
  splitInfo,
  extractObservaciones,
  mergeObservaciones,
  validateObservaciones
};
