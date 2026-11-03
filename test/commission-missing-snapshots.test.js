const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
const {PGlite}=require('@electric-sql/pglite');
test('repara tabla mensual ausente y permite guardar sin perder bloqueos, auditoría ni idempotencia',async()=>{
 const db=new PGlite();
 try {
  await db.exec('create role anon; create role authenticated; create role service_role;');
  const apply=async name=>db.exec(fs.readFileSync('supabase/migrations/'+name,'utf8'));
  await apply('20261010040000_commission_movements.sql');
  await apply('20261026160000_manual_settlement_bonuses.sql');
  const data={request_key:'00000000-0000-4000-8000-000000000101',month_key:'2026-10',person_email:'persona@example.com',person_name:'Persona',kind:'bono',source_key:'manual:repair-test',amount:155700,currency:'ARS',exchange_rate:1,effective_date:'2026-10-30',concept:'Prueba'};
  const save=()=>db.query("select commission_movement_write('create','matirandazzo@gmail.com',$1) as result",[JSON.stringify(data)]);
  await assert.rejects(save(),/commission_month_snapshots/);
  await apply('20261103120000_restore_commission_month_snapshots.sql');
  const saved=(await save()).rows[0].result;
  assert.equal(Number(saved.amount_ars),155700);
  assert.equal((await save()).rows[0].result.id,saved.id);
  assert.equal((await db.query('select * from commission_movement_audit')).rows.length,1);
  await db.exec("insert into commission_month_snapshots(month_key,locked,config) values('2026-11',true,'{\"keep\":true}')");
  await apply('20261103120000_restore_commission_month_snapshots.sql');
  assert.deepEqual((await db.query("select config from commission_month_snapshots where month_key='2026-11'")).rows[0].config,{keep:true});
  data.request_key='00000000-0000-4000-8000-000000000102';data.month_key='2026-11';
  await assert.rejects(save(),/mes está bloqueado/);
  await db.exec('set role anon');await assert.rejects(db.query('select * from commission_month_snapshots'));
 } finally {await db.close();}
});
