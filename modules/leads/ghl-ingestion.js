const crypto=require('node:crypto');
const axios=require('axios');
const {mapGhlLead}=require('./ghl-mapper');
const initialCatalog=require('./ghl-field-catalog.json');
let catalog=initialCatalog,catalogUntil=0;
function config(){const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw Error('Falta configuración de Supabase');return {url,headers:{apikey:key,Authorization:`Bearer ${key}`},timeout:30000};}
async function definitions(payload){
 const data=payload.data||payload;
 const supplied=Array.isArray(data.customFieldDefinitions)?Object.fromEntries(data.customFieldDefinitions.filter(f=>f.id&&f.name).map(f=>['custom:'+f.id,{label:f.name,key:f.fieldKey,type:f.dataType}])):{};
 if(process.env.GHL_API_KEY&&Date.now()>catalogUntil){
  try{const {data}=await axios.get(`${(process.env.GHL_BASE_URL||'https://services.leadconnectorhq.com').replace(/\/$/,'')}/locations/WU2z8kl23Dr3IyBW1hv5/customFields`,{headers:{Authorization:`Bearer ${process.env.GHL_API_KEY}`,Version:'2021-07-28'},timeout:8000});
   catalog={...catalog,...Object.fromEntries((data.customFields||[]).map(f=>['custom:'+f.id,{label:f.name,key:f.fieldKey,type:f.dataType}]))};catalogUntil=Date.now()+300000;
  }catch{catalogUntil=Date.now()+30000;}
 }
 return {...catalog,...supplied};
}
function eventId(payload,identity){
 const data=payload.data||payload;const id=data.webhookEventId||data.eventId||payload.eventId;
 if(typeof id!=='string'||!id.trim())return crypto.randomUUID();
 const hash=crypto.createHash('sha256').update(`${identity.locationId}:${identity.contactId}:${id}`).digest('hex').slice(0,32);
 return `${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20)}`;
}
async function ingest(payload,identity){
 const conf=config();const mapped=mapGhlLead(payload,await definitions(payload));
 const {data}=await axios.post(`${conf.url}/rest/v1/rpc/metricas_leads_ghl_ingest`,{
  p_event:eventId(payload,identity),p_ghlid:identity.contactId||null,p_location:identity.locationId,
  p_payload:payload,p_patch:mapped.patch,p_fields:mapped.fields,p_warnings:mapped.warnings,p_source_at:mapped.sourceUpdatedAt
 },{headers:conf.headers,timeout:conf.timeout});
 return {...data,source:'ghl',ghlId:identity.contactId,captured:true,mappingReady:true};
}
async function refreshAging(){const conf=config();return (await axios.post(`${conf.url}/rest/v1/rpc/metricas_leads_ghl_refresh_aging`,{},{headers:conf.headers,timeout:conf.timeout})).data;}
module.exports={ingest,refreshAging,eventId};
