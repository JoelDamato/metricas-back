const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const {validate,createStore}=require('../modules/administration/service');
const {invoiceCategory}=require('../public/metricas-v2/js/views/invoice-category');
const {canAccessPageForUser}=require('../modules/auth/access');
const team={name:'Persona de prueba',area:'CSM',position:'Consultor',birthday:'1990-05-10',startDate:'2020-01-01',vacationYear:2026,vacationAllowance:14,vacations:[{from:'2026-12-01',to:'2026-12-07'}]};
test('facturas emitidas conservan la condición autorizada y desconocidas no se presumen RI',()=>{
 assert.equal(invoiceCategory({arcaInvoiceType:'A',arcaVatCondition:'Responsable Monotributo',vatConditionId:1}).key,'A-MONO');
 assert.equal(invoiceCategory({arcaInvoiceType:'A',arcaVatConditionId:1,vatConditionId:6}).key,'A-RI');
 assert.equal(invoiceCategory({arcaInvoiceType:'B'}).key,'B');
 assert.equal(invoiceCategory({vatConditionId:6}).key,'A-MONO');
 assert.equal(invoiceCategory({requestedInvoiceType:'A'}).key,'unknown');
 assert.equal(invoiceCategory({identificationType:'CUIT'}).key,'unknown');
});
test('valida fechas reales, períodos sin superposición y enlaces web seguros',()=>{
 assert.equal(validate('team',team).name,team.name);
 assert.throws(()=>validate('team',{...team,birthday:'2026-02-30'}),/fecha inválida/);
 assert.throws(()=>validate('team',{...team,vacations:[{from:'2026-12-01',to:'2026-12-07'},{from:'2026-12-07',to:'2026-12-09'}]}),/superponerse/);
 assert.throws(()=>validate('tutorials',{title:'T',area:'Admin',url:'javascript:alert(1)'}),/enlace/i);
 assert.throws(()=>validate('tutorials',{title:'T',area:'Admin',url:'https://user:password@example.com'}),/enlace/i);
 assert.equal(validate('tutorials',{title:'T',area:'Admin',url:'https://example.com/video'}).url,'https://example.com/video');
});
test('páginas de legajos y tutoriales respetan permisos de Administración',()=>{
 for(const page of ['equipo-mr.html','tutoriales-admin.html']){
  assert(canAccessPageForUser({email:'nadia.cavallini@gmail.com',role:'total'},page));
  assert(!canAccessPageForUser({email:'x@example.com',role:'csm'},page));
  assert(!canAccessPageForUser({email:'nadia.cavallini@gmail.com',role:'total',access_config:{canAccessAdministration:false}},page));
 }
});
test('persistencia: crear, editar, detectar conflicto, archivar y restaurar; RLS bloquea clientes directos',async()=>{
 const db=new PGlite();process.env.SUPABASE_URL='https://example.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='test';
 try{
  await db.exec('create role anon;create role authenticated;create role service_role;');
  await db.exec(fs.readFileSync('supabase/migrations/20261020200000_administration_resources.sql','utf8'));
  const adapter={
   async get(url,{params}){return {data:(await db.query('select * from administration_resources where kind=$1 order by id limit $2 offset $3',[params.kind.slice(3),params.limit,params.offset])).rows};},
   async post(url,row){return {data:(await db.query('insert into administration_resources(id,kind,data,archived,version,updated_by) values($1,$2,$3,$4,$5,$6) returning *',[row.id,row.kind,JSON.stringify(row.data),row.archived,row.version,row.updated_by])).rows};},
   async patch(url,row,{params}){return {data:(await db.query('update administration_resources set data=$1,archived=$2,version=$3,updated_by=$4 where id=$5 and kind=$6 and version=$7 returning *',[JSON.stringify(row.data),row.archived,row.version,row.updated_by,params.id.slice(3),params.kind.slice(3),Number(params.version.slice(3))])).rows};}
  };
  const store=createStore(adapter),id='00000000-0000-4000-8000-000000000001',user={email:'admin@example.test'};
  const first=await store.save('team',id,{version:0,archived:false,data:team},user);assert.equal(first.version,1);
  assert.equal((await store.list('team')).length,1);assert.equal((await store.list('tutorials')).length,0);
  const edited=await store.save('team',id,{version:1,archived:false,data:{...team,position:'Nuevo cargo'}},user);assert.equal(edited.data.position,'Nuevo cargo');
  await assert.rejects(store.save('team',id,{version:1,archived:false,data:team},user),e=>e.statusCode===409);
  await store.save('team',id,{version:2,archived:true,data:edited.data},user);assert.equal((await store.list('team'))[0].archived,true);
  await store.save('team',id,{version:3,archived:false,data:edited.data},user);assert.equal((await store.list('team'))[0].archived,false);
  await db.exec('set role anon');await assert.rejects(db.query('select * from administration_resources'),/permission denied/);await db.exec('reset role;set role authenticated');await assert.rejects(db.query('select * from administration_resources'),/permission denied/);
 }finally{await db.close();}
});
test('API exige sesión y permiso para listar y guardar, incluso accediendo por URL directa',async()=>{
 const express=require('express'),{createRouter}=require('../modules/administration/router');let reads=0,writes=0;
 const app=express();app.use(express.json());app.use((req,res,next)=>{if(req.headers['x-test-user'])req.authUser={email:req.headers['x-test-user'],role:'total'};next();});
 app.use('/admin',createRouter({list:async()=>{reads++;return[];},save:async()=>{writes++;return{};}}));
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 try{const base=`http://127.0.0.1:${server.address().port}/admin/team`;
  assert.equal((await fetch(base)).status,401);
  assert.equal((await fetch(base,{headers:{'x-test-user':'other@example.test'}})).status,403);
  assert.equal((await fetch(base+'/id',{method:'PUT',headers:{'x-test-user':'other@example.test','Content-Type':'application/json'},body:'{}'})).status,403);
  assert.equal(reads,0);assert.equal(writes,0);
  assert.equal((await fetch(base,{headers:{'x-test-user':'nadia.cavallini@gmail.com'}})).status,200);assert.equal(reads,1);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
