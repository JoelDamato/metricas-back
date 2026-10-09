const express=require('express'),axios=require('axios');
const env=require('../metricasv2/config/env');
const canRead=user=>['leonardoalaniz19@gmail.com','matirandazzo@gmail.com'].includes(String(user?.email||'').trim().toLowerCase());
async function db(params,method='get',data){return (await axios({url:env.supabaseUrl+'/rest/v1/training_disc_submissions',method,params,data,headers:{apikey:env.supabaseKey,Authorization:'Bearer '+env.supabaseKey,Prefer:'return=representation'},timeout:20000})).data;}
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
function publicRouter(request=db){
 const router=express.Router(),limits=new Map();
 router.post('/disc',async(req,res)=>{
  res.set('Cache-Control','no-store');
  const now=Date.now();for(const [k,v] of limits)if(v.until<now)limits.delete(k);
  const key=req.ip,limit=limits.get(key)||{count:0,until:now+3600000};limit.count++;limits.set(key,limit);
  if(limit.count>60||limits.size>10000)return res.status(429).json({message:'Demasiados intentos. Volvé a intentar más tarde.'});
  let row;try{row=validate(req.body);}catch(e){return res.status(400).json({message:e.message});}
  try{
   const saved=(await request({},'post',row))[0];
   return res.status(201).json({ok:true,submittedAt:saved.submitted_at});
  }catch(e){
   if(e.response?.data?.code==='23505'){
    try{const rows=await request({email:'eq.'+row.email,submission_key:'eq.'+row.submission_key,select:'submitted_at'});if(rows[0])return res.json({ok:true,submittedAt:rows[0].submitted_at});}catch{}
    return res.status(409).json({message:'Este email ya tiene un test registrado. No se puede enviar otro.'});
   }
   return res.status(503).json({message:'No pudimos guardar el test. Reintentá el envío; tus respuestas siguen en esta pantalla.'});
  }
 });return router;
}
function privateRouter(request=db){
 const router=express.Router();router.use((req,res,next)=>{res.set('Cache-Control','no-store');if(!req.authUser)return res.status(401).json({message:'Sesión requerida'});if(!canRead(req.authUser))return res.status(403).json({message:'Sin acceso al Centro de entrenamiento'});next();});
 router.get('/',async(req,res)=>{try{const offset=Math.max(0,parseInt(req.query.offset,10)||0);const rows=await request({select:'id,nombre,email,percentages,predominant,submitted_at,test_version,answers',order:'submitted_at.desc,id.desc',limit:51,offset});res.json({rows:rows.slice(0,50),hasMore:rows.length>50});}catch{res.status(503).json({message:'No se pudieron cargar los resultados. Volvé a intentar.'});}});return router;
}
module.exports={publicRouter,privateRouter,validate,canRead};
