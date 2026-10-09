// Opt-in local real-data trial. Uses the existing schema; no DDL or Notion calls.
const axios = require('axios');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const direct = require('./comprobantes-direct.service');
const env = require('../config/env');
const testMode = () => process.env.COMPROBANTES_LOCAL_REAL_TEST === '1';
const PREFIX = process.env.COMPROBANTES_LOCAL_DIRECT === '1' ? '[SUPABASE DIRECT]' : '[TEST SUPABASE LOCAL]';
const { buildMutation } = require('./comprobantes-local-mutations');
const BUCKET = 'comprobantes-test-local';
const META = '\nTEST_METADATA=';
const pending = new Map();
const auditRoot = process.env.COMPROBANTES_LOCAL_AUDIT_DIR || path.join(__dirname,'../../../tmp/comprobantes-real-test');
function enabled() { return (process.env.COMPROBANTES_LOCAL_REAL_TEST === '1' || process.env.COMPROBANTES_LOCAL_DIRECT === '1') && process.env.NODE_ENV !== 'production'; }
function assertEnabled() { if (!enabled()) throw new Error('El modo TEST local no está habilitado'); }
function headers(extra = {}) { return { apikey: env.supabaseKey, Authorization: `Bearer ${env.supabaseKey}`, ...extra }; }
function literal(value) { return "'" + String(value).replace(/'/g, "''") + "'"; }
async function sql(query) {
  assertEnabled();
  if (!process.env.SUPABASE_ACCESS_TOKEN) throw new Error('Falta SUPABASE_ACCESS_TOKEN para la transacción TEST');
  const ref = new URL(env.supabaseUrl).hostname.split('.')[0];
  return (await axios.post(`https://api.supabase.com/v1/projects/${ref}/database/query`, { query }, {headers:{Authorization:`Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`}, timeout:45000})).data;
}
async function read(table, params) { return (await axios.get(`${env.supabaseUrl}/rest/v1/${table}`, {headers:headers(),params,timeout:30000})).data; }
function metadata(row) { try { return JSON.parse(String(row?.info_comprobantes||'').includes(META) ? String(row.info_comprobantes).slice(String(row.info_comprobantes).lastIndexOf(META)+META.length) : 'null'); } catch { return null; } }
function isDirect(row) { return /^\[(TEST SUPABASE LOCAL|SUPABASE DIRECT)\]/.test(String(row?.info_comprobantes || '')) && ['local_real_test','local_direct'].includes(metadata(row)?.mode); }
function isTest(row) { return String(row?.info_comprobantes||'').startsWith('[TEST SUPABASE LOCAL]') && metadata(row)?.mode === 'local_real_test'; }
let schemaPromise;
async function schema() {
  if (!schemaPromise) schemaPromise = sql("select column_name,data_type from information_schema.columns where table_schema='public' and table_name='comprobantes'").catch(e=>{schemaPromise=null;throw e;});
  return schemaPromise;
}
function projectRow(row, columns) {
  const out = {};
  for (const {column_name:k,data_type:t} of columns) {
    if (row[k] === undefined || ['created_at','updated_at'].includes(k)) continue;
    out[k] = row[k] != null && t === 'text' ? String(row[k]) : row[k];
  }
  return out;
}
function buildTransaction(rows, columns, tag, leadId, saleId, actor) {
  const names = Object.keys(rows[0]);
  if (!names.every(k=>/^[a-z_][a-z0-9_]*$/.test(k))) throw new Error('Columnas inválidas');
  const col = names.map(k=>'"'+k+'"').join(',');
  const cash = rows.reduce((n,r)=>n+(r.tipo==='Devolucion'?-1:1)*Number(r.cash_collected||0),0);
  const fact = rows.reduce((n,r)=>n+(r.tipo==='Devolucion'?-1:1)*Number(r.facturacion||0),0);
  if (![cash,fact].every(Number.isFinite)) throw new Error('Importes inválidos');
  const net = rows.reduce((n,r)=>n+(r.tipo==='Devolucion'?-1:1)*Number(r.cash_collected_neto||0),0);
  const netUpdate=names.includes('cash_collected_neto')?`,cash_collected_neto_total=coalesce(cash_collected_neto_total,0)+(${net})`:'';
  const existingSale = !rows.some(r=>r.id===saleId);
  const block = '$test_' + crypto.randomBytes(16).toString('hex') + '$';
  // All user values are SQL string literals, never identifiers or raw SQL.
  return `begin; set local statement_timeout='20s';
    select pg_advisory_xact_lock(hashtextextended(${literal(tag)},0));
    do ${block} begin
      if not exists(select 1 from public.comprobantes where info_comprobantes like ${literal(tag+'%')}) then
        perform 1 from public.leads_raw where id=${literal(leadId)} for update;
        if not found then raise exception 'Cliente inexistente'; end if;
        ${existingSale ? `perform 1 from public.comprobantes where id=${literal(saleId)} and tipo='Venta' and cliente=${literal(leadId)} for update; if not found then raise exception 'Venta inexistente o de otro cliente'; end if;` : ''}
        insert into public.comprobantes (${col}) select ${col} from json_populate_recordset(null::public.comprobantes,${literal(JSON.stringify(rows))}::json);
        ${existingSale ? `update public.comprobantes set cash_collected_total=coalesce(cash_collected_total,0)+ (${cash}), monto_incobrable=greatest(coalesce(facturacion,0)-coalesce((select sum(r.facturacion) from public.comprobantes r where r.venta_relacionada=${literal(saleId)} and r.tipo in ('Devolucion','Devolución')),0)-coalesce(cash_collected_total,0)- (${cash}),0)${netUpdate} where id=${literal(saleId)};` : ''}
        update public.leads_raw set facturacion_total=coalesce(facturacion_total,0)+ (${fact}),cash_collected_total=coalesce(cash_collected_total,0)+ (${cash}),saldo=coalesce(facturacion_total,0)+ (${fact})-coalesce(cash_collected_total,0)- (${cash}) where id=${literal(leadId)};
      end if;
    end ${block};
    select id,tipo from public.comprobantes where info_comprobantes like ${literal(tag+'%')} order by fecha_creado,id;
    commit;`;
}
let bucketPromise;
async function ensureBucket() {
  if (!bucketPromise) bucketPromise=(async()=>{
    const buckets=(await axios.get(`${env.supabaseUrl}/storage/v1/bucket`,{headers:headers()})).data;
    if (!buckets.some(b=>b.id===BUCKET)) await axios.post(`${env.supabaseUrl}/storage/v1/bucket`,{id:BUCKET,name:BUCKET,public:false,file_size_limit:20971520},{headers:headers()});
  })().catch(e=>{bucketPromise=null;throw e;});
  return bucketPromise;
}
const repository = {
  async getConfig() {
    try {
      const {data} = await axios.get(`${env.supabaseUrl}/storage/v1/object/authenticated/${BUCKET}/configuration/catalog.json`,{headers:headers(),params:{v:Date.now()}});
      const config = direct._test.validateConfig(data);
      config.rules.commissionBaseFromPaymentMethod = true;
      return {...config,migrationReady:true};
    } catch (error) {
      const message = String(error.response?.data?.message || '').toLowerCase();
      if (![400,404].includes(error.response?.status) || !/not found|does not exist/.test(message)) throw error;
      return {migrationReady:true,products:direct._test.DEFAULT_PRODUCTS,paymentMethods:direct._test.DEFAULT_PAYMENT_METHODS,responsiblePeople:direct._test.DEFAULT_RESPONSIBLE_PEOPLE,rules:{...direct._test.DEFAULT_RULES,commissionBaseFromPaymentMethod:true}};
    }
  },
  async getLead(ghlid) { return (await read('leads_raw',{ghlid:`eq.${ghlid}`,select:'*',order:'last_edited_time.desc',limit:1}))[0]||null; },
  async getLeadById(id) { return (await read('leads_raw',{id:`eq.${id}`,select:'*',limit:1}))[0]||null; },
  async getCsm(ghlid) { return (await read('csm',{ghlid:`eq.${ghlid}`,select:'*',limit:1}))[0]||null; },
  async getSale(id,ghlid) { return (await read('comprobantes',{select:'*',tipo:'eq.Venta',...(id?{id:`eq.${id}`}:{ghlid:`eq.${ghlid}`,order:'f_venta.desc.nullslast,fecha_creado.desc.nullslast'}),limit:1}))[0]||null; },
  async getComprobante(id) { const row = (await read('comprobantes',{select:'*',id:`eq.${id}`,limit:1}))[0]||null; return row; },
  async getSubmission(key) {
    const rows=await read('comprobantes',{select:'id,tipo,info_comprobantes',info_comprobantes:`like.${PREFIX} ${key} |*`});
    return rows.length?{status:'completed',created:rows.map(r=>({id:r.id,type:r.tipo}))}:null;
  },
  async uploadFile(_bucket,objectPath,file) {
    await ensureBucket();
    return (await axios.post(`${env.supabaseUrl}/storage/v1/object/${BUCKET}/${objectPath.split('/').map(encodeURIComponent).join('/')}`,Buffer.from(file.base64,'base64'),{headers:headers({'Content-Type':file.type,'x-upsert':'false'}),maxBodyLength:Infinity,timeout:45000})).data;
  },
  async removeFiles(_bucket,paths) { await axios.delete(`${env.supabaseUrl}/storage/v1/object/${BUCKET}`,{headers:headers(),data:{prefixes:paths}}); },
  async createBatch(payload) {
    const tag=`${PREFIX} ${payload.submissionKey} |`;
    const columns=await schema();
    const leadId=payload.rows[0].cliente;
    const saleId=payload.rows[0].venta_relacionada;
    const before={lead:await repository.getLeadById(leadId),sale:await repository.getComprobante(saleId)};
    const rows=payload.rows.map((r,index)=>projectRow({...r,
      cliente_format:testMode()?`[TEST] ${r.cliente_format}`:r.cliente_format,
      producto_format:r.producto_format || before.sale?.producto_format || null,
      productos:r.productos || before.sale?.productos || null,
      monto_incobrable:r.tipo==='Venta'?Math.max(Number(r.facturacion||0)-Number(r.cash_collected_total||0),0):r.monto_incobrable,
      info_comprobantes:tag+' '+r.info_comprobantes+META+JSON.stringify({mode:testMode()?'local_real_test':'local_direct',batchId:payload.batchId,submissionKey:payload.submissionKey,actorEmail:payload.actorEmail,files:payload.files.filter(f=>f.operationIndex===index).map(f=>({...f,bucket:BUCKET})),before:index===0?{leadId:before.lead?.id,leadTotals:{facturacion_total:before.lead?.facturacion_total,cash_collected_total:before.lead?.cash_collected_total,saldo:before.lead?.saldo},saleId:before.sale?.id,saleTotal:before.sale?.cash_collected_total}:undefined})
    },columns));
    const dir=auditRoot;fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(path.join(dir,payload.batchId+'.json'),JSON.stringify({before,rows,files:payload.files},null,2));
    await sql(buildTransaction(rows,columns,tag,leadId,saleId,payload.actorEmail));
    const result=await repository.getSubmission(payload.submissionKey);
    if (!result || result.created.length!==rows.length) throw new Error('No pude verificar todas las filas TEST');
    return {ok:true,created:result.created,test:testMode(),idempotentReplay:result.created.some(r=>!rows.some(created=>created.id===r.id))};
  },
  async updateComprobante({id,patch,actorEmail,expectedRow}) {
    const before=expectedRow || await repository.getComprobante(id);
    const meta=metadata(before);
    const cleanInfo=String(patch.info_comprobantes || '').split(META)[0]
      .replace(/^\[(?:TEST SUPABASE LOCAL|SUPABASE DIRECT)\] [^|]+\|\s*/, '');
    const identity=meta || {mode:'local_direct',actorEmail,files:[],legacy:true};
    const oldPrefix=String(before.info_comprobantes||'').split(' |')[0];
    patch.info_comprobantes=(meta?oldPrefix:'[SUPABASE DIRECT] legacy-'+id)+' | '+cleanInfo+META+JSON.stringify(identity);
    if (/club/i.test(patch.producto_format || before.producto_format || '')) patch.neto_club=Math.max(0,Number(patch.cash_ar)-Number(patch.iva)-Number(patch.comisiones));
    const projected=projectRow(patch,await schema());
    await runMutation({before,patch:projected},actorEmail);
    return {ok:true};
  },
  async deleteComprobante({id,actorEmail,expectedRow}) {
    const before=expectedRow || await repository.getComprobante(id);
    await runMutation({before,remove:true},actorEmail);
    return {ok:true};
  },
  async enqueueFileCleanup(files,context) {
    const dir=path.join(auditRoot,'cleanup');fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(path.join(dir,crypto.randomUUID()+'.json'),JSON.stringify({files,context}));
    return {queued:files.length};
  },
  async listFiles(id) { const row=await repository.getComprobante(id);return (metadata(row)?.files||[]).map((f,i)=>({id:`${id}-${i}`,original_name:f.name,mime_type:f.mimeType,size_bytes:f.sizeBytes,bucket:BUCKET,object_path:f.objectPath})); },
  async signFile(bucket,objectPath) {
    const {data}=await axios.post(`${env.supabaseUrl}/storage/v1/object/sign/${BUCKET}/${objectPath.split('/').map(encodeURIComponent).join('/')}`,{expiresIn:600},{headers:headers()});
    return `${env.supabaseUrl}/storage/v1${data.signedURL||data.signedUrl}`;
  }
};
async function runMutation(change,actorEmail) {
  const dir=path.join(auditRoot,'mutations');fs.mkdirSync(dir,{recursive:true});
  const audit=path.join(dir,crypto.randomUUID()+'.json');
  fs.writeFileSync(audit,JSON.stringify({...change,actorEmail,status:'pending'}));
  try { await sql(buildMutation(change)); }
  catch (error) { const e=new Error(error.response?.data?.message || error.message);e.statusCode=409;throw e; }
  fs.writeFileSync(audit,JSON.stringify({...change,actorEmail,status:'completed'}));
}
const options = ()=>({repository,allowOperationalUser:true,bypassSafety:true});
async function getBootstrap(user) {assertEnabled();return {...await direct.getBootstrap(user,options()),localRealTest:testMode(),productsSource:'supabase',localDirect:true};}
async function create(payload,user) {
  assertEnabled();
  const key=String(payload.submissionKey||'');
  if (pending.has(key)) return pending.get(key);
  const work=(async()=>{ const config=await repository.getConfig(); return direct.create(payload,user,{...options(),config,allowMissingAttachments:false}); })();pending.set(key,work);
  try{return await work;}finally{pending.delete(key);}
}
async function owns(id) {return enabled() && isDirect(await repository.getComprobante(id));}
async function reconcile(id,state,user) {
  assertEnabled();const row=await repository.getComprobante(id);if(!row) {const e=new Error('Comprobante inexistente');e.statusCode=404;throw e;}
  const states={conciliated:'Conciliado',not_conciliated:null,bounced:'Rebotado'};
  if(!Object.hasOwn(states,state))throw new Error('Estado inválido');
  const result=await axios.patch(`${env.supabaseUrl}/rest/v1/comprobantes`,{estado:states[state],rebotar_pago:state==='bounced'?'true':null},{headers:headers({Prefer:'return=representation'}),params:{id:`eq.${id}`}});
  return {row:result.data[0],state,message:'Estado actualizado en Supabase'};
}
async function getConfig(user) {
  assertEnabled(); if (!direct.canAccessLab(user)) { const e=new Error('No tenés permiso para configurar las cargas');e.statusCode=403;throw e; }
  return {...await repository.getConfig(),localRealTest:testMode(),source:'supabase-storage',safety:{dryRunOnly:false}};
}
async function saveConfig(config,user) {
  await getConfig(user);
  const validated=direct._test.validateConfig(config);
  await ensureBucket();
  await axios.post(`${env.supabaseUrl}/storage/v1/object/${BUCKET}/configuration/catalog.json`,JSON.stringify(validated),{headers:headers({'Content-Type':'application/json','x-upsert':'true','Cache-Control':'no-cache'})});
  return {config:await getConfig(user)};
}
async function cleanupQueue(user,retry=false) {
  await getConfig(user);
  const dir=path.join(auditRoot,'cleanup');
  if (!fs.existsSync(dir)) return {count:0,rows:[],completed:0,failed:0};
  const rows=[];let completed=0,failed=0;
  for(const name of fs.readdirSync(dir).filter(n=>n.endsWith('.json'))) {
    const file=path.join(dir,name),entry=JSON.parse(fs.readFileSync(file,'utf8'));
    if(retry) {try {await repository.removeFiles(BUCKET,entry.files.map(f=>f.object_path));fs.unlinkSync(file);completed++;continue;}catch{failed++;}}
    rows.push({id:name,count:entry.files.length,context:entry.context});
  }
  return {count:rows.length,rows,completed,failed};
}
module.exports={enabled,cleanupQueue,getConfig,saveConfig,getBootstrap,create,owns,reconcile,
 lookupClient:(id,user)=>direct.lookupClient(id,user,options()),
 lookupRelatedSale:(id,expected,user)=>direct.lookupRelatedSale(id,expected,user,options()),
 listFiles:(id,user)=>direct.listSignedFiles(id,user,options()),
 getEditable:async(id,user)=>{const data=await direct.getEditableComprobante(id,user,options());data.infoComprobantes=String(data.infoComprobantes||'').split(META)[0].replace(/^\[(?:TEST SUPABASE LOCAL|SUPABASE DIRECT)\] [^|]+\|\s*/,'');return data;},
 updateEditable:(id,payload,user)=>direct.updateEditableComprobante(id,payload,user,options()),
 deleteEditable:(id,user)=>direct.deleteEditableComprobante(id,user,options()),
 _test:{literal,projectRow,buildTransaction,isTest,isDirect,repository}};
