const test=require('node:test');
const assert=require('node:assert/strict');
const axios=require('axios');
const fs=require('node:fs');
const {handleWebhook}=require('../controllers/webhookcom');
test('el webhook acusa recibo sin escribir ni reenviar altas, cambios o borrados',async(t)=>{
 for(const method of ['get','post','patch','delete']) t.mock.method(axios,method,()=>{throw Error('No debe acceder a servicios externos');});
 for(const type of ['page.created','page.properties_updated','page.deleted']){
  let body,status;
  await handleWebhook({body:{type,data:{id:'historical-receipt'}}},{status(code){status=code;return this;},json(value){body=value;}});
  assert.equal(status,200);assert.equal(body.status,'ignored');assert.equal(body.reason,'comprobantes_webhook_retired');
 }
});
test('el distribuidor no reenvía ni borra comprobantes por eventos Notion',()=>{
 const source=fs.readFileSync(require.resolve('../controllers/webhookDistribuidor'),'utf8');
 assert.doesNotMatch(source,/onrender\.com\/api\/comprobantes/);
 assert.doesNotMatch(source,/const tablasSupabase\s*=.*'comprobantes'/);
});
