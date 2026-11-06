// Restaura filas de los respaldos NDJSON.gz a las tablas físicas (upsert por clave). NO borra filas.
// Uso: node scripts/restore_ghl_tables.js <carpeta-respaldo> <tabla> [--ghlid=<id>] [--ejecutar]
// Sin --ejecutar sólo cuenta. Para volver al estado exacto anterior a un cambio masivo, restaurar la tabla completa.
require('dotenv').config({quiet: true});
const fs = require('fs'), path = require('path'), zlib = require('zlib'), readline = require('readline');
const {SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key} = process.env;
const [dir, table, ...flags] = process.argv.slice(2);
const only = (flags.find(f => f.startsWith('--ghlid=')) || '').slice(8), run = flags.includes('--ejecutar');
const PK = {ghl_field_catalogs: 'id', csm_ghl_contacts_store: 'ghlid', leads_ghl_contacts_store: 'ghlid', ghl_catalog_compaction_audit: 'source,ghlid'};
(async () => {
  if (!PK[table]) throw new Error('Tabla no soportada');
  const rl = readline.createInterface({input: fs.createReadStream(path.join(dir, `${table}.ndjson.gz`)).pipe(zlib.createGunzip())});
  let batch = [], n = 0;
  const flush = async () => {
    if (!batch.length) return;
    if (run) {
      const r = await fetch(`${url}/rest/v1/${table}?on_conflict=${PK[table]}`, {method: 'POST', headers: {apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal'}, body: JSON.stringify(batch)});
      if (!r.ok) throw new Error(`HTTP ${r.status} ${await r.text()}`);
      await new Promise(r => setTimeout(r, 150));
    }
    n += batch.length; batch = [];
  };
  for await (const line of rl) {
    if (!line) continue; const row = JSON.parse(line);
    if (only && row.ghlid !== only) continue;
    batch.push(row); if (batch.length >= 10) await flush();
  }
  await flush();
  console.log(run ? 'Restauradas' : 'Se restaurarían', n, 'filas en', table);
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
