const {test}=require('node:test'),assert=require('node:assert/strict'),express=require('express');
const {validate,publicRouter,privateRouter,canRead}=require('../modules/training/router');
const access=require('../modules/auth/access');
const payload={nombre:'Test Ejemplo',email:' PERSONA@example.com ',submissionKey:'00000000-0000-4000-8000-000000000001',respuestas:Array(30).fill('D')};
test('DISC valida respuestas, normaliza email y recalcula puntajes ignorando datos del navegador',()=>{
 const row=validate({...payload,conteo:{I:30},fecha:'2000-01-01'});assert.equal(row.email,'persona@example.com');assert.equal(row.scores.D,30);assert.equal(row.percentages.D,100);assert.deepEqual(row.predominant,['D']);assert.equal(row.submitted_at,undefined);
 for(const invalid of [{email:''},{respuestas:Array(29).fill('D')},{respuestas:Array(30).fill('X')},{nombre:''}])assert.throws(()=>validate({...payload,...invalid}));
 assert(canRead({email:'leonardoalaniz19@gmail.com'}));assert(!canRead({email:'walteralegre56@gmail.com',role:'total'}));
 assert(access.canAccessPageForUser({email:'leonardoalaniz19@gmail.com',role:'comercial'},'entrenamiento.html'));
});
test('envíos persisten una vez por email, reintentos idempotentes y listado privado',async()=>{
 let saved=[];const request=async(params,method='get',row)=>{if(method==='post'){if(saved.some(r=>r.email===row.email||r.submission_key===row.submission_key)){const e=new Error();e.response={data:{code:'23505'}};throw e;}const value={...row,id:'1',submitted_at:'2026-10-10T01:02:03Z'};saved.push(value);return[value];}if(params.email)return saved.filter(r=>params.email==='eq.'+r.email&&params.submission_key==='eq.'+r.submission_key);return saved;};
 const app=express();app.use(express.json());app.use('/public',publicRouter(request));app.use('/private',(req,res,next)=>{if(req.headers['x-user'])req.authUser={email:req.headers['x-user']};next();},privateRouter(request));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const url='http://127.0.0.1:'+server.address().port;
 try{const post=b=>fetch(url+'/public/disc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
 assert.equal((await post(payload)).status,201);assert.equal((await post(payload)).status,200);assert.equal((await post({...payload,email:'PERSONA@EXAMPLE.COM',submissionKey:'00000000-0000-4000-8000-000000000002'})).status,409);assert.equal(saved.length,1);
 assert.equal((await fetch(url+'/private')).status,401);assert.equal((await fetch(url+'/private',{headers:{'x-user':'walteralegre56@gmail.com'}})).status,403);const data=await (await fetch(url+'/private',{headers:{'x-user':'leonardoalaniz19@gmail.com'}})).json();assert.equal(data.rows[0].submitted_at,'2026-10-10T01:02:03Z');assert.equal(data.rows[0].answers.length,30);
 }finally{await new Promise(r=>server.close(r));}
});
test('base de datos impide duplicados y lecturas anónimas',async()=>{
 const {PGlite}=require('@electric-sql/pglite'),fs=require('fs');const db=new PGlite();try{await db.exec('create role anon;create role authenticated;create role service_role;');await db.exec(fs.readFileSync('supabase/migrations/20261010010000_training_disc.sql','utf8'));const row=validate(payload);const insert=()=>db.query('insert into training_disc_submissions(submission_key,email,nombre,answers,scores,percentages,predominant) values($1,$2,$3,$4,$5,$6,$7) returning submitted_at',[row.submission_key,row.email,row.nombre,JSON.stringify(row.answers),JSON.stringify(row.scores),JSON.stringify(row.percentages),JSON.stringify(row.predominant)]);assert((await insert()).rows[0].submitted_at);await assert.rejects(insert());await db.exec('set role anon');await assert.rejects(db.query('select * from training_disc_submissions'));}finally{await db.close();}
});
