const test=require('node:test'),assert=require('node:assert/strict'),axios=require('axios');
const {retryRead}=require('../modules/metricasv2/services/webinar-setter.service');
const loader=require('../modules/metricasv2/services/comprobantes-loader.service');
const env=require('../modules/metricasv2/config/env');
test('reintenta una lectura cortada pero no oculta errores permanentes',async()=>{
 let calls=0;const value=await retryRead(async()=>{if(++calls===1)throw new Error('socket hang up');return 3;});
 assert.equal(value,3);assert.equal(calls,2);
 calls=0;await assert.rejects(retryRead(async()=>{calls++;throw new Error('invalid column');}),/invalid column/);assert.equal(calls,1);
});
test('Mis comprobantes excluye a Juan Pablo de Nahuel y admite su setting webinar real',async t=>{
 const original={supabaseUrl:env.supabaseUrl,supabaseKey:env.supabaseKey};Object.assign(env,{supabaseUrl:'https://test.invalid',supabaseKey:'test'});t.after(()=>Object.assign(env,original));
 t.mock.method(axios,'get',async url=>({data:url.endsWith('/leads_ghl_contacts')?[
  {ghlid:'juan',fields:{'Setter webinar':{value:'Brenda Damato'}}},
  {ghlid:'own',fields:{'Setting webinar':{value:'Nahuel Iasci'}}}
 ]:[{id:'juan',ghlid:'juan',setter:'Nahuel Iasci',responsable_venta:'Nahuel Iasci'},{id:'own',ghlid:'own',setter:'Otro',responsable_venta:'Patricia Conti'},{id:'foreign',setter:'Otro',responsable_venta:'Patricia Conti'}]}));
 const result=await loader.listMyComprobantes({email:'iascinahuel@gmail.com',nombre:'Nahuel Iasci'});
 assert.deepEqual(result.rows.map(r=>r.id),['own']);assert.equal(result.rows[0].setter,'Nahuel Iasci');
});

test('Mis comprobantes muestra Club vendido por Nahuel sin apropiarse de ventas webinar ajenas',async t=>{
 const original={supabaseUrl:env.supabaseUrl,supabaseKey:env.supabaseKey};Object.assign(env,{supabaseUrl:'https://test.invalid',supabaseKey:'test'});t.after(()=>Object.assign(env,original));
 const base={ghlid:'contact',tipo:'Venta',producto_format:'Club',setter:'Nahuel Iasci'};
 t.mock.method(axios,'get',async url=>({data:url.endsWith('/leads_ghl_contacts')?[
  {ghlid:'contact',fields:{'Setter webinar':{value:'Maria Soliz'}}}
 ]:[{...base,id:'club-own',responsable_venta:'Nahuel Iasci'},
    {...base,id:'club-other',responsable_venta:'Patricia Conti'},
    {...base,id:'meg-other',producto_format:'MEG',responsable_venta:'Nahuel Iasci'},
    {...base,id:'creator-only',responsable_venta:null,creado_por:'Nahuel Iasci'}]}));
 const result=await loader.listMyComprobantes({email:'iascinahuel@gmail.com',nombre:'Nahuel Iasci'});
 assert.deepEqual(result.rows.map(r=>r.id),['club-own']);
});
