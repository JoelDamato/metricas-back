const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
const ui=require('../public/metricas-v2/js/views/csm-module-durations');
const base={id:'a',ghlid:'a',nombre:'Ana',acceso:'Acceso',f_acceso:'2026-01-01',modulo_1:'2026-09-01',modulo_1_fin:'2026-09-04'};
test('cohorte excluye históricos, renovaciones, personalizados y estados no operativos sin usar created_at',()=>{
 assert.equal(ui.exclusion(base,'2026-10-06'),'');
 for(const fields of [{f_acceso:'2025-12-31'},{productos_adquiridos:'MEG Renovación'},{fecha_inicio_renovacion:'2026-04-01'},{productos_adquiridos:'Personalizado'},{acceso:'Sin acceso'},{pausa:'En Pausa'},{abandono:'Abandono'},{f_acceso:null,created_at:'2026-01-01'}])assert.notEqual(ui.exclusion({...base,...fields},'2026-10-06'),'');
});
test('ventanas sin reglas no inventan colores; reglas propias aplican límites inclusive',()=>{
 const list=rules=>ui.operationalLists([base],'modules','2026-09-18',rules).find(l=>l.key==='w1');
 assert.equal(list({}).records[0].tone,'neutral');assert.equal(list({w1:{yellow:7,red:14}}).records[0].tone,'red');
 assert.equal(ui.operationalLists([{...base,modulo_1_fin:null}],'modules','2026-09-15')[0].records[0].tone,'red');
});
test('sesiones saltan Costos 2, rechazan fechas invertidas y no inventan sesiones faltantes',()=>{
 const rows=[{...base,f_diagnostico:'2026-09-01',f_costos_1:'2026-09-03',f_costos_2:'2026-09-04',f_eerr_economico:'2026-09-09'}];
 const lists=ui.operationalLists(rows,'sessions','2026-09-20');assert.equal(lists[1].label,'Costos → Económica');assert.equal(lists[1].records[0].days,6);
 assert.equal(ui.operationalLists([{...base,f_diagnostico:'2026-09-20',f_costos_1:'2026-09-01'}],'sessions','2026-09-25')[0].records[0].days,null);
});
test('prioridad y orden por días preservan cero y colocan faltantes al final',()=>{
 const rows=[{nombre:'C',tone:'yellow',days:30},{nombre:'B',tone:'red',days:15},{nombre:'A',tone:'neutral',days:null},{nombre:'D',tone:'green',days:0}];
 assert.equal(ui.orderRecords(rows)[0].nombre,'B');assert.equal(ui.orderRecords(rows,'days-asc')[0].days,0);assert.equal(ui.orderRecords(rows,'days-desc').at(-1).days,null);
});
test('notas y reglas compartidas protegen contra sobrescrituras concurrentes',async()=>{
 const {PGlite}=require('@electric-sql/pglite');const db=new PGlite();
 await db.exec("create role anon;create role authenticated;create role service_role;create table csm(ghlid text);insert into csm values('abc');create table csm_ghl_contacts(ghlid text,latest_payload jsonb);");
 await db.exec(fs.readFileSync('supabase/migrations/20261006210000_csm_followup_notes.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261006213000_csm_followup_profiles_cache.sql','utf8'));
 await db.query('insert into csm_ghl_contacts values($1,$2)', ['abc',JSON.stringify({'Fecha de inicio estimado':'2026-01-01','F. inicio renovacion':'2026-09-01'})]);
 assert.equal((await db.query('select fecha_inicio_renovacion from csm_followup_profiles')).rows[0].fecha_inicio_renovacion,'2026-09-01');
 await db.query('update csm_ghl_contacts set latest_payload=$1', [JSON.stringify({'Fecha de inicio estimado':'2026-01-02'})]);
 assert.equal((await db.query('select fecha_inicio_renovacion from csm_followup_profiles')).rows[0].fecha_inicio_renovacion,'2026-09-01');
 const note=async(revision,text)=> (await db.query('select metricas_csm_followup_note($1,$2,$3,$4) as data',['abc',text,revision,'tester'])).rows[0].data;
 assert.equal((await note(0,'Contexto')).revision,1);assert.equal((await note(0,'Sobrescribir')).conflict,true);assert.equal((await note(1,'Actualizado')).revision,2);
 const rule=async(rev,y,r)=>(await db.query('select metricas_csm_followup_rule($1,$2,$3,$4,$5) as data',['w1',y,r,rev,'tester'])).rows[0].data;
 assert.equal((await rule(0,7,14)).revision,1);assert.equal((await rule(0,8,15)).conflict,true);await assert.rejects(rule(1,14,7));await db.close();
});
