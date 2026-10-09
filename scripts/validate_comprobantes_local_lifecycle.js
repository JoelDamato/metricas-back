// Complete local adapter, existing PostgreSQL schema, no external requests.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
process.env.COMPROBANTES_LOCAL_DIRECT='1';delete process.env.COMPROBANTES_LOCAL_REAL_TEST;
process.env.SUPABASE_URL='https://local-benchmark.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='local-only';process.env.SUPABASE_ACCESS_TOKEN='local-only';
const audit=fs.mkdtempSync(path.join(os.tmpdir(),'comprobantes-lifecycle-'));process.env.COMPROBANTES_LOCAL_AUDIT_DIR=audit;
const {PGlite}=require(process.env.PGLITE_PACKAGE_PATH||'@electric-sql/pglite');
const axios=require('axios'),local=require('../modules/metricasv2/services/comprobantes-local-test.service'),direct=require('../modules/metricasv2/services/comprobantes-direct.service');
const schema=require('../test/fixtures/comprobantes-existing-schema.json');
const user={email:'matirandazzo@gmail.com',nombre:'Mati Randazzo'};
const config={migrationReady:true,products:direct._test.DEFAULT_PRODUCTS,paymentMethods:direct._test.DEFAULT_PAYMENT_METHODS,responsiblePeople:direct._test.DEFAULT_RESPONSIBLE_PEOPLE,rules:direct._test.DEFAULT_RULES};
const files=new Map(),calls=[];let failDelete=false;
(async()=>{const db=new PGlite();try{
 await db.exec(`create table comprobantes(${schema.map(c=>`"${c.column_name}" ${c.data_type}${c.column_name==='id'?' primary key':''}`).join(',')});create table leads_raw(id text primary key,ghlid text,nombre text,mail text,setter text,last_edited_time text,facturacion_total numeric,cash_collected_total numeric,saldo numeric);create table csm(id text,ghlid text);insert into leads_raw values('11111111-1111-4111-8111-111111111111','local-lead','Cliente QA','qa@example.test','Nahuel Iasci','2026-10-03',0,0,0);`);
 const get=async(table,id)=>(await db.query(`select to_jsonb(t) as row from ${table} t where id=$1`,[id])).rows[0]?.row;
 axios.get=async(url,{params={}}={})=>{
  calls.push(url);if(url.includes('/storage/v1/object/authenticated/'))return {data:structuredClone(config)};
  if(url.endsWith('/storage/v1/bucket'))return {data:[{id:'comprobantes-test-local'}]};
  const table=url.split('/rest/v1/')[1];assert.ok(['comprobantes','leads_raw','csm'].includes(table),'unexpected network: '+url);
  const conditions=[],values=[];for(const [key,val]of Object.entries(params)){if(['select','limit','order','offset'].includes(key))continue;const dot=val.indexOf('.'),op=val.slice(0,dot),v=val.slice(dot+1);assert.ok(['eq','like'].includes(op));values.push(op==='like'?v.replaceAll('*','%'):v);conditions.push(`"${key}" ${op==='eq'?'=':'like'} $${values.length}`);}
  return {data:(await db.query(`select to_jsonb(t) as row from ${table} t ${conditions.length?'where '+conditions.join(' and '):''} ${params.order?'order by '+(table==='comprobantes'?'f_venta':'last_edited_time')+' desc nulls last':''} ${params.limit?'limit '+Number(params.limit):''}`,values)).rows.map(x=>x.row)};
 };
 axios.post=async(url,body)=>{calls.push(url);
  if(url.includes('/database/query')){if(body.query.includes('information_schema.columns'))return{data:schema};try{const results=await db.exec(body.query);return{data:results.at(-1)?.rows||[]};}catch(e){await db.exec('rollback');throw e;}}
  if(url.includes('/storage/v1/object/sign/'))return {data:{signedURL:'/object/sign/qa?token=local'}};
  if(url.includes('/storage/v1/object/')){files.set(url.split('/storage/v1/object/')[1],body);return {data:{}};}
  throw Error('unexpected network: '+url);
 };
 axios.delete=async(url,{data})=>{assert.ok(url.includes('/storage/v1/object/'));if(failDelete)throw Error('Temporary Storage error');for(const key of data.prefixes)files.delete('comprobantes-test-local/'+key);return{data:{}};};
 axios.patch=async(url,patch,{params})=>{assert.ok(url.includes('/rest/v1/comprobantes'));const keys=Object.keys(patch),id=params.id.slice(3);await db.query(`update comprobantes set ${keys.map((k,i)=>`"${k}"=$${i+1}`).join(',')} where id=$${keys.length+1}`,[...Object.values(patch),id]);return{data:[await get('comprobantes',id)]};};
 const base={tipo:'Venta',ghlId:'local-lead',clientPageId:'11111111-1111-4111-8111-111111111111',responsableVenta:'Mati Randazzo',fechaVenta:'2026-01-15',fechaAcreditacion:'2026-01-15',tc:1000,cashCollectedArs:100000,medioPago:config.paymentMethods.find(p=>p.active&&!/cheq/i.test(p.name)).name,dniCuit:'20123456789',productName:'Meg 2.1',facturacionUsd:1000,cantidadPagos:1,submissionKey:'local-lifecycle-sale-0001',attachmentFiles:[{name:'test.pdf',type:'application/pdf',base64:Buffer.from('%PDF-1.4\nQA').toString('base64')}]};
 const sale=await local.create(base,user),saleId=sale.created[0].id;
 assert.equal((await local.create(base,user)).created[0].id,saleId);
 assert.equal(files.size,1);
 const historical=await get('comprobantes',saleId);assert.ok(!historical.cliente_format.includes('[TEST]'));assert.ok(historical.info_comprobantes.startsWith('[SUPABASE DIRECT]'));
 const collection=await local.create({...base,tipo:'Cobranza',latestSaleId:saleId,fechaAcreditacion:'2026-10-03',submissionKey:'local-lifecycle-cobranza-0001',facturacionUsd:undefined},user),id=collection.created[0].id;
 assert.equal((await get('comprobantes',id)).producto_format,'Meg 2.1');
 assert.equal((await get('leads_raw',base.clientPageId)).saldo,800);
 const edit=await local.getEditable(id,user);assert.ok(!edit.infoComprobantes.includes('TEST_METADATA'));
 await assert.rejects(local.updateEditable(id,edit,{email:'other@example.test',nombre:'Otro'}),/Sólo quien/);
 await local.updateEditable(id,{...edit,cashCollectedArs:150000},user);
 assert.equal((await get('leads_raw',base.clientPageId)).saldo,750);
 assert.equal((await local.listFiles(id,user)).length,1);
 await local.reconcile(id,'conciliated',user);
 await assert.rejects(local.deleteEditable(id,user),/Sólo quien/);
 await local.reconcile(id,'not_conciliated',user);
 await assert.rejects(local.deleteEditable(saleId,user),/cobranzas/);
 failDelete=true;const removed=await local.deleteEditable(id,user);assert.equal(removed.cleanupQueued,1);failDelete=false;
 assert.equal((await local.cleanupQueue(user,true)).completed,1);
 assert.equal((await get('leads_raw',base.clientPageId)).saldo,900);
 await local.deleteEditable(saleId,user);
 assert.equal((await get('leads_raw',base.clientPageId)).saldo,0);assert.equal(files.size,0);
 assert.ok(calls.every(url=>!url.includes('notion')));
 console.log(JSON.stringify({database:'PostgreSQL embebido, esquema existente',externalRequests:0,notionRequests:0,sale:true,collection:true,idempotency:true,edit:true,ownership:true,reconciliation:true,linkedSaleDeleteBlocked:true,delete:true,files:true,cleanupRetry:true,finalBalance:0},null,2));
 }finally{await db.close();fs.rmSync(audit,{recursive:true,force:true});}})().catch(e=>{console.error(e.message);process.exitCode=1;});
