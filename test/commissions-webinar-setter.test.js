const test=require('node:test'),assert=require('node:assert/strict');
const service=require('../modules/metricasv2/services/commissions.service');
const {extractWebinarSetters,enrichComprobanteOrigins,buildTransactionDetails}=service._test;
const config=service.normalizeConfig({global:{includeOnlyVerified:false}});
const base={tipo:'Venta',producto_format:'MEG 2.1',estado:'Conciliado',f_venta:'2026-10-28',f_acreditacion:'2026-10-28',setter:'Nahuel Iasci',responsable_venta:'Patricia Conti',origen_actual:'VSL',cash_ar:100000,tc:1000,facturacion:1000};
const run=rows=>buildTransactionDetails({monthKey:'2026-10',config,comprobantesRows:rows,settersRows:[]});
test('lee Setter webinar sin confundirlo con el turno o asesor de WhatsApp',()=>{
 assert.deepEqual(extractWebinarSetters({'Setter':{value:'Nahuel Iasci'},'Webinar 28/10 Setter':{value:'Valentina Suarez'},'Webinar 28/10 - Turno setter':{value:'3'},'Webinar WhatsApp asesor':{value:'Nahuel Iasci'}}),['Valentina Suarez']);
 assert.deepEqual(extractWebinarSetters({abc:{label:'Setter Webinar',value:' Nahuel Iasci '}}),['Nahuel Iasci']);
 assert.deepEqual(extractWebinarSetters({'Webinar 28/10 Setter':{value:''}}),[]);
});
test('Nahuel sólo cobra setting cuando el setter webinar está vacío o es él; closer sigue igual',()=>{
 const rows=[{...base,id:'foreign',ghlid:'foreign'},{...base,id:'own',ghlid:'own',origen_actual:'Webinar'},{...base,id:'empty',ghlid:'empty'}];
 const enriched=enrichComprobanteOrigins(rows,[{ghlid:'foreign',webinarSetters:['Valentina Suarez']},{ghlid:'own',webinarSetters:['Nahuel Iasci']},{ghlid:'empty',webinarSetters:[]}]);
 const details=run(enriched);
 assert.deepEqual(details.filter(d=>d.role==='Setter').map(d=>d.transactionId).sort(),['empty','own']);
 assert.equal(details.filter(d=>d.role==='Closer').length,3);
});
test('las cobranzas heredan la exclusión de la venta vinculada cuando falta el contacto',()=>{
 const details=run([{...base,id:'sale',webinarSetters:['Otra persona']},{...base,id:'payment',tipo:'Cobranza',venta_relacionada:'sale',webinarSetters:[]}]);
 assert.equal(details.filter(d=>d.role==='Setter').length,0);
 assert.equal(details.filter(d=>d.role==='Closer').length,2);
});
test('una venta Club de otro setter webinar no cuenta en la escalera Club de Nahuel',()=>{
 const rows=Array.from({length:6},(_,i)=>({...base,id:`club-${i}`,producto_format:'Club',medios_de_pago:'Mercado Pago',webinarSetters:i<5?['Otra persona']:['Nahuel Iasci']}));
 const details=run(rows).filter(d=>d.role==='Setter');
 assert.equal(details.length,1);
 assert.equal(details[0].counters.clubSalesSequential,1);
 assert.equal(details[0].commissionPct,.5);
});
