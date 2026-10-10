const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('Reporte de cash no muestra pagos pendientes pero Ventas mantiene las ventas registradas',async()=>{
 const rows=[['paid','Conciliado',false],['pending',null,false],['bounce','Rebotado',false],['flag','Conciliado',true]].map(([id,estado,rebotar_pago])=>({id,responsable_venta:'Patricia Conti',tipo:'Venta',producto_format:'MEG 2.1',estado,rebotar_pago,cash_collected_neto:100,cash_collected_neto_ars:100000,facturacion:1000}));
 const context={window:{metricasApi:{fetchAllRows:async()=>({rows})}},console};
 const source=fs.readFileSync('public/metricas-v2/js/views/reportes.page.js','utf8').replace(/setupFilters\(\);\s*document\.getElementById\('reload'\)\.addEventListener\('click', loadReportes\);\s*loadReportes\(\);\s*$/,'');
 vm.createContext(context);vm.runInContext(source,context);
 const cash=await context.fetchCashRows({from:'2026-10-01',to:'2026-11-01'});
 assert.equal(cash.length,1);assert.equal(cash[0].cash_collected_usd,100);
 const sales=await context.loadVentasData({from:'2026-10-01',to:'2026-11-01'});
 assert.equal(sales.reduce((sum,r)=>sum+Number(r.ventas||0),0),4);
});
test('Renovaciones excluye cobros pendientes y mantiene la deuda de una venta sin conciliar',()=>{
 const source=fs.readFileSync('public/metricas-v2/js/views/csm.page.js','utf8');
 const context={window:{location:{search:'',pathname:'/views/csm-tiempo.html'}},document:{body:{dataset:{csmPage:'test'}}},Intl,Date,URLSearchParams,console};
 vm.createContext(context);vm.runInContext(source,context);
 const rows=[{id:'s',ghlid:'g',tipo:'Venta',producto_format:'Renovacion - Meg 2.1',f_venta:'2026-10-01',f_acreditacion:'2026-10-01',facturacion:1000,cash_collected_neto:500,cash_collected_neto_total:0,estado:null}];
 const result=context.buildRenewalFinancialMetrics(rows,{});
 assert.equal(result.totals.cashCollected,0);assert.equal(result.totals.pendiente,1000);assert.equal(result.totals.facturacion,1000);
 rows[0].estado='Conciliado';const paid=context.buildRenewalFinancialMetrics(rows,{});assert.equal(paid.totals.cashCollected,500);assert.equal(paid.totals.pendiente,500);
 rows[0].rebotar_pago=true;assert.equal(context.buildRenewalFinancialMetrics(rows,{}).totals.cashCollected,0);
});
