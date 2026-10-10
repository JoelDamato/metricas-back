const crypto=require('node:crypto');
const {identifyGhlPayload}=require('../modules/csm/ghl-webhook-preview');
const ingestion=require('../modules/leads/ghl-ingestion');
function authorized(req){
 const expected=process.env.GHL_LEADS_WEBHOOK_SECRET;if(!expected)return true;
 const actual=String(req.get?.('x-webhook-token')||req.headers?.['x-webhook-token']||'');
 const a=Buffer.from(actual),b=Buffer.from(expected);return a.length===b.length&&crypto.timingSafeEqual(a,b);
}
async function handleWebhook(req,res){
 if(!authorized(req))return res.status(401).json({error:'Webhook no autorizado'});
 const identity=identifyGhlPayload(req.body);
 if(!identity)return res.status(400).json({error:'Se espera un contacto GHL con contact_id y location.id'});
 try{
  const result=await ingestion.ingest(req.body,identity);
  return res.status(result.status==='needs_review'?422:200).json(result);
 }catch(error){
  console.error('[leads GHL] No se pudo persistir el evento',error.response?.status||error.code||'storage_error');
  return res.status(503).json({error:'No se pudo guardar el evento de leads. Reintentar.',captured:false});
 }
}
function getCapabilities(req,res){return res.json({source:'ghl',resource:'leads',mode:'write_and_archive',required:['contact_id','location.id'],locationId:'WU2z8kl23Dr3IyBW1hv5',newFields:'automatic_jsonb_catalog',partialUpdates:'preserve_missing_empty_and_invalid',financialFields:'derived_from_supabase_receipts',notion:'protected_per_contact_after_first_success'});}
module.exports={handleWebhook,getCapabilities};
