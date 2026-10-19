const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
const {PGlite}=require('@electric-sql/pglite');
test('ranking applies client aging without changing balances, sales, cash or attributing collections twice',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create table leads_raw(id text primary key,ghlid text);
 create table comprobantes(id text primary key,cliente text,ghlid text,venta_relacionada text,tipo text,estado text,rebotar_pago boolean,cash_collected numeric,cash_collected_neto numeric,f_acreditacion timestamptz,f_venta timestamptz,facturacion numeric,monto_incobrable numeric,responsable_venta text,creado_por text,producto_format text);
 create view comprobantes_cash_metricas as select * from comprobantes;
 create function metricas_is_non_club_product(p text) returns boolean language sql immutable as $$select p not ilike '%club%'$$;
 create function metricas_is_valid_sale_product(p text) returns boolean language sql immutable as $$select p is not null and p not ilike '%club%'$$;`);
 const source=fs.readFileSync('supabase/migrations/20260602193010_use_responsable_venta_for_closer_views.sql','utf8').split('CREATE OR REPLACE VIEW public.agenda_detalle_por_origen_closer AS')[0];await db.exec(source.replace('FROM public.comprobantes c','FROM public.comprobantes_cash_metricas c'));
 await db.exec(`insert into leads_raw values('l1','client1'),('duplicate','client1');`);
 const day="(now() at time zone 'America/Argentina/Buenos_Aires')::date";
 for(const [id,age,amount,status='Conciliado',bounce=false,type='Venta',product='MEG'] of [['old',61,600],['boundary',60,600],['recent',59,600],['zero',90,0],['pending',90,600,'Pendiente'],['bounce',90,600,'Conciliado',true],['club',90,600,'Conciliado',false,'Venta','Club'],['missing',null,600]]){
 await db.query(`insert into comprobantes values($1,$1,null,null,$2,$3,$4,400,400,${age===null?'null':`(${day} - ${age})::timestamp at time zone 'America/Argentina/Buenos_Aires'`},'2026-01-01',1000,$5,'Closer',null,$6)`,[id,type,status,bounce,amount,product]);}
 const snapshot=(await db.query('select * from comprobantes order by id')).rows;
 const before=(await db.query('select * from ranking_closers_mensual')).rows[0];
 const migration=fs.readFileSync('supabase/migrations/20261019180000_ranking_incobrables_aging.sql','utf8');await db.exec(migration);
 let after=(await db.query('select * from ranking_closers_mensual')).rows[0];assert.equal(Number(after.monto_incobrable_total),600);
 for(const field of ['total_ventas','facturacion_total','cash_collected_total','ranking_posicion'])assert.equal(after[field],before[field]);
 assert.deepEqual((await db.query('select * from comprobantes order by id')).rows,snapshot);
 // A recent pending collection does not reset aging; reconciliation does, even when linked without client ID.
 await db.exec(`insert into comprobantes(id,venta_relacionada,tipo,estado,cash_collected,f_acreditacion,monto_incobrable) values('payment','old','Cobranza','Pendiente',100,now(),999);`);
 assert.equal(Number((await db.query('select monto_incobrable_total from ranking_closers_mensual')).rows[0].monto_incobrable_total),600);
 await db.exec("update comprobantes set estado='Conciliado' where id='payment'");
 assert.equal(Number((await db.query('select monto_incobrable_total from ranking_closers_mensual')).rows[0].monto_incobrable_total),0);
 // Duplicate CRM identities resolve through GHL; another sale's recent payment resets the client's clock.
 await db.exec(`update comprobantes set cliente='l1' where id='old';insert into comprobantes(id,cliente,tipo,estado,cash_collected,f_acreditacion) values('second','duplicate','Venta','Conciliado',100,now());`);
 await db.exec("delete from comprobantes where id='payment'");
 assert.equal(Number((await db.query('select monto_incobrable_total from ranking_closers_mensual')).rows[0].monto_incobrable_total),0);
 await db.exec(migration); // idempotent
 }finally{await db.close();}
});
