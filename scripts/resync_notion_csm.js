require('dotenv').config();

const axios = require('axios');
const { Client: NotionClient } = require('@notionhq/client');
const { mapToSupabase } = require('../controllers/webhookcsm')._test;

const DEFAULT_CSM_DATABASE_ID = '246482517a958045b90fef657d8831ff';
const databaseId = process.env.NOTION_CSM_DATABASE_ID
  || process.env.NOTION_DATABASE_ID
  || DEFAULT_CSM_DATABASE_ID;
const applyChanges = process.argv.includes('--apply');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const notionKey = process.env.NOTION_API_KEY;

function assertConfig(name, value) {
  if (!value) throw new Error(`Falta ${name}`);
}

function titleOf(page) {
  const title = Object.values(page?.properties || {}).find((property) => property?.type === 'title');
  return (title?.title || []).map((part) => part.plain_text || '').join('').trim() || 'Sin título';
}

function isAnonymousCloser(value) {
  const normalized = String(value || '').trim().toLocaleLowerCase('es');
  return !normalized || ['anonymous', 'anonimo', 'anónimo'].includes(normalized);
}

function comparable(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean' || typeof value === 'number') return value;
  const text = String(value).trim();
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return Number(text);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const timestamp = new Date(text).getTime();
    if (!Number.isNaN(timestamp)) return timestamp;
  }
  return text;
}

function changedFields(expected, current) {
  if (!current) return Object.keys(expected).filter((key) => key !== 'id');
  return Object.keys(expected).filter((key) => {
    if (key === 'id') return false;
    if (key === 'closer' && isAnonymousCloser(expected[key]) && !isAnonymousCloser(current[key])) {
      return false;
    }
    if (key === 'activos') {
      return Boolean(Number(expected[key])) !== Boolean(current[key]);
    }
    return comparable(expected[key]) !== comparable(current[key]);
  });
}

async function fetchAllNotionPages(notion) {
  const pages = [];
  let cursor;
  do {
    const response = await notion.databases.query({
      database_id: databaseId,
      page_size: 100,
      start_cursor: cursor
    });
    pages.push(...response.results);
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);
  return pages;
}

async function fetchAllSupabaseRows() {
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const response = await axios.get(`${supabaseUrl}/rest/v1/csm`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Range: `${offset}-${offset + pageSize - 1}`
      },
      params: { select: '*', order: 'id.asc' }
    });
    const batch = response.data || [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

function buildDiff(pages, rows) {
  const currentById = new Map(rows.map((row) => [row.id, row]));
  return pages.map((page) => {
    const expected = mapToSupabase({ data: page });
    const current = currentById.get(page.id) || null;
    return {
      page,
      expected,
      current,
      name: titleOf(page),
      missing: !current,
      fields: changedFields(expected, current)
    };
  }).filter((item) => item.missing || item.fields.length);
}

function prepareUpsertRow(item) {
  const row = { ...item.expected };
  if (isAnonymousCloser(row.closer) && !isAnonymousCloser(item.current?.closer)) {
    row.closer = item.current.closer;
  }
  return row;
}

function chunk(items, size) {
  const groups = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
}

async function upsertBatch(rows) {
  return axios.post(`${supabaseUrl}/rest/v1/csm`, rows, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    params: { on_conflict: 'id' },
    timeout: 30000
  });
}

async function main() {
  assertConfig('NOTION_API_KEY', notionKey);
  assertConfig('SUPABASE_URL', supabaseUrl);
  assertConfig('SUPABASE_SERVICE_ROLE_KEY', supabaseKey);

  const notion = new NotionClient({ auth: notionKey });
  const database = await notion.databases.retrieve({ database_id: databaseId });
  const databaseTitle = (database.title || []).map((part) => part.plain_text || '').join('').trim();
  const pages = await fetchAllNotionPages(notion);
  const beforeRows = await fetchAllSupabaseRows();
  const differences = buildDiff(pages, beforeRows);

  console.log(JSON.stringify({
    mode: applyChanges ? 'apply' : 'dry-run',
    databaseId,
    databaseTitle,
    notionRows: pages.length,
    supabaseRows: beforeRows.length,
    rowsToUpsert: differences.length,
    missingRows: differences.filter((item) => item.missing).length,
    sample: differences.slice(0, 30).map((item) => ({
      name: item.name,
      missing: item.missing,
      fields: item.fields
    }))
  }, null, 2));

  if (!applyChanges || !differences.length) return;

  const batches = chunk(differences.map(prepareUpsertRow), 50);
  for (let index = 0; index < batches.length; index += 1) {
    await upsertBatch(batches[index]);
    console.log(`Lote CSM ${index + 1}/${batches.length} guardado (${batches[index].length} filas)`);
  }

  const afterRows = await fetchAllSupabaseRows();
  const remaining = buildDiff(pages, afterRows);
  console.log(JSON.stringify({
    applied: differences.length,
    batches: batches.length,
    supabaseRowsAfter: afterRows.length,
    remainingDifferences: remaining.map((item) => ({
      name: item.name,
      missing: item.missing,
      fields: item.fields
    }))
  }, null, 2));

  if (remaining.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.response?.data || error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  comparable,
  changedFields,
  buildDiff,
  prepareUpsertRow,
  chunk
};
