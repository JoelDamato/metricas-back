const express = require('express');
const axios = require('axios');
const {createHash} = require('node:crypto');
const env = require('../metricasv2/config/env');
const access = require('../auth/access');
const headers = () => ({apikey:env.supabaseKey, Authorization:`Bearer ${env.supabaseKey}`, Prefer:'return=representation'});
async function db(table, params={}, method='get', data) {
  return (await axios({url:`${env.supabaseUrl}/rest/v1/${table}`,method,params,data,headers:headers(),timeout:30000})).data;
}
function extractRecordings(rows) {
  const results = new Map();
  for (const row of rows) {
    const text = typeof row.recordings === 'string' ? row.recordings : '';
    for (const match of text.matchAll(/https?:\/\/[^\s<>"']+/gi)) {
      const url = match[0].replace(/[.,;!?)\]}]+$/, '');
      try { const parsed=new URL(url); if(!['https:','http:'].includes(parsed.protocol)||parsed.username||parsed.password)continue; } catch { continue; }
      const id=createHash('sha256').update(`${row.ghlid}\n${url}`).digest('hex');
      results.set(id,{id,ghlid:row.ghlid,name:row.name||'Cliente sin nombre',url});
    }
  }
  return [...results.values()].sort((a,b)=>a.name.localeCompare(b.name,'es')||a.id.localeCompare(b.id));
}
const canCurate = user => ['leonardoalaniz19@gmail.com','matirandazzo@gmail.com'].includes(String(user?.email || '').trim().toLowerCase());
function createRouter(request=db) {
  const router=express.Router(); let cached=null,expires=0;
  async function library() {
    if(cached&&Date.now()<expires)return cached;
    const rows=[];
    for(let offset=0;;offset+=250){const batch=await request('recording_sources',{select:'ghlid,name,recordings',recordings:'not.is.null',order:'ghlid',limit:250,offset});rows.push(...batch);if(batch.length<250)break;}
    cached=extractRecordings(rows);expires=Date.now()+60000;return cached;
  }
  router.use((req,res,next)=>{if(!req.authUser)return res.status(401).json({message:'Sesión requerida'});if(!access.canAccessPageForUser(req.authUser,'grabaciones.html'))return res.status(403).json({message:'Sin acceso a grabaciones'});res.set('Cache-Control','no-store');next();});
  const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next);
  router.get('/',wrap(async(req,res)=>{
    const recordings=await library(),top=[];
    for(let offset=0;;offset+=500){const rows=await request('recording_top',{select:'recording_id,selected_name,selected_at',order:'recording_id',limit:500,offset});top.push(...rows);if(rows.length<500)break;}
    const selected=new Map(top.map(row=>[row.recording_id,row]));
    res.json({recordings:recordings.map(row=>({...row,top:selected.get(row.id)||null})),canCurate:canCurate(req.authUser)});
  }));
  router.put('/:recordingId/top',wrap(async(req,res)=>{
    if(!canCurate(req.authUser))return res.status(403).json({message:'Sólo Leo o Mati pueden seleccionar grabaciones Top'});
    const id=req.params.recordingId;
    if(typeof req.body?.selected!=='boolean')return res.status(400).json({message:'Selección inválida'});
    if((await library()).every(row=>row.id!==id))return res.status(404).json({message:'Grabación no encontrada'});
    if(req.body.selected){
      try{await request('recording_top',{},'post',{recording_id:id,selected_by:req.authUser.email.toLowerCase(),selected_name:req.authUser.nombre||req.authUser.email});}
      catch(e){if(e.response?.status!==409)throw e;}
    }else await request('recording_top',{recording_id:`eq.${id}`},'delete');
    const rows=await request('recording_top',{recording_id:`eq.${id}`,select:'recording_id,selected_name,selected_at'});
    res.json({top:rows[0]||null});
  }));
  // Validate the stable recording identity before any comment operation.
  router.use('/:recordingId/comments',async(req,res,next)=>{try{if(!/^[a-f0-9]{64}$/.test(req.params.recordingId)||(await library()).every(r=>r.id!==req.params.recordingId))return res.status(404).json({message:'Grabación no encontrada'});next();}catch(e){next(e);}});
  const present=(row,user)=>({...row,author_email:undefined,canEdit:row.author_email===String(user.email).toLowerCase()});
  router.get('/:recordingId/comments',wrap(async(req,res)=>{const rows=[];for(let offset=0;;offset+=500){const batch=await request('recording_comments',{recording_id:`eq.${req.params.recordingId}`,order:'created_at,id',limit:500,offset});rows.push(...batch);if(batch.length<500)break;}res.json({comments:rows.map(r=>present(r,req.authUser))});}));
  const body=req=>typeof req.body?.body==='string'?req.body.body.trim():'';
  router.post('/:recordingId/comments',wrap(async(req,res)=>{const text=body(req);if(!text||text.length>4000)return res.status(400).json({message:'Escribí un comentario de hasta 4000 caracteres'});const rows=await request('recording_comments',{},'post',{recording_id:req.params.recordingId,author_email:String(req.authUser.email).toLowerCase(),author_name:req.authUser.nombre||req.authUser.email,body:text});res.status(201).json({comment:present(rows[0],req.authUser)});}));
  async function mutate(req,res,method){const revision=req.body?.revision;if(!/^[a-f0-9-]{36}$/i.test(req.params.id)||!Number.isInteger(revision)||revision<1)return res.status(400).json({message:'Comentario inválido'});const text=body(req);if(method==='patch'&&(!text||text.length>4000))return res.status(400).json({message:'Escribí un comentario de hasta 4000 caracteres'});const rows=await request('recording_comments',{id:`eq.${req.params.id}`,recording_id:`eq.${req.params.recordingId}`,author_email:`eq.${String(req.authUser.email).toLowerCase()}`,revision:`eq.${revision}`},method,method==='patch'?{body:text,revision:revision+1,updated_at:new Date().toISOString()}:undefined);if(!rows.length)return res.status(409).json({message:'El comentario cambió, fue eliminado o pertenece a otro usuario. Actualizá los comentarios.'});res.json({ok:true});}
  router.patch('/:recordingId/comments/:id',wrap((req,res)=>mutate(req,res,'patch')));
  router.delete('/:recordingId/comments/:id',wrap((req,res)=>mutate(req,res,'delete')));
  return router;
}
module.exports={createRouter,extractRecordings};
