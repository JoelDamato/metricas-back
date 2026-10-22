const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
test('vencidos incluye hoy y 15 días, excluye 16 días, futuros y renovados; elimina cantidad de renovaciones',()=>{
 const context={window:{location:{search:''}},document:{body:{dataset:{csmPage:'test'}}},URLSearchParams,Intl,console};
 vm.createContext(context);
 vm.runInContext(`const RealDate=Date; Date=class extends RealDate { constructor(...args){super(...(args.length?args:['2026-10-22T12:00:00Z']));} };`,context);
 vm.runInContext(fs.readFileSync('public/metricas-v2/js/views/csm.page.js','utf8'),context);
 const page=vm.runInContext(`buildRenewalsPage(enrichRows([
 {id:'today',nombre:'Hoy',fecha_final:'2026-10-22'},
 {id:'15',nombre:'Quince',fecha_final:'2026-10-07'},
 {id:'16',nombre:'Dieciséis',fecha_final:'2026-10-06'},
 {id:'future',nombre:'Futuro',fecha_final:'2026-10-23'},
 {id:'renewed',nombre:'Renovado',fecha_final:'2026-10-20',fecha_final_renovacion:'2027-04-20'},
 {id:'empty',nombre:'Sin fecha'}
 ]))`,context);
 const overdue=page.metrics.find(m=>m.key==='renewals_overdue_15d');
 assert.equal(overdue.value,'2');
 assert.deepEqual(Array.from(overdue.info.detailRows,r=>r[0].label).sort(),['Hoy','Quince']);
 assert.equal(page.metrics.some(m=>['renewals_completed','renewals_overdue'].includes(m.key)),false);
 assert.equal(page.kpiKeys.includes('renewals_completed'),false);
 assert.equal(page.chart.labels.includes('Renovadas'),false);
 assert.equal(page.chart.datasets[0].data[2],2);
 // The separately displayed current-month count retains its own scope.
 assert.equal(page.metrics.find(m=>m.key==='renewals_overdue_current_month').value,'3');
});
