function buildAgendaCredits(overrides, sourceRows, agendaRows, month, qualifies) {
  const byId = new Map(sourceRows.map(row => [String(row.id), row]));
  const seen = new Set();
  return overrides.flatMap(override => {
    if (override.agenda_month !== month) return [];
    const sale = byId.get(override.sale_id);
    if (!sale || !sale.setter) return [];
    const identity = sale.ghlid || sale.cliente || sale.id;
    if (seen.has(identity)) return [];
    seen.add(identity);
    const alreadyCounted = agendaRows.some(row => (sale.ghlid ? row.ghlid === sale.ghlid : row.id === sale.cliente) && qualifies(row));
    return [{saleId:sale.id,ghlid:sale.ghlid,clientName:sale.cliente_format,person:sale.setter,month,additionalCount:alreadyCounted?0:1}];
  });
}
module.exports = { buildAgendaCredits };
