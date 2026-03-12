const { readFileSync } = require('fs');
const { join } = require('path');
const { Client } = require('pg');

(async () => {
  try {
    const sqlPath = join(__dirname, '..', 'sql', 'add_csm_columns.sql');
    const sql = readFileSync(sqlPath, 'utf8');

    const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.SUPABASE_DB_CONN;
    if (!connectionString) {
      console.error('❌ Falta la variable de entorno DATABASE_URL o SUPABASE_DB_URL con la conexión Postgres.');
      process.exit(1);
    }

    const client = new Client({ connectionString });
    await client.connect();
    console.log('🔌 Conectado a la DB, ejecutando SQL...');

    await client.query(sql);

    console.log('✅ SQL ejecutado correctamente. Columnas añadidas si no existían.');
    await client.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error ejecutando el SQL:', err.message || err);
    process.exit(2);
  }
})();
