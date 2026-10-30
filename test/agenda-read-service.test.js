const {test}=require('node:test');const assert=require('node:assert/strict');const axios=require('axios');
process.env.SUPABASE_URL='https://example.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='test';
const service=require('../modules/metricasv2/services/supabase.service');
test('agenda RPC conserva filtros, orden y paginación sin afectar otras vistas',async()=>{
 const original=axios.get;const calls=[];
 axios.get=async(url,config)=>{calls.push({url,config});return {data:[{total_agendados:4}]};};
 try{
  const result=await service.listRows('agenda_totales',{limit:250,offset:500,orderBy:'mes',orderDir:'asc',eqFilters:{anio:2026,estrategia_a:'A'}});
  assert.equal(result[0].total_agendados,4);assert.match(calls[0].url,/rpc\/agenda_totales_read$/);
  assert.equal(calls[0].config.timeout,35000);
  assert.deepEqual(calls[0].config.params,{select:'*',limit:250,offset:500,order:'mes.asc',anio:'eq.2026',estrategia_a:'eq.A'});
  await service.listRows('csm');assert.match(calls[1].url,/\/csm$/);assert.equal(calls[1].config.timeout,undefined);
 }finally{axios.get=original;}
});
