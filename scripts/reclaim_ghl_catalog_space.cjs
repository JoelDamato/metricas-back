// Run only after lossless catalog normalization has completed for the selected stores.
require('dotenv').config({ quiet: true });
const { Client } = require('pg');
const fs = require('fs');

async function main() {
  const tables = process.argv.slice(2);
  const allowed = ['csm_ghl_contacts_store', 'leads_ghl_contacts_store'];
  if (!tables.length || tables.some(table => !allowed.includes(table))) {
    throw new Error('Pass one or both GHL contact store table names');
  }
  if (!process.env.SUPABASE_SSL_ROOT_CERT) {
    throw new Error('Set SUPABASE_SSL_ROOT_CERT to the official Supabase CA certificate path');
  }
  const ref = new URL(process.env.SUPABASE_URL).hostname.split('.')[0];
  const client = new Client({
    host: `db.${ref}.supabase.co`,
    user: 'postgres',
    database: 'postgres',
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: { rejectUnauthorized: true, ca: fs.readFileSync(process.env.SUPABASE_SSL_ROOT_CERT, 'utf8') },
    connectionTimeoutMillis: 7000,
  });
  try {
    await client.connect();
    await client.query("set lock_timeout='2s'");
    await client.query("set statement_timeout='300s'");
    for (const table of tables) {
      const { rows } = await client.query(`select count(*)::int n from public.${table} where not catalog_compacted`);
      if (rows[0].n) throw new Error(`Pending ${rows[0].n} rows in ${table}`);
      const before = (await client.query('select pg_total_relation_size($1) bytes', [table])).rows[0].bytes;
      const started = Date.now();
      await client.query(`VACUUM (FULL, ANALYZE) public.${table}`);
      const after = (await client.query('select pg_total_relation_size($1) bytes', [table])).rows[0].bytes;
      console.log(JSON.stringify({ table, before, after, ms: Date.now() - started }));
    }
    console.log((await client.query('select pg_database_size(current_database()) bytes')).rows[0]);
  } finally {
    await client.end();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
