const {test}=require('node:test');
const assert=require('node:assert/strict');
const cache=require('../modules/metricasv2/services/request-data-cache');
test('marketing shares concurrent reads only within the same request',async()=>{
 let calls=0;const read=()=>cache.once('rows',async()=>++calls);
 assert.deepEqual(await cache.run(()=>Promise.all([read(),read()])),[1,1]);
 assert.deepEqual(await cache.run(()=>Promise.all([read(),read()])),[2,2]);
 assert.equal(await read(),3);
});
test('a failed request cannot poison the next request',async()=>{
 await assert.rejects(cache.run(()=>cache.once('rows',()=>Promise.reject(new Error('offline')))),/offline/);
 assert.equal(await cache.run(()=>cache.once('rows',()=>42)),42);
});

test('Marketing comparte la lectura de agendas y conserva el detalle y la exportación al proyectar columnas', async t => {
  const axios = require('axios');
  process.env.SUPABASE_URL = 'https://example.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test';
  const service = require('../modules/metricasv2/services/supabase.service');
  const {csv} = require('../public/metricas-v2/js/marketing-cohort');
  const requests = [];
  const agenda = {
    id: 'lead-1', ghlid: 'contact-1', nombre: 'Persona de prueba', mail: 'persona@example.test',
    telefono: '5550100', fecha_agenda: '2026-11-05', agendo: 'Agendo', aplica: 'Aplica',
    origen_actual: 'Postulación MEG - VSL', primer_origen: 'VSL', closer: 'Closer',
    setter: 'Setter', call_confirm: 'Exitoso', llamada_meg: 'Efectuada',
    campaign: 'Circulito rojo', adset: 'Conjunto', adname: 'Anuncio',
    created_time: '2026-11-03', last_edited_time: '2026-11-06', extra: {notNeeded: true}
  };
  const trace = {...agenda, id: 'traza-1', fecha_venta: '2026-11-12', calidad_lead: 'Calificado'};
  t.mock.method(axios, 'get', async (url, {params}) => {
    if (!url.endsWith('/leads_raw')) return {data: []};
    requests.push(params);
    const source = params.and.includes('created_time.gte.') ? trace : agenda;
    const rows = [source, {...source, id: 'csm-1', origen_actual: 'Sesión de cliente'}];
    return {data: rows.map(row => Object.fromEntries(
      params.select.split(',').filter(key => Object.hasOwn(row, key)).map(key => [key, row[key]])
    ))};
  });

  const filters = {from: '2026-11-01', to: '2026-11-30', origen: 'VSL'};
  const result = await service.getMarketingDashboard(filters);

  assert.equal(requests.length, 2);
  assert.equal(requests.filter(params => params.and.includes('fecha_agenda.gte.')).length, 1);
  assert.equal(requests[0].select, requests[1].select);
  assert(!requests[0].select.includes('*'));
  assert(!requests[0].select.split(',').includes('extra'));
  assert.equal(result.leads.length, 1);
  assert.equal(result.campaigns[0].agendas, 1);
  assert.equal(result.campaigns[0].reunionesCce, 1);
  assert.equal(result.traceability.length, 1);
  assert.equal(result.traceability[0].fecha_venta, trace.fecha_venta);
  assert.equal(result.traceability[0].calidad_lead, trace.calidad_lead);
  assert.equal(csv(result.leads, filters), csv([agenda], filters));
});
