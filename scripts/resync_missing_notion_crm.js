// Replays missing CRM records only; existing rows are never overwritten.
require('dotenv').config();
require('dotenv').config({ path: '.env.local', override: true });
const axios = require('axios');
const fs = require('node:fs');
const path = require('node:path');
const { mapToSupabase } = require('../controllers/webhooksheets2');

async function main() {
  const since = '2026-09-25T03:00:00.000Z';
  const until = new Date().toISOString();
  const apply = process.argv.includes('--apply');
  for (const key of ['NOTION_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (!process.env[key]) throw new Error(`Missing ${key}`);
  }
  const notionHeaders = { Authorization: `Bearer ${process.env.NOTION_API_KEY}`, 'Notion-Version': '2022-06-28' };
  const supabaseHeaders = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` };
  const database = '24648251-7a95-80ba-8a16-d978f21365e1';
  const endpoint = `${process.env.SUPABASE_URL}/rest/v1/leads_raw`;
  const pages = [];
  let cursor;
  do {
    const { data } = await axios.post(`https://api.notion.com/v1/databases/${database}/query`, {
      page_size: 100, start_cursor: cursor,
      filter: { and: [
        { timestamp: 'last_edited_time', last_edited_time: { on_or_after: since } },
        { timestamp: 'last_edited_time', last_edited_time: { on_or_before: until } }
      ] },
      sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }]
    }, { headers: notionHeaders, timeout: 45000 });
    pages.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
    console.log(`Notion: ${pages.length} fichas revisadas`);
  } while (cursor);
  const rows = pages.filter(p => !p.archived && p.last_edited_time >= since && p.last_edited_time <= until).map(mapToSupabase);
  const queryRows = async (field, values) => {
    const found = [];
    const unique = [...new Set(values.filter(Boolean))];
    for (let i = 0; i < unique.length; i += 60) {
      const { data } = await axios.get(endpoint, {
        headers: supabaseHeaders,
        params: { select: 'id,ghlid,nombre', [field]: `in.(${unique.slice(i, i + 60).join(',')})`, limit: 1000 },
        timeout: 30000
      });
      found.push(...data);
    }
    return found;
  };
  const present = new Set((await queryRows('id', rows.map(r => r.id))).map(r => r.id));
  const absent = rows.filter(r => !present.has(r.id));
  const existingGhlIds = new Set((await queryRows('ghlid', absent.map(r => r.ghlid))).map(r => r.ghlid));
  const targets = absent.filter(r => r.id && r.ghlid && !existingGhlIds.has(r.ghlid));
  const report = {
    since, until, apply, checked: rows.length, alreadyPresent: present.size,
    skippedDifferentIdOrMissingGhlId: absent.length - targets.length,
    targets: targets.map(r => ({ id: r.id, ghlid: r.ghlid, nombre: r.nombre })),
    insertedIds: [], verified: false
  };
  const reportPath = path.join(__dirname, '../tmp', `crm-missing-replay-${Date.now()}.json`);
  const save = () => fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  save();
  console.log(JSON.stringify({ checked: rows.length, alreadyPresent: present.size, missing: targets.length, skipped: report.skippedDifferentIdOrMissingGhlId, reportPath }));
  if (!apply) return;
  for (let i = 0; i < targets.length; i += 40) {
    const batch = targets.slice(i, i + 40);
    const { data } = await axios.post(endpoint, batch, {
      headers: { ...supabaseHeaders, Prefer: 'resolution=ignore-duplicates,return=representation' },
      params: { on_conflict: 'id', select: 'id' }, timeout: 45000
    });
    report.insertedIds.push(...data.map(r => r.id));
    save();
    console.log(`Reenvío: ${Math.min(i + 40, targets.length)}/${targets.length}`);
  }
  const verified = await queryRows('id', targets.map(r => r.id));
  const verifiedById = new Map(verified.map(r => [r.id, r]));
  report.remainingMissing = targets.filter(r => !verifiedById.has(r.id)).map(r => r.id);
  report.identityMismatch = targets.filter(r => verifiedById.has(r.id) && verifiedById.get(r.id).ghlid !== r.ghlid).map(r => r.id);
  report.verified = !report.remainingMissing.length && !report.identityMismatch.length;
  save();
  console.log(JSON.stringify({ inserted: report.insertedIds.length, verifiedContacts: verified.length, remainingMissing: report.remainingMissing.length, identityMismatch: report.identityMismatch.length, reportPath }));
  if (!report.verified) throw new Error('La verificación final detectó diferencias; consultar el informe');
}

main().catch(e => { console.error(e.response?.data || e.message); process.exitCode = 1; });
