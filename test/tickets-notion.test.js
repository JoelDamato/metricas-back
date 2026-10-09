const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createService, CLIENTS, DATABASE_ID, buildFilter } = require('../modules/tickets/notion');
function page(id, client = CLIENTS['matias-randazzo'].id, status = 'Pendiente') {
  return { id, parent: { database_id: DATABASE_ID }, created_time:'2026-10-03T00:00:00Z', last_edited_time:'2026-10-03T00:00:00Z', properties: { Cliente: { relation: [{ id: client }] }, Tarea: { title: [{ plain_text:'Tarea <test>' }] }, 'Cliente slug': { select: { name:'matias-randazzo' } }, Status: { status: { name:status } }, Area: { multi_select:[{name:'Csm'}] } } };
}
test('pagination includes both clients, excludes finalized and rejects unrelated client even with stale slug', async () => {
  let calls = 0;
  const service = createService({ client: { databases: { query: async query => {
    assert.deepEqual(query.filter, buildFilter()); calls++;
    return calls === 1 ? { results: [page('1'), page('2', 'other-client'), page('3', CLIENTS.accelerator.id, 'Finalizada')], has_more:true, next_cursor:'cursor' } : { results:[page('4', CLIENTS.accelerator.id)], has_more:false };
  } } } });
  const data = await service.list(); assert.equal(calls,2); assert.deepEqual(data.tickets.map(t=>t.id), ['notion-1','notion-4']);
  await service.list(); assert.equal(calls,2); assert.match(JSON.stringify(buildFilter()),/does_not_equal.*Finalizada/);
});
test('detail and updates enforce client scope', async () => {
  let writes = 0;
  const service = createService({ client: { pages: { retrieve: async()=>page('a'.repeat(32),'other-client'), update:async()=>{writes++;} } } });
  await assert.rejects(service.detail('a'.repeat(32)),{statusCode:404});
  await assert.rejects(service.update('a'.repeat(32),'Finalizada'),{statusCode:404});assert.equal(writes,0);
  await assert.rejects(service.update('a'.repeat(32),'Bogus'),{statusCode:400});
});
test('publish carries client, area, description and stable reconciliation marker', async () => {
  let payload;
  const service = createService({ client: { databases: { query:async()=>({results:[]}) }, pages: { create:async input=>{payload=input;return page('a'.repeat(32),CLIENTS.accelerator.id);} } } });
  await service.publish({id:'local-123',subject:'Prueba',detail:'Detalle largo',author:'Usuario',clientKey:'accelerator',area:'Csm'});
  assert.equal(payload.properties.Cliente.relation[0].id,CLIENTS.accelerator.id);
  assert.equal(payload.properties.Status.status.name,'Pendiente');
  assert.match(JSON.stringify(payload),/Referencia de ticket: local-123/);
});
test('publish reconciles an uncertain prior creation without another write', async () => {
  let writes=0;
  const service=createService({client:{databases:{query:async()=>({results:[page('a'.repeat(32))]})},pages:{create:async()=>{writes++;}}}});
  const result=await service.publish({id:'local-123'});assert.equal(result.source,'notion');assert.equal(writes,0);
});
test('image upload is attached to the created Notion task', async () => {
  let payload; const requests=[];
  const service=createService({token:'test-token',fetchImpl:async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>({id:'upload-id'})};},client:{databases:{query:async()=>({results:[]})},pages:{create:async value=>{payload=value;return page('a'.repeat(32));}}}});
  await service.publish({id:'image-ticket',subject:'Imagen',detail:'Captura',author:'Usuario',image:{mime:'image/png',data:Buffer.from('test').toString('base64')}});
  assert.equal(requests.length,2);assert.match(requests[1].url,/upload-id\/send$/);assert.ok(requests[1].options.body instanceof FormData);
  assert.equal(payload.children[1].image.file_upload.id,'upload-id');
});
