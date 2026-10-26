const {test}=require('node:test'),assert=require('node:assert/strict');
const ledger=require('../modules/settlements/service');
test('liquidación separa comisión, bonos aprobados y retiros sin duplicar bonos',()=>{
 const entries=[{kind:'bono',status:'approved',amount_ars:100},{kind:'adelanto',status:'approved',amount_ars:200},{kind:'retiro',status:'void',amount_ars:999}];
 const result=ledger.calculate({summary:{totalCommission:1100},details:[{isBonus:true,commissionAmount:100}]},entries);
 assert.equal(result.commission,1000);assert.equal(result.bonuses,100);assert.equal(result.withdrawals,200);assert.equal(result.total,900);
 assert(ledger.canManage({email:'nadia.cavallini@gmail.com'}));assert(!ledger.canApprove({email:'nadia.cavallini@gmail.com'}));assert(ledger.canApprove({email:'leonardoalaniz19@gmail.com'}));
});
test('movimientos preservan auditoría, idempotencia, permisos y bloqueo mensual',async()=>{
 const {PGlite}=require('@electric-sql/pglite'),fs=require('fs'),db=new PGlite();
 try{await db.exec('create role anon;create role authenticated;create role service_role;create table commission_month_snapshots(month_key text primary key,locked boolean);');await db.exec(fs.readFileSync('supabase/migrations/20261010040000_commission_movements.sql','utf8'));
 const row={request_key:'00000000-0000-4000-8000-000000000001',month_key:'2026-10',person_email:'persona@example.com',person_name:'Persona',kind:'adelanto',amount:100,currency:'USD',exchange_rate:1500,effective_date:'2026-10-10',concept:'Adelanto'};
 const write=async(action,actor,data)=>(await db.query('select commission_movement_write($1,$2,$3) as result',[action,actor,JSON.stringify(data)])).rows[0].result;
 await assert.rejects(write('create','otro@example.com',row));const saved=await write('create','nadia.cavallini@gmail.com',row);assert.equal(Number(saved.amount_ars),150000);assert.equal((await write('create','nadia.cavallini@gmail.com',row)).id,saved.id);
 assert.equal((await db.query('select * from commission_movement_audit')).rows.length,1);
 await assert.rejects(write('create','nadia.cavallini@gmail.com',{...row,amount:101}));
 const bono={...row,request_key:'00000000-0000-4000-8000-000000000002',kind:'bono',source_key:'sistema-agendas'};await assert.rejects(write('create','nadia.cavallini@gmail.com',bono));await write('create','leonardoalaniz19@gmail.com',bono);await assert.rejects(write('create','leonardoalaniz19@gmail.com',{...bono,request_key:'00000000-0000-4000-8000-000000000003'}));
 await assert.rejects(write('void','charliecarlostu@gmail.com',{id:saved.id,reason:'Intento de otro usuario'}));
 await assert.rejects(write('void','leonardoalaniz19@gmail.com',{id:saved.id,reason:'Leo no administra retiros'}));
 assert.equal((await db.query('select status from commission_movements where id=$1',[saved.id])).rows[0].status,'approved');
 const cancelled=await write('void','nadia.cavallini@gmail.com',{id:saved.id,reason:'Corrección de carga'});assert.equal(cancelled.status,'void');assert.equal((await db.query('select * from commission_movement_audit')).rows.length,3);
 await db.exec("insert into commission_month_snapshots values('2026-11',true)");await assert.rejects(write('create','nadia.cavallini@gmail.com',{...row,month_key:'2026-11',request_key:'00000000-0000-4000-8000-000000000004'}));
 await db.exec('set role anon');await assert.rejects(db.query('select * from commission_movements'));
 }finally{await db.close();}
});

test('arrastra deuda entre meses y años, la compensa con comisión y bonos, sin arrastrar saldos positivos',async()=>{
 const people=[{email:'a',raw:{email:'a'}},{email:'b',raw:{email:'b'}}];
 const dashboards={
  '2026-11':{commission:100,movementRows:[{person_email:'a',kind:'adelanto',status:'approved',amount_ars:500},{person_email:'b',kind:'retiro',status:'void',amount_ars:900}]},
  '2026-12':{commission:100,movementRows:[{person_email:'a',kind:'bono',status:'approved',amount_ars:50}]},
  '2027-01':{commission:300,movementRows:[]}
 };
 const personal=(d)=>({summary:{totalCommission:d.commission},details:[]});
 const before=await ledger.openingBalances('2027-01',people,'2026-11',async key=>dashboards[key],personal);
 assert.deepEqual(before,{a:-250,b:0});
 const january=ledger.calculate(personal(dashboards['2027-01']),[],before.a);
 assert.equal(january.openingBalance,-250);assert.equal(january.total,50);
 assert.deepEqual(await ledger.openingBalances('2027-02',people,'2026-11',async key=>dashboards[key],personal),{a:0,b:0});
 assert.deepEqual(await ledger.openingBalances('2026-11',people,null,()=>{throw Error('No history needed')},personal),{a:0,b:0});
});

test('Nadia carga y anula bonos manuales sin aprobar automáticos; mantiene idempotencia y bloqueo',async()=>{
 const {PGlite}=require('@electric-sql/pglite'),fs=require('fs'),db=new PGlite();
 try{
  await db.exec('create role anon;create role authenticated;create role service_role;create table commission_month_snapshots(month_key text primary key,locked boolean);');
  for(const migration of ['20261010040000_commission_movements.sql','20261026160000_manual_settlement_bonuses.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+migration,'utf8'));
  const row={request_key:'00000000-0000-4000-8000-000000000010',month_key:'2026-10',person_email:'persona@example.com',person_name:'Persona',kind:'bono',source_key:'manual:test',amount:100,currency:'ARS',exchange_rate:1,effective_date:'2026-10-26',concept:'Bono por desempeño'};
  const write=async(action,actor,data)=>(await db.query('select commission_movement_write($1,$2,$3) as result',[action,actor,JSON.stringify(data)])).rows[0].result;
  await assert.rejects(write('create','charliecarlostu@gmail.com',row));
  await assert.rejects(write('create','nadia.cavallini@gmail.com',{...row,source_key:'sistema-agendas'}));
  const saved=await write('create','nadia.cavallini@gmail.com',row);
  assert.equal((await write('create','nadia.cavallini@gmail.com',row)).id,saved.id);
  assert.equal(ledger.calculate({summary:{totalCommission:0}},[saved]).total,100);
  assert.equal((await write('void','nadia.cavallini@gmail.com',{id:saved.id,reason:'Error de carga'})).status,'void');
  await db.exec("insert into commission_month_snapshots values('2026-11',true)");
  await assert.rejects(write('create','nadia.cavallini@gmail.com',{...row,month_key:'2026-11',request_key:'00000000-0000-4000-8000-000000000011'}));
 }finally{await db.close();}
});
