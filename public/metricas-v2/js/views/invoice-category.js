(function(root){
  function invoiceCategory(row={}) {
    const issued=Boolean(row.arcaCae || row.arcaInvoiceType);
    const type=String(issued?row.arcaInvoiceType:row.proposedInvoice?.invoiceType||row.requestedInvoiceType||([1,6].includes(Number(row.vatConditionId))?'A':Number(row.vatConditionId)===5?'B':'')).toUpperCase();
    const raw=issued?row.arcaVatCondition:row.proposedInvoice?.vatCondition;
    const condition=String(raw||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const id=Number(issued?row.arcaVatConditionId:row.proposedInvoice?.vatConditionId??row.vatConditionId);
    if(type==='B')return {key:'B',label:'B'};
    if(type==='A'&&(id===6||condition.includes('monotrib')))return {key:'A-MONO',label:'A · Monotributista'};
    if(type==='A'&&(id===1||condition.includes('inscripto')))return {key:'A-RI',label:'A · RI'};
    return {key:'unknown',label:type==='A'?'A · Condición sin informar':'Por confirmar'};
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={invoiceCategory};
  else root.invoiceCategory=invoiceCategory;
})(typeof window!=='undefined'?window:globalThis);
