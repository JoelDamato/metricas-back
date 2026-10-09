const test=require('node:test'),assert=require('node:assert/strict'),axios=require('axios');
const {handleWebhook,getCapabilities}=require('../controllers/webhookcsm');
test('webhook envía todo a la RPC y responde según el resultado transaccional',async()=>{
 const old=axios.post,oldUrl=process.env.SUPABASE_URL,oldKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 process.env.SUPABASE_URL='https://test.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='test';
 try{for(const status of ['created','updated','unchanged','needs_review']){const calls=[];axios.post=async(url,body)=>{calls.push({url,body});return{data:{status,csmWritten:status!=='needs_review',receiptId:body.p_event}}};
 const payload={contact_id:'abc',full_name:'Cliente',extra:{unknown:[false,0,'']},Pausa:''};const res={status(n){this.code=n;return this},json(body){this.body=body;return this}};
 await handleWebhook({body:payload},res);assert.equal(res.code,status==='needs_review'?422:200);assert.equal(calls.length,1);assert.ok(calls[0].url.endsWith('/rpc/metricas_csm_ghl_ingest'));assert.deepEqual(calls[0].body.p_payload,payload);assert.equal(calls[0].body.p_patch.nombre,'Cliente');assert.ok(!('pausa'in calls[0].body.p_patch));assert.equal(res.body.captured,true);}
 axios.post=async()=>{throw Error('offline')};const res={status(n){this.code=n;return this},json(b){this.body=b;return this}};await handleWebhook({body:{contact_id:'abc'}},res);assert.equal(res.code,503);
 }finally{axios.post=old;for(const [k,v]of [['SUPABASE_URL',oldUrl],['SUPABASE_SERVICE_ROLE_KEY',oldKey]]){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});
test('consulta de capacidades identifica modo escritura',()=>{const res={set(){return this},json(body){this.body=body;return this}};getCapabilities({},res);assert.equal(res.body.ghl.mode,'write_and_archive');});
