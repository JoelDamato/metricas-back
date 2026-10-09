const axios = require('axios');
const env = require('../config/env');
const direct = require('./comprobantes-direct.service');
const META = '\nTEST_METADATA=';
const CONFIG_BUCKET = 'comprobantes-test-local'; // Keep the saved catalog; no historical file migration.
const metadata = row => { try { return JSON.parse(String(row?.info_comprobantes || '').split(META)[1] || 'null'); } catch { return null; } };
const headers = extra => ({ apikey: env.supabaseKey, Authorization: `Bearer ${env.supabaseKey}`, ...extra });
const enabled = () => true;
const testMode = () => process.env.COMPROBANTES_LOCAL_REAL_TEST === '1' && process.env.NODE_ENV !== 'production';
const bucket = () => direct.getSafetyStatus().storageBucket;
const pending = new Map();
const buckets = new Map();
let schemaPromise;
let configCache;
const read = async (table, params) => (await axios.get(`${env.supabaseUrl}/rest/v1/${table}`, {headers:headers(),params,timeout:30000})).data;
async function rpc(action, payload) {
  try { return (await axios.post(`${env.supabaseUrl}/rest/v1/rpc/metricas_comprobantes_write_v2`, {p_action:action,p_payload:payload}, {headers:headers(),timeout:45000})).data; }
  catch (error) { const e=new Error(error.response?.data?.message || error.message);e.statusCode=error.response?.status===400?409:(error.response?.status || 502);throw e; }
}
async function schema(actorEmail) {
 if(!schemaPromise) schemaPromise=rpc('schema',{actorEmail}).catch(e=>{schemaPromise=null;throw e;});
 return schemaPromise;
}
function projectRow(row, columns) {
 return Object.fromEntries(columns.filter(c=>row[c.column_name]!==undefined).map(c=>[c.column_name,row[c.column_name]!=null&&c.data_type==='text'?String(row[c.column_name]):row[c.column_name]]));
}
async function ensureBucket(name) {
 if (!buckets.has(name)) buckets.set(name,(async()=>{
  const data=(await axios.get(`${env.supabaseUrl}/storage/v1/bucket`,{headers:headers()})).data;
  if(!data.some(b=>b.id===name)) await axios.post(`${env.supabaseUrl}/storage/v1/bucket`,{id:name,name,public:false,file_size_limit:20971520},{headers:headers()});
 })().catch(e=>{buckets.delete(name);throw e;}));
 return buckets.get(name);
}
const repository = {
 async getConfig({fresh=false}={}) {
  if(!fresh && configCache && configCache.until>Date.now()) return structuredClone(configCache.value);
  let data;
  try {data=(await axios.get(`${env.supabaseUrl}/storage/v1/object/authenticated/${CONFIG_BUCKET}/configuration/catalog.json`,{headers:headers(),params:{v:Date.now()},timeout:15000})).data;}
  catch(error){const message=String(error.response?.data?.message || '');if(![400,404].includes(error.response?.status)||!/not found|does not exist/i.test(message))throw error;
   data={products:direct._test.DEFAULT_PRODUCTS,paymentMethods:direct._test.DEFAULT_PAYMENT_METHODS,responsiblePeople:direct._test.DEFAULT_RESPONSIBLE_PEOPLE,rules:direct._test.DEFAULT_RULES};}
  const config={...direct._test.validateConfig(data),migrationReady:true};config.rules.commissionBaseFromPaymentMethod=true;
  configCache={value:config,until:Date.now()+30000};return structuredClone(config);
 },
 async getLead(ghlid){return (await read('leads_raw',{ghlid:`eq.${ghlid}`,select:'*',order:'last_edited_time.desc.nullslast',limit:1}))[0]||null;},
 async getLeadById(id){return(await read('leads_raw',{id:`eq.${id}`,select:'*',limit:1}))[0]||null;},
 async getCsm(ghlid){return(await read('csm',{ghlid:`eq.${ghlid}`,select:'*',limit:1}))[0]||null;},
 async getSale(id,ghlid){return(await read('comprobantes',{select:'*',tipo:'eq.Venta',...(id?{id:`eq.${id}`}:{ghlid:`eq.${ghlid}`,order:'f_venta.desc.nullslast,fecha_creado.desc.nullslast'}),limit:1}))[0]||null;},
 async getComprobante(id){return(await read('comprobantes',{id:`eq.${id}`,select:'*',limit:1}))[0]||null;},
 async getSubmission(key){const row=(await read('comprobantes_operaciones_v2',{submission_key:`eq.${key}`,select:'actor_email,result',limit:1}))[0];return row?{status:'completed',actorEmail:row.actor_email,...row.result}:null;},
 async stageFiles(files,actorEmail){await rpc('stage_files',{files,actorEmail});},
 async uploadFile(name,objectPath,file){await ensureBucket(name);return(await axios.post(`${env.supabaseUrl}/storage/v1/object/${name}/${objectPath.split('/').map(encodeURIComponent).join('/')}`,Buffer.from(file.base64,'base64'),{headers:headers({'Content-Type':file.type,'x-upsert':'false'}),maxBodyLength:Infinity,timeout:60000})).data;},
 async removeFiles(name,paths){await axios.delete(`${env.supabaseUrl}/storage/v1/object/${name}`,{headers:headers(),data:{prefixes:paths},timeout:30000});
  for(const object_path of paths) await rpc('cleanup_finish',{actorEmail:'storage-worker@internal',bucket:name,object_path,success:true});},
 async enqueueFileCleanup(files,context){await rpc('cleanup_enqueue',{actorEmail:context.actorEmail||'storage-worker@internal',files});return {queued:files.length};},
 async createBatch(payload){
  const columns=await schema(payload.actorEmail);
  const sale=payload.rows.some(r=>r.tipo==='Venta')?null:await repository.getSale(payload.rows[0].venta_relacionada);
  const rows=payload.rows.map((r,i)=>projectRow({...r,
   cliente_format:testMode()?`[TEST] ${r.cliente_format}`:r.cliente_format,
   producto_format:r.producto_format||sale?.producto_format||null,productos:r.productos||sale?.productos||null,
   info_comprobantes:`${testMode()?'[TEST SUPABASE LOCAL]':'[SUPABASE DIRECT]'} ${payload.submissionKey} | ${r.info_comprobantes}`+META+JSON.stringify({mode:testMode()?'local_real_test':'supabase_direct',actorEmail:payload.actorEmail,submissionKey:payload.submissionKey,batchId:payload.batchId,files:payload.files.filter(f=>f.operationIndex===i)})
  },columns));
  const result=await rpc('create',{...payload,rows});invalidateContact();return result;
 },
 async updateComprobante({id,patch,actorEmail,expectedRow,resubmit}){
  const before=expectedRow||await repository.getComprobante(id);const meta=metadata(before)||{mode:'supabase_direct',actorEmail,files:[],legacy:true};
  const prefix=metadata(before)?String(before.info_comprobantes).split(' |')[0]:`[SUPABASE DIRECT] legacy-${id}`;
  patch.info_comprobantes=prefix+' | '+String(patch.info_comprobantes||'').split(META)[0].replace(/^\[(TEST SUPABASE LOCAL|SUPABASE DIRECT)\] [^|]+\|\s*/,'')+META+JSON.stringify(meta);
  if(/club/i.test(patch.producto_format||before.producto_format||''))patch.neto_club=Math.max(0,Number(patch.cash_ar)-Number(patch.iva)-Number(patch.comisiones));
  const result=await rpc('edit',{id,actorEmail,resubmit,expectedRow:before,patch:projectRow(patch,await schema(actorEmail))});invalidateContact();return result;
 },
 async deleteComprobante({id,actorEmail,expectedRow}){const result=await rpc('delete',{id,actorEmail,expectedRow,files:await repository.listFiles(id)});invalidateContact();return result;},
 async listFiles(id){const row=await repository.getComprobante(id);return(metadata(row)?.files||[]).map((f,i)=>({id:`${id}-${i}`,original_name:f.name,mime_type:f.mimeType,size_bytes:f.sizeBytes,bucket:f.bucket||CONFIG_BUCKET,object_path:f.objectPath}));},
 async signFile(name,objectPath){const {data}=await axios.post(`${env.supabaseUrl}/storage/v1/object/sign/${encodeURIComponent(name)}/${objectPath.split('/').map(encodeURIComponent).join('/')}`,{expiresIn:600},{headers:headers()});const url=data.signedURL||data.signedUrl;return /^https?:/.test(url)?url:`${env.supabaseUrl}/storage/v1${url}`;}
};
function invalidateContact(){require('../../../controllers/contactStatus').invalidateCache?.();}
const options=()=>({repository,allowOperationalUser:true,bypassSafety:true});
async function getBootstrap(user){return {...await direct.getBootstrap(user,options()),localRealTest:testMode(),localDirect:true,productsSource:'supabase',reconciliationRequired:true};}
async function create(payload,user,extra={}){
 const key=String(user?.email||'').trim().toLowerCase()+':'+String(payload.submissionKey||'');if(pending.has(key))return pending.get(key);
 const work=(async()=>{const config=await repository.getConfig({fresh:true});return direct.create(payload,user,{...options(),config,allowMissingAttachments:false,...extra});})();pending.set(key,work);
 try{return await work;}finally{pending.delete(key);}
}
async function getConfig(user){if(!direct.canAccessLab(user)){const e=new Error('Sin permiso para configurar las cargas');e.statusCode=403;throw e;}return {...await repository.getConfig(),source:'supabase',safety:{dryRunOnly:false}};}
async function saveConfig(config,user){await getConfig(user);const validated=direct._test.validateConfig(config);await ensureBucket(CONFIG_BUCKET);await axios.post(`${env.supabaseUrl}/storage/v1/object/${CONFIG_BUCKET}/configuration/catalog.json`,JSON.stringify(validated),{headers:headers({'Content-Type':'application/json','x-upsert':'true'})});configCache=null;return {config:await getConfig(user)};}
async function reconcile(id,state,user,reason){reason=String(reason||'').trim();if(state==='bounced'&&(!reason||reason.length>1000)){const e=new Error('Indicá el motivo del rebote (hasta 1000 caracteres)');e.statusCode=400;throw e;}if(!['conciliated','not_conciliated','bounced'].includes(state)){const e=new Error('Estado inválido');e.statusCode=400;throw e;}const result=await rpc('reconcile',{id,state,reason,actorEmail:user.email});invalidateContact();return {...result,state,message:'Estado y saldos actualizados en Supabase'};}
async function cleanupQueue(user,retry=false){await getConfig(user);return retry?retryCleanup(user.email):{rows:await read('comprobantes_cleanup_v2',{select:'*',order:'created_at.asc',limit:100})};}
async function retryCleanup(actorEmail='storage-worker@internal'){
 const rows=await rpc('cleanup_claim',{actorEmail});let completed=0,failed=0;
 for(const row of rows){try{await repository.removeFiles(row.bucket,[row.object_path]);completed++;}catch(error){await rpc('cleanup_finish',{actorEmail,bucket:row.bucket,object_path:row.object_path,success:false,error:error.message});failed++;}}
 return{completed,failed};
}
async function preview(payload,user){const config=await repository.getConfig({fresh:true});const result=await direct.preview(payload,user,{...options(),config,allowMissingAttachments:true});
 const lead=await repository.getLead(payload.ghlId);const {listContactReceipts,totals,cashWithoutIva}=require('./comprobantes-contacto.service');const current=totals(await listContactReceipts(payload.ghlId,[lead.id],{url:env.supabaseUrl,key:env.supabaseKey}));const billed=Number(result.rows[0]?.facturacion||0),cash=result.rows.reduce((n,r)=>n+cashWithoutIva(r),0);return {...result,financialPreview:{balanceBefore:current.saldo,balanceAfterPending:current.saldo+(payload.tipo==='Venta'?billed:0),balanceAfterConciliation:current.saldo+(payload.tipo==='Venta'?billed:payload.tipo==='Devolución'?-billed:0)+(payload.tipo==='Devolución'?cash:-cash),cashArs:result.rows.reduce((n,r)=>n+Number(r.cash_ar||0),0),ivaArs:result.rows.reduce((n,r)=>n+Number(r.iva||0),0),feesArs:result.rows.reduce((n,r)=>n+Number(r.comisiones||0),0),netArs:result.rows.reduce((n,r)=>n+Number(r.cash_ar||0)-Number(r.iva||0)-Number(r.comisiones||0),0),pending:true,relatedSaleId:result.relatedSaleId}};
}
module.exports={enabled,getBootstrap,getConfig,saveConfig,create,preview,reconcile,cleanupQueue,retryCleanup,
 lookupClient:(id,user)=>direct.lookupClient(id,user,options()),lookupRelatedSale:(id,expected,user)=>direct.lookupRelatedSale(id,expected,user,options()),
 getEditable:async(id,user)=>{const data=await direct.getEditableComprobante(id,user,options());data.infoComprobantes=String(data.infoComprobantes||'').split(META)[0].replace(/^\[(TEST SUPABASE LOCAL|SUPABASE DIRECT)\] [^|]+\|\s*/,'');return data;},
 updateEditable:(id,payload,user)=>direct.updateEditableComprobante(id,payload,user,options()),deleteEditable:(id,user)=>direct.deleteEditableComprobante(id,user,options()),
 listFiles:(id,user)=>direct.listSignedFiles(id,user,options()),owns:async id=>/^\[(TEST SUPABASE LOCAL|SUPABASE DIRECT)\]/.test(String((await repository.getComprobante(id))?.info_comprobantes||'')),
 _test:{repository,rpc,metadata,projectRow}
};
