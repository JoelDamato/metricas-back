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
  function invoiceFiscalDetails(row={}) {
    const issued=Boolean(row.arcaCae || row.arcaInvoiceType);
    const source=issued ? {type:row.arcaInvoiceType,id:row.arcaVatConditionId,condition:row.arcaVatCondition}
      : {type:row.proposedInvoice?.invoiceType||row.requestedInvoiceType,id:row.proposedInvoice?.vatConditionId??row.vatConditionId,condition:row.proposedInvoice?.vatCondition};
    const id=Number(source.id);
    const condition=source.condition || ({1:'Responsable Inscripto',5:'Consumidor Final',6:'Monotributista'}[id]) || 'Sin informar';
    const type=String(source.type || (!issued ? ({1:'A',5:'B',6:'A'}[id]) : '') || '').toUpperCase();
    return {invoice:type ? `Factura ${type}` : 'Tipo por confirmar',condition};
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={invoiceCategory,invoiceFiscalDetails};
  else {root.invoiceCategory=invoiceCategory;root.invoiceFiscalDetails=invoiceFiscalDetails;}
})(typeof window!=='undefined'?window:globalThis);
