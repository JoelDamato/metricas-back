require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const axios = require('axios');

const MIGRATION_PATH = path.join(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '20260828183000_marketing_only_origen_actual.sql'
);

function required(name, value) {
  if (!value) throw new Error(`Falta ${name}`);
  return value;
}

function projectRefFromUrl(value) {
  return new URL(required('SUPABASE_URL', value)).hostname.split('.')[0];
}

async function runSql(query) {
  const projectRef = projectRefFromUrl(process.env.SUPABASE_URL);
  const response = await axios.post(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    { query },
    {
      headers: {
        Authorization: `Bearer ${required('SUPABASE_ACCESS_TOKEN', process.env.SUPABASE_ACCESS_TOKEN)}`,
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data || [];
}

function inspectDefinition(definition) {
  const originLines = definition
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const fallbackLines = originLines.filter((line) => (
    /\bcoalesce\s*\(/i.test(line) &&
    /\.(?:origen)\b/i.test(line) &&
    /(?:origen_actual|marketing_origin)/i.test(line)
  ));
  const usesOrigenActual = /\borigen_actual\b/i.test(definition);

  return {
    usesOrigenActual,
    historicalFallbacks: fallbackLines.length,
    strict: usesOrigenActual && fallbackLines.length === 0
  };
}

async function audit() {
  const [viewRow] = await runSql(`
    select pg_get_viewdef('public.kpi_marketing_diario'::regclass, true) as definition;
  `);
  const [counts] = await runSql(`
    select
      count(*) filter (
        where fecha_agenda >= date '2026-09-01'
          and fecha_agenda < date '2026-10-01'
      )::int as leads_septiembre,
      count(*) filter (
        where fecha_agenda >= date '2026-09-01'
          and fecha_agenda < date '2026-10-01'
          and nullif(btrim(origen_actual), '') is not null
      )::int as con_origen_actual,
      count(*) filter (
        where fecha_agenda >= date '2026-09-01'
          and fecha_agenda < date '2026-10-01'
          and nullif(btrim(origen_actual), '') is null
      )::int as sin_origen_actual,
      count(*) filter (
        where fecha_agenda >= date '2026-09-01'
          and fecha_agenda < date '2026-10-01'
          and nullif(btrim(origen_actual), '') is null
          and nullif(btrim(origen), '') is not null
      )::int as solo_origen_historico
    from public.leads_raw;
  `);
  const [viewCounts] = await runSql(`
    select coalesce(sum(reuniones_agendadas), 0)::int as agendas_vista_septiembre
    from public.kpi_marketing_diario
    where fecha >= date '2026-09-01'
      and fecha < date '2026-10-01';
  `);

  return {
    definition: inspectDefinition(String(viewRow?.definition || '')),
    counts,
    view: viewCounts
  };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const before = await audit();
  console.log(JSON.stringify({ phase: 'before', ...before }, null, 2));

  if (!apply) {
    console.log('Modo auditoría: no se modificó Supabase. Usá --apply para aplicar la vista estricta.');
    return;
  }

  const migrationSql = fs.readFileSync(MIGRATION_PATH, 'utf8');
  await runSql(`
    begin;
    ${migrationSql}
    notify pgrst, 'reload schema';
    commit;
  `);

  const after = await audit();
  console.log(JSON.stringify({ phase: 'after', ...after }, null, 2));

  if (!after.definition.strict) {
    throw new Error('La vista productiva todavía contiene referencias al origen histórico.');
  }
}

main().catch((error) => {
  console.error(error.response?.data || error.message || error);
  process.exit(1);
});
