const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validateConfig}=require('../modules/metricasv2/services/commission-config-validation');
const {normalizeConfig,DEFAULT_CONFIG,saveCommissionConfig}=require('../modules/metricasv2/services/commissions.service');
test('rechaza porcentajes fuera de rango y tramos ambiguos antes de escribir',async()=>{
 assert.doesNotThrow(()=>validateConfig(DEFAULT_CONFIG));
 for(const pct of [-1,1.01,NaN,Infinity,'0.08',null])assert.throws(()=>validateConfig({global:{defaultCloserPct:pct}}));
 assert.throws(()=>validateConfig({agendaScale:[{min:0,pct:.05},{min:0,pct:.08}]}));
 assert.throws(()=>validateConfig({clubScale:[]}));
 assert.throws(()=>validateConfig({personAreas:[{person:'',area:'CSM'}]}));
 assert.throws(()=>validateConfig({fixedOverrides:[{person:'Carlos',pct:.08},{person:'carlos',pct:.1}]}));
 await assert.rejects(saveCommissionConfig('2026-10',{global:{defaultCloserPct:8}},{}),{statusCode:400});
});
test('respeta un bono explícitamente desactivado y mantiene compatibilidad de históricos',()=>{
 assert.equal(normalizeConfig({agendaScale:[{min:31,pct:.06,bonusUsd:0},{min:51,pct:.07,bonusUsd:0}]}).agendaScale[1].bonusUsd,0);
 assert.equal(normalizeConfig({agendaScale:[{min:51,pct:.07}]}).agendaScale[0].bonusUsd,250);
 assert.equal(normalizeConfig({personAreas:[{person:'Walter Alegre',area:'Marketing'}]}).personAreas[0].area,'Marketing');
});
test('guardar conserva reglas no editadas, persiste el mes correcto y rechaza meses bloqueados',async t=>{
 const axios=require('axios'),supabase=require('../modules/metricasv2/services/supabase.service'),env=require('../modules/metricasv2/config/env');
 const oldUrl=env.supabaseUrl,oldKey=env.supabaseKey;
 env.supabaseUrl='https://example.invalid';env.supabaseKey='test';t.after(()=>{env.supabaseUrl=oldUrl;env.supabaseKey=oldKey;});
 let snapshot=null,writes=0;
 t.mock.method(supabase,'listRows',async table=>table==='commission_settings'?[{config:DEFAULT_CONFIG}]:snapshot?[snapshot]:[]);
 t.mock.method(axios,'post',async(url,body)=>{writes++;snapshot=structuredClone(body);return {data:[snapshot]};});
 const result=await saveCommissionConfig('2026-10',{global:{defaultCloserPct:.125}},{email:'nadia.cavallini@gmail.com'});
 assert.equal(result.config.global.defaultCloserPct,.125);assert.deepEqual(result.config.closerRules,normalizeConfig(DEFAULT_CONFIG).closerRules);
 assert.equal(snapshot.month_key,'2026-10');assert.equal(snapshot.updated_by,'nadia.cavallini@gmail.com');
 snapshot.locked=true;
 await assert.rejects(saveCommissionConfig('2026-10',{global:{defaultCloserPct:.15}},{}),{statusCode:409});
 assert.equal(writes,1);
});
