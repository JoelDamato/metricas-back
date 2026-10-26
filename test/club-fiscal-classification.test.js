const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createClassifier}=require('../modules/metricasv2/services/club-fiscal-classification.service');
const {invoiceFiscalDetails,matchesInvoiceCategory}=require('../public/metricas-v2/js/views/invoice-category');
const {metricasApiGuard}=require('../modules/auth/middleware');
const row=(id,extra={})=>({kind:'payment',id,identificationType:'CUIT',identificationNumber:'20123456789',...extra});
test('resuelve antes de emitir, deduplica CUIT y conserva los errores por fila',async()=>{
 let calls=0;
 const classify=createClassifier(async record=>{calls++;if(record.identificationNumber==='20999999999')throw Error('Padrón no disponible');return {invoiceType:record.identificationType==='DNI'?'B':'A',vatConditionId:record.identificationType==='DNI'?5:6,vatCondition:record.identificationType==='DNI'?'Consumidor Final':'Responsable Monotributo'};});
 const input=[row('1'),row('2'),row('3',{identificationType:'DNI',identificationNumber:'30123456'}),row('4',{identificationNumber:''}),row('5',{identificationNumber:'20999999999'})];
 const result=await classify(input);
 assert.equal(calls,3);assert.equal(result.records[0].fiscalClassification.vatConditionId,6);
 assert.equal(result.records[2].fiscalClassification.invoiceType,'B');assert.equal(result.records[3].fiscalStatus,'missing');assert.equal(result.records[4].fiscalStatus,'error');
 assert.equal(matchesInvoiceCategory(result.records[0],'A-MONO'),true);
 assert.equal(invoiceFiscalDetails(result.records[0]).condition,'Responsable Monotributo');
 assert.match(invoiceFiscalDetails(result.records[4]).condition,/Padrón/);
 assert.equal(invoiceFiscalDetails({...result.records[0],arcaInvoiceType:'B',arcaVatCondition:'Consumidor Final'}).invoice,'Factura B');
 await classify(input);assert.equal(calls,3);
 await classify([row('6',{vatConditionId:1,payerAddress:'Cambio de datos'})]);assert.equal(calls,4);
 await assert.rejects(classify(Array.from({length:21},(_,i)=>row(String(i)))),e=>e.statusCode===400);
});
test('las consultas se limitan a cuatro concurrentes',async()=>{
 let active=0,max=0;const classify=createClassifier(async()=>{active++;max=Math.max(max,active);await new Promise(r=>setImmediate(r));active--;return {invoiceType:'A',vatConditionId:1,vatCondition:'Responsable Inscripto'};});
 await classify(Array.from({length:12},(_,i)=>row(String(i),{identificationNumber:String(20000000000+i)})));assert.equal(max,4);
});
test('la consulta fiscal conserva el permiso de Administración',async t=>{
 for(const [user,allowed] of [[{email:'nadia.cavallini@gmail.com',role:'total'},true],[{email:'charliecarlostu@gmail.com',role:'comercial'},false],[{email:'nadia.cavallini@gmail.com',role:'total',access_config:{canAccessAdministration:false}},false]]){
  t.mock.method(require('../modules/auth/service'),'getActiveUserByEmail',async()=>user);
  let passed=false,status=200;const res={status(n){status=n;return this},json(){return this}};
  await metricasApiGuard({path:'/mercado-pago/club/fiscal-classification',method:'POST',authUser:user},res,()=>{passed=true});
  assert.equal(passed,allowed);if(!allowed)assert.equal(status,403);
 }
});
