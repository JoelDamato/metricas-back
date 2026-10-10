const {test}=require('node:test'),assert=require('node:assert/strict');
const {buildUserCommercialArea}=require('../modules/metricasv2/services/commissions.service');
const {isOwner}=require('../modules/metricasv2/services/owner-overview');
function row(id,extra={}){return {id,tipo:'Venta',producto_format:'MEG 2.1',cliente_format:id,responsable_venta:'',estado:'Conciliado',f_venta:'2026-10-03',f_acreditacion:'2026-10-03',cash_ar:121000,iva:21000,comisiones:10000,tc:1000,facturacion:200,...extra};}
function overview(source){return buildUserCommercialArea({month:'2026-10',details:[{commissionAmount:9000},{isBonus:true,commissionAmount:1000}],areaCommissions:[{gain:4000}],movementRows:[{kind:'adelanto',amount_ars:20000}],sourceComprobantesRows:source},{email:'matirandazzo@gmail.com'});}
test('dueño incluye ventas sin closer y sin comisión; deduplica comprobantes y usa cash conciliado neto',()=>{
 const receipt=row('a');const data=overview([receipt,receipt,row('pending',{estado:'No conciliado'}),row('bounce',{estado:'Rebotado'}),row('flag',{rebotar_pago:true}),row('old',{f_venta:'2026-09-03',f_acreditacion:'2026-09-03'})]);
 assert.equal(data.isOwner,true);assert.equal(data.details.length,4);assert.equal(data.details[0].closer,'Sin asignar');assert.equal(data.summary.cashArs,90000);assert.equal(data.summary.cashUsd,90);assert.equal(data.summary.pendingCount,1);assert.equal(data.summary.bouncedCount,2);assert.equal(data.summary.salesCount,2);assert.equal(data.summary.facturacionUsd,400);assert.equal(data.summary.teamCommissionsArs,14000);assert.equal(data.summary.availableArs,76000);assert(!('totalCommission' in data.summary));assert(!('settlement' in data));
});
test('cobranza de venta anterior suma al cash del mes sin inventar una venta nueva; no mezcla TC faltante',()=>{
 const data=overview([row('collection',{tipo:'Cobranza',f_venta:'2026-06-03'}),row('no-tc',{tc:0}),row('refund',{tipo:'Devolución',cash_ar:-121000,iva:-21000,comisiones:-10000})]);
 assert.equal(data.summary.salesCount,1);assert.equal(data.summary.facturacionUsd,200);assert.equal(data.summary.cashArs,90000);assert.equal(data.summary.cashUsd,0);assert.equal(data.summary.missingTcCount,1);
});
test('permisos de dueño dependen exclusivamente de la identidad, no del rol o nombre',()=>{
 assert(isOwner({email:' MATIRANDAZZO@GMAIL.COM '}));assert(!isOwner({email:'otro@example.com',role:'total',nombre:'Mati Randazzo'}));assert(!isOwner({email:'nadia.cavallini@gmail.com',role:'total'}));
});
