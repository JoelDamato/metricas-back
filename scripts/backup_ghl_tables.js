// Respaldo lógico (NDJSON + gzip) de las tablas físicas de GHL, leyendo por REST en páginas chicas para no cargar la base.
// Uso: node scripts/backup_ghl_tables.js <carpeta-destino>
// Restaurar: ver scripts/restore_ghl_tables.js
require('dotenv').config({quiet: true});
const fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto');
const {SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key} = process.env;
const H = {apikey: key, Authorization: `Bearer ${key}`};
const dest = process.argv[2]; if (!dest) throw new Error('Falta carpeta destino');
fs.mkdirSync(dest, {recursive: true});
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(q, tries = 6) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(`${url}/rest/v1/${q}`, {headers: H, signal: AbortSignal.timeout(30000)});
      if (r.ok) return r.json();
      throw new Error('HTTP ' + r.status);
    } catch (e) { if (i === tries - 1) throw e; await sleep(2000 * (i + 1)); }
  }
}
const TABLES = [
  {name: 'ghl_field_catalogs', pk: 'id', page: 5},
  {name: 'csm_ghl_contacts_store', pk: 'ghlid', page: 20},
  {name: 'leads_ghl_contacts_store', pk: 'ghlid', page: 20},
  {name: 'ghl_catalog_compaction_audit', pk: 'ghlid', page: 500, order: 'ghlid,source', offset: true}
];
(async () => {
  const manifest = {created_at: new Date().toISOString(), tables: {}};
  for (const t of TABLES) {
    const file = path.join(dest, `${t.name}.ndjson.gz`);
    const gz = zlib.createGzip({level: 6}), out = fs.createWriteStream(file), hash = crypto.createHash('sha256');
    gz.pipe(out); let n = 0, last = null;
    for (let off = 0; ; off += t.page) {
      const q = t.offset ? `${t.name}?select=*&order=${t.order}&limit=${t.page}&offset=${off}`
        : `${t.name}?select=*&order=${t.pk}&limit=${t.page}` + (last !== null ? `&${t.pk}=gt.${encodeURIComponent(last)}` : '');
      const rows = await get(q);
      for (const row of rows) { const line = JSON.stringify(row) + '\n'; hash.update(line); gz.write(line); n++; }
      if (!rows.length) break;
      last = rows[rows.length - 1][t.pk];
      if (rows.length < t.page) break;
      await sleep(120);
      if (n % 1000 < t.page) console.log(t.name, n);
    }
    await new Promise(r => { out.on('close', r); gz.end(); });
    manifest.tables[t.name] = {rows: n, sha256_of_ndjson: hash.digest('hex'), bytes_gz: fs.statSync(file).size};
    console.log('OK', t.name, manifest.tables[t.name]);
  }
  fs.writeFileSync(path.join(dest, 'manifest.json'), JSON.stringify(manifest, null, 2));
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
