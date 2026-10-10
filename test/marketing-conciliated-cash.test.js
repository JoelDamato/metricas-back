const {test}=require('node:test'),assert=require('node:assert/strict'),axios=require('axios');
process.env.SUPABASE_URL='https://example.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='test';
const service=require('../modules/metricasv2/services/supabase.service');
test('Marketing conserva las ventas pero excluye cash pendiente, rebotado y marcado como rebote',async()=>{
 const original=axios.get;
 const rows=[['paid','Conciliado',false],['pending',null,false],['bounce','Rebotado',false],['flag','Conciliado',true]].map(([id,estado,rebotar_pago])=>({id,ghlid:id,tipo:'Venta',producto_format:'Meg 2.1',facturacion:1000,cash_collected_neto:500,fecha_de_agendamiento:'2026-01-01',f_acreditacion:'2026-01-01',estado,rebotar_pago}));
 axios.get=async url=>({data:url.endsWith('/leads_raw')?rows.map(r=>({ghlid:r.ghlid,origen_actual:'Postulación MEG - VSL'})):rows});
 try{
  const filter={from:'2026-01-01',to:'2026-02-01',origen:'VSL'};
  const cash=await service.getMarketingCashCollectedAgenda(filter),sales=await service.getMarketingVentasTotales(filter),aov=await service.getMarketingAovDia1(filter);
  assert.equal(cash.cashCollectedAgenda,500);assert.equal(sales.ventasTotales,4);assert.equal(sales.facturacionVentasTotales,4000);assert.equal(aov.cashCollectedDia1,500);assert.equal(aov.ventasDia1,1);
 }finally{axios.get=original;}
});
test('el filtro de agenda se aplica sobre la fecha actual antes de paginar; venta y pago usan el registro original',async()=>{
 const original=axios.get,calls=[];
 axios.get=async(url,{params})=>{calls.push({url,params});return {data:[]};};
 try{
  for(const dateField of ['fecha_de_agendamiento','f_venta','f_acreditacion'])await service.listRows('comprobantes',{from:'2026-10-01',to:'2026-10-31',dateField,offset:1000});
  assert(calls[0].url.endsWith('/comprobantes_agenda_metricas'));
  assert(calls[0].params.and.includes('fecha_de_agendamiento.gte.2026-10-01'));assert.equal(calls[0].params.offset,1000);
  assert(calls[1].url.endsWith('/comprobantes'));assert(calls[2].url.endsWith('/comprobantes'));
 }finally{axios.get=original;}
});
