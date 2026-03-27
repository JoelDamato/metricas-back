const PAGE_ROLE_ACCESS = {
  'index.html': ['total', 'comercial', 'csm'],
  'ranking.html': ['total', 'comercial'],
  'agendas-totales.html': ['total', 'comercial'],
  'agendas-detalle-closer.html': ['total', 'comercial'],
  'kpi-closers.html': ['total', 'comercial'],
  'setting.html': ['total', 'comercial'],
  'reportes.html': ['total', 'comercial'],
  'leads-bdd.html': ['total', 'comercial', 'csm'],
  'marketing.html': ['total', 'comercial', 'csm'],
  'csm-tiempo.html': ['total', 'csm'],
  'csm-situacion.html': ['total', 'csm'],
  'csm-renovaciones.html': ['total', 'csm'],
  'view.html': ['total']
};

const RESOURCE_ROLE_ACCESS = {
  ranking_closers_mensual: ['total', 'comercial'],
  agenda_totales: ['total', 'comercial'],
  agenda_detalle_por_origen_closer: ['total', 'comercial'],
  kpi_closers_mensual: ['total', 'comercial'],
  setters: ['total', 'comercial'],
  setting: ['total', 'comercial'],
  agenda_detalle_diario_closer: ['total', 'comercial'],
  ventas_diario_closer: ['total', 'comercial'],
  cash_collected_diario_closer: ['total', 'comercial'],
  leads_raw: ['total', 'comercial', 'csm'],
  csm: ['total', 'csm'],
  kpi_marketing_diario: ['total', 'comercial', 'csm'],
  kpi_marketing_inversiones: ['total', 'comercial', 'csm']
};

const FEATURE_ROLE_ACCESS = {
  views: ['total', 'comercial', 'csm'],
  kpi_closers_rules: ['total', 'comercial'],
  marketing_inversion: ['total', 'comercial', 'csm'],
  auth_session: ['total', 'comercial', 'csm'],
  assistant: ['total', 'comercial', 'csm']
};

function hasRoleAccess(allowedRoles, role) {
  if (!Array.isArray(allowedRoles) || !allowedRoles.length) return false;
  return allowedRoles.includes(role);
}

function canAccessPage(role, pageName) {
  return hasRoleAccess(PAGE_ROLE_ACCESS[pageName], role);
}

function canAccessResource(role, resourceName) {
  return hasRoleAccess(RESOURCE_ROLE_ACCESS[resourceName], role);
}

function canAccessFeature(role, featureName) {
  return hasRoleAccess(FEATURE_ROLE_ACCESS[featureName], role);
}

module.exports = {
  PAGE_ROLE_ACCESS,
  RESOURCE_ROLE_ACCESS,
  FEATURE_ROLE_ACCESS,
  canAccessPage,
  canAccessResource,
  canAccessFeature
};
