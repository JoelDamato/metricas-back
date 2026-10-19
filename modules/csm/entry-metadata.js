const axios = require('axios');
const env = require('../metricasv2/config/env');
const access = require('../auth/access');
function dateOnly(value) {
 const day=String(value||'').slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return null;
 const date=new Date(day+'T00:00:00Z');
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===day?day:null;
}
async function read(table,params){return (await axios.get(`${env.supabaseUrl}/rest/v1/${table}`,{headers:{apikey:env.supabaseKey,Authorization:`Bearer ${env.supabaseKey}`},params,timeout:30000})).data;}
function createHandler(request=read){return async(req,res,next)=>{try{
 if(!req.authUser||!access.canAccessPageForUser(req.authUser,'csm-cuadro.html'))return res.status(403).json({message:'Sin acceso a métricas CSM'});
 const ids=[...new Set(String(req.query.ids||'').split(',').filter(Boolean))];
 if(!ids.length||ids.length>100||ids.some(id=>!/^[a-zA-Z0-9]{1,100}$/.test(id)))return res.status(400).json({message:'Contactos inválidos'});
 const filter=`in.(${ids.join(',')})`;
 const [sources,leads]=await Promise.all([
 request('recording_sources',{select:'ghlid,closer,call_date',ghlid:filter,limit:100}),
 request('leads_raw',{select:'ghlid,closer,fecha_llamada',ghlid:filter,order:'last_edited_time.desc.nullslast',limit:1000})
 ]);
 const sourceMap=new Map(sources.map(r=>[r.ghlid,r])),leadMap=new Map();
 for(const lead of leads)if(!leadMap.has(lead.ghlid))leadMap.set(lead.ghlid,lead);
 res.set('Cache-Control','no-store').json({rows:ids.map(ghlid=>({ghlid,
 call_date:dateOnly(sourceMap.get(ghlid)?.call_date)||dateOnly(leadMap.get(ghlid)?.fecha_llamada),
 closer:String(sourceMap.get(ghlid)?.closer||leadMap.get(ghlid)?.closer||'').trim()
 }))});
 }catch(error){next(error);}};}
module.exports={createHandler,dateOnly};
