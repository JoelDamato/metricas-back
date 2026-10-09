require('dotenv').config();
require('dotenv').config({ path: '.env.local', override: true });

const axios = require('axios');
const { Client: NotionClient } = require('@notionhq/client');

const MODULE_FIELDS = [
  ['modulo_1', 'zINUgW2p2NQJVMn1PlfZ'],
  ['modulo_2', '3MagFWDne8XrSL8W9u6w'],
  ['modulo_3', 'q7wyIHL9y5zCoISZhHKX'],
  ['modulo_4', '4d9RolhqrPQtmOHm3W0T'],
  ['modulo_5', 'dq9W20Nl8QJXmSVrBO8H'],
  ['modulo_6', 'LKI5QvHtCMMYTtfh7F6O'],
  ['modulo_7', 'yQGgx1OeekXpJASOX83C'],
  ['modulo_8', '2psRGSev08EsxVlXBsln'],
  ['modulo_9', 'i4D3bIISKTXup8ePUbvp'],
  ['modulo_10', 'DDyAFGEH6asHzH6Z50tv']
];
const RECORDINGS_FIELD_ID = 'o1vA5kJbbqSI71qScofW';
const DEFAULT_NOTION_DATABASE_ID = '246482517a958045b90fef657d8831ff';

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Falta ${name}`);
  return value;
}

function dateOnly(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const match = text.match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0] || text;
}

function daySpan(startValue, endValue) {
  const start = Date.parse(`${dateOnly(startValue)}T00:00:00Z`);
  const end = Date.parse(`${dateOnly(endValue)}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.round((end - start) / 86400000);
}

function trafficLightSummary(rows, today = new Date()) {
  const todayValue = today.toISOString().slice(0, 10);
  const definitions = [
    { field: 'modulo_1', start: (row) => row.f_onboarding || row.f_acceso || row.f_pago_con_acceso, yellow: 7, red: 14 },
    { field: 'modulo_2', start: (row) => row.modulo_1, yellow: 14, red: 21 },
    { field: 'modulo_3', start: (row) => row.modulo_2, yellow: 14, red: 21 },
    { field: 'modulo_4', start: (row) => row.modulo_3, yellow: 7, red: 14 },
    { field: 'modulo_6', start: (row) => row.modulo_5, yellow: 14, red: 21 },
    { field: 'modulo_7', start: (row) => row.modulo_6, yellow: 14, red: 21 }
  ];
  return definitions.map((definition) => {
    const counts = { field: definition.field, started: 0, onTrack: 0, yellow: 0, red: 0 };
    rows.forEach((row) => {
      const startValue = definition.start(row);
      if (!hasValue(startValue)) return;
      const days = daySpan(startValue, row[definition.field] || todayValue);
      if (days === null) return;
      counts.started += 1;
      if (days >= definition.red) counts.red += 1;
      else if (days >= definition.yellow) counts.yellow += 1;
      else counts.onTrack += 1;
    });
    return counts;
  });
}

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function isAbandoned(row) {
  const value = String(row?.abandono || '').trim().toLowerCase();
  return ['true', '1', 'si', 'sí', 'yes', 'x'].includes(value);
}

function isActive(row) {
  return String(row?.acceso || '').trim().toLowerCase() === 'acceso' && !isAbandoned(row);
}

async function fetchSupabaseRows() {
  const url = `${required('SUPABASE_URL')}/rest/v1/csm`;
  const key = required('SUPABASE_SERVICE_ROLE_KEY');
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const select = [
    'id', 'ghlid', 'nombre', 'acceso', 'abandono', 'f_pago_con_acceso', 'f_onboarding',
    ...MODULE_FIELDS.map(([field]) => field)
  ].join(',');
  const rows = [];
  const size = 1000;
  for (let offset = 0; ; offset += size) {
    const response = await axios.get(url, {
      headers: { ...headers, Range: `${offset}-${offset + size - 1}` },
      params: { select, order: 'id.asc' },
      timeout: 30000
    });
    const batch = response.data || [];
    rows.push(...batch);
    if (batch.length < size) break;
  }
  return rows;
}

async function inspectSupabaseRecordingColumn() {
  const url = `${required('SUPABASE_URL')}/rest/v1/csm`;
  const key = required('SUPABASE_SERVICE_ROLE_KEY');
  try {
    await axios.get(url, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      params: { select: 'grabaciones_actividades', limit: 1 },
      timeout: 30000
    });
    return true;
  } catch (error) {
    if (error.response?.status === 400 && ['42703', 'PGRST204'].includes(error.response?.data?.code)) return false;
    throw error;
  }
}

async function inspectNotionRecordingProperties() {
  const notion = new NotionClient({ auth: required('NOTION_API_KEY') });
  const databaseId = process.env.NOTION_CSM_DATABASE_ID || process.env.NOTION_DATABASE_ID || DEFAULT_NOTION_DATABASE_ID;
  const database = await notion.databases.retrieve({ database_id: databaseId });
  return Object.entries(database.properties || {})
    .filter(([name]) => /grabaci/i.test(name))
    .map(([name, property]) => ({ name, type: property.type }));
}

function selectScope(rows) {
  const all = process.argv.includes('--all');
  const active = process.argv.includes('--active');
  const periodArg = process.argv.find((arg) => arg.startsWith('--period='));
  const period = periodArg?.slice('--period='.length) || '2026-09';
  if (all) return { label: 'all', rows };
  if (active) return { label: 'active', rows: rows.filter(isActive) };
  return {
    label: period,
    rows: rows.filter((row) => dateOnly(row.f_pago_con_acceso).startsWith(period) && !isAbandoned(row))
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchGhlContact(ghlid) {
  const baseUrl = required('GHL_BASE_URL').replace(/\/$/, '');
  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${required('GHL_API_KEY')}`,
    Version: process.env.GHL_API_VERSION || '2021-07-28'
  };
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await axios.get(`${baseUrl}/contacts/${encodeURIComponent(ghlid)}`, { headers, timeout: 30000 });
      return response.data?.contact || response.data || null;
    } catch (error) {
      lastError = error;
      const status = Number(error.response?.status || 0);
      if (![0, 408, 425, 429].includes(status) && status < 500) throw error;
      const retryAfter = Number(error.response?.headers?.['retry-after'] || 0) * 1000;
      await wait(retryAfter || Math.min(8000, 400 * (2 ** (attempt - 1))));
    }
  }
  throw lastError;
}

async function mapConcurrent(items, concurrency, mapper) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

function customFieldMap(contact) {
  return new Map((contact?.customFields || []).map((field) => [String(field.id || ''), field.value]));
}

async function main() {
  required('GHL_LOCATION_ID');
  const [allRows, notionRecordingProperties, supabaseRecordingColumn] = await Promise.all([
    fetchSupabaseRows(),
    inspectNotionRecordingProperties(),
    inspectSupabaseRecordingColumn()
  ]);
  const scope = selectScope(allRows);
  const rows = scope.rows.filter((row) => hasValue(row.ghlid));
  const failures = [];
  const contacts = await mapConcurrent(rows, 6, async (row) => {
    try {
      return { row, contact: await fetchGhlContact(row.ghlid) };
    } catch (error) {
      failures.push({
        nombre: row.nombre || 'Sin nombre',
        ghlid: row.ghlid,
        status: error.response?.status || null,
        message: error.response?.data?.message || error.message
      });
      return { row, contact: null };
    }
  });

  const moduleDifferences = [];
  const recordingsInGhl = [];
  let moduleValuesInGhl = 0;
  let moduleValuesInSupabase = 0;
  const moduleCounts = Object.fromEntries(MODULE_FIELDS.map(([field]) => [field, {
    field,
    ghlValues: 0,
    supabaseValues: 0,
    differences: 0
  }]));
  contacts.forEach(({ row, contact }) => {
    if (!contact) return;
    const fields = customFieldMap(contact);
    const recordingValue = fields.get(RECORDINGS_FIELD_ID);
    if (hasValue(recordingValue)) recordingsInGhl.push({ nombre: row.nombre || contact.name || 'Sin nombre', ghlid: row.ghlid });
    MODULE_FIELDS.forEach(([field, ghlFieldId]) => {
      const ghlValue = dateOnly(fields.get(ghlFieldId));
      const supabaseValue = dateOnly(row[field]);
      if (ghlValue) {
        moduleValuesInGhl += 1;
        moduleCounts[field].ghlValues += 1;
      }
      if (supabaseValue) {
        moduleValuesInSupabase += 1;
        moduleCounts[field].supabaseValues += 1;
      }
      if (ghlValue !== supabaseValue) {
        moduleCounts[field].differences += 1;
        moduleDifferences.push({
          nombre: row.nombre || contact.name || 'Sin nombre',
          ghlid: row.ghlid,
          field,
          ghl: ghlValue || null,
          supabase: supabaseValue || null
        });
      }
    });
  });

  console.log(JSON.stringify({
    mode: 'read-only',
    scope: scope.label,
    supabaseRowsTotal: allRows.length,
    scopeRows: scope.rows.length,
    scopeRowsWithGhlId: rows.length,
    ghlContactsRead: contacts.filter((item) => item.contact).length,
    ghlFailures: failures,
    recordings: {
      ghlContactsWithValue: recordingsInGhl.length,
      ghlContacts: recordingsInGhl,
      notionProperties: notionRecordingProperties,
      supabaseColumnExists: supabaseRecordingColumn
    },
    modules: {
      valuesInGhl: moduleValuesInGhl,
      valuesInSupabase: moduleValuesInSupabase,
      differences: moduleDifferences.length,
      byField: Object.values(moduleCounts),
      trafficLight: trafficLightSummary(scope.rows),
      rows: moduleDifferences
    }
  }, null, 2));
}

main().catch((error) => {
  console.error(error.response?.data || error.message);
  process.exitCode = 1;
});
