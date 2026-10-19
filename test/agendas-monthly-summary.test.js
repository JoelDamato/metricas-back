const {test}=require('node:test'),assert=require('node:assert/strict'),axios=require('axios');
process.env.SUPABASE_URL='https://example.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='test';
const service=require('../modules/metricasv2/services/supabase.service');
test('desglose mensual conserva AOV ponderado, conciliación y rangos de inversión',async()=>{
 const original=axios.get;
 const rows=[['2026-01-03',400,'Conciliado'],['2026-01-20',800,'Conciliado'],['2026-02-01',900,'Conciliado'],['2026-02-02',900,'Rebotado']].map(([fecha_de_agendamiento,cash_collected_neto,estado],i)=>({id:String(i),origen_actual:'VSL',primer_origen:'VSL',tipo:'Venta',producto_format:'MEG',facturacion:1000,fecha_de_agendamiento,cash_collected_neto,estado}));
 axios.get=async url=>({data:url.endsWith('/kpi_marketing_inversiones')?[
 {fecha_desde:'2026-01-01',fecha_hasta:'2026-01-31',inversion_realizada:100},
 {fecha_desde:'2026-01-15',fecha_hasta:'2026-02-15',inversion_realizada:200},
 {fecha_desde:'2026-02-01',fecha_hasta:'2026-02-28',inversion_realizada:300}]:url.endsWith('/leads_raw')?[]:rows});
 try{const f={from:'2026-01-01',to:'2026-12-31'};const a=await service.getMarketingAovDia1(f),i=await service.getMarketingInvestment(f);
 assert.equal(a.aovDia1,700);assert.equal(a.byMonth[1].aovDia1,600);assert.equal(a.byMonth[2].aovDia1,900);assert.equal(a.ventasDia1,3);
 assert.equal(i.inversion_realizada,600);assert.deepEqual(i.byMonth,{1:100,2:300});
 }finally{axios.get=original;}
});
