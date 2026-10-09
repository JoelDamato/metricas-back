const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createRouter } = require('../modules/tickets/router');
const { createStore } = require('../modules/tickets/store');
const access = require('../modules/auth/access');
test('shared tickets persist, validate uploads and restrict status changes', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tickets-test-'));
  const app = express(); app.use(express.json());
  app.use((req, res, next) => { if (req.headers['x-role']) req.authUser = { role: req.headers['x-role'], nombre: 'Equipo' }; next(); });
  app.use('/tickets', createRouter(createStore(directory)));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/tickets`;
  const call = (suffix = '', options = {}, role = 'comercial') => fetch(url + suffix, { ...options, headers: { 'x-role': role, ...options.headers } });
  try {
    assert.equal((await fetch(url)).status, 401);
    const invalid = new FormData(); invalid.set('subject', ''); invalid.set('detail', 'Algo');
    assert.equal((await call('', { method: 'POST', body: invalid })).status, 400);
    const badImage = new FormData(); badImage.set('subject', 'Asunto'); badImage.set('detail', 'Detalle'); badImage.set('image', new Blob(['<svg/>'], { type: 'image/png' }), 'test.png');
    assert.equal((await call('', { method: 'POST', body: badImage })).status, 400);
    const form = new FormData(); form.set('subject', 'Ayuda'); form.set('detail', 'Detalle'); form.set('image', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jG1sAAAAASUVORK5CYII=', 'base64')], { type: 'image/png' }), 'capture.png');
    const created = await call('', { method: 'POST', body: form }); assert.equal(created.status, 201);
    const { ticket } = await created.json(); assert.equal(ticket.status, 'Abierto'); assert.equal(ticket.hasImage, true); assert.equal(ticket.image, undefined);
    const list = await (await call('', {}, 'csm')).json(); assert.equal(list.tickets.length, 1);
    assert.equal((await call(`/${ticket.id}/image`, {}, 'csm')).headers.get('content-type'), 'image/png');
    const patch = { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Resuelto' }) };
    assert.equal((await call(`/${ticket.id}`, patch)).status, 403);
    assert.equal((await call(`/${ticket.id}`, patch, 'total')).status, 200);
    assert.equal((await createStore(directory).read())[0].status, 'Resuelto');
    const concurrent = createStore(directory);
    await Promise.all(Array.from({ length: 10 }, (_, i) => concurrent.mutate(rows => rows.push({ id: String(i) }))));
    assert.equal((await concurrent.read()).length, 11);
  } finally { await new Promise(resolve => server.close(resolve)); await fs.rm(directory, { recursive: true, force: true }); }
});
test('tickets accessible despite custom page restrictions', () => {
  for (const role of ['total', 'comercial', 'csm']) {
    const user = { role, email: 'test@example.com', access_config: { allowedPages: ['marketing.html'] } };
    assert.equal(access.canAccessPageForUser(user, 'tickets.html'), true);
    const permissions = access.getUserPermissions(user);
    if (permissions.allowedPages) assert.ok(permissions.allowedPages.includes('tickets.html'));
  }
  assert.equal(access.canAccessPageForUser(null, 'tickets.html'), false);
});
test('Notion list merges pending tickets, hides synced copies and keeps failed submissions recoverable', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tickets-notion-test-'));
  const store = createStore(directory);
  const remote = { id:'notion-remote', notionId:'remote', source:'notion', subject:'Desde Notion', status:'Pendiente' };
  let fail = true;
  const notion = { list:async()=>({tickets:[remote],connected:true}), publish:async()=>{if(fail) throw new Error('network');return remote;}, detail:async()=>remote, update:async()=>remote };
  await store.mutate(rows => rows.push({id:'old-synced',subject:'Finalizada en Notion',notion:{pageId:'finalized',status:'synced'}}));
  const app = express(); app.use(express.json()); app.use((req,res,next)=>{req.authUser={role:req.headers['x-role'] || 'total',nombre:'Usuario'};next();}); app.use('/tickets',createRouter(store,notion));
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const url=`http://127.0.0.1:${server.address().port}/tickets`;
  try {
    const list=await (await fetch(url)).json();assert.deepEqual(list.tickets.map(t=>t.id),['notion-remote']);
    const form=new FormData();form.set('subject','Nuevo ticket');form.set('detail','Detalle');form.set('clientKey','accelerator');form.set('area','Csm');
    const response=await fetch(url,{method:'POST',body:form});assert.equal(response.status,201);const created=await response.json();assert.ok(created.warning);assert.equal(created.ticket.notion.status,'pending_sync');
    assert.equal((await fetch(`${url}/${created.ticket.id}/sync`,{method:'POST',headers:{'x-role':'csm'}})).status,403);
    assert.equal((await fetch(`${url}/notion/remote`,{method:'PATCH',headers:{'Content-Type':'application/json','x-role':'csm'},body:JSON.stringify({status:'Finalizada'})})).status,403);
    fail=false;assert.equal((await fetch(`${url}/${created.ticket.id}/sync`,{method:'POST'})).status,200);
    assert.equal((await store.read()).find(t=>t.id===created.ticket.id).notion.pageId,'remote');
    assert.equal((await (await fetch(url)).json()).tickets.length,1);
  } finally { await new Promise(resolve=>server.close(resolve)); await fs.rm(directory,{recursive:true,force:true}); }
});
