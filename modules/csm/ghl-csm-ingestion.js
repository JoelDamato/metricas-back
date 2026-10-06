const crypto=require('crypto');
const axios=require('axios');
const {mapGhlCsm}=require('./ghl-csm-mapper');
async function ingest(payload,identity){
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new Error('Falta configuración Supabase');
 const {patch,warnings}=mapGhlCsm(payload),receiptId=crypto.randomUUID();
 const {data}=await axios.post(`${url}/rest/v1/rpc/metricas_csm_ghl_ingest`,{
  p_event:receiptId,p_ghlid:identity.contactId||null,p_location:identity.locationId,
  p_payload:payload,p_patch:patch,p_warnings:warnings
 },{headers:{apikey:key,Authorization:`Bearer ${key}`},timeout:30000});
 return {...data,source:'ghl',ghlId:identity.contactId||null,captured:true,mappingReady:true,
  message:data.csmWritten?'CSM guardado; payload completo conservado en Supabase.':data.message};
}
module.exports={ingest};
