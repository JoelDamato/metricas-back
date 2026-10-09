require('dotenv').config();

const axios = require('axios');
const { Client: NotionClient } = require('@notionhq/client');
const { mapToSupabase } = require('../controllers/webhooksheets2');

const DEFAULT_CRM_DATABASE_ID = '24648251-7a95-80ba-8a16-d978f21365e1';
const DATE_PROPERTY = 'Fecha de agendamiento';

function required(name, value) {
  if (!value) throw new Error(`Falta ${name}`);
  return value;
}

function normalizeId(value) {
  return String(value || '').replace(/-/g, '').trim().toLowerCase();
}

function strictCurrentOrigin(row) {
  return Boolean(String(row?.origen_actual || '').trim());
}

function notionDateFilter(propertyType, from, to) {
  const date = { on_or_after: from, before: to };
  if (propertyType === 'formula') return { property: DATE_PROPERTY, formula: { date } };
  if (propertyType === 'rollup') return { property: DATE_PROPERTY, rollup: { date } };
  return { property: DATE_PROPERTY, date };
}

async function fetchNotionRows(notion, databaseId, from, to) {
  const database = await notion.databases.retrieve({ database_id: databaseId });
  const propertyType = database.properties?.[DATE_PROPERTY]?.type;
  if (!propertyType) throw new Error(`No existe la propiedad ${DATE_PROPERTY} en Notion`);

  const pages = [];
  let cursor;
  do {
    const response = await notion.databases.query({
      database_id: databaseId,
      page_size: 100,
      start_cursor: cursor,
      filter: notionDateFilter(propertyType, from, to)
    });
    pages.push(...response.results);
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  const mappedRows = pages.map((page) => mapToSupabase(page));
  const fromTime = Date.parse(`${from}T00:00:00Z`);
  const toTime = Date.parse(`${to}T00:00:00Z`);
  const rows = mappedRows.filter((row) => {
    const timestamp = Date.parse(row?.fecha_agenda || '');
    return Number.isFinite(timestamp) && timestamp >= fromTime && timestamp < toTime;
  });

  return {
    propertyType,
    queriedPages: pages.length,
    rows
  };
}

async function fetchSupabaseRows(from, to) {
  const key = required('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY);
  const response = await axios.get(
    `${required('SUPABASE_URL', process.env.SUPABASE_URL)}/rest/v1/leads_raw`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`
      },
      params: {
        select: 'id,ghlid,nombre,fecha_agenda,origen_actual,origen',
        and: `(fecha_agenda.gte.${from},fecha_agenda.lt.${to})`,
        order: 'fecha_agenda.asc',
        limit: 1000
      },
      timeout: 60000
    }
  );
  return response.data || [];
}

function describeMissing(rows, idsInOtherSource) {
  return rows
    .filter((row) => !idsInOtherSource.has(normalizeId(row.id)))
    .map((row) => ({
      id: row.id,
      ghlid: row.ghlid || null,
      nombre: row.nombre || null,
      fecha_agenda: row.fecha_agenda || null,
      origen_actual: row.origen_actual || null
    }));
}

async function main() {
  const from = process.argv[2] || '2026-09-01';
  const to = process.argv[3] || '2026-10-01';
  const notion = new NotionClient({
    auth: required('NOTION_API_KEY', process.env.NOTION_API_KEY),
    timeoutMs: 60000
  });
  const databaseId = process.env.NOTION_CRM_DATABASE_ID || DEFAULT_CRM_DATABASE_ID;

  console.log('Consultando septiembre en Notion y Supabase...');
  const notionPromise = fetchNotionRows(notion, databaseId, from, to)
    .then((result) => {
      console.log(`Notion: ${result.rows.length} agendas encontradas.`);
      return result;
    });
  const supabasePromise = fetchSupabaseRows(from, to)
    .then((rows) => {
      console.log(`Supabase: ${rows.length} agendas encontradas.`);
      return rows;
    });
  const [notionResult, supabaseRows] = await Promise.all([notionPromise, supabasePromise]);
  const notionRows = notionResult.rows;
  const notionStrict = notionRows.filter(strictCurrentOrigin);
  const supabaseStrict = supabaseRows.filter(strictCurrentOrigin);
  const notionIds = new Set(notionStrict.map((row) => normalizeId(row.id)));
  const supabaseIds = new Set(supabaseStrict.map((row) => normalizeId(row.id)));

  console.log(JSON.stringify({
    period: { from, to },
    notionDatePropertyType: notionResult.propertyType,
    notionPagesReturnedByApi: notionResult.queriedPages,
    notion: {
      totalWithAgendaDate: notionRows.length,
      withCurrentOrigin: notionStrict.length,
      withoutCurrentOrigin: notionRows.length - notionStrict.length
    },
    supabase: {
      totalWithAgendaDate: supabaseRows.length,
      withCurrentOrigin: supabaseStrict.length,
      withoutCurrentOrigin: supabaseRows.length - supabaseStrict.length
    },
    strictComparison: {
      matches: notionStrict.length === supabaseStrict.length &&
        notionIds.size === supabaseIds.size &&
        [...notionIds].every((id) => supabaseIds.has(id)),
      onlyInNotion: describeMissing(notionStrict, supabaseIds),
      onlyInSupabase: describeMissing(supabaseStrict, notionIds)
    }
  }, null, 2));
}

main().catch((error) => {
  console.error(error.body || error.response?.data || error.message || error);
  process.exit(1);
});
