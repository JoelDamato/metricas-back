// Read-only snapshot. Run twice and compare deltas; counters are cumulative.
require('dotenv').config({ quiet: true });
const query = `select jsonb_build_object(
 'captured_at',now(),
 'database',(select jsonb_build_object('stats_reset',stats_reset,'connections',numbackends,
   'disk_blocks_read',blks_read,'cache_blocks_hit',blks_hit,'temp_bytes',temp_bytes,
   'temp_files',temp_files,'deadlocks',deadlocks) from pg_stat_database where datname=current_database()),
 'top_io_queries',(select jsonb_agg(q) from (select queryid::text,calls,
   round(mean_exec_time::numeric,2) mean_ms,shared_blks_read,temp_blks_read,temp_blks_written,
   left(query,350) query from extensions.pg_stat_statements
   order by shared_blks_read+temp_blks_read+temp_blks_written desc limit 10)q),
 'active_queries',(select count(*) from pg_stat_activity where state='active' and pid<>pg_backend_pid())
 ) as audit;`;
async function main() {
  const { SUPABASE_URL, SUPABASE_ACCESS_TOKEN } = process.env;
  if (!SUPABASE_URL || !SUPABASE_ACCESS_TOKEN) throw new Error('Faltan SUPABASE_URL o SUPABASE_ACCESS_TOKEN');
  const ref = new URL(SUPABASE_URL).hostname.split('.')[0];
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, read_only: true }), signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(`Supabase respondió HTTP ${response.status}`);
  const data = await response.json();
  console.log(JSON.stringify(data[0].audit, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
