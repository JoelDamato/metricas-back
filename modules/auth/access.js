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

const RESTRICTED_COMMERCIAL_EMAILS = new Set([
  'walteralegre56@gmail.com',
  'posadaelmontecito@gmail.com',
  'charliecarlostu@gmail.com',
  'meg.claudionicolini@gmail.com',
  'gaitanmauro23@gmail.com'
]);

const MARKETING_BLOCKED_PAGES = new Set(['marketing.html']);
const MARKETING_BLOCKED_RESOURCES = new Set(['kpi_marketing_diario', 'kpi_marketing_inversiones']);
const MARKETING_BLOCKED_FEATURES = new Set(['marketing_inversion']);

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isRestrictedCommercialUser(userOrEmail) {
  const email = typeof userOrEmail === 'string'
    ? normalizeEmail(userOrEmail)
    : normalizeEmail(userOrEmail?.email);

  return RESTRICTED_COMMERCIAL_EMAILS.has(email);
}

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

function canAccessPageForUser(user, pageName) {
  if (!canAccessPage(user?.role, pageName)) return false;
  if (isRestrictedCommercialUser(user) && MARKETING_BLOCKED_PAGES.has(pageName)) return false;
  return true;
}

function canAccessResourceForUser(user, resourceName) {
  if (!canAccessResource(user?.role, resourceName)) return false;
  if (isRestrictedCommercialUser(user) && MARKETING_BLOCKED_RESOURCES.has(resourceName)) return false;
  return true;
}

function canAccessFeatureForUser(user, featureName, options = {}) {
  if (!canAccessFeature(user?.role, featureName)) return false;

  if (isRestrictedCommercialUser(user) && MARKETING_BLOCKED_FEATURES.has(featureName)) {
    return false;
  }

  if (
    isRestrictedCommercialUser(user)
    && featureName === 'kpi_closers_rules'
    && String(options.method || 'GET').toUpperCase() !== 'GET'
  ) {
    return false;
  }

  return true;
}

function getUserPermissions(user) {
  return {
    canAccessMarketing: canAccessPageForUser(user, 'marketing.html'),
    canEditKpiClosersRules: canAccessFeatureForUser(user, 'kpi_closers_rules', { method: 'POST' })
  };
}

module.exports = {
  PAGE_ROLE_ACCESS,
  RESOURCE_ROLE_ACCESS,
  FEATURE_ROLE_ACCESS,
  RESTRICTED_COMMERCIAL_EMAILS,
  isRestrictedCommercialUser,
  canAccessPage,
  canAccessResource,
  canAccessFeature,
  canAccessPageForUser,
  canAccessResourceForUser,
  canAccessFeatureForUser,
  getUserPermissions
};
