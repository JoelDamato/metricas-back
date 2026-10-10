const test=require('node:test');const assert=require('node:assert/strict');
const {listContactReceipts,totals}=require('../modules/metricasv2/services/comprobantes-contacto.service');
const commissions=require('../modules/metricasv2/services/commissions.service');
test('estado de contacto pagina todo el histórico e incluye cobranzas sin GHL por venta relacionada',async()=>{
 const calls=[];const rows=Array.from({length:500},(_,i)=>({id:String(i).padStart(5,'0'),tipo:i===0?'Venta':'Cobranza',ghlid:'contact',f_acreditacion:'2026-01-01'}));
 const result=await listContactReceipts('contact',['lead'],{url:'https://test.invalid',key:'test',request:async(_url,{params})=>{calls.push(params);if(params.venta_relacionada)return{data:[rows[1],{id:'orphan',tipo:'Cobranza',venta_relacionada:'00000',f_acreditacion:'2026-10-03'}]};return {data:params.id?[{id:'new-direct',tipo:'Cobranza',f_acreditacion:'2026-10-03'}]:rows};}});
 assert.equal(result.length,502);assert.equal(calls[1].id,'gt.00499');assert.ok(result.some(r=>r.id==='orphan'));assert.ok(result.some(r=>r.id==='new-direct'));assert.ok(calls.some(call=>call.cliente?.startsWith('in.')));
});
test('saldos separan cobrado conciliado, pendiente y rebotado',()=>{
 assert.deepEqual(totals([{tipo:'Venta',facturacion:1000,cash_collected:100,estado:'Conciliado'},{tipo:'Cobranza',cash_collected:200,estado:null},{tipo:'Cobranza',cash_collected:300,estado:'Rebotado'}]),{facturacion:1000,cobrado:100,pendiente:200,rebotado:300,saldo:900});
});
test('únicamente conciliado genera comisión, incluso al desactivar el filtro de verificación',()=>{
 for(const includeOnlyVerified of [true,false])for(const estado of [null,'No conciliado','Rebotado','Conciliado']){
  const row={id:'r',tipo:'Venta',producto_format:'Meg 2.1',responsable_venta:'Patricia Conti',estado,verificacion_comisiones:'🟢 Verificado',f_venta:'2026-10-01',f_acreditacion:'2026-10-01',cash_collected_ar:100000,cash_collected_ars:100000,iva:10000,comisiones:5000};
  const details=commissions._test.buildTransactionDetails({monthKey:'2026-10',config:commissions.normalizeConfig({global:{includeOnlyVerified}}),comprobantesRows:[row],settersRows:[],agendaRows:[]});
  assert.equal(details.length>0,estado==='Conciliado');if(details.length)assert.equal(details[0].baseAmount,85000);
 }
});
test('saldo del cliente descuenta IVA con el TC del comprobante pero no comisiones del medio',()=>{
 const result=totals([{tipo:'Venta',facturacion:1000,cash_collected:1210,cash_ar:1210000,iva:210000,tc:1000,comisiones:50000,estado:'Conciliado'}]);
 assert.equal(result.cobrado,1000);assert.equal(result.saldo,0);
 const historical=totals([{tipo:'Venta',facturacion:1000,cash_collected:1210,cash_ar:1210000,iva:210000,estado:'Conciliado'}]);assert.equal(historical.saldo,0);
 const pending=totals([{tipo:'Venta',facturacion:1000,cash_collected:1210,iva:210000,tc:1000,estado:'No conciliado'}]);assert.equal(pending.cobrado,0);assert.equal(pending.pendiente,1000);assert.equal(pending.saldo,1000);
});
test('histórico preservado se suma una sola vez; pendientes y rebotes no alteran el saldo inicial',()=>{
 const {openingBalance}=require('../modules/metricasv2/services/comprobantes-contacto.service');
 const opening=openingBalance({ghl_opening_balance:{facturacion:1500,cash_collected:1500}});
 const rows=[{tipo:'Venta',facturacion:1975,cash_collected:1975,estado:'Conciliado'},{tipo:'Cobranza',cash_collected:100,estado:null}];
 assert.deepEqual(totals(rows,opening),{facturacion:3475,cobrado:3475,pendiente:100,rebotado:0,saldo:0});
 assert.equal(totals(rows,opening).facturacion,3475);
 assert.deepEqual(totals([],opening),{facturacion:1500,cobrado:1500,pendiente:0,rebotado:0,saldo:0});
 assert.equal(openingBalance({}),null);
 assert.throws(()=>openingBalance({ghl_opening_balance:{facturacion:100,cash_collected:200}}));
});
