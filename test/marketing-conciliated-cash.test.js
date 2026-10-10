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
