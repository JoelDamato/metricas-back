const express=require('express');
const axios=require('axios');
const env=require('../metricasv2/config/env');
const service=require('../metricasv2/services/supabase.service');
const access=require('../auth/access');
const model=require('./model');
const editors=new Set(['matirandazzo@gmail.com','leonardoalaniz19@gmail.com']);
const canEdit=user=>editors.has(String(user?.email||'').trim().toLowerCase());
const canRead=user=>Boolean(user)&&access.canAccessPageForUser(user,'objetivos-comerciales.html');
const canViewLeads = user => access.canAccessResourceForUser(user, 'leads_raw');
function url(month,channel){return `${env.supabaseUrl}/storage/v1/object/${env.reportesPersonalesDataBucket}/config/commercial-objectives/${channel?model.channelKey(channel)+'/':''}${model.monthKey(month)}.json`;}
function headers(){return {apikey:env.supabaseKey,Authorization:`Bearer ${env.supabaseKey}`};}
async function read(month,channel){try{const {data}=await axios.get(url(month,channel),{headers:headers(),timeout:15000});if(!data||data.month!==month||(channel&&data.channel!==channel))throw new Error('El objetivo guardado no corresponde al mes solicitado.');return {...data,...model.validate(data)};}catch(e){const d=e.response?.data;if(e.response?.status===404 || (e.response?.status===400 && /object not found/i.test(String(d?.message||d?.error||''))))return null;throw e;}}
async function save(month,input,user,channel){const row={month,...(channel?{channel:model.channelKey(channel)}:{}),...model.validate(input),updatedAt:new Date().toISOString(),updatedBy:user.email};await axios.post(url(month,channel),row,{headers:{...headers(),'Content-Type':'application/json','x-upsert':'true','cache-control':'0'},timeout:15000});return row;}
async function rows(year,month){const options={eqFilters:{anio:year},limit:1000,select:'anio,mes,origen,closer,'+Object.values(model.fields).join(',')};if(month)options.eqFilters.mes=month;return service.listAllRows('agenda_detalle_por_origen_closer',options);}
function createRouter(){const router=express.Router();router.use((req,res,next)=>{if(!req.authUser)return res.status(401).json({ok:false,message:'Sesión requerida'});if(!canRead(req.authUser))return res.status(403).json({ok:false,message:'Sin permiso para Objetivos comerciales'});next();});router.get('/leads', async (req, res, next) => {
  if (!canViewLeads(req.authUser)) {
    return res.status(403).json({ ok: false, message: 'Sin permiso para ver el detalle de leads' });
  }
  try {
    const month = model.monthKey(req.query.month);
    const channel = model.channelKey(req.query.channel);
    const [year, monthNumber] = month.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const records = await service.listAllRows('closer_webinar_leads', {
      from: `${month}-01`,
      to: `${month}-${lastDay}`,
      dateField: 'fecha_agenda',
      orderBy: 'fecha_agenda',
      orderDir: 'asc',
      select: 'nombre,closer,fecha_agenda,fecha_llamada,llamada_meg,aplica,agendo,ghlid,origen',
      limit: 1000
    });
    res.json({ ok: true, leads: model.leadDetails(records, channel) });
  } catch (error) {
    next(error);
  }
});router.get('/history',async(req,res,next)=>{try{const channel=model.channelKey(req.query.channel);const year=Number(req.query.year);model.monthKey(`${year}-01`);const records=await rows(year);const months=await Promise.all(Array.from({length:12},async(_,i)=>{const month=`${year}-${String(i+1).padStart(2,'0')}`;return {month,target:await read(month,channel),...model.aggregate(model.channelRows(records.filter(r=>Number(r.mes)===i+1),channel))};}));res.json({ok:true,months});}catch(e){next(e);}});router.get('/',async(req,res,next)=>{try{const channel=model.channelKey(req.query.channel);const month=model.monthKey(req.query.month);const [year,m]=month.split('-').map(Number);const [target,records]=await Promise.all([read(month,channel),rows(year,m)]);res.json({ok:true,month,channel,target,legacyTarget:target||await read(month,channel==='evergreen'?'lanzamiento':'evergreen')?null:await read(month),...model.aggregate(model.channelRows(records,channel)),canEdit:canEdit(req.authUser),canViewLeads:canViewLeads(req.authUser),team:model.TEAM,consultedAt:new Date().toISOString()});}catch(e){next(e);}});router.post('/',async(req,res,next)=>{try{if(!canEdit(req.authUser))return res.status(403).json({ok:false,message:'Solo Mati y Leo pueden editar objetivos.'});const month=model.monthKey(req.body?.month);const channel=model.channelKey(req.body?.channel);const target=await save(month,req.body,req.authUser,channel);res.json({ok:true,target});}catch(e){next(e);}});return router;}
module.exports={createRouter,read,save,canRead,canEdit};
