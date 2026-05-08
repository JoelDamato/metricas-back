require('dotenv').config();

const { Client: NotionClient } = require('@notionhq/client');
const axios = require('axios');

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function assertEnv(name, value) {
  if (!value) {
    throw new Error(`Falta la variable ${name}`);
  }
}

function normalizeDate(dateValue) {
  if (!dateValue) return null;
  try {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return null;
    const adjusted = new Date(date.getTime() - 3 * 60 * 60 * 1000);
    return adjusted.toISOString().replace(/\.\d{3}Z$/, 'Z');
  } catch {
    return null;
  }
}

function getValue(prop) {
  if (!prop) return null;

  switch (prop.type) {
    case 'title':
    case 'rich_text':
      return prop[prop.type]?.[0]?.plain_text || null;
    case 'number':
      return prop.number ?? null;
    case 'select':
      return prop.select?.name ?? null;
    case 'multi_select':
      return prop.multi_select?.map((item) => item.name).join(', ') || null;
    case 'date':
      return normalizeDate(prop.date?.start);
    case 'checkbox':
      return prop.checkbox ?? null;
    case 'formula':
      if (prop.formula.type === 'string') return prop.formula.string;
      if (prop.formula.type === 'number') return prop.formula.number;
      if (prop.formula.type === 'boolean') return prop.formula.boolean;
      if (prop.formula.type === 'date') return normalizeDate(prop.formula.date?.start);
      return null;
    case 'rollup':
      if (prop.rollup.type === 'number') return prop.rollup.number;
      if (prop.rollup.type === 'date') return normalizeDate(prop.rollup.date?.start);
      if (prop.rollup.type === 'array') return prop.rollup.array?.length || 0;
      return null;
    default:
      return null;
  }
}

async function fetchAllNotionPages(notion) {
  const results = [];
  let cursor;

  do {
    const response = await notion.databases.query({
      database_id: NOTION_DATABASE_ID,
      start_cursor: cursor,
      page_size: 100
    });
    results.push(...response.results);
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  return results;
}

async function fetchExistingCsmIds() {
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`
  };
  const response = await axios.get(`${SUPABASE_URL}/rest/v1/csm?select=id&limit=1000`, { headers });
  return new Set((response.data || []).map((row) => row.id));
}

async function patchCsmRow(id, payload) {
  const response = await axios.patch(
    `${SUPABASE_URL}/rest/v1/csm?id=eq.${encodeURIComponent(id)}`,
    payload,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      }
    }
  );
  return Array.isArray(response.data) ? response.data[0] : null;
}

function mapCsmFields(page) {
  const p = page.properties || {};
  return {
    pago_a_onbo: getValue(p['Pago a onbo']),
    pago_a_diagnostico: getValue(p['Pago a diagnostico']) ?? getValue(p['Pago a Diagnostico']),
    diagnostico_7dias: getValue(p['Diagnostico en 7 dias']),
    f_primer_resultado: getValue(p['F. Primer Resultado']) ?? getValue(p['F Primer Resultado']),
    caso_de_exito: getValue(p['Caso de exito']),
    fecha_final_renovacion: getValue(p['Fecha final renovacion']),
    solicito_devolucion: getValue(p['Solicito Devolucion']),
    abandono: getValue(p['Abandono'])
  };
}

async function main() {
  assertEnv('NOTION_API_KEY', NOTION_API_KEY);
  assertEnv('NOTION_DATABASE_ID', NOTION_DATABASE_ID);
  assertEnv('SUPABASE_URL', SUPABASE_URL);
  assertEnv('SUPABASE_SERVICE_ROLE_KEY', SUPABASE_KEY);

  const notion = new NotionClient({ auth: NOTION_API_KEY });
  const existingIds = await fetchExistingCsmIds();
  const pages = await fetchAllNotionPages(notion);

  let matched = 0;
  let updated = 0;
  const pagoRows = [];

  for (const page of pages) {
    if (!existingIds.has(page.id)) continue;
    matched += 1;

    const payload = mapCsmFields(page);
    const updatedRow = await patchCsmRow(page.id, payload);
    if (updatedRow) {
      updated += 1;
      if (payload.pago_a_onbo !== null && payload.pago_a_onbo !== undefined && String(payload.pago_a_onbo).trim() !== '') {
        pagoRows.push({
          id: page.id,
          nombre: updatedRow.nombre || getValue(page.properties?.Nombre) || '',
          pago_a_onbo: payload.pago_a_onbo
        });
      }
    }
  }

  pagoRows.sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || '')));

  console.log(JSON.stringify({
    notionPages: pages.length,
    matchedCsmRows: matched,
    updatedRows: updated,
    pagoAOnboRows: pagoRows.length,
    pagoAOnbo: pagoRows
  }, null, 2));
}

main().catch((error) => {
  console.error('❌ Error en backfill de pago_a_onbo:', error.message || error);
  process.exit(1);
});
