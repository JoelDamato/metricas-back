const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

const service = require('../modules/metricasv2/services/comprobantes-reconciliation.service');
const env = require('../modules/metricasv2/config/env');

const {
  reconciliationStateFromRow,
  normalizeReconciliationState,
  summarizeRows
} = service._test;

const COMPROBANTE_ID = '49f48251-7a95-800d-9168-fefc4ff0ff16';

function installEnv(t) {
  const previous = {
    supabaseUrl: env.supabaseUrl,
    supabaseKey: env.supabaseKey,
    notionApiKey: env.notionApiKey
  };
  env.supabaseUrl = 'https://supabase.reconciliation.test';
  env.supabaseKey = 'test-service-key';
  env.notionApiKey = null;
  t.after(() => Object.assign(env, previous));
}

function uuidFor(index) {
  return `00000000-0000-0000-0000-${String(index).padStart(12, '0')}`;
}

test('agrupa únicamente en conciliado, no conciliado y rebotado', () => {
  assert.equal(reconciliationStateFromRow({ estado: 'Conciliado' }), 'conciliated');
  assert.equal(reconciliationStateFromRow({ estado: null }), 'not_conciliated');
  assert.equal(reconciliationStateFromRow({ estado: 'Rectificado' }), 'not_conciliated');
  assert.equal(reconciliationStateFromRow({ estado: 'Rebotado' }), 'bounced');
  assert.deepEqual(summarizeRows([
    { estado: 'Conciliado' },
    { estado: null },
    { estado: 'Rectificado' },
    { estado: 'Rebotado' }
  ]), {
    total: 4,
    conciliated: 1,
    not_conciliated: 2,
    bounced: 1
  });
  assert.throws(() => normalizeReconciliationState('eliminado'), /Estado inválido/);
});

test('lista todos los comprobantes con paginación por cursor, sin OFFSET', async (t) => {
  installEnv(t);
  const firstPage = Array.from({ length: 500 }, (_, index) => ({
    id: uuidFor(index + 1),
    estado: index % 2 ? 'Conciliado' : null,
    f_acreditacion: '2026-08-01'
  }));
  const secondPage = [{ id: uuidFor(501), estado: 'Rebotado', f_acreditacion: '2026-08-02' }];
  const requests = [];

  t.mock.method(axios, 'get', async (url, config) => {
    assert.equal(url, 'https://supabase.reconciliation.test/rest/v1/comprobantes');
    requests.push(config.params);
    return { data: requests.length === 1 ? firstPage : secondPage };
  });

  const result = await service.listAllComprobantes();

  assert.equal(result.count, 501);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].offset, undefined);
  assert.equal(requests[1].id, `gt.${uuidFor(500)}`);
  assert.equal(result.rows[0].id, uuidFor(501));
  assert.equal(result.summary.bounced, 1);
});

test('actualiza sólo Supabase al mover un comprobante a Rebotado', async (t) => {
  installEnv(t);
  const patches = [];

  t.mock.method(axios, 'get', async () => ({
    data: [{ id: COMPROBANTE_ID, estado: 'Conciliado', rebotar_pago: false }]
  }));
  t.mock.method(axios, 'patch', async (url, body, config) => {
    patches.push({ url, body, config });
    if (url.startsWith('https://api.notion.com/')) return { data: { id: COMPROBANTE_ID } };
    return { data: [{ id: COMPROBANTE_ID, estado: 'Rebotado', rebotar_pago: false }] };
  });

  const result = await service.updateComprobanteState(COMPROBANTE_ID, 'bounced');

  assert.equal(patches.length, 1);
  assert.ok(patches.every(patch => !patch.url.includes('notion.com')));
  assert.deepEqual(patches[0].body, { estado: 'Rebotado', rebotar_pago: true });
  assert.equal(patches[0].config.headers.Prefer, 'return=representation');
  assert.equal(result.previousState, 'conciliated');
  assert.equal(result.state, 'bounced');
});

test('No conciliado limpia el estado directamente en Supabase', async (t) => {
  installEnv(t);
  const patches = [];

  t.mock.method(axios, 'get', async () => ({
    data: [{ id: COMPROBANTE_ID, estado: 'Rebotado', rebotar_pago: false }]
  }));
  t.mock.method(axios, 'patch', async (url, body) => {
    patches.push({ url, body });
    return url.startsWith('https://api.notion.com/')
      ? { data: { id: COMPROBANTE_ID } }
      : { data: [{ id: COMPROBANTE_ID, estado: null, rebotar_pago: false }] };
  });

  const result = await service.updateComprobanteState(COMPROBANTE_ID, 'not_conciliated');

  assert.equal(patches.length, 1);
  assert.ok(patches.every(patch => !patch.url.includes('notion.com')));
  assert.deepEqual(patches[0].body, { estado: null, rebotar_pago: false });
  assert.equal(result.state, 'not_conciliated');
});

test('la nota usa escritura acotada sin cambiar estado y detecta conflictos',async t=>{
 installEnv(t);const original=axios.post;t.after(()=>{axios.post=original});let sent;
 axios.post=async(url,body)=>{sent={url,body};return {data:{row:{id:COMPROBANTE_ID,nota_conciliacion:body.p_note,estado:'Conciliado'}}};};
 const result=await service.saveReconciliationNote(COMPROBANTE_ID,{note:' Revisar CUIT ',revision:0},{nombre:'Admin',email:'admin@example.com'});
 assert.equal(result.row.nota_conciliacion,'Revisar CUIT');assert.equal(result.row.estado,'Conciliado');assert(sent.url.endsWith('/rpc/metricas_reconciliation_note'));assert.deepEqual(Object.keys(sent.body).sort(),['p_author','p_id','p_note','p_revision']);
 axios.post=async()=>({data:{conflict:true}});await assert.rejects(service.saveReconciliationNote(COMPROBANTE_ID,{note:'Otra',revision:0},{nombre:'Admin'}),{statusCode:409});
 await assert.rejects(service.saveReconciliationNote(COMPROBANTE_ID,{note:'x'.repeat(4001),revision:0},{nombre:'Admin'}),{statusCode:400});
});
