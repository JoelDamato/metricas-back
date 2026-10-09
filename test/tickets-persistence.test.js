const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
test('tickets compartidos sobreviven y rechazan escrituras desactualizadas sin perder otras filas', async () => {
 const db = new PGlite();
 try {
  await db.exec('create role anon; create role authenticated; create role service_role;');
  await db.exec(fs.readFileSync('supabase/migrations/20261009140000_support_tickets.sql','utf8'));
  const mutate = changes => db.query('select support_tickets_mutate($1::jsonb)', [JSON.stringify(changes)]);
  const original = {id:'one',status:'Abierto'};
  await mutate([{id:'one',before:null,after:original}]);
  await mutate([{id:'two',before:null,after:{id:'two',status:'Abierto'}}]);
  await mutate([{id:'one',before:original,after:{...original,status:'Resuelto'}}]);
  await assert.rejects(mutate([{id:'one',before:original,after:{...original,status:'Cerrado'}}]), /concurrently/);
  const rows = (await db.query('select payload from support_tickets order by id')).rows;
  assert.equal(rows.length,2);assert.equal(rows[0].payload.status,'Resuelto');
  await db.exec('set role anon');
  await assert.rejects(db.query('select * from support_tickets'), /permission denied/);
 } finally {await db.close();}
});
