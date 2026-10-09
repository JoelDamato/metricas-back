const axios = require('axios');
const env = require('../metricasv2/config/env');
const access = require('../auth/access');
const headers = () => ({apikey:env.supabaseKey,Authorization:`Bearer ${env.supabaseKey}`});
async function all(table) {
 const rows=[];
 for(let offset=0;;offset+=1000){const {data}=await axios.get(`${env.supabaseUrl}/rest/v1/${table}`,{headers:headers(),params:{select:'*',order:table==='csm_followup_rules'?'stage':'ghlid',limit:1000,offset},timeout:30000});rows.push(...data);if(data.length<1000)return rows;}
}
const allowed=req=>['total','csm'].includes(req.authUser?.role)&&access.canAccessPageForUser(req.authUser,'csm-tiempo.html');
async function list(req,res,next){try{if(!allowed(req))return res.status(403).json({message:'Sin permiso para seguimiento CSM'});const [notes,profiles,rules]=await Promise.all([all('csm_followup_notes'),all('csm_followup_profiles'),all('csm_followup_rules')]);res.json({notes,profiles,rules});}catch(e){next(e);}}
async function save(req,res,next){try{
 if(!allowed(req))return res.status(403).json({message:'Sin permiso para seguimiento CSM'});
 const {note,revision}=req.body||{},ghlid=req.params.ghlid;
 if(!/^[a-zA-Z0-9]{1,100}$/.test(ghlid)||typeof note!=='string'||note.length>4000||!Number.isInteger(revision)||revision<0)return res.status(400).json({message:'Nota o revisión inválida'});
 const {data}=await axios.post(`${env.supabaseUrl}/rest/v1/rpc/metricas_csm_followup_note`,{p_ghlid:ghlid,p_note:note,p_revision:revision,p_actor:req.authUser.email},{headers:headers(),timeout:30000});
 res.status(data.conflict?409:200).json(data);
}catch(e){next(e);}}
async function saveRule(req,res,next){try{
 if(!allowed(req))return res.status(403).json({message:'Sin permiso para seguimiento CSM'});
 const {yellow,red,revision}=req.body||{},stage=req.params.stage;
 if(!/^(w[1-9]|s[0-3])$/.test(stage)||![yellow,red,revision].every(Number.isInteger)||yellow<0||red<=yellow||red>3650||revision<0)return res.status(400).json({message:'Usá días enteros: rojo debe ser mayor que amarillo (máximo 3650).'});
 const {data}=await axios.post(`${env.supabaseUrl}/rest/v1/rpc/metricas_csm_followup_rule`,{p_stage:stage,p_yellow:yellow,p_red:red,p_revision:revision,p_actor:req.authUser.email},{headers:headers(),timeout:30000});res.status(data.conflict?409:200).json(data);
}catch(e){next(e);}}
module.exports={list,save,saveRule};
