#!/usr/bin/env node
// Compara las opciones de los campos de lista de GHL (Modelo de negocio y Rubro - <modelo>) con el catálogo
// de códigos fijos de modules/csm/business-segment.js (TA-8962). Sólo lee: no cambia nada en GHL.
// Si alguien renombró, agregó o sacó una opción en GHL y no la registró en el catálogo, lo avisa y sale con 1.
// Uso: GHL_API_KEY=... node scripts/verificar_catalogo_rubros.js
const axios = require('axios');
const {MODELOS, MODEL_FIELD} = require('../modules/csm/business-segment');

async function main() {
  const key = process.env.GHL_API_KEY;
  if (!key) throw new Error('Falta GHL_API_KEY');
  const loc = process.env.GHL_LOCATION_ID || 'WU2z8kl23Dr3IyBW1hv5';
  const {data} = await axios.get(`https://services.leadconnectorhq.com/locations/${loc}/customFields`, {headers: {Authorization: `Bearer ${key}`, Version: '2021-07-28'}, params: {model: 'contact'}, timeout: 30000});
  const byId = new Map((data.customFields || []).map(f => [f.id, f]));
  const problemas = [];
  const comparar = (id, nombre, esperadas) => {
    const f = byId.get(id);
    if (!f) return problemas.push(`${nombre}: el campo ${id} ya no existe en GHL`);
    const enGhl = (f.picklistOptions || []).map(String);
    enGhl.filter(o => !esperadas.includes(o)).forEach(o => problemas.push(`${nombre}: «${o}» está en GHL y no tiene código (¿renombrada o nueva? registrala en el catálogo)`));
    esperadas.filter(o => !enGhl.includes(o)).forEach(o => problemas.push(`${nombre}: «${o}» tiene código pero ya no está en GHL`));
  };
  comparar(MODEL_FIELD.id, MODEL_FIELD.name, MODELOS.map(m => m.nombre));
  MODELOS.forEach(m => comparar(m.campo.id, m.campo.name, m.rubros.map(x => x.nombre)));
  const total = MODELOS.reduce((n, m) => n + m.rubros.length, 0);
  if (problemas.length) { console.log(problemas.join('\n')); process.exitCode = 1; }
  else console.log(`OK: ${MODELOS.length} modelos y ${total} rubros de GHL tienen su código fijo.`);
}
main().catch(e => { console.error(e.message); process.exitCode = 2; });
