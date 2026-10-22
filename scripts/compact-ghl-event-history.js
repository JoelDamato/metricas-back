// Production maintenance: install migration first. Default is read-only.
require('dotenv').config();
const axios=require('axios');
const tables=['leads_ghl_events','csm_ghl_events'];
const ref=new URL(process.env.SUPABASE_URL).hostname.split('.')[0];
async function query(sql){return (await axios.post(`https://api.supabase.com/v1/projects/${ref}/database/query`,{query:sql},{headers:{Authorization:`Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`},timeout:150000})).data;}
async function report(){console.log(JSON.stringify(await query(`select pg_size_pretty(pg_database_size(current_database())) database_size,relname,pg_size_pretty(pg_total_relation_size(relid)) size,n_live_tup from pg_stat_user_tables where relname in ('leads_ghl_events','csm_ghl_events','leads_raw','csm','comprobantes') order by relname`)));}
async function main(){
 await report();
 if(!process.argv.includes('--compact'))return;
 for(const table of tables){
  let total=0;
  while(true){
   const result=await query(`set lock_timeout='3s';set statement_timeout='30s';with batch as(select id from public.${table} where payload_sha256 is null or payload<>'{}'::jsonb or mapped_patch<>'{}'::jsonb or before_row is not null or after_row is not null order by id limit 250 for update),changed as(update public.${table} e set payload=e.payload from batch where e.id=batch.id returning e.id) select count(*)::int compacted from changed`);
   const n=result[0].compacted;total+=n;
   if(total%2500===0||n<250)console.log(table,'compacted',total);
   if(n===0)break;
  }
 }
 await report();
}
main().catch(e=>{console.error(e.response?.data?.message||e.response?.data||e.message);process.exitCode=1});
