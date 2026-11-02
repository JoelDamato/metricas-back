const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const {buildAgendaCredits}=require('../modules/metricasv2/services/commission-agenda-credits');
test('el ajuste APSET pertenece sólo al mes indicado y no duplica una agenda existente',()=>{
 const sale={id:'paula',ghlid:'p',setter:'Nahuel Iasci',cliente_format:'Paula Crotti'},override={sale_id:'paula',agenda_month:'2026-10'};
 assert.equal(buildAgendaCredits([override],[sale],[],'2026-11',()=>true).length,0);
 assert.equal(buildAgendaCredits([override,override],[sale],[],'2026-10',()=>true)[0].additionalCount,1);
 assert.equal(buildAgendaCredits([override],[sale],[{ghlid:'p'}],'2026-10',()=>true)[0].additionalCount,0);
});
test('los ajustes reales quedan auditados, son idempotentes y conservan el porcentaje closer',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create table comprobantes(id text primary key,tipo text,ghlid text,cliente text,cliente_format text,producto_format text,responsable_venta text,setter text,venta_relacionada text,cobranza_relacionada text,f_acreditacion timestamptz);
 create table commission_month_snapshots(month_key text primary key,locked boolean);
 insert into comprobantes(id,tipo,ghlid,f_acreditacion) values('cd556044-82a6-4059-a62c-38d9024ffe38','Venta','XZb7mo3Pl7MTx8a2E8Zv','2026-10-30'),('a0d34ff7-ba83-4e3a-b314-61b81235e96d','Venta','L7QdAjwquybGltb3sT2E','2026-10-30');`);
 await db.exec(fs.readFileSync('supabase/migrations/20261102180000_commission_sale_overrides.sql','utf8'));
 await db.exec(`insert into commission_sale_overrides(sale_id,closer_pct,reason,updated_by) values('cd556044-82a6-4059-a62c-38d9024ffe38',.09,'Regla closer previa','admin')`);
 const migration=fs.readFileSync('supabase/migrations/20261102230000_commission_agenda_credits.sql','utf8');await db.exec(migration);await db.exec(migration);
 const rows=(await db.query('select * from commission_sale_overrides order by sale_id')).rows;
 assert(rows.every(r=>Number(r.setter_pct)===.03));const paula=rows.find(r=>r.agenda_month);assert.equal(paula.agenda_month,'2026-10');assert.equal(Number(paula.closer_pct),.09);assert.equal(paula.setter_eligible,true);
 assert.equal((await db.query('select * from commission_sale_override_audit')).rows.length,2);
 await db.exec('set role anon');await assert.rejects(db.query('select * from commission_sale_overrides'));
 }finally{await db.close();}
});
