// Lossless, resumable normalization. Every row is compared before/after by SQL.
require('dotenv').config({quiet:true});
async function main(){
 const ref=new URL(process.env.SUPABASE_URL).hostname.split('.')[0];
 for(const source of ['csm_ghl_contacts','leads_ghl_contacts']){
  let total=0;
  for(let batch=0;batch<1000;batch++){
   const started=Date.now();
   const response=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+process.env.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query:`set statement_timeout='20s'; select public.compact_ghl_catalog_batch('${source}',25) as compacted;`,read_only:false}),signal:AbortSignal.timeout(30000)});
   const data=await response.json();if(!response.ok)throw Error(data.message||`HTTP ${response.status}`);
   const count=data[0]?.compacted;if(!Number.isInteger(count))throw Error('Unexpected batch response');total+=count;
   if(batch%5===0||count===0)console.log(JSON.stringify({source,batch,total,lastCount:count,ms:Date.now()-started}));
   if(count===0)break;
   if(batch===999)throw Error('Batch safety limit reached; rerun to resume');
   await new Promise(resolve=>setTimeout(resolve,100));
  }
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
