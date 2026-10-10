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
 const cancelled=await write('void','nadia.cavallini@gmail.com',{id:saved.id,reason:'Corrección de carga'});assert.equal(cancelled.status,'void');assert.equal((await db.query('select * from commission_movement_audit')).rows.length,3);
 await db.exec("insert into commission_month_snapshots values('2026-11',true)");await assert.rejects(write('create','nadia.cavallini@gmail.com',{...row,month_key:'2026-11',request_key:'00000000-0000-4000-8000-000000000004'}));
 await db.exec('set role anon');await assert.rejects(db.query('select * from commission_movements'));
 }finally{await db.close();}
});
