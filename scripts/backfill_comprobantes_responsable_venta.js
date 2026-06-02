require('dotenv').config();
const axios = require('axios');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

function required(name, value) {
  if (!value) {
    throw new Error(`Falta ${name}`);
  }
  return value;
}

function projectRefFromUrl(url) {
  const match = String(url || '').match(/^https:\/\/([a-z0-9-]+)\.supabase\.co/i);
  return match?.[1] || '';
}

function titleCaseName(value) {
  const source = String(value || '').trim();
  if (!source) return '';
  return source
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function extractResponsibleVenta(infoComprobantes = '') {
  const raw = String(infoComprobantes || '').trim();
  if (!raw) return '';
  const match = raw.match(/responsable venta:\s*([^|]+)/i);
  return titleCaseName(match?.[1] || '');
}

async function runSql(query) {
  const ref = projectRefFromUrl(required('SUPABASE_URL', SUPABASE_URL));
  const response = await axios.post(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    { query },
    {
      headers: {
        Authorization: `Bearer ${required('SUPABASE_ACCESS_TOKEN', SUPABASE_ACCESS_TOKEN)}`,
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data;
}

async function main() {
  console.log('→ Creando columna responsable_venta si no existe...');
  await runSql('alter table if exists public.comprobantes add column if not exists responsable_venta text;');
  console.log('→ Poblando responsable_venta desde info_comprobantes / responsable_actual / creado_por...');
  await runSql(`
    update public.comprobantes
    set responsable_venta = trim(
      coalesce(
        nullif(responsable_venta, ''),
        nullif(substring(info_comprobantes from '(?i)Responsable venta:\\s*([^|]+)'), ''),
        nullif(responsable_actual, ''),
        nullif(creado_por, '')
      )
    )
    where trim(
      coalesce(
        nullif(responsable_venta, ''),
        nullif(substring(info_comprobantes from '(?i)Responsable venta:\\s*([^|]+)'), ''),
        nullif(responsable_actual, ''),
        nullif(creado_por, '')
      )
    ) is not null;
  `);

  console.log('→ Recargando schema cache de PostgREST...');
  await runSql(`notify pgrst, 'reload schema';`);

  const verification = await runSql(`
    select
      count(*) as total,
      count(*) filter (where nullif(trim(responsable_venta), '') is not null) as with_responsable_venta,
      count(*) filter (where nullif(trim(responsable_venta), '') is null) as without_responsable_venta
    from public.comprobantes;
  `);

  console.log(JSON.stringify(verification, null, 2));
}

main().catch((error) => {
  console.error('❌ Error en backfill de responsable_venta:', error.response?.data || error.message || error);
  process.exit(1);
});
