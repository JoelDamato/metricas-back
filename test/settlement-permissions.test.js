const {test}=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const auth=require('../modules/auth/service');
const commissions=require('../modules/metricasv2/services/commissions.service');
const supabase=require('../modules/metricasv2/services/supabase.service');
const ledger=require('../modules/settlements/service');
const access=require('../modules/auth/access');
const router=require('../modules/settlements/router');
const people=[
 ['Belen Herrera','belenherrera.gestion@gmail.com','csm'],
 ['Carlos Tu','charliecarlostu@gmail.com','comercial'],
 ['Claudio Nicolini','meg.claudionicolini@gmail.com','comercial'],
 ['Leonardo Alaniz','leonardoalaniz19@gmail.com','comercial'],
 ['Mauro Gaitan','gaitanmauro23@gmail.com','comercial'],
 ['Nahuel Iasci','iascinahuel@gmail.com','comercial'],
 ['Pablo Butera Vie','pmbutera1234@gmail.com','comercial'],
 ['Patricia Conti','posadaelmontecito@gmail.com','comercial'],
 ['Walter Alegre','walteralegre56@gmail.com','comercial']
].map(([nombre,email,role])=>({nombre,email,role,activo:true}));
test('nueve comisionistas ven sólo su liquidación y no pueden cargar ni anular movimientos',async t=>{
 const managers=[{nombre:'Nadia',email:'nadia.cavallini@gmail.com',role:'total'},{nombre:'Mati',email:'matirandazzo@gmail.com',role:'total'}];
 const all=[...people,...managers];
 const dashboard={config:{personRoles:people.map(u=>({person:u.nombre,role:'Closer'}))},details:[],bonusCandidates:[],locked:false,movementRows:people.map((u,i)=>({id:String(i),person_email:u.email,kind:'adelanto',status:'approved',amount_ars:100+i,concept:'Privado de '+u.email}))};
 t.mock.method(auth,'listUsers',async()=>all);
 t.mock.method(commissions,'buildCommissionDashboard',async()=>dashboard);
 t.mock.method(commissions,'buildUserCommercialArea',()=>({summary:{totalCommission:1000},details:[]}));
 t.mock.method(supabase,'listAllRows',async()=>[]);
 t.mock.method(supabase,'getAgendaBonusRules',async()=>({}));
 t.mock.method(supabase,'getReportesPremioConfig',async()=>({cash_collected_premio_pct:0}));
 let writes=0;t.mock.method(ledger,'write',async()=>{writes++;throw Error('Unexpected financial write');});
 const app=express();app.use(express.json());app.use((req,res,next)=>{req.authUser=all.find(u=>u.email===req.headers['x-test-user']);next();});app.use('/settlements',router);app.use((err,req,res,next)=>res.status(err.statusCode||500).json({message:err.message}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
 const base='http://127.0.0.1:'+server.address().port+'/settlements';
 const request=(user,url='',method='GET',body)=>fetch(base+url,{method,headers:{'x-test-user':user.email,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 for(const user of people){
  const response=await request(user,'?month=2026-10&email=nadia.cavallini%40gmail.com&person_email=otro%40example.com&canManage=true');
  assert.equal(response.status,200);const data=await response.json();assert.equal(data.canManage,false);assert.equal(data.rows.length,1);assert.equal(data.rows[0].email,user.email);assert(data.rows[0].entries.every(e=>e.person_email===user.email));
  assert.equal(access.canAccessCommissionsForUser(user),false);
  for(const email of [user.email,people[0].email])assert.equal((await request(user,'','POST',{email,month:'2026-10',kind:'adelanto',amount:100,currency:'ARS'})).status,403);
  if(user.email!=='leonardoalaniz19@gmail.com'){
   assert.equal((await request(user,'/0/void','POST',{reason:'Intento no autorizado'})).status,403);
   assert.equal((await request(user,'/approve','POST',{email:people[0].email})).status,403);
   assert.deepEqual(data.candidates,[]);
  }
 }
 for(const manager of managers){const res=await request(manager,'?month=2026-10');const data=await res.json();assert.equal(res.status,200);assert.equal(data.rows.length,9);assert.equal(data.canManage,true);}
 assert.equal((await fetch(base+'?month=2026-10')).status,401);assert.equal(writes,0);
 dashboard.bonusCandidates=[{id:'test',person:'Carlos Tu',bonusUsd:100}];
 dashboard.movementRows.push({id:'bonus',kind:'bono',person_email:people[1].email,source_key:'agendas-setter:test',status:'approved',amount:100,currency:'USD',exchange_rate:1500,concept:'private concept',void_reason:'private reason'});
 const approved=await router._test.candidates('2026-10',dashboard,await router._test.users(dashboard));
 assert.deepEqual(Object.keys(approved[0].movement).sort(),['id','status','amount','currency','exchange_rate'].sort());
});
