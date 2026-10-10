const {test}=require('node:test'),assert=require('node:assert/strict'),axios=require('axios');
const {handleWebhook,getCapabilities}=require('../controllers/webhookleads');
const response=()=>({status(code){this.code=code;return this},json(body){this.body=body;return this}});
test('webhook responde sólo luego de persistir, conserva todo y distingue errores/reintentos',async(t)=>{
 const saved={...process.env};process.env.SUPABASE_URL='https://test.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='test';delete process.env.GHL_API_KEY;delete process.env.GHL_LEADS_WEBHOOK_SECRET;
 try{
  let calls=[];t.mock.method(axios,'post',async(url,body)=>{calls.push({url,body});return{data:{status:'updated',leadWritten:true,receiptId:body.p_event}};});
  const payload={contact_id:'abc',location:{id:'WU2z8kl23Dr3IyBW1hv5'},full_name:'Cliente',newField:{zero:0},'Fecha de llamada':'bad',eventId:'evt1'};
  let res=response();await handleWebhook({body:payload},res);assert.equal(res.code,200);assert.equal(res.body.captured,true);assert.deepEqual(calls[0].body.p_payload,payload);assert(calls[0].url.endsWith('/rpc/metricas_leads_ghl_ingest'));assert.equal(calls[0].body.p_warnings[0].reason,'invalid_date');
  res=response();await handleWebhook({body:payload},res);assert.equal(calls[0].body.p_event,calls[1].body.p_event);
  axios.post=async()=>({data:{status:'needs_review',leadWritten:false}});res=response();await handleWebhook({body:payload},res);assert.equal(res.code,422);
  axios.post=async()=>{throw Error('offline')};res=response();await handleWebhook({body:payload},res);assert.equal(res.code,503);assert.equal(res.body.captured,false);
  res=response();await handleWebhook({body:{data:{object:'page',id:'notion'}}},res);assert.equal(res.code,400);
  process.env.GHL_LEADS_WEBHOOK_SECRET='secret';res=response();await handleWebhook({body:payload,headers:{}},res);assert.equal(res.code,401);
  res=response();getCapabilities({},res);assert.equal(res.body.resource,'leads');
 }finally{for(const key of ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','GHL_API_KEY','GHL_LEADS_WEBHOOK_SECRET'])if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}
});
