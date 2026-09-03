require('dotenv').config();

const axios = require('axios');
const { Client: NotionClient } = require('@notionhq/client');
const leadsWebhook = require('../controllers/webhooksheets2');
const comprobantesWebhook = require('../controllers/webhookcom');

const period = String(process.argv[2] || '').trim();
const shouldApply = process.env.APPLY === '1';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta ${name}`);
  return value;
}

function periodBounds(value) {
  const fromMatch = value.match(/^from:(\d{4}-\d{2}-\d{2})$/);
  if (fromMatch) {
    return { from: fromMatch[1], to: null };
  }
  if (!/^\d{4}-\d{2}$/.test(value)) {
    throw new Error('El período debe tener formato YYYY-MM o from:YYYY-MM-DD');
  }
  const [year, monthNumber] = value.split('-').map(Number);
  const nextMonth = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);
  return { from: `${value}-01`, to: nextMonth };
}

async function fetchSupabaseIds(table, dateField, bounds) {
  const ids = [];
  const pageSize = 1000;
  let offset = 0;
  do {
    const params = {
      select: 'id',
      limit: pageSize,
      offset
    };
    if (bounds.to) {
      params.and = `(${dateField}.gte.${bounds.from},${dateField}.lt.${bounds.to})`;
    } else {
      params[dateField] = `gte.${bounds.from}`;
    }
    const response = await axios.get(`${required('SUPABASE_URL')}/rest/v1/${table}`, {
      headers: headers(),
      params,
      timeout: 60000
    });
    const rows = response.data || [];
    ids.push(...rows.map((row) => row.id).filter(Boolean));
    if (rows.length < pageSize) break;
    offset += pageSize;
  } while (true);
  return [...new Set(ids)];
}

async function fetchNotionPages(notion, ids, label) {
  const pages = new Array(ids.length);
  let cursor = 0;
  let completed = 0;
  const workers = Array.from({ length: Math.min(4, ids.length) }, async () => {
    while (cursor < ids.length) {
      const index = cursor;
      cursor += 1;
      pages[index] = await notion.pages.retrieve({ page_id: ids[index] });
      completed += 1;
      if (completed % 25 === 0 || completed === ids.length) {
        console.log(`${label} desde Notion: ${completed}/${ids.length}`);
      }
    }
  });
  await Promise.all(workers);
  return pages;
}

function headers() {
  const key = required('SUPABASE_SERVICE_ROLE_KEY');
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal'
  };
}

async function upsertRows(table, rows) {
  const chunkSize = 50;
  const groups = new Map();
  rows.forEach((row) => {
    const signature = Object.keys(row).sort().join('|');
    const group = groups.get(signature) || [];
    group.push(row);
    groups.set(signature, group);
  });

  let completed = 0;
  for (const group of groups.values()) {
    for (let index = 0; index < group.length; index += chunkSize) {
      const chunk = group.slice(index, index + chunkSize);
      await axios.post(
        `${required('SUPABASE_URL')}/rest/v1/${table}`,
        chunk,
        { headers: headers(), params: { on_conflict: 'id' }, timeout: 60000 }
      );
      completed += chunk.length;
      console.log(`${table}: ${completed}/${rows.length}`);
    }
  }
}

async function main() {
  const bounds = periodBounds(period);
  const notion = new NotionClient({ auth: required('NOTION_API_KEY'), timeoutMs: 120000 });
  const [comprobanteIds, leadIds] = await Promise.all([
    fetchSupabaseIds('comprobantes', 'f_acreditacion', bounds),
    fetchSupabaseIds('leads_raw', 'fecha_agenda', bounds)
  ]);
  console.log(JSON.stringify({ period, comprobanteIds: comprobanteIds.length, agendaIds: leadIds.length }));

  const comprobantePages = await fetchNotionPages(notion, comprobanteIds, 'Comprobantes');
  const leadPages = await fetchNotionPages(notion, leadIds, 'Agendas');

  const comprobantes = comprobantePages.map((page) => comprobantesWebhook.mapToSupabase(page));
  const leads = leadPages.map((page) => leadsWebhook.mapToSupabase(page));
  const summary = {
    period,
    mode: shouldApply ? 'apply' : 'dry-run',
    comprobantes: comprobantes.length,
    comprobantesWithCurrentOrigin: comprobantes.filter((row) => row.origen_actual).length,
    agendas: leads.length,
    agendasWithCurrentOrigin: leads.filter((row) => row.origen_actual).length
  };

  console.log(JSON.stringify(summary, null, 2));
  if (!shouldApply) return;

  await upsertRows('comprobantes', comprobantes);
  await upsertRows('leads_raw', leads);
  console.log(JSON.stringify({ ...summary, completed: true }, null, 2));
}

main().catch((error) => {
  console.error(error.response?.data || error.body || error.message);
  process.exitCode = 1;
});
