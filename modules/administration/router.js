const express=require('express');
const {canAccessAdministrationForUser}=require('../auth/access');
const {createStore}=require('./service');
function createRouter(store=createStore()) {
  const router=express.Router();
  router.use((req,res,next)=>{res.set('Cache-Control','no-store');if(!req.authUser)return res.status(401).json({ok:false,message:'Sesión requerida'});if(!canAccessAdministrationForUser(req.authUser))return res.status(403).json({ok:false,message:'Acceso exclusivo de Administración'});next();});
  router.param('kind',(req,res,next,kind)=>['team','tutorials'].includes(kind)?next():res.status(404).json({ok:false,message:'Sección no encontrada'}));
  router.get('/:kind',async(req,res,next)=>{try{res.json({ok:true,rows:await store.list(req.params.kind)});}catch(e){next(e);}});
  router.put('/:kind/:id',async(req,res,next)=>{try{res.json({ok:true,row:await store.save(req.params.kind,req.params.id,req.body,req.authUser)});}catch(e){next(e);}});
  return router;
}
module.exports={createRouter};
