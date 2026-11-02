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
 assert.deepEqual(extractWebinarSetters({setting:{label:'Setting webinar',value:'Nahuel Iasci'}}),['Nahuel Iasci']);
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


test('asigna a Nahuel el setting webinar aunque el setter común esté vacío o sea otro, sin duplicarlo',()=>{
 const details=run([
  {...base,id:'empty',setter:'',origen_actual:'Webinar',webinarSetters:['Nahuel Iasci']},
  {...base,id:'other',setter:'Otro Setter',origen_actual:'Webinar',webinarSetters:['Nahuel Iasci']},
  {...base,id:'same',setter:'Nahuel Iasci',webinarSetters:['Nahuel']},
  {...base,id:'foreign',setter:'Nahuel Iasci',webinarSetters:['Otra persona']}
 ]);
 const setting=details.filter(d=>d.role==='Setter');
 assert.deepEqual(setting.map(d=>d.transactionId).sort(),['empty','other','same']);
 assert(setting.every(d=>d.person==='Nahuel Iasci'&&d.commissionAmount===d.baseAmount*d.commissionPct));
 assert.equal(details.filter(d=>d.role==='Closer').length,4);
});

test('la cobranza hereda el setter webinar de la venta y conserva el porcentaje especial',()=>{
 const saleId='10000000-0000-4000-8000-000000000001';
 const rows=[{...base,id:saleId,cliente:'client',setter:'',webinarSetters:['Nahuel Iasci']},{...base,id:'payment',cliente:'client',tipo:'Cobranza',setter:'',origen_actual:'Webinar',venta_relacionada:saleId}];
 const details=buildTransactionDetails({monthKey:'2026-10',config,comprobantesRows:rows,settersRows:[],commissionOverrides:[{sale_id:saleId,setter_pct:.07}]});
 const setting=details.filter(d=>d.role==='Setter');
 assert.equal(setting.length,2);
 assert(setting.every(d=>d.person==='Nahuel Iasci'&&d.commissionPct===.07));
});
