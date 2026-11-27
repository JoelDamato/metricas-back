const express=require('express');
const axios=require('axios');
const env=require('../metricasv2/config/env');
const service=require('../metricasv2/services/supabase.service');
const access=require('../auth/access');
const model=require('./model');
const bookings=require('./webinar-bookings');
function createEventFunnelReader() {
  let crmCache;
  let crmRequest;

  function readEventCrm() {
    if (crmCache && Date.now() - crmCache.fetchedAt < 30_000) return crmCache.records;
    if (!crmRequest) {
      crmRequest = axios.get(env.supabaseUrl + '/rest/v1/rpc/commercial_webinar_crm_read', {
        headers:headers(), timeout:33000
      }).then(({data})=>{
        if (!Array.isArray(data?.agendas) || !Array.isArray(data?.sales)) {
          throw new Error('La consulta del CRM devolvió datos incompletos.');
        }
        crmCache={records:data,fetchedAt:Date.now()};
        return data;
      }).catch(()=>{
        throw Object.assign(new Error('No se pudieron consultar los registros de lanzamiento en el CRM.'),{statusCode:502});
      }).finally(()=>{crmRequest=null;});
    }
    return crmRequest;
  }

  return async function readEventFunnel(webinar, requireCrm=false) {
    const crmPromise=readEventCrm();
    const crmRead=webinar===bookings.WEBINAR&&!requireCrm
      ? optionalRead(crmPromise,4000) : crmPromise;
    const [crm,snapshot]=await Promise.all([crmRead,bookings.getSnapshot()]);
    return {
      agendas:bookings.scopedRows(crm?.agendas || [],snapshot.rows,webinar),
      sales:bookings.scopedSales(crm?.sales || [],crm?.agendas || [],snapshot.rows,webinar),
      crmAvailable:Boolean(crm),
      bookingTotals:webinar===bookings.WEBINAR
        ? {confirmed_at_cutoff:bookings.LIVE_CUTOFF.confirmed,
          reservation_count:snapshot.rows.filter(row=>row.aplica==='Aplica').length,verified_at:snapshot.verifiedAt} : null
    };
  };

}

function optionalRead(promise, timeout) {
  let timer;
  return Promise.race([
    Promise.resolve(promise).catch(()=>null),
    new Promise(resolve=>{timer=setTimeout(()=>resolve(null),timeout);})
  ]).finally(()=>clearTimeout(timer));
}

function eventSummary({sales,agendas}) {
  return agendas.map(row=>({
    origen:row.origen, closer:row.closer,
    total_aplica:Number(row.aplica==='Aplica'),
    total_efectuadas:Number(row.aplica==='Aplica' && row.agendo==='Agendo' && row.llamada_meg==='Efectuada'),
    total_ventas:0, facturacion_f_agenda:0
  })).concat(sales.map(row=>({
    origen:row.origen,closer:String(row.responsable_venta || '').trim() || row.creado_por,
    total_aplica:0,total_efectuadas:0,total_ventas:1,facturacion_f_agenda:row.facturacion ?? 0
  })));
}
const editors=new Set(['matirandazzo@gmail.com','leonardoalaniz19@gmail.com']);
const canEdit=user=>editors.has(String(user?.email||'').trim().toLowerCase());
const canRead=user=>Boolean(user)&&access.canAccessPageForUser(user,'objetivos-comerciales.html');
const canViewSales = user => access.canAccessResourceForUser(user, 'comprobantes');
const canViewLeads = user => access.canAccessResourceForUser(user, 'leads_raw');
function url(month,channel,webinar='all'){if(model.webinarKey(webinar)!=='all')return `${env.supabaseUrl}/storage/v1/object/${env.reportesPersonalesDataBucket}/config/commercial-objectives/events/${webinar}.json`;return `${env.supabaseUrl}/storage/v1/object/${env.reportesPersonalesDataBucket}/config/commercial-objectives/${channel?model.channelKey(channel)+'/':''}${model.monthKey(month)}.json`;}
function headers(){return {apikey:env.supabaseKey,Authorization:`Bearer ${env.supabaseKey}`};}
async function read(month,channel,webinar='all'){try{const {data}=await axios.get(url(month,channel,webinar),{headers:headers(),timeout:15000});if(!data||data.month!==month||(channel&&data.channel!==channel)||(webinar!=='all'&&data.webinar!==webinar))throw new Error('El objetivo guardado no corresponde al mes solicitado.');return {...data,...model.validate(data)};}catch(e){const d=e.response?.data;if(e.response?.status===404 || (e.response?.status===400 && /object not found/i.test(String(d?.message||d?.error||''))))return null;throw e;}}
async function save(month,input,user,channel,webinar='all'){model.webinarKey(webinar);const row={month,...(webinar!=='all'?{webinar}:{}),...(channel?{channel:model.channelKey(channel)}:{}),...model.validate(input),updatedAt:new Date().toISOString(),updatedBy:user.email};await axios.post(url(month,channel,webinar),row,{headers:{...headers(),'Content-Type':'application/json','x-upsert':'true','cache-control':'0'},timeout:15000});return row;}
async function rows(year,month){const options={eqFilters:{anio:year},limit:1000,select:'anio,mes,origen,closer,'+Object.values(model.fields).join(',')};if(month)options.eqFilters.mes=month;return service.listAllRows('agenda_detalle_por_origen_closer',options);}
function createRouter(){const router=express.Router();const readEventFunnel=createEventFunnelReader();router.use((req,res,next)=>{if(!req.authUser)return res.status(401).json({ok:false,message:'Sesión requerida'});if(!canRead(req.authUser))return res.status(403).json({ok:false,message:'Sin permiso para Objetivos comerciales'});next();});router.get('/details', async(req,res,next)=>{
  try {
    const stage=model.stageKey(req.query.stage);
    const sale=stage==='sales'||stage==='billing';
    if(!(sale?canViewSales(req.authUser):canViewLeads(req.authUser)))
      return res.status(403).json({ok:false,message:'Sin permiso para ver este detalle.'});
    const {month,channel,webinar,event}=model.scope(req.query);
    const [year,m]=month.split('-').map(Number);
    const lastDay=new Date(Date.UTC(year,m,0)).getUTCDate();
    const dateField=sale?'fecha_de_agendamiento':'fecha_agenda';
    const records=event?(await readEventFunnel(webinar,sale))[sale?'sales':'agendas']:await service.listAllRows(sale?'commercial_objectives_sales':'closer_webinar_leads',{
      from:month+'-01',to:month+'-'+lastDay,
      dateField,orderBy:dateField,orderDir:'asc',limit:1000,
      select:sale?'id,cliente_format,ghlid,origen,responsable_venta,creado_por,fecha_de_agendamiento,f_venta,producto_format,facturacion':
        'id,nombre,ghlid,origen,closer,fecha_agenda,fecha_llamada,llamada_meg,aplica,agendo'
    });
    const details=model.funnelDetails(records,channel,stage);
    res.json({ok:true,stage,details,count:details.length,
      total:stage==='billing'?details.reduce((sum,r)=>sum+r.amount,0):details.length});
  } catch(e){next(e);}
});router.get('/leads', async (req, res, next) => {
  if (!canViewLeads(req.authUser)) {
    return res.status(403).json({ ok: false, message: 'Sin permiso para ver el detalle de leads' });
  }
  try {
    const {month,channel,webinar,event} = model.scope(req.query);
    const [year, monthNumber] = month.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const records = event ? (await readEventFunnel(webinar)).agendas : await service.listAllRows('closer_webinar_leads', {
      from: `${month}-01`, to: `${month}-${lastDay}`,
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
});router.get('/history',async(req,res,next)=>{try{const channel=model.channelKey(req.query.channel);if(model.webinarKey(req.query.webinar)!=='all')throw Object.assign(new Error('La comparación mensual corresponde al acumulado, no a un lanzamiento.'),{statusCode:400});const year=Number(req.query.year);model.monthKey(`${year}-01`);const records=await rows(year);const months=await Promise.all(Array.from({length:12},async(_,i)=>{const month=`${year}-${String(i+1).padStart(2,'0')}`;return {month,target:await read(month,channel),...model.aggregate(model.channelRows(records.filter(r=>Number(r.mes)===i+1),channel))};}));res.json({ok:true,months});}catch(e){next(e);}});router.get('/',async(req,res,next)=>{try{
  const {channel,month,webinar,event}=model.scope(req.query);
  const [year,m]=month.split('-').map(Number);
  const targetRead=webinar==='unassigned'?null:read(month,channel,webinar);
  const [target,records,eventFunnel]=await Promise.all([
    webinar===bookings.WEBINAR?optionalRead(targetRead,4000):targetRead,
    event?null:rows(year,m),
    event?readEventFunnel(webinar):null
  ]);
  const result=model.aggregate(model.channelRows(eventFunnel?eventSummary(eventFunnel):records,channel));
  const crmAvailable=eventFunnel?.crmAvailable!==false;
  if(!crmAvailable) {
    for(const item of [result.actual,...result.closers]){
      Object.assign(item,{sales:null,billing:null,closing:null,ticket:null});
    }
  }
  res.json({ok:true,month,channel,webinar,event,webinars:model.WEBINARS,target,bookingTotals:eventFunnel?.bookingTotals || null,crmAvailable,
    legacyTarget:event?null:target||await read(month,channel==='evergreen'?'lanzamiento':'evergreen')?null:await read(month),
    ...result,
    canEdit:crmAvailable&&canEdit(req.authUser)&&webinar!=='unassigned',canViewLeads:canViewLeads(req.authUser),
    canViewStages:{agendas:canViewLeads(req.authUser),calls:canViewLeads(req.authUser),sales:crmAvailable&&canViewSales(req.authUser),billing:crmAvailable&&canViewSales(req.authUser)},
    team:model.TEAM,consultedAt:new Date().toISOString()});
}catch(e){next(e);}});
router.post('/',async(req,res,next)=>{try{
  if(!canEdit(req.authUser))return res.status(403).json({ok:false,message:'Solo Mati y Leo pueden editar objetivos.'});
  const {month,channel,webinar}=model.scope(req.body||{});
  if(webinar==='unassigned')return res.status(400).json({ok:false,message:'Elegí un webinar identificado para guardar objetivos.'});
  const target=await save(month,req.body,req.authUser,channel,webinar);
  res.json({ok:true,target});
}catch(e){next(e);}});return router;}
module.exports={createRouter,read,save,canRead,canEdit};
