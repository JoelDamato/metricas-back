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
 assert.deepEqual(details.filter(d=>d.role==='Setter'&&d.person==='Nahuel Iasci').map(d=>d.transactionId).sort(),['empty','own']);
 assert.equal(details.filter(d=>d.role==='Closer').length,3);
});
test('las cobranzas heredan la exclusión de la venta vinculada cuando falta el contacto',()=>{
 const details=run([{...base,id:'sale',webinarSetters:['Otra persona']},{...base,id:'payment',tipo:'Cobranza',venta_relacionada:'sale',webinarSetters:[]}]);
 assert.equal(details.filter(d=>d.role==='Setter'&&d.person==='Nahuel Iasci').length,0);
 assert.equal(details.filter(d=>d.role==='Closer').length,2);
});
test('una venta Club de otro setter webinar no cuenta en la escalera Club de Nahuel',()=>{
 const rows=Array.from({length:6},(_,i)=>({...base,id:`club-${i}`,producto_format:'Club',medios_de_pago:'Mercado Pago',webinarSetters:i<5?['Otra persona']:['Nahuel Iasci']}));
 const details=run(rows).filter(d=>d.role==='Setter'&&d.person==='Nahuel Iasci');
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
 const setting=details.filter(d=>d.role==='Setter'&&d.person==='Nahuel Iasci');
 assert.deepEqual(setting.map(d=>d.transactionId).sort(),['empty','other','same']);
 assert(setting.every(d=>d.person==='Nahuel Iasci'&&d.commissionAmount===d.baseAmount*d.commissionPct));
 assert.equal(details.filter(d=>d.role==='Closer').length,4);
});

test('la cobranza hereda el setter webinar de la venta y conserva el porcentaje especial',()=>{
 const saleId='10000000-0000-4000-8000-000000000001';
 const rows=[{...base,id:saleId,cliente:'client',setter:'',webinarSetters:['Nahuel Iasci']},{...base,id:'payment',cliente:'client',tipo:'Cobranza',setter:'',origen_actual:'Webinar',venta_relacionada:saleId}];
 const details=buildTransactionDetails({monthKey:'2026-10',config,comprobantesRows:rows,settersRows:[],commissionOverrides:[{sale_id:saleId,setter_pct:.07}]});
 const setting=details.filter(d=>d.role==='Setter'&&d.person==='Nahuel Iasci');
 assert.equal(setting.length,2);
 assert(setting.every(d=>d.person==='Nahuel Iasci'&&d.commissionPct===.07));
});

test('la agenda de Brenda no cuenta para Nahuel y elimina el contador histórico residual',()=>{
 const agenda={setter:'Nahuel Iasci',fecha_agenda:'2026-10-28',agendo:'Agendo',aplica:'Aplica',origen_actual:'APSET',webinarSetters:['Brenda Damato']};
 const counts=service._test.buildLiveAgendaCountMap([agenda],'2026-10');
 assert.equal(counts.has('nahuel iasci'),false);
 assert.equal(counts.get('brenda damato').agendo,1);
 const details=buildTransactionDetails({monthKey:'2026-10',config,comprobantesRows:[{...base,id:'own'}],agendaRows:[agenda],settersRows:[{anio:2026,mes:10,setter:'Nahuel Iasci',agendo:80}]});
 assert.equal(details.find(d=>d.role==='Setter').counters.agendas,0);
 assert.equal(details.some(d=>d.isBonus),false);
});
test('Brenda recibe la comisión de su lead con sus reglas configuradas',()=>{
 const rules=service.normalizeConfig({...config,personRoles:[...config.personRoles,{person:'Brenda Damato',role:'Setter'}]});
 const details=buildTransactionDetails({monthKey:'2026-10',config:rules,comprobantesRows:[{...base,id:'juan',webinarSetters:['Brenda Damato']}],settersRows:[]});
 assert.equal(details.find(d=>d.role==='Setter').person,'Brenda Damato');
 assert.equal(details.some(d=>d.person==='Nahuel Iasci'),false);
});
test('el histórico Club personal tampoco incluye leads de otro setter webinar',()=>{
 const rows=[{...base,id:'foreign',producto_format:'Club',webinarSetters:['Brenda Damato']},{...base,id:'own',producto_format:'Club',setter:'',webinarSetters:['Nahuel Iasci']}];
 const months=service._test.buildPersonalClubMonthly(rows,{email:'iascinahuel@gmail.com'},2026,false);
 assert.equal(months[9].sales,1);
});

test('sector Webinar: sólo agendas vendidas, 11 al 3% y 12 al 3,5%; sin contar cobranzas ni agendas sin venta',()=>{
 const sales=Array.from({length:12},(_,i)=>({...base,id:`sale${i}`,ghlid:`g${i}`,webinarSetters:['Brenda Damato']}));
 const agendas=Array.from({length:50},(_,i)=>({id:`agenda${i}`,fecha_agenda:'2026-10-28',agendo:'Agendo',webinarSetters:['Brenda Damato']}));
 for(const [count,pct] of [[11,.03],[12,.035]]){
  const rows=[...sales.slice(0,count),{...base,id:'payment',ghlid:'g0',tipo:'Cobranza',webinarSetters:['Brenda Damato']},{...base,id:'nahuel',webinarSetters:['Nahuel Iasci']}];
  const details=buildTransactionDetails({monthKey:'2026-10',config,comprobantesRows:rows,agendaRows:agendas,settersRows:[]});
  const webinar=details.filter(d=>d.sector==='webinar');
  assert.equal(webinar.length,count+1);
  assert(webinar.every(d=>d.commissionPct===pct&&d.counters.agendas===count));
  assert.equal(details.find(d=>d.transactionId==='nahuel'&&d.role==='Setter').commissionPct,.045);
 }
});
test('el resumen webinar omite setters sin ventas ni cobranzas y cuenta a Juan Pablo sin fecha de agenda',()=>{
 const {buildWebinarSummary,webinarSoldAgendaCounts}=require('../modules/metricasv2/services/webinar-commissions');
 const rows=[{...base,id:'juan',ghlid:'juan',webinarSetters:['Brenda Damato']},{...base,id:'second',ghlid:'juan',webinarSetters:['Brenda Damato']}];
 assert.equal(webinarSoldAgendaCounts(rows).get('brenda damato').agendas,1);
 const details=buildTransactionDetails({monthKey:'2026-10',config,comprobantesRows:rows,agendaRows:[{fecha_agenda:'2026-10-28',agendo:'Agendo',webinarSetters:['Otra Setter']}],settersRows:[]});
 const summary=buildWebinarSummary(details);
 assert.equal(summary.length,1);assert.equal(summary[0].person,'Brenda Damato');assert.equal(summary[0].agendas,1);
});
test('Webinar: cobra cada acreditación del mes y respeta el porcentaje especial de la venta',()=>{
 const sale='10000000-0000-4000-8000-000000000004';
 const rows=[{...base,ghlid:'same-client',id:sale,f_acreditacion:'2026-09-28',webinarSetters:['Brenda Damato']},{...base,ghlid:'same-client',id:'payment',tipo:'Cobranza',venta_relacionada:sale}];
 const details=buildTransactionDetails({monthKey:'2026-10',config,comprobantesRows:rows,settersRows:[],commissionOverrides:[{sale_id:sale,setter_pct:.04}]});
 const webinar=details.filter(d=>d.sector==='webinar');assert.equal(webinar.length,1);assert.equal(webinar[0].person,'Brenda Damato');assert.equal(webinar[0].commissionPct,.04);
});
