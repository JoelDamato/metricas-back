const isOwner = user => String(user?.email || '').trim().toLowerCase() === 'matirandazzo@gmail.com';
const text = value => String(value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const round = value => Math.round((value + Number.EPSILON) * 100) / 100;

// Receipts, not commission lines: an unassigned sale still belongs in the owner's view.
function buildOwnerOverview(dashboard, normalizedRows) {
  const month = dashboard.month;
  const unique = [...new Map(normalizedRows.map((row,index)=>[row.id || `unidentified-${index}`,row])).values()];
  const rows = unique.map(row => {
    const gross = number(row.cash_ar);
    const deductions = number(row.iva_ars) + number(row.external_commissions_ars);
    const net = gross < 0 ? Math.min(0,gross + Math.abs(deductions)) : Math.max(0,gross-deductions);
    const bounced = text(row.estado)==='rebotado' || ['true','1'].includes(text(row.rebotar_pago));
    const status = bounced ? 'Rebotado' : text(row.estado)==='conciliado' ? 'Conciliado' : 'Pendiente';
    const sale = text(row.tipo)==='venta';
    const saleDate = row.f_venta_only || row.f_acreditacion_only;
    return {id:row.id,ghlid:row.ghlid,clientName:row.cliente_format || 'Sin nombre',closer:row.responsable_venta || 'Sin asignar',product:row.producto_format || 'Sin producto',tipo:row.tipo,status,
      date:sale ? saleDate : row.f_acreditacion_only,acreditacionDate:row.f_acreditacion_only,paymentMethod:row.medios_de_pago,
      grossCashArs:round(gross),deductionsArs:round(deductions),cashArs:round(net),cashUsd:row.tc>0?round(net/row.tc):null,tc:row.tc,
      facturacionUsd:sale?number(row.facturacion):0,
      saleInMonth:sale&&String(saleDate).startsWith(month)&&!bounced,
      cashInMonth:String(row.f_acreditacion_only).startsWith(month)};
  }).filter(row=>row.cashInMonth || String(row.date).startsWith(month));
  const collected=rows.filter(row=>row.cashInMonth&&row.status==='Conciliado');
  const sales=rows.filter(row=>row.saleInMonth);
  const pending=rows.filter(row=>row.status==='Pendiente');
  const bounced=rows.filter(row=>row.status==='Rebotado');
  const sum=(items,key)=>round(items.reduce((total,row)=>total+number(row[key]),0));
  const teamCommissionsArs=round(sum(dashboard.details||[],'commissionAmount')+sum(dashboard.areaCommissions||[],'gain'));
  const cashArs=sum(collected,'cashArs');
  return {isOwner:true,month,person:'Mati Randazzo',details:rows.sort((a,b)=>String(b.date).localeCompare(String(a.date))),
    summary:{salesCount:sales.length,facturacionUsd:sum(sales,'facturacionUsd'),cashArs,cashUsd:sum(collected,'cashUsd'),grossCashArs:sum(collected,'grossCashArs'),totalDeductionsArs:sum(collected,'deductionsArs'),transactionCount:collected.length,
      teamCommissionsArs,availableArs:round(cashArs-teamCommissionsArs),pendingArs:sum(pending,'cashArs'),pendingCount:pending.length,bouncedArs:sum(bounced,'cashArs'),bouncedCount:bounced.length,missingTcCount:collected.filter(row=>!(row.tc>0)&&row.cashArs!==0).length},
    attention:[...pending,...bounced].sort((a,b)=>Math.abs(b.cashArs)-Math.abs(a.cashArs)).slice(0,8),
    methodology:'Ventas y facturación por fecha de venta; cash por acreditación y sólo conciliado. Disponible: cash neto menos comisiones de personas, áreas y bonos aprobados. No descuenta otros gastos ni resta adelantos nuevamente.'};
}
module.exports={isOwner,buildOwnerOverview};
