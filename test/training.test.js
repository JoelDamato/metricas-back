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
test('inicio público valida email y el resultado privado sigue protegido',async()=>{
 const request=async()=>[];let received;
 const app=express();app.use(express.json());app.use('/public',publicRouter(request,async(_p,_m,data)=>[{...data,attempt_key:payload.submissionKey,started_at:'2026-10-10T00:00:00Z',deadline_at:'2026-10-10T01:00:00Z'}],async(...args)=>{received=args;return{finalized:true,completionStatus:'incomplete'};}));app.use('/private',(req,res,next)=>{if(req.headers['x-user'])req.authUser={email:req.headers['x-user']};next();},privateRouter(request));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const url='http://127.0.0.1:'+server.address().port;
 try{const post=(path,b)=>fetch(url+'/public/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
 assert.equal((await post('disc/start',{nombre:'Ana',email:''})).status,400);const start=await post('disc/start',payload);assert.equal(start.status,201);assert.equal((await start.json()).deadlineAt,'2026-10-10T01:00:00Z');
 const finish=await post('disc',{submissionKey:payload.submissionKey,respuestas:payload.respuestas,revision:4,finish:true});assert.equal((await finish.json()).completionStatus,'incomplete');assert.equal(received[2],4);
 assert.equal((await fetch(url+'/private')).status,401);assert.equal((await fetch(url+'/private',{headers:{'x-user':'walteralegre56@gmail.com'}})).status,403);assert.equal((await fetch(url+'/private',{headers:{'x-user':'leonardoalaniz19@gmail.com'}})).status,200);
 }finally{await new Promise(r=>server.close(r));}
});
test('base de datos impide duplicados y lecturas anónimas',async()=>{
 const {PGlite}=require('@electric-sql/pglite'),fs=require('fs');const db=new PGlite();try{await db.exec('create role anon;create role authenticated;create role service_role;');await db.exec(fs.readFileSync('supabase/migrations/20261010010000_training_disc.sql','utf8'));const row=validate(payload);const insert=()=>db.query('insert into training_disc_submissions(submission_key,email,nombre,answers,scores,percentages,predominant) values($1,$2,$3,$4,$5,$6,$7) returning submitted_at',[row.submission_key,row.email,row.nombre,JSON.stringify(row.answers),JSON.stringify(row.scores),JSON.stringify(row.percentages),JSON.stringify(row.predominant)]);assert((await insert()).rows[0].submitted_at);await assert.rejects(insert());await db.exec('set role anon');await assert.rejects(db.query('select * from training_disc_submissions'));}finally{await db.close();}
});

test('reloj servidor cierra incompletos, conserva respuestas y rechaza cambios tardíos',async()=>{
 const {PGlite}=require('@electric-sql/pglite'),fs=require('fs');const db=new PGlite();try{
 await db.exec('create role anon;create role authenticated;create role service_role;');
 for(const file of ['20261010010000_training_disc.sql','20261010020000_disc_timer.sql','20261010023000_disc_thirty_minutes.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));
 const key=payload.submissionKey;await db.query('insert into training_disc_attempts(attempt_key,email,nombre) values($1,$2,$3)',[key,'timer@example.com','Test reloj']);
 const duration=await db.query('select extract(epoch from (deadline_at-started_at)) as seconds from training_disc_attempts where attempt_key=$1',[key]);assert.equal(Number(duration.rows[0].seconds),1800);
 const answers=Array(30).fill(null);answers[0]='D';
 const save=async(a,revision,finish=false)=>(await db.query('select disc_attempt_save($1,$2,$3,$4) as result',[key,a===null?null:JSON.stringify(a),revision,finish])).rows[0].result;
 await save(answers,2);const stale=await save(Array(30).fill(null),1);assert.equal(stale.answers[0],'D');
 await db.exec("update training_disc_attempts set deadline_at=now()-interval '1 second'");
 const closed=await save(Array(30).fill('I'),3,true);assert.equal(closed.completionStatus,'incomplete');assert.equal(closed.answers.filter(Boolean).length,1);
 const again=await save(Array(30).fill('C'),4,true);assert.equal(again.submittedAt,closed.submittedAt);
 const rows=await db.query('select * from training_disc_submissions');assert.equal(rows.rows.length,1);assert.equal(rows.rows[0].scores.D,1);assert.equal(rows.rows[0].scores.I,0);
 const k2='00000000-0000-4000-8000-000000000002';await db.query('insert into training_disc_attempts(attempt_key,email,nombre) values($1,$2,$3)',[k2,'complete@example.com','Completo']);const completed=(await db.query('select disc_attempt_save($1,$2,1,true) as result',[k2,JSON.stringify(Array(30).fill('C'))])).rows[0].result;assert.equal(completed.completionStatus,'completed');
 }finally{await db.close();}
});
