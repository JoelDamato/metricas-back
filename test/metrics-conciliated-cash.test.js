const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
test('fuente de métricas excluye pendientes/rebotes sin perder ventas ni tocar los importes originales',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;
   create table comprobantes(id text primary key,tipo text,estado text,rebotar_pago text,facturacion numeric,cash_collected numeric,cash_collected_neto numeric,cash_collected_neto_ars numeric);
   insert into comprobantes values('paid','Venta','Conciliado',null,100,121,100,100000),('pending','Venta',null,null,200,242,200,200000),('bounced','Cobranza','Rebotado',null,0,121,100,100000),('flag','Cobranza','Conciliado','true',0,121,100,100000);`);
  const names=['agenda_detalle_diario_closer','agenda_detalle_por_origen_closer','agenda_detalle_por_origen_closer_base','agenda_totales','agenda_totales_base','agenda_totales_ultimo_origen','cash_collected_diario_closer','dashboard_totales','kpi_closers_mensual','kpi_marketing_diario','ranking_closers_mensual'];
  for(const name of names)await db.exec(`create view ${name} as select sum(comprobantes.facturacion) fact,sum(comprobantes.cash_collected_neto) cash,count(*) filter(where tipo='Venta') sales from comprobantes;`);
  const sql=fs.readFileSync('supabase/migrations/20261010140000_metrics_conciliated_cash.sql','utf8');
  await db.exec(sql);await db.exec(sql);
  for(const name of names){const r=(await db.query(`select * from ${name}`)).rows[0];assert.equal(Number(r.fact),300);assert.equal(Number(r.cash),100);assert.equal(r.sales,2);}
  assert.equal(Number((await db.query("select cash_collected from comprobantes where id='pending'")).rows[0].cash_collected),242);
  await db.exec("update comprobantes set estado='Conciliado' where id='pending'");
  assert.equal(Number((await db.query('select cash from kpi_closers_mensual')).rows[0].cash),300);
  await db.exec("update comprobantes set estado='Rebotado' where id='pending'");
  assert.equal(Number((await db.query('select cash from kpi_closers_mensual')).rows[0].cash),100);
  await db.exec('set role anon');await assert.rejects(db.query('select * from comprobantes_cash_metricas'));
 }finally{await db.close();}
});
