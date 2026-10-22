const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const {mapGhlLead}=require('../modules/leads/ghl-mapper');
const schema=require('./fixtures/leads-existing-schema.json');
const sql=name=>fs.readFileSync('supabase/migrations/'+name,'utf8');
test('compact history preserves contacts, replay, payload collision and future ingestion',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;
   create table leads_raw(${schema.map(c=>`"${c.column_name}" ${c.data_type}${c.column_name==='id'?' primary key':''}${c.column_default?' default '+c.column_default:''}`).join(',')});
   create table comprobantes(id text primary key,ghlid text,cliente text,tipo text,producto_format text,estado text,rebotar_pago boolean,facturacion numeric,cash_collected numeric,cash_ar numeric,iva numeric,tc numeric,f_venta timestamptz,f_acreditacion timestamptz,venta_relacionada text,cash_collected_total numeric,cash_collected_neto numeric,cash_collected_neto_total numeric,monto_incobrable numeric);
   create table csm(id text primary key,ghlid text,nombre text,crm_2_0 text,created_at timestamptz,updated_at timestamptz);
  `);
  await db.exec(sql('20261010120000_leads_ghl_ingestion.sql'));
  await db.exec(sql('20261010130000_preserve_crm_opening_balances.sql'));
  await db.exec(sql('20261013160000_leads_commercial_financial_review.sql'));
  await db.exec(sql('20261006180000_csm_ghl_ingestion.sql'));
  const lead=async(id,payload)=>{const m=mapGhlLead(payload);return (await db.query('select metricas_leads_ghl_ingest($1,$2,$3,$4,$5,$6,$7,$8) r',[id,payload.contact_id,'WU2z8kl23Dr3IyBW1hv5',JSON.stringify(payload),JSON.stringify(m.patch),JSON.stringify(m.fields),JSON.stringify(m.warnings),m.sourceUpdatedAt])).rows[0].r;};
  const csm=async(id,payload)=>(await db.query('select metricas_csm_ghl_ingest($1,$2,$3,$4,$5,$6) r',[id,'client','WU2z8kl23Dr3IyBW1hv5',JSON.stringify(payload),JSON.stringify({nombre:payload.full_name}),'[]'])).rows[0].r;
  const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002';
  const p={contact_id:'client',full_name:'Original',detail:'x'.repeat(10000)};
  assert.equal((await lead(a,p)).status,'created');assert.equal((await csm(a,p)).status,'created');
  const before=(await db.query('select to_jsonb(l) r from leads_raw l')).rows;
  await db.exec(sql('20261022190000_compact_ghl_event_history.sql'));
  await db.exec("update leads_ghl_events set payload=payload;update csm_ghl_events set payload=payload;");
  assert.deepEqual((await db.query('select to_jsonb(l) r from leads_raw l')).rows,before);
  assert.equal((await lead(a,p)).replayed,true);assert.equal((await csm(a,p)).replayed,true);
  await assert.rejects(lead(a,{...p,full_name:'Wrong'}),/reutilizado/);
  assert.equal((await lead(b,{...p,full_name:'New'})).status,'updated');
  assert.equal((await csm(b,{...p,full_name:'New'})).status,'updated');
  for(const table of ['leads_ghl_events','csm_ghl_events']){
   const rows=(await db.query(`select * from ${table}`)).rows;assert.equal(rows.length,2);
   for(const row of rows){assert.deepEqual(row.payload,{});assert.deepEqual(row.mapped_patch,{});assert.equal(row.before_row,null);assert.equal(row.after_row,null);assert.match(row.payload_sha256,/^[a-f0-9]{64}$/);}
  }
  assert.equal((await db.query('select nombre from leads_raw')).rows[0].nombre,'New');
  assert.equal((await db.query('select nombre from csm')).rows[0].nombre,'New');
  assert.equal((await db.query('select latest_payload from leads_ghl_contacts')).rows[0].latest_payload.full_name,'New');
  await db.exec(sql('20261022190000_compact_ghl_event_history.sql')); // Safe re-run.
 }finally{await db.close();}
});
