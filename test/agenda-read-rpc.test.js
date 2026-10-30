const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
test('lectura acotada conserva datos vivos y sólo service_role puede ejecutar',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon; create role authenticated; create role service_role; create table source(anio int, mes int, total_agendados int); insert into source values(2026,10,5); create view agenda_totales as select * from source; grant select on agenda_totales to service_role;`);
  await db.exec(fs.readFileSync('supabase/migrations/20261030193000_agenda_totales_read.sql','utf8'));
  assert.deepEqual((await db.query('select * from agenda_totales_read()')).rows,(await db.query('select * from agenda_totales')).rows);
  await db.exec('update source set total_agendados=6; set role service_role;');
  assert.equal((await db.query('select * from agenda_totales_read()')).rows[0].total_agendados,6);
  await db.exec('reset role; set role anon');await assert.rejects(db.query('select * from agenda_totales_read()'),/permission/);
  await db.exec('reset role; set role authenticated');await assert.rejects(db.query('select * from agenda_totales_read()'),/permission/);
 }finally{await db.close();}
});
