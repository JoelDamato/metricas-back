require('dotenv').config();

const axios = require('axios');
const { Client: NotionClient } = require('@notionhq/client');
const { mapToSupabase } = require('../controllers/webhooksheets2');

const DEFAULT_CRM_DATABASE_ID = '24648251-7a95-80ba-8a16-d978f21365e1';
const DEFAULT_SINCE = '2026-09-13T00:00:00Z';
const PAGE_SIZE = 100;
const UPSERT_CHUNK_SIZE = 50;

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta ${name}`);
  return value;
}

function normalizeSince(value) {
  const date = new Date(value || DEFAULT_SINCE);
  if (Number.isNaN(date.getTime())) {
    throw new Error('La fecha inicial debe ser un ISO válido, por ejemplo 2026-09-13T00:00:00Z');
  }
  return date.toISOString();
}

function supabaseHeaders() {
  const key = required('SUPABASE_SERVICE_ROLE_KEY');
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal'
  };
}

async function fetchChangedPages(notion, databaseId, since, options = {}) {
  const pages = [];
  const maxPages = Number(options.maxPages || 0);
  let cursor;
  let requestCount = 0;

  do {
    const response = await notion.databases.query({
      database_id: databaseId,
      page_size: PAGE_SIZE,
      start_cursor: cursor,
      filter: {
        timestamp: 'last_edited_time',
        last_edited_time: { on_or_after: since }
      },
      sorts: [{ timestamp: 'last_edited_time', direction: 'ascending' }]
    });

    pages.push(...response.results);
    requestCount += 1;
    console.log(`Notion CRM: ${pages.length} páginas leídas`);

    if (maxPages > 0 && requestCount >= maxPages) break;
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  return pages;
}

async function upsertRows(rows) {
  const url = `${required('SUPABASE_URL')}/rest/v1/leads_raw`;
  let completed = 0;

  for (let index = 0; index < rows.length; index += UPSERT_CHUNK_SIZE) {
    const chunk = rows.slice(index, index + UPSERT_CHUNK_SIZE);
    await axios.post(url, chunk, {
      headers: supabaseHeaders(),
      params: { on_conflict: 'id' },
      timeout: 60000
    });
    completed += chunk.length;
    console.log(`Supabase leads_raw: ${completed}/${rows.length}`);
  }
}

async function verifyRows(ids) {
  const url = `${required('SUPABASE_URL')}/rest/v1/leads_raw`;
  const found = new Set();

  for (let index = 0; index < ids.length; index += 100) {
    const chunk = ids.slice(index, index + 100);
    const response = await axios.get(url, {
      headers: supabaseHeaders(),
      params: {
        select: 'id',
        id: `in.(${chunk.join(',')})`
      },
      timeout: 60000
    });
    (response.data || []).forEach((row) => found.add(row.id));
  }

  return ids.filter((id) => !found.has(id));
}

async function main() {
  const since = normalizeSince(process.argv[2]);
  const shouldApply = process.env.APPLY === '1';
  const maxPages = Number(process.env.MAX_PAGES || 0);
  const databaseId = process.env.NOTION_CRM_DATABASE_ID || DEFAULT_CRM_DATABASE_ID;
  const notion = new NotionClient({
    auth: required('NOTION_API_KEY'),
    timeoutMs: 60000
  });

  const pages = await fetchChangedPages(notion, databaseId, since, { maxPages });
  const rows = pages.map(mapToSupabase).filter((row) => row.id);
  const summary = {
    mode: shouldApply ? 'apply' : 'dry-run',
    since,
    pages: pages.length,
    rows: rows.length,
    oldestEdit: pages[0]?.last_edited_time || null,
    newestEdit: pages.at(-1)?.last_edited_time || null,
    limited: maxPages > 0
  };

  console.log(JSON.stringify(summary, null, 2));
  if (!shouldApply || rows.length === 0) return summary;

  await upsertRows(rows);
  const missingIds = await verifyRows(rows.map((row) => row.id));
  const result = { ...summary, completed: true, missing: missingIds.length };
  console.log(JSON.stringify(result, null, 2));

  if (missingIds.length > 0) {
    throw new Error(`La verificación encontró ${missingIds.length} IDs ausentes en Supabase`);
  }

  return result;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.response?.data || error.body || error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  normalizeSince,
  fetchChangedPages,
  upsertRows,
  verifyRows,
  main
};
