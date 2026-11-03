const express=require('express'),axios=require('axios');
const env=require('../metricasv2/config/env'),access=require('../auth/access');
const {buildWorld}=require('./model');
async function loadRows(){const rows=[];for(let offset=0;;offset+=1000){const {data}=await axios.get(`${env.supabaseUrl}/rest/v1/mati_world_sources`,{headers:{apikey:env.supabaseKey,Authorization:`Bearer ${env.supabaseKey}`},params:{select:'*',order:'id',limit:1000,offset},timeout:30000});rows.push(...data);if(data.length<1000)return rows;if(rows.length>=20000)throw Error('El mapa superó el límite operativo; se requiere paginación adicional.');}}
function createRouter(load=loadRows){const router=express.Router();let cached=null,pending=null,expires=0;
 router.use((req,res,next)=>{res.set('Cache-Control','private, no-store');if(!req.authUser)return res.status(401).json({message:'Sesión requerida'});
 if(!access.canAccessPageForUser(req.authUser,'mati-world.html'))return res.status(403).json({message:'Sin acceso a Mati World'});
 if(req.method!=='GET')return res.status(405).set('Allow','GET').json({message:'Mati World es de sólo lectura'});next();});
 router.get('/',async(req,res)=>{try{
  if(!cached||Date.now()>=expires){if(!pending)pending=load().then(rows=>{cached=rows;expires=Date.now()+20000;return rows;}).finally(()=>{pending=null;});await pending;}
  res.json({...buildWorld(cached),syncedAt:new Date(expires-20000).toISOString(),refreshSeconds:30});
 }catch{res.status(503).json({message:'No se pudo sincronizar el mundo. Reintentá en unos segundos.'});}});return router;}
module.exports={createRouter,loadRows};
