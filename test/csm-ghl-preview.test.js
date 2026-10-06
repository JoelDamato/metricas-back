const test=require('node:test'),assert=require('node:assert/strict'),axios=require('axios');
const {identifyGhlPayload}=require('../modules/csm/ghl-webhook-preview');
const {handleWebhook}=require('../controllers/webhookcsm');
test('identifica GHL plano, anidado y declarado sin confundir páginas Notion',()=>{
 for(const p of [{contact_id:'abc'},{contact:{id:'abc'}},{data:{contactId:'abc'}},{id:'abc',location:{id:'location'}},{source:'ghl',id:'abc'}])assert.equal(identifyGhlPayload(p).contactId,'abc');
 assert.equal(identifyGhlPayload({id:'unknown'}),null);
 assert.equal(identifyGhlPayload({data:{object:'page',id:'notion',ghlid:'abc'}}),null);
 assert.equal(identifyGhlPayload({type:'page.deleted',entity:{id:'abc'}}),null);
 assert.equal(identifyGhlPayload(null),null);
});
test('captura prueba durable sin escribir CSM ni reenviar a Sheets',async()=>{
 const oldGet=axios.get,oldPost=axios.post,oldUrl=process.env.SUPABASE_URL,oldKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 process.env.SUPABASE_URL='https://test.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='test';
 try{for(const count of [0,1,2]){const posts=[];axios.get=async(url,config)=>{assert.ok(url.endsWith('/csm'));assert.equal(config.params.ghlid,'eq.abc');return{data:Array.from({length:count},()=>({id:'notion-id',ghlid:'abc'}))};};axios.post=async(url,body)=>{posts.push({url,body});return{status:201}};
 const res={status(n){this.code=n;return this},json(body){this.body=body;return this}};
 await handleWebhook({body:{contact_id:'abc',customData:{estado:'Prueba'}}},res);
 assert.equal(res.code,200);assert.equal(res.body.csmWritten,false);assert.equal(res.body.operation,['would_create','would_update','ambiguous'][count]);assert.equal(posts.length,1);assert.ok(posts[0].url.endsWith('/webhook_logs'));assert.equal(JSON.parse(posts[0].body.payload).customData.estado,'Prueba');assert.equal(posts[0].body.notion_id,null);}
 axios.post=async()=>{throw new Error('offline')};const res={status(n){this.code=n;return this},json(body){this.body=body;return this}};await handleWebhook({body:{contact_id:'abc'}},res);assert.equal(res.code,503);assert.equal(res.body.csmWritten,false);
 }finally{axios.get=oldGet;axios.post=oldPost;if(oldUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=oldUrl;if(oldKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=oldKey;}
});
