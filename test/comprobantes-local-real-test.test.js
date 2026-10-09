const test=require('node:test');
const assert=require('node:assert/strict');
const {literal,projectRow,buildTransaction,isTest}=require('../modules/metricasv2/services/comprobantes-local-test.service')._test;
test('el modo real TEST queda desactivado por defecto y nunca se habilita en producción',()=>{
 const old=process.env.COMPROBANTES_LOCAL_REAL_TEST,env=process.env.NODE_ENV;
 try{delete process.env.COMPROBANTES_LOCAL_REAL_TEST;assert.equal(require('../modules/metricasv2/services/comprobantes-local-test.service').enabled(),false);process.env.COMPROBANTES_LOCAL_REAL_TEST='1';process.env.NODE_ENV='production';assert.equal(require('../modules/metricasv2/services/comprobantes-local-test.service').enabled(),false);}finally{if(old===undefined)delete process.env.COMPROBANTES_LOCAL_REAL_TEST;else process.env.COMPROBANTES_LOCAL_REAL_TEST=old;if(env===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=env;}
});
test('adapta al esquema existente sin enviar columnas nuevas y preserva tipos históricos',()=>{
 assert.deepEqual(projectRow({id:'a',finalizar:true,cash_collected:12,batch_id:'new'},[{column_name:'id',data_type:'text'},{column_name:'finalizar',data_type:'text'},{column_name:'cash_collected',data_type:'numeric'}]),{id:'a',finalizar:'true',cash_collected:12});
 assert.equal(literal("O'Connor"),"'O''Connor'");
});
test('requiere marca y metadatos propios para reconocer un TEST',()=>{
 assert.equal(isTest({info_comprobantes:'TEST escrito por cliente'}),false);
 assert.equal(isTest({info_comprobantes:'[TEST SUPABASE LOCAL] abc\nTEST_METADATA={"mode":"local_real_test"}'}),true);
});
test('SQL limita las escrituras a la carga, bloquea reintentos y no ejecuta DDL',()=>{
 const q=buildTransaction([{id:'sale',tipo:'Venta',cash_collected:10,facturacion:30,info_comprobantes:"O'Connor $test_batch$"}],[], 'test-key','lead','sale');
 assert.match(q,/pg_advisory_xact_lock/);assert.match(q,/if not exists/);assert.match(q,/json_populate_recordset/);assert.doesNotMatch(q,/alter table|create table|drop table/i);assert.match(q,/O''Connor/);
});
test('los medios son generales y se descartan restricciones antiguas por producto',()=>{
 const d=require('../modules/metricasv2/services/comprobantes-direct.service')._test;
 const base={products:structuredClone(d.DEFAULT_PRODUCTS),paymentMethods:structuredClone(d.DEFAULT_PAYMENT_METHODS),responsiblePeople:structuredClone(d.DEFAULT_RESPONSIBLE_PEOPLE),rules:{...structuredClone(d.DEFAULT_RULES),productPaymentMethods:{club:[]}}};
 const config=d.validateConfig(base);
 assert.equal(config.rules.productPaymentMethods,undefined);
 delete base.rules.productPaymentMethods;
 assert.deepEqual(config.paymentMethods,d.validateConfig(base).paymentMethods);
});
test('las nuevas cargas descuentan IVA y costo del medio antes del porcentaje del vendedor, también en Club',()=>{
 const {normalizeConfig,_test:{buildTransactionDetails}}=require('../modules/metricasv2/services/commissions.service');
 for(const product of ['Club del Costo','Meg 2.1']) {
  const details=buildTransactionDetails({monthKey:'2026-10',config:normalizeConfig({}),settersRows:[],agendaRows:[],comprobantesRows:[{
   id:'test-net',tipo:'Venta',estado:'Conciliado',producto_format:product,responsable_venta:'Patricia Conti',setter:'Nahuel Iasci',f_venta:'2026-10-01',f_acreditacion:'2026-10-01',cash_ar:100000,cash_collected_ar:100000,cash_collected_ars:100000,iva:10000,comisiones:5000,medios_de_pago:'Transferencia',info_comprobantes:'[TEST SUPABASE LOCAL] test-net'
  }]});
  assert.ok(details.length>0);
  for(const detail of details){assert.equal(detail.baseAmount,85000);assert.equal(detail.commissionAmount,85000*detail.commissionPct);}
 }
});
