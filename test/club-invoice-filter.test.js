const {test}=require('node:test');
const assert=require('node:assert/strict');
const {matchesInvoiceCategory,invoiceCategory}=require('../public/metricas-v2/js/views/invoice-category');
test('filtro A incluye ambas condiciones y A histórica sin condición; C no desaparece',()=>{
 const rows=[{arcaInvoiceType:'A',arcaVatConditionId:1},{arcaInvoiceType:'A',arcaVatConditionId:6},{arcaInvoiceType:'A'},{arcaInvoiceType:'B'},{arcaInvoiceType:'C'},{identificationType:'CUIT'}];
 assert.equal(rows.filter(r=>matchesInvoiceCategory(r,'A')).length,3);
 assert.equal(rows.filter(r=>matchesInvoiceCategory(r,'A-RI')).length,1);
 assert.equal(rows.filter(r=>matchesInvoiceCategory(r,'A-MONO')).length,1);
 assert.equal(rows.filter(r=>matchesInvoiceCategory(r,'B')).length,1);
 assert.equal(rows.filter(r=>matchesInvoiceCategory(r,'C')).length,1);
 assert.equal(invoiceCategory(rows[4]).label,'C');
 assert.equal(rows.filter(r=>matchesInvoiceCategory(r,'')).length,6);
 assert.equal(matchesInvoiceCategory({arcaInvoiceType:'B',requestedInvoiceType:'A',vatConditionId:1},'A'),false);
 assert.equal(matchesInvoiceCategory({vatConditionId:6},'A'),true);
});
