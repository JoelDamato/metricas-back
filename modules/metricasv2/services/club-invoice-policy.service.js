const FIXED_DESCRIPTION = 'Suscripción mensual a edición digital informativa sobre costos y gestión, con contenidos originales y actualización periódica en línea - Club del Costo.';
const MONOTRIBUTO_LEGEND = 'El crédito fiscal discriminado en el presente comprobante, sólo podrá ser computado a efectos del Régimen de Sostenimiento e Inclusión Fiscal para Pequeños Contribuyentes de la Ley N.º 27.618.';
const TRANSPARENCY_LEGEND = 'Régimen de Transparencia Fiscal al Consumidor (Ley 27.743)';
const VAT_RATE = 0.21;
const VAT_RATE_ID = 5;

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function invoiceAmounts(total, taxTreatment) {
  const amount = roundMoney(total);
  if (taxTreatment === 'Gravado 21%') {
    const net = roundMoney(amount / (1 + VAT_RATE));
    const vat = roundMoney(amount - net);
    return { total: amount, net, exempt: 0, vat, vatRate: VAT_RATE, vatRateId: VAT_RATE_ID };
  }
  return { total: amount, net: 0, exempt: amount, vat: 0, vatRate: 0, vatRateId: null };
}

function buildClubInvoicePolicy(record, recipient) {
  const vatConditionId = Number(recipient?.vatConditionId);
  const isMonotributo = vatConditionId === 6;
  const isRegisteredVat = vatConditionId === 1;
  const taxTreatment = isRegisteredVat ? 'Gravado 21%' : 'Exento';
  const description = isRegisteredVat
    ? String(record?.description || '').trim()
    : FIXED_DESCRIPTION;

  if (!description) throw new Error('Falta el nombre de la membresía de Mercado Pago para facturar al Responsable Inscripto');

  const legends = [];
  if (isMonotributo) legends.push(MONOTRIBUTO_LEGEND);
  if (!isRegisteredVat) legends.push(TRANSPARENCY_LEGEND);

  return {
    case: isRegisteredVat ? 'responsable_inscripto' : isMonotributo ? 'monotributo' : 'consumidor_final',
    description,
    taxTreatment,
    amounts: invoiceAmounts(record?.amount, taxTreatment),
    legends,
    showTransparency: !isRegisteredVat,
    showMonotributoLegend: isMonotributo
  };
}

function arcaAmountsXml(amounts) {
  const total = amounts.total.toFixed(2);
  const net = amounts.net.toFixed(2);
  const exempt = amounts.exempt.toFixed(2);
  const vat = amounts.vat.toFixed(2);
  const vatBreakdown = amounts.vatRateId
    ? `<Iva><AlicIva><Id>${amounts.vatRateId}</Id><BaseImp>${net}</BaseImp><Importe>${vat}</Importe></AlicIva></Iva>`
    : '';
  return `<ImpTotal>${total}</ImpTotal><ImpTotConc>0.00</ImpTotConc><ImpNeto>${net}</ImpNeto><ImpOpEx>${exempt}</ImpOpEx><ImpTrib>0.00</ImpTrib><ImpIVA>${vat}</ImpIVA>${vatBreakdown}`;
}

module.exports = {
  FIXED_DESCRIPTION,
  MONOTRIBUTO_LEGEND,
  TRANSPARENCY_LEGEND,
  buildClubInvoicePolicy,
  invoiceAmounts,
  arcaAmountsXml
};
