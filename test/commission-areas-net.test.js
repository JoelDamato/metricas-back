const test=require('node:test'),assert=require('node:assert/strict');
const service=require('../modules/metricasv2/services/commissions.service');
const {commissionAreaForUser}=require('../modules/metricasv2/services/commission-area-identity');
const access=require('../modules/auth/access');
const config=service.normalizeConfig({global:{includeOnlyVerified:false}});
function detail(id,product,tipo='Venta'){return {transactionId:id,role:'Setter',category:'MEG',product,tipo,tc:1000,grossArs:121000,cashArs:121000,cashUsd:121,facturacionUsd:200,facturacionArs:200000,ivaArs:21000,paymentFeesArs:10000,totalDeductionsArs:31000,netTotalArs:90000,baseAmount:90000};}
test('áreas usan CC neto, deduplican comprobantes y CSM excluye venta/cobranza consultoría',()=>{
 const rows=[detail('meg','MEG 2.1'),detail('costos','Sistema de Costos Rentables'),detail('consult','Consultoría'),detail('collection','Consultoría','Cobranza'),detail('related','','Cobranza')];
 const areas=service._test.buildAreaCommissionData([...rows,rows[0]],null,[{id:'related',venta_relacionada:'consult'},{id:'consult',producto_format:'Consultoría'}],'2026-10',config);
 assert.deepEqual(areas.map(a=>a.label),['Comercial','CSM','Marketing']);
 assert.equal(areas[0].cc,450000);assert.equal(areas[0].gain,18000);
 assert.equal(areas[1].cc,180000);assert.equal(areas[1].gain,7200);assert.equal(areas[1].transactionCount,2);
 assert.equal(areas[1].details[0].cashUsd,90);assert.equal(areas[1].details[0].commissionAmount,3600);
});
test('Marketing conserva consultoría pero sólo cuenta conciliados y aplica cargos una vez',()=>{
 const source={id:'sale',tipo:'Venta',producto_format:'Consultoría',estado:'Conciliado',f_acreditacion:'2026-10-04',cash_ar:121000,tc:1000,iva:21000,comisiones:10000,facturacion:200};
 const areas=service._test.buildAreaCommissionData([],null,[source,source,{...source,id:'pending',estado:'No conciliado'},{...source,id:'bounced',rebotar_pago:true}],'2026-10',config);
 const marketing=areas.find(a=>a.label==='Marketing');assert.equal(marketing.cc,90000);assert.equal(marketing.gain,4500);assert.equal(marketing.details.length,1);
});
test('cada cuenta accede sólo a su resumen asignado, incluso Belu con rol CSM',()=>{
 for(const [email,area,role] of [['belenherrera.gestion@gmail.com','CSM','csm'],['walteralegre56@gmail.com','Marketing','comercial'],['leonardoalaniz19@gmail.com','Comercial','comercial']]){
 const user={email,role};assert.equal(commissionAreaForUser(user),area);assert(access.canAccessFeatureForUser(user,'commercial_area',{method:'GET'}));assert(!access.canAccessFeatureForUser(user,'commercial_area',{method:'POST'}));assert(access.canAccessPageForUser(user,'area-comercial.html'));
 }
 assert.equal(commissionAreaForUser({email:'valecalmet@gmail.com',nombre:'Belu',role:'csm'}),null);
});
