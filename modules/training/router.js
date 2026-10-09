const express=require('express'),axios=require('axios');
const env=require('../metricasv2/config/env');
const canRead=user=>['leonardoalaniz19@gmail.com','matirandazzo@gmail.com'].includes(String(user?.email||'').trim().toLowerCase());
async function db(params,method='get',data){return (await axios({url:env.supabaseUrl+'/rest/v1/training_disc_submissions',method,params,data,headers:{apikey:env.supabaseKey,Authorization:'Bearer '+env.supabaseKey,Prefer:'return=representation'},timeout:20000})).data;}
async function attemptDb(params,method='get',data){return (await axios({url:env.supabaseUrl+'/rest/v1/training_disc_attempts',method,params,data,headers:{apikey:env.supabaseKey,Authorization:'Bearer '+env.supabaseKey,Prefer:'return=representation'},timeout:20000})).data;}
async function saveAttempt(key,answers=null,revision=0,finish=false,generation=0){return (await axios.post(env.supabaseUrl+'/rest/v1/rpc/disc_attempt_save',{p_key:key,p_answers:answers,p_revision:revision,p_finish:finish,p_generation:generation},{headers:{apikey:env.supabaseKey,Authorization:'Bearer '+env.supabaseKey},timeout:20000})).data;}

function validate(body={}){
 const nombre=String(body.nombre||'').trim(),email=String(body.email||'').trim().toLowerCase(),answers=body.respuestas;
 if(nombre.length<2||nombre.length>150||email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Ingresá nombre y email válidos.');
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.submissionKey||''))throw Error('Identificador de envío inválido. Recargá el test.');
 if(!Array.isArray(answers)||answers.length!==30||answers.some(a=>!['D','I','S','C'].includes(a)))throw Error('Completá las 30 preguntas antes de enviar.');
 const scores={D:0,I:0,S:0,C:0};answers.forEach(a=>scores[a]++);
 const percentages=Object.fromEntries(Object.entries(scores).map(([k,v])=>[k,Math.round(v/30*1000)/10]));
 const max=Math.max(...Object.values(scores));
 return {nombre,email,answers,scores,percentages,predominant:Object.keys(scores).filter(k=>scores[k]===max),submission_key:body.submissionKey,test_version:'disc-v1'};
}
function publicRouter(request=db,attemptStore=attemptDb,save=saveAttempt){
 const router=express.Router(),limits=new Map();
 router.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
 router.post('/disc/start',async(req,res)=>{
  const now=Date.now();for(const [k,v] of limits)if(v.until<now)limits.delete(k);
  const limit=limits.get(req.ip)||{count:0,until:now+3600000};limit.count++;limits.set(req.ip,limit);
  if(limit.count>60||limits.size>10000)return res.status(429).json({message:'Demasiados intentos. Volvé a intentar más tarde.'});
  const nombre=String(req.body?.nombre||'').trim(),email=String(req.body?.email||'').trim().toLowerCase();
  if(nombre.length<2||nombre.length>150||email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({message:'Ingresá nombre y email válidos.'});
  try{
   if((await request({email:'eq.'+email,select:'id',limit:1})).length)return res.status(409).json({message:'Este email ya tiene un test registrado.'});
   const row=(await attemptStore({},'post',{nombre,email}))[0];
   res.status(201).json({attemptKey:row.attempt_key,startedAt:row.started_at,deadlineAt:row.deadline_at,serverNow:new Date().toISOString()});
  }catch(e){res.status(e.response?.data?.code==='23505'?409:503).json({message:e.response?.data?.code==='23505'?'Este email ya inició el test. Retomalo desde el mismo navegador.':'No se pudo iniciar el test. Volvé a intentar.'});}
 });
 router.post('/disc',async(req,res)=>{
  const key=req.body?.submissionKey;
  if(!/^[0-9a-f-]{36}$/i.test(key||''))return res.status(400).json({message:'Iniciá el test para activar el reloj.'});
  try{const result=await save(key,req.body.respuestas??null,Math.max(0,Math.min(100000,parseInt(req.body.revision,10)||0)),req.body.finish===true,Math.max(0,parseInt(req.body.generation,10)||0));res.json({ok:true,...result});}
  catch(e){res.status(e.response?.status===400?400:503).json({message:e.response?.status===400?'No se pudo validar el intento o las respuestas.':'No se pudo guardar. Reintentá sin cerrar esta pantalla.'});}
 });return router;
}
function privateRouter(request=db){
 const router=express.Router();router.use((req,res,next)=>{res.set('Cache-Control','no-store');if(!req.authUser)return res.status(401).json({message:'Sesión requerida'});if(!canRead(req.authUser))return res.status(403).json({message:'Sin acceso al Centro de entrenamiento'});next();});
 router.get('/',async(req,res)=>{try{const offset=Math.max(0,parseInt(req.query.offset,10)||0);const rows=await request({completion_status:'eq.completed',select:'id,nombre,email,percentages,predominant,submitted_at,test_version,answers,started_at,completion_status',order:'submitted_at.desc,id.desc',limit:51,offset});res.json({rows:rows.slice(0,50),hasMore:rows.length>50});}catch{res.status(503).json({message:'No se pudieron cargar los resultados. Volvé a intentar.'});}});return router;
}
module.exports={publicRouter,privateRouter,validate,canRead};
