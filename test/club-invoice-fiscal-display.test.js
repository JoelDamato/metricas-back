const test=require('node:test');
const assert=require('node:assert/strict');
const {invoiceFiscalDetails}=require('../public/metricas-v2/js/views/invoice-category');
test('muestra letra y condición fiscal guardada antes de facturar',()=>{
 assert.deepEqual(invoiceFiscalDetails({vatConditionId:6}),{invoice:'Factura A',condition:'Monotributista'});
 assert.deepEqual(invoiceFiscalDetails({vatConditionId:1}),{invoice:'Factura A',condition:'Responsable Inscripto'});
 assert.deepEqual(invoiceFiscalDetails({vatConditionId:5}),{invoice:'Factura B',condition:'Consumidor Final'});
 assert.deepEqual(invoiceFiscalDetails({}),{invoice:'Tipo por confirmar',condition:'Sin informar'});
});
test('las facturas emitidas muestran sus datos históricos sin sustituirlos por datos actuales',()=>{
 assert.deepEqual(invoiceFiscalDetails({arcaInvoiceType:'A',arcaVatCondition:'Responsable Monotributo',vatConditionId:1}),{invoice:'Factura A',condition:'Responsable Monotributo'});
 assert.deepEqual(invoiceFiscalDetails({arcaInvoiceType:'B',vatConditionId:6}),{invoice:'Factura B',condition:'Sin informar'});
});
