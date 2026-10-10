const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
test('agenda de métricas sigue al lead sin duplicar ventas ni cambiar el comprobante o el cash',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;
   create table leads_raw(id text primary key,ghlid text,fecha_agenda timestamp);
   create table comprobantes(id text primary key,cliente text,ghlid text,venta_relacionada text,tipo text,fecha_de_agendamiento timestamptz,agenda_format text,agenda_periodo_m numeric,agenda_periodo_a numeric,f_venta timestamptz,f_acreditacion timestamptz,cash_collected numeric);
   create view comprobantes_cash_metricas with(security_invoker=true) as select * from comprobantes;
   insert into leads_raw values('l','ghl','2026-09-15'),('dup1','dupe','2026-09-01'),('dup2','dupe','2026-10-01'),('null','null',null);
   insert into comprobantes(id,cliente,ghlid,tipo,fecha_de_agendamiento,f_venta,f_acreditacion,cash_collected) values
   ('sale','l','ghl','Venta','2026-09-15','2026-09-20','2026-10-09',100),('orphan',null,'missing','Venta','2026-08-10','2026-09-20','2026-10-09',100),('ambiguous',null,'dupe','Venta','2026-08-10','2026-09-20','2026-10-09',100),('empty','null','null','Venta','2026-08-10','2026-09-20','2026-10-09',100),('relation','l',null,'Venta','2026-09-15','2026-09-20','2026-10-09',100),('wrong','l','missing','Venta','2026-08-10','2026-09-20','2026-10-09',100);
   insert into comprobantes(id,venta_relacionada,tipo,fecha_de_agendamiento,cash_collected) values('collection','sale','Cobranza','2026-09-15',50);`);
  const sql=fs.readFileSync('supabase/migrations/20261010150000_metrics_current_lead_agenda.sql','utf8');await db.exec(sql);await db.exec(sql);
  const original=(await db.query('select * from comprobantes order by id')).rows;
  await db.exec("update leads_raw set fecha_agenda='2026-10-02 23:30:00' where id='l'");
  const rows=(await db.query("select id,fecha_de_agendamiento::date::text agenda,agenda_periodo_m from comprobantes_cash_metricas order by id")).rows;
  assert.equal(rows.length,7);
  for(const id of ['sale','collection','relation'])assert.equal(rows.find(r=>r.id===id).agenda,'2026-10-02');
  for(const id of ['orphan','ambiguous','empty','wrong'])assert.equal(rows.find(r=>r.id===id).agenda,'2026-08-10');
  assert.equal(Number(rows.find(r=>r.id==='sale').agenda_periodo_m),10);
  assert.equal((await db.query("select count(*) from comprobantes_agenda_metricas where fecha_de_agendamiento>='2026-10-01' and fecha_de_agendamiento<'2026-11-01'")).rows[0].count,3);
  assert.deepEqual((await db.query('select * from comprobantes order by id')).rows,original);
  assert.equal(Number((await db.query('select sum(cash_collected) cash from comprobantes_cash_metricas')).rows[0].cash),650);
  await db.exec("update leads_raw set fecha_agenda='2026-12-31 23:30' where id='l'");
  assert.equal((await db.query("select fecha_de_agendamiento::date::text agenda from comprobantes_cash_metricas where id='sale'")).rows[0].agenda,'2026-12-31');
  await db.exec('set role anon');await assert.rejects(db.query('select * from comprobantes_agenda_metricas'));
 }finally{await db.close();}
});
