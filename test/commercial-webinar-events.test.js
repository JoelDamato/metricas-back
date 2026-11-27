const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
test('etiquetas separan eventos entre meses, conservan ambiguos y no duplican ventas',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create table closer_webinar_leads(ghlid text,origen text,origen_actual text,ultimo_origen text,primer_origen text,fecha_agenda timestamp,closer text,aplica text,agendo text,llamada_meg text);
 create table closer_webinar_receipts(ghlid text,origen text,fecha_de_agendamiento timestamptz,responsable_venta text,creado_por text,tipo text,producto_format text,facturacion numeric);
 create function metricas_normalize_closer_name(text) returns text language sql immutable as 'select $1';
 create function metricas_comprobante_closer_name(text,text) returns text language sql immutable as 'select coalesce($1,$2)';
 create function metricas_is_valid_sale_product(text) returns boolean language sql immutable as $$select $1='MEG'$$;
 insert into closer_webinar_leads values
 ('a','Webinar',null,null,'WEBINAR 28/10','2026-11-27','Carlos Tu','Aplica','Agendo','Efectuada'),
 ('b','Webinar','WEBINAR 26/11',null,'WEBINAR 28/10','2026-12-02','Carlos Tu','Aplica','Agendo',null),
 ('c','Webinar',null,null,null,'2026-11-27','Carlos Tu','Aplica','Agendo','Cancelado'),
 ('x','Webinar',null,null,'WEBINAR 28/10','2026-11-28','Carlos Tu','Aplica','Agendo',null),
 ('x','Webinar',null,null,'WEBINAR 26/11','2026-11-28','Carlos Tu','Aplica','Agendo',null);
 insert into closer_webinar_receipts values
 ('b','Webinar','2026-12-02 03:00Z','Carlos Tu',null,'Venta','MEG',3500),
 ('x','Webinar','2026-11-28 03:00Z','Carlos Tu',null,'Venta','MEG',4000);
 `);
 await db.exec(`alter table closer_webinar_leads add column fecha_llamada date;alter table closer_webinar_leads add column nombre text;
 alter table closer_webinar_receipts add column id serial;
 update closer_webinar_leads set nombre='PRUEBA SCALO NO CONTACTAR' where ghlid='c';`);
 await db.exec(fs.readFileSync('supabase/migrations/20261127010000_commercial_objectives_webinar_events.sql','utf8'));
 const rows=(await db.query('select webinar_id,sum(total_aplica)::int agendas,sum(total_ventas)::int sales,sum(facturacion_f_agenda)::int billing from commercial_webinar_summary group by 1 order by 1')).rows;
 assert.deepEqual(rows,[{webinar_id:'unassigned',agendas:1,sales:1,billing:4000},{webinar_id:'webinar-1',agendas:2,sales:0,billing:0},{webinar_id:'webinar-2',agendas:2,sales:1,billing:3500}]);


 await db.exec(fs.readFileSync('supabase/migrations/20261127020000_commercial_funnel_details.sql','utf8'));
 const checked=(await db.query('select ghlid,webinar_id,attribution_note from commercial_webinar_leads order by ghlid,webinar_id')).rows;
 assert.equal(checked.find(r=>r.ghlid==='a').webinar_id,'unassigned');
 assert.match(checked.find(r=>r.ghlid==='a').attribution_note,/posterior/);
 assert.equal(checked.find(r=>r.ghlid==='b').webinar_id,'webinar-2');
 assert.match(checked.find(r=>r.ghlid==='c').attribution_note,/prueba/);
 assert.equal((await db.query('select count(*)::int n from commercial_objectives_sales')).rows[0].n,2);
 }finally{await db.close();}
});
