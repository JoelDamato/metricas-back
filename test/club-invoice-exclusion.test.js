const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
const {PGlite}=require('@electric-sql/pglite');
test('No facturar is reversible, atomic and cannot hide authorized or uncertain ARCA invoices',async()=>{
 const db=new PGlite();
 try{
  await db.exec('create role anon;create role authenticated;create role service_role;');
  for(const file of ['20260722170010_create_mercado_pago_club_workflow.sql','20260722183010_add_arca_credit_note_to_mp_workflow.sql','20260723133010_add_distributed_arca_claims.sql','20260826211500_protect_invoiced_mp_workflow.sql','20261009170000_mp_not_invoiced_queue.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));
  await db.exec("insert into mercado_pago_club_workflow(record_kind,record_id,status,reconciled_at) values('payment','a','reconciled',now()),('payment','b','invoicing',now()),('payment','c','reconciled',now());update mercado_pago_club_workflow set arca_response='{\"pending\":true}' where record_id='c';");
  const move=(ids,excluded)=>db.query('select set_mp_billing_selection($1::jsonb,$2,$3) n',[JSON.stringify(ids.map(id=>({kind:'payment',id}))),excluded,'admin@example.test']);
  await assert.rejects(move(['a','b'],true),/cambió de estado/);
  assert.equal((await db.query("select status from mercado_pago_club_workflow where record_id='a'")).rows[0].status,'reconciled');
  await assert.rejects(move(['c'],true),/emisión ARCA pendiente/);
  assert.equal((await move(['a'],true)).rows[0].n,1);
  assert.equal((await db.query("select * from claim_mp_invoice('payment','a')")).rows.length,0);
  const stale=await db.query(`select reconcile_mp_records('[{"record_kind":"payment","record_id":"a","record_snapshot":{}}]','old@example.test') n`);assert.equal(stale.rows[0].n,0);
  assert.equal((await move(['a'],false)).rows[0].n,1);
  assert.equal((await db.query("select * from claim_mp_invoice('payment','a')")).rows.length,1);
  await db.exec("update mercado_pago_club_workflow set status='invoiced',arca_cae='cae',arca_invoice_number='1' where record_id='a'");
  await assert.rejects(move(['a'],true),/cambió de estado/);
  await db.exec('set role anon');await assert.rejects(move(['b'],true),/permission denied/);
 }finally{await db.close();}
});
test('only administration can move records to No facturar',async()=>{
 const auth=require('../modules/auth/service'),{metricasApiGuard}=require('../modules/auth/middleware');
 const previous=auth.getActiveUserByEmail;
 try{
  for(const [role,allowed] of [['comercial',false],['csm',false],['total',true]]){
   const user={email:allowed?'matirandazzo@gmail.com':'other@example.test',role};auth.getActiveUserByEmail=async()=>user;let status,next=false;
   const res={status(code){status=code;return this;},json(){return this;}};
   await metricasApiGuard({path:'/mercado-pago/club/billing-selection',method:'POST',authUser:user},res,()=>{next=true;});
   assert.equal(next,allowed);if(!allowed)assert.equal(status,403);
  }
 }finally{auth.getActiveUserByEmail=previous;}
});
