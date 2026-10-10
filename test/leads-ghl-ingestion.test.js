const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const {mapGhlLead}=require('../modules/leads/ghl-mapper');
const migration=fs.readFileSync('supabase/migrations/20261010120000_leads_ghl_ingestion.sql','utf8');
const schema=require('./fixtures/leads-existing-schema.json');
test('GHL leads: transacción, protección histórica, fórmulas, conciliación, catálogo, errores y permisos',async()=>{
 const db=new PGlite();let sequence=0;
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;
  create table leads_raw(${schema.map(c=>`"${c.column_name}" ${c.data_type}${c.column_name==='id'?' primary key':''}${c.column_default?' default '+c.column_default:''}`).join(',')});
  create table comprobantes(id text primary key,ghlid text,cliente text,tipo text,producto_format text,estado text,rebotar_pago boolean,
  facturacion numeric,cash_collected numeric,cash_ar numeric,iva numeric,tc numeric,f_venta timestamptz,f_acreditacion timestamptz,venta_relacionada text,
  cash_collected_total numeric,cash_collected_neto numeric,cash_collected_neto_total numeric,monto_incobrable numeric);
  `);
  // Install the existing financial protections too, to test trigger interaction, not a simplified substitute.
  const runtime=fs.readFileSync('supabase/migrations/20261003120000_comprobantes_internal_runtime.sql','utf8');
  await db.exec(runtime.slice(0,runtime.indexOf('create or replace function public.metricas_comprobantes_write_v2'))+'commit;');
  await db.exec(migration);
  await db.exec(fs.readFileSync('supabase/migrations/20261010130000_preserve_crm_opening_balances.sql','utf8'));
  const ingest=async(payload,options={})=>{
   const mapped=mapGhlLead(payload);const id=options.id||`00000000-0000-4000-8000-${String(++sequence).padStart(12,'0')}`;
   return (await db.query('select metricas_leads_ghl_ingest($1,$2,$3,$4,$5,$6,$7,$8) as result',[id,payload.contact_id,options.location||'WU2z8kl23Dr3IyBW1hv5',JSON.stringify(payload),JSON.stringify({...mapped.patch,...options.patch}),JSON.stringify(mapped.fields),JSON.stringify(mapped.warnings),mapped.sourceUpdatedAt])).rows[0].result;
  };
  const row=async id=>(await db.query('select * from leads_raw where ghlid=$1',[id])).rows[0];
  await db.exec("insert into leads_raw(id,ghlid,nombre,closer,fecha_agenda,created_time,fecha_creada,facturacion_total,saldo) values('legacy','one','Anterior','Carlos','2026-09-15','2025-01-01','2025-01-01',0,0)");
  const payload={contact_id:'one',full_name:'Cliente',date_created:'2024-01-01','Fecha de agendamiento':'2026-10-09','Agendo':'Agendo','Recurso IG':', Reel - Costos, Carrusel - Ventas',date_updated:'2026-10-09T12:00:00Z',Nuevo:0};
  const r=await ingest(payload,{id:'00000000-0000-4000-8000-999999999999'});assert.equal(r.status,'updated');assert.equal(r.leadId,'legacy');
  let lead=await row('one');assert.equal(lead.closer,'Carlos');assert(lead.created_time.toISOString().startsWith('2025-01-01'));assert(lead.fecha_creada.toISOString().startsWith('2025-01-01'));assert(lead.fecha_agenda.toISOString().startsWith('2026-10-09'));assert.equal(lead.etapa,'Agendo');assert.equal(lead.primero_recurso,'Reel - Costos');assert.equal(lead.ultimo_recurso,'Carrusel - Ventas');assert.equal(lead.formato_fuente,'Reel');assert.equal(Number(lead.cantidad_recursos),3);assert.equal(Number(lead.saldo),0);
  assert.equal((await ingest(payload,{id:'00000000-0000-4000-8000-999999999999'})).replayed,true);
  await assert.rejects(ingest({...payload,full_name:'Alterado'},{id:'00000000-0000-4000-8000-999999999999'}));
  assert.equal((await ingest({contact_id:'one',full_name:'Atrasado',date_updated:'2026-10-08T12:00:00Z'})).status,'stale');assert.equal((await row('one')).nombre,'Cliente');
  await ingest({contact_id:'one',Closer:'',email:null,'Fecha de agendamiento':'31/02/2026',Nuevo:false,Otro:{arr:[1,2]},saldo:999});
  lead=await row('one');assert.equal(lead.closer,'Carlos');assert(lead.fecha_agenda.toISOString().startsWith('2026-10-09'));assert.equal(Number(lead.saldo),0);
  const tracked=(await db.query("select * from leads_ghl_contacts where ghlid='one'")).rows[0];assert.equal(tracked.fields.Nuevo.value,false);assert.equal(tracked.fields.Agendo.value,'Agendo');assert.deepEqual(tracked.fields.Otro.value,{arr:[1,2]});
  assert.deepEqual((await db.query("select observed_types from leads_ghl_fields where field_key='Nuevo'")).rows[0].observed_types,['boolean','number']);
  // A late Notion upsert or distributor delete must not undo a taken-over contact.
  await db.exec("update leads_raw set nombre='Notion viejo',closer=null,fecha_agenda=null where id='legacy';delete from leads_raw where id='legacy';insert into leads_raw(id,ghlid,nombre) values('another-id','one','Duplicado')");
  assert.equal((await row('one')).nombre,'Cliente');assert.equal((await db.query("select count(*) from leads_raw where ghlid='one'")).rows[0].count,1);
  const created=await ingest({contact_id:'new',full_name:'Nuevo',fecha_agenda:null},{patch:{saldo:100,id:'evil',facturacion_total:100,archived:true}});assert.equal(created.status,'created');assert.equal((await row('new')).fecha_agenda,null);assert.equal((await row('new')).saldo,null);assert.equal((await row('new')).archived,false);
  // Existing sale and new collections: only reconciled cash, net of IVA (not payment charges).
  await db.exec("insert into comprobantes(id,ghlid,cliente,tipo,producto_format,estado,facturacion,cash_collected,iva,tc,f_venta,f_acreditacion) values('sale','one','legacy','Venta','Meg 2.1','Conciliado',1000,605,10500,100,'2026-09-15','2026-09-15')");
  lead=await row('one');assert.equal(Number(lead.facturacion_total),1000);assert.equal(Number(lead.cash_collected_total),500);assert.equal(Number(lead.saldo),500);assert.equal(lead.u_product_adquirido,'Meg 2.1');assert.equal(lead.fecha_venta,'2026-09-15');
  await db.exec("insert into comprobantes(id,tipo,estado,cash_collected,venta_relacionada,f_acreditacion) values('collection','Cobranza','No conciliado',500,'sale','2026-10-09')");assert.equal(Number((await row('one')).saldo),500);
  await db.exec("update comprobantes set estado='Conciliado' where id='collection'");assert.equal(Number((await row('one')).saldo),0);
  // The older receipt RPC tries gross totals; the lead guard still produces the agreed net balance.
  await db.exec("begin;select set_config('metricas.receipt_write','on',true);select metricas_receipt_totals_v2('legacy');commit;");assert.equal(Number((await row('one')).saldo),0);
  await db.exec("begin;select set_config('metricas.receipt_write','on',true);update comprobantes set estado='Rebotado',rebotar_pago=true where id='collection';commit;");assert.equal(Number((await row('one')).saldo),500);
  await db.exec("insert into comprobantes(id,tipo,estado,facturacion,cash_collected,venta_relacionada,f_acreditacion) values('refund','Devolución','Conciliado',100,100,'sale','2026-10-09')");lead=await row('one');assert.equal(Number(lead.facturacion_total),900);assert.equal(Number(lead.cash_collected_total),400);assert.equal(Number(lead.saldo),500);
  await db.exec("begin;select set_config('metricas.receipt_write','on',true);update comprobantes set f_acreditacion=now()-interval '90 days' where id='sale';commit;");assert.equal(Number((await row('one')).monto_incobrable),500);
  // A paid historical program is not lost when only its renewal has receipts.
  await db.exec("insert into leads_raw(id,ghlid,nombre,facturacion_total,cash_collected_total,saldo) values('history','history','Histórico',3475,3475,0);insert into comprobantes(id,ghlid,cliente,tipo,producto_format,estado,facturacion,cash_collected,f_venta,f_acreditacion) values('history-sale','history','history','Venta','Renovacion - Meg 2.1','Conciliado',1975,1975,'2026-09-29','2026-09-29')");
  assert.equal((await ingest({contact_id:'history',full_name:'Histórico'})).status,'updated');
  let historical=await row('history');assert.equal(Number(historical.facturacion_total),3475);assert.equal(Number(historical.cash_collected_total),3475);assert.equal(Number(historical.saldo),0);assert.equal(historical.extra.ghl_opening_balance.facturacion,1500);
  await ingest({contact_id:'history',full_name:'Histórico'});assert.equal(Number((await row('history')).facturacion_total),3475);
  await db.exec("insert into comprobantes(id,ghlid,cliente,tipo,estado,facturacion,cash_collected,f_venta,f_acreditacion) values('history-new','history','history','Venta','No conciliado',500,500,'2026-10-10','2026-10-10')");
  assert.equal(Number((await row('history')).facturacion_total),3975);assert.equal(Number((await row('history')).cash_collected_total),3475);assert.equal(Number((await row('history')).saldo),500);
  await db.exec("begin;select set_config('metricas.receipt_write','on',true);update comprobantes set estado='Conciliado' where id='history-new';select metricas_receipt_totals_v2('history');commit;");assert.equal(Number((await row('history')).saldo),0);assert.equal(Number((await row('history')).cash_collected_total),3975);
  // Capture a receipt-less opening before the first new sale, so the new sale is added, not absorbed.
  await db.exec("insert into leads_raw(id,ghlid,nombre,facturacion_total,cash_collected_total,saldo) values('opening','opening','Anterior',1000,1000,0)");
  await db.exec("update leads_raw set u_product_adquirido='Meg 1.0',fecha_venta='2025-01-01' where ghlid='opening'");
  await ingest({contact_id:'opening',full_name:'Anterior'});
  assert.equal((await row('opening')).u_product_adquirido,'Meg 1.0');assert.equal((await row('opening')).fecha_venta,'2025-01-01');
  await db.exec("insert into comprobantes(id,ghlid,tipo,estado,facturacion,cash_collected) values('opening-new','opening','Venta','Conciliado',500,500)");
  assert.equal(Number((await row('opening')).facturacion_total),1500);assert.equal(Number((await row('opening')).cash_collected_total),1500);
  // A pre-existing duplicate is captured for review, never guessed or merged automatically.
  await db.exec("insert into leads_raw(id,ghlid,nombre) values('dup1','dupe','A'),('dup2','dupe','B')");assert.equal((await ingest({contact_id:'dupe',full_name:'No elegir'})).status,'needs_review');
  assert.equal((await ingest({contact_id:'wrong',full_name:'Wrong'},{location:'another-location'})).status,'needs_review');
  assert.equal((await ingest({contact_id:'noname'})).status,'needs_review');
  assert.equal((await db.query("select count(*) from leads_ghl_events where status='error'")).rows[0].count,3);
  assert.equal((await row('dupe')).nombre,'A');
  await db.exec('set role anon');await assert.rejects(db.query('select * from leads_ghl_contacts'));await assert.rejects(db.query('select * from leads_ghl_field_values'));await assert.rejects(db.query('select metricas_leads_ghl_refresh_aging()'));
 }finally{await db.close();}
});
