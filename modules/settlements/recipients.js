const { commissionAreaForUser } = require('../metricasv2/services/commission-area-identity');
const loader = require('../metricasv2/services/comprobantes-loader.service');
const normalize = value => String(value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function commissionRecipients(users, dashboard) {
  const config = dashboard.config || {};
  const names = new Set([
    ...(config.personRoles || []).map(row => row.person),
    ...(config.fixedOverrides || []).filter(row => row.enabled !== false).map(row => row.person),
    ...(config.setterFixedOverrides || []).filter(row => row.enabled !== false).map(row => row.person),
    ...(config.closerRules || []).filter(row => row.enabled !== false).map(row => row.person),
    ...(dashboard.details || []).filter(row => !row.isBonus && Number.isFinite(Number(row.commissionAmount)) && Number(row.commissionAmount) !== 0).map(row => row.person)
  ].map(normalize).filter(Boolean));
  return users.filter(user => {
    if (user.activo === false) return false;
    if (commissionAreaForUser(user)) return true;
    return [user.nombre, loader.getResponsibleNameForUser(user), ...loader.getComprobantesSetterNames(user)]
      .some(name => names.has(normalize(name)));
  }).sort((a,b) => String(a.nombre || a.email).localeCompare(String(b.nombre || b.email), 'es'));
}
module.exports = { commissionRecipients };
