const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
test('Setting atribuye a Brenda, conserva datos originales y sigue los cambios webinar sin duplicar leads',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create table leads_raw(id text primary key,ghlid text,setter text);
 create table leads_ghl_contacts(ghlid text primary key,fields jsonb);
 create view setters as select setter,count(*) as count from leads_raw group by setter;
 insert into leads_raw values('1','juan','Nahuel Iasci'),('2','own','Otro'),('3','regular','Nahuel Iasci');
 insert into leads_ghl_contacts values('juan','{"Setter Webinar":{"value":"Brenda Damato"},"Webinar Turno setter":{"value":"4"}}'),('own','{"Setting webinar":{"value":"Nahuel"}}');`);
 await db.exec(fs.readFileSync('supabase/migrations/20261102220000_webinar_setter_attribution.sql','utf8'));
 assert.deepEqual((await db.query('select setter,count::int from setters order by setter')).rows,[{setter:'Brenda Damato',count:1},{setter:'Nahuel Iasci',count:2}]);
 assert.equal((await db.query("select setter from leads_raw where ghlid='juan'")).rows[0].setter,'Nahuel Iasci');
 await db.exec(`update leads_ghl_contacts set fields='{"Setting webinar":{"value":"Valentina Suarez"}}' where ghlid='juan'`);
 assert.equal((await db.query("select setter from leads_setter_attribution where ghlid='juan'")).rows[0].setter,'Valentina Suarez');
 await db.exec('set role anon');await assert.rejects(db.query('select * from leads_setter_attribution'));await db.exec('reset role');
 }finally{await db.close();}
});
