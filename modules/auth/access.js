const PAGE_ROLE_ACCESS = {
  'dashboard.html': ['total', 'comercial', 'csm'],
  'index.html': ['total', 'comercial', 'csm'],
  'split-screen.html': ['total', 'comercial', 'csm'],
  'ranking.html': ['total', 'comercial'],
  'agendas-totales.html': ['total', 'comercial'],
  'agendas-ultimo-origen.html': ['total', 'comercial'],
  'agendas-detalle-closer.html': ['total', 'comercial'],
  'analisis-ventas.html': ['total', 'comercial'],
  'kpi-closers.html': ['total', 'comercial'],
  'setting.html': ['total', 'comercial'],
  'reportes.html': ['total', 'comercial'],
  'alertas-operativas.html': ['total', 'comercial', 'csm'],
  'mag-sistema-agendas.html': ['total', 'comercial'],
  'mag-reportes-personales.html': ['total', 'comercial'],
  'mag-reporte-closers-2026.html': ['total', 'comercial'],
  'mag-manual-closers.html': ['total', 'comercial'],
  'admin-usuarios.html': ['total'],
  'leads-bdd.html': ['total', 'comercial', 'csm'],
  'marketing.html': ['total', 'comercial', 'csm'],
  'comisiones.html': ['total', 'comercial', 'csm'],
  'carga-comprobantes.html': ['total', 'comercial', 'csm'],
  'estado-contacto-comisiones.html': ['total', 'comercial'],
  'csm-tiempo.html': ['total', 'csm'],
  'csm-situacion.html': ['total', 'csm'],
  'csm-renovaciones.html': ['total', 'comercial'],
  'herramientas.html': ['total', 'comercial', 'csm'],
  'generador-params.html': ['total', 'comercial', 'csm'],
  'view.html': ['total']
};

const RESOURCE_ROLE_ACCESS = {
  ranking_closers_mensual: ['total', 'comercial'],
  agenda_totales: ['total', 'comercial'],
  agenda_totales_ultimo_origen: ['total', 'comercial'],
  agenda_detalle_por_origen_closer: ['total', 'comercial'],
  kpi_closers_mensual: ['total', 'comercial'],
  setters: ['total', 'comercial'],
  setting: ['total', 'comercial'],
  agenda_detalle_diario_closer: ['total', 'comercial'],
  ventas_diario_closer: ['total', 'comercial'],
  cash_collected_diario_closer: ['total', 'comercial'],
  comprobantes: ['total', 'comercial'],
  leads_raw: ['total', 'comercial', 'csm'],
  csm: ['total', 'comercial', 'csm'],
  kpi_marketing_diario: ['total', 'comercial', 'csm'],
  kpi_marketing_inversiones: ['total', 'comercial', 'csm']
};

const FEATURE_ROLE_ACCESS = {
  views: ['total', 'comercial', 'csm'],
  kpi_closers_rules: ['total', 'comercial'],
  agenda_bonus_rules: ['total', 'comercial'],
  agenda_calendar_assignments: ['total', 'comercial'],
  reportes_premio: ['total', 'comercial'],
  reportes_comentarios: ['total', 'comercial'],
  marketing_inversion: ['total', 'comercial', 'csm'],
  utm_builder: ['total', 'comercial', 'csm'],
  alertas_operativas: ['total', 'comercial', 'csm'],
  auth_session: ['total', 'comercial', 'csm'],
  assistant: ['total', 'comercial', 'csm'],
  user_admin: ['total']
};

const MARKETING_ONLY_EMAILS = new Set([
  'juanma@romsconsultora.com',
  'fran@romsconsultora.com',
  'tomas@romsconsultora.com'
]);

const RESTRICTED_COMMERCIAL_EMAILS = new Set([
  'walteralegre56@gmail.com',
  'posadaelmontecito@gmail.com',
  'charliecarlostu@gmail.com',
  'meg.claudionicolini@gmail.com',
  'gaitanmauro23@gmail.com',
  'pmbutera1234@gmail.com'
]);

const CSM_ONLY_EMAILS = new Set([
  'valecalmet@gmail.com',
  'belenherrera.gestion@gmail.com',
  'glcosta.gc11@gmail.com'
]);

const REPORTES_PREMIO_EDITOR_EMAILS = new Set([
  'leonardoalaniz19@gmail.com'
]);

const AGENDA_CALENDAR_EDITOR_EMAILS = new Set([
  'leonardoalaniz19@gmail.com',
  'matirandazzo@gmail.com'
]);

const CLOSER_AI_REPORT_EDITOR_EMAILS = new Set([
  'leonardoalaniz19@gmail.com',
  'matirandazzo@gmail.com'
]);

const MARKETING_FORCE_ALLOW_EMAILS = new Set([
  'nahuerandazzo@gmail.com'
]);

const USER_ACCESS_OVERRIDES = {
  'iascinahuel@gmail.com': {
    homePath: '/views/setting.html',
    allowedPages: new Set(['setting.html', 'carga-comprobantes.html']),
    allowedResources: new Set(['setters']),
    allowedFeatures: {}
  },
  'robertoboero83@gmail.com': {
    homePath: '/index.html',
    allowedPages: new Set([
      'index.html',
      'ranking.html',
      'agendas-totales.html',
      'analisis-ventas.html',
      'mag-sistema-agendas.html',
      'mag-reportes-personales.html',
      'mag-reporte-closers-2026.html',
      'mag-manual-closers.html',
      'setting.html',
      'leads-bdd.html',
      'marketing.html',
      'herramientas.html',
      'generador-params.html'
    ]),
    allowedResources: new Set([
      'ranking_closers_mensual',
      'agenda_totales',
      'setters',
      'leads_raw',
      'kpi_marketing_diario',
      'kpi_marketing_inversiones',
      'comprobantes'
    ]),
    allowedFeatures: {
      marketing_inversion: ['GET']
    }
  }
};

const MARKETING_BLOCKED_PAGES = new Set(['marketing.html']);
const MARKETING_BLOCKED_RESOURCES = new Set(['kpi_marketing_diario', 'kpi_marketing_inversiones']);
const MARKETING_BLOCKED_FEATURES = new Set(['marketing_inversion']);
const CSM_ONLY_BLOCKED_PAGES = new Set(['marketing.html', 'leads-bdd.html']);
const CSM_ONLY_BLOCKED_RESOURCES = new Set(['kpi_marketing_diario', 'kpi_marketing_inversiones', 'leads_raw']);
const CSM_ONLY_BLOCKED_FEATURES = new Set(['marketing_inversion']);
const MARKETING_ONLY_ALLOWED_PAGES = new Set(['marketing.html']);
const MARKETING_ONLY_ALLOWED_RESOURCES = new Set(['kpi_marketing_diario', 'kpi_marketing_inversiones']);
const MARKETING_ONLY_ALLOWED_FEATURES = new Set(['views', 'marketing_inversion']);

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function hasForcedMarketingAccess(userOrEmail) {
  return MARKETING_FORCE_ALLOW_EMAILS.has(normalizeEmail(typeof userOrEmail === 'string' ? userOrEmail : userOrEmail?.email));
}

function getAccessConfig(userOrEmail) {
  if (!userOrEmail || typeof userOrEmail === 'string') return {};
  const accessConfig = userOrEmail.access_config;
  return accessConfig && typeof accessConfig === 'object' ? accessConfig : {};
}

function getConfigBoolean(userOrEmail, key) {
  const accessConfig = getAccessConfig(userOrEmail);
  if (typeof accessConfig[key] === 'boolean') return accessConfig[key];
  return null;
}

function normalizeOverride(rawOverride = null) {
  if (!rawOverride || typeof rawOverride !== 'object') return null;
  return {
    homePath: rawOverride.homePath ? String(rawOverride.homePath).trim() : null,
    allowedPages: new Set(Array.isArray(rawOverride.allowedPages) ? rawOverride.allowedPages : Array.from(rawOverride.allowedPages || [])),
    allowedResources: new Set(Array.isArray(rawOverride.allowedResources) ? rawOverride.allowedResources : Array.from(rawOverride.allowedResources || [])),
    allowedFeatures: Object.fromEntries(
      Object.entries(rawOverride.allowedFeatures || {}).map(([feature, methods]) => [
        feature,
        Array.isArray(methods) ? methods.map((method) => String(method || '').toUpperCase()).filter(Boolean) : []
      ])
    )
  };
}

function getUserAccessOverride(userOrEmail) {
  const config = getAccessConfig(userOrEmail);
  const hasCustomOverride = config.useCustomAccess === true
    || (Array.isArray(config.allowedPages) && config.allowedPages.length > 0)
    || (Array.isArray(config.allowedResources) && config.allowedResources.length > 0)
    || String(config.homePath || '').trim() !== ''
    || (config.allowedFeatures && typeof config.allowedFeatures === 'object' && Object.keys(config.allowedFeatures).length > 0);

  if (hasCustomOverride) {
    return normalizeOverride(config);
  }

  const email = typeof userOrEmail === 'string'
    ? normalizeEmail(userOrEmail)
    : normalizeEmail(userOrEmail?.email);

  return normalizeOverride(USER_ACCESS_OVERRIDES[email] || null);
}

function isMarketingOnlyUser(userOrEmail) {
  const configValue = getConfigBoolean(userOrEmail, 'marketingOnly');
  if (configValue !== null) return configValue;
  const email = typeof userOrEmail === 'string'
    ? normalizeEmail(userOrEmail)
    : normalizeEmail(userOrEmail?.email);

  return MARKETING_ONLY_EMAILS.has(email);
}

function isRestrictedCommercialUser(userOrEmail) {
  const configValue = getConfigBoolean(userOrEmail, 'restrictedCommercial');
  if (configValue !== null) return configValue;
  const email = typeof userOrEmail === 'string'
    ? normalizeEmail(userOrEmail)
    : normalizeEmail(userOrEmail?.email);

  return RESTRICTED_COMMERCIAL_EMAILS.has(email);
}

function isCsmOnlyUser(userOrEmail) {
  const configValue = getConfigBoolean(userOrEmail, 'csmOnly');
  if (configValue !== null) return configValue;
  const email = typeof userOrEmail === 'string'
    ? normalizeEmail(userOrEmail)
    : normalizeEmail(userOrEmail?.email);

  return CSM_ONLY_EMAILS.has(email);
}

function canEditReportesPremioForUser(user) {
  const configValue = getConfigBoolean(user, 'canEditReportesPremio');
  if (configValue !== null) return configValue;
  const email = normalizeEmail(user?.email);
  return user?.role === 'total' || REPORTES_PREMIO_EDITOR_EMAILS.has(email);
}

function canEditAgendaCalendarForUser(user) {
  const configValue = getConfigBoolean(user, 'canEditAgendaCalendar');
  if (configValue !== null) return configValue;
  const email = normalizeEmail(user?.email);
  return AGENDA_CALENDAR_EDITOR_EMAILS.has(email);
}

function canGenerateCloserAiReportForUser(user) {
  const configValue = getConfigBoolean(user, 'canGenerateCloserAiReport');
  if (configValue !== null) return configValue;
  const email = normalizeEmail(user?.email);
  return user?.role === 'total' || CLOSER_AI_REPORT_EDITOR_EMAILS.has(email);
}

function canManageUsersForUser(user) {
  const configValue = getConfigBoolean(user, 'canManageUsers');
  if (configValue !== null) return configValue;
  return user?.role === 'total';
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
  if (pageName === 'admin-usuarios.html') return canManageUsersForUser(user);
  if (hasForcedMarketingAccess(user) && pageName === 'marketing.html') return true;
  const override = getUserAccessOverride(user);
  if (override) return override.allowedPages.has(pageName);
  if (pageName === 'dashboard.html') return Boolean(user) && !isMarketingOnlyUser(user);
  if (isMarketingOnlyUser(user)) return MARKETING_ONLY_ALLOWED_PAGES.has(pageName);
  if (!canAccessPage(user?.role, pageName)) return false;
  if (isRestrictedCommercialUser(user) && MARKETING_BLOCKED_PAGES.has(pageName)) return false;
  if (isCsmOnlyUser(user) && CSM_ONLY_BLOCKED_PAGES.has(pageName)) return false;
  return true;
}

function canAccessResourceForUser(user, resourceName) {
  if (hasForcedMarketingAccess(user) && ['kpi_marketing_diario', 'kpi_marketing_inversiones'].includes(resourceName)) return true;
  const override = getUserAccessOverride(user);
  if (override) return override.allowedResources.has(resourceName);
  if (isMarketingOnlyUser(user)) return MARKETING_ONLY_ALLOWED_RESOURCES.has(resourceName);
  if (!canAccessResource(user?.role, resourceName)) return false;
  if (isRestrictedCommercialUser(user) && MARKETING_BLOCKED_RESOURCES.has(resourceName)) return false;
  if (isCsmOnlyUser(user) && CSM_ONLY_BLOCKED_RESOURCES.has(resourceName)) return false;
  return true;
}

function canAccessFeatureForUser(user, featureName, options = {}) {
  if (featureName === 'user_admin') {
    return canManageUsersForUser(user);
  }

  if (
    hasForcedMarketingAccess(user)
    && featureName === 'marketing_inversion'
  ) {
    return true;
  }

  const override = getUserAccessOverride(user);
  if (override) {
    const allowedMethods = override.allowedFeatures[featureName];
    if (!allowedMethods) return false;
    return allowedMethods.includes(String(options.method || 'GET').toUpperCase());
  }

  if (isMarketingOnlyUser(user) && !MARKETING_ONLY_ALLOWED_FEATURES.has(featureName)) {
    return false;
  }

  if (!canAccessFeature(user?.role, featureName)) return false;

  if (isRestrictedCommercialUser(user) && MARKETING_BLOCKED_FEATURES.has(featureName)) {
    return false;
  }

  if (isCsmOnlyUser(user) && CSM_ONLY_BLOCKED_FEATURES.has(featureName)) {
    return false;
  }

  if (
    isRestrictedCommercialUser(user)
    && featureName === 'kpi_closers_rules'
    && String(options.method || 'GET').toUpperCase() !== 'GET'
  ) {
    return false;
  }

  if (
    isRestrictedCommercialUser(user)
    && featureName === 'agenda_bonus_rules'
    && String(options.method || 'GET').toUpperCase() !== 'GET'
  ) {
    return false;
  }

  if (
    featureName === 'reportes_premio'
    && String(options.method || 'GET').toUpperCase() !== 'GET'
  ) {
    return canEditReportesPremioForUser(user);
  }

  if (
    featureName === 'agenda_calendar_assignments'
    && String(options.method || 'GET').toUpperCase() !== 'GET'
  ) {
    return canEditAgendaCalendarForUser(user);
  }

  if (
    featureName === 'reportes_comentarios'
    && String(options.method || 'GET').toUpperCase() === 'POST'
  ) {
    return user?.role === 'total';
  }

  return true;
}

function getUserPermissions(user) {
  const override = getUserAccessOverride(user);
  return {
    onlyMarketingAccess: isMarketingOnlyUser(user),
    homePath: override?.homePath || null,
    allowedPages: override ? Array.from(override.allowedPages) : null,
    allowedResources: override ? Array.from(override.allowedResources) : null,
    allowedFeatures: override ? override.allowedFeatures : null,
    canAccessLeadsBdd: canAccessPageForUser(user, 'leads-bdd.html'),
    canAccessMarketing: canAccessPageForUser(user, 'marketing.html'),
    canEditKpiClosersRules: canAccessFeatureForUser(user, 'kpi_closers_rules', { method: 'POST' }),
    canEditAgendaBonusRules: canAccessFeatureForUser(user, 'agenda_bonus_rules', { method: 'POST' }),
    canEditAgendaCalendar: canAccessFeatureForUser(user, 'agenda_calendar_assignments', { method: 'POST' }),
    canEditReportesPremio: canAccessFeatureForUser(user, 'reportes_premio', { method: 'POST' }),
    canCommentReportes: canAccessFeatureForUser(user, 'reportes_comentarios', { method: 'POST' }),
    canGenerateCloserAiReport: canGenerateCloserAiReportForUser(user),
    canManageUsers: canManageUsersForUser(user),
    accessFlags: {
      marketingOnly: isMarketingOnlyUser(user),
      restrictedCommercial: isRestrictedCommercialUser(user),
      csmOnly: isCsmOnlyUser(user)
    }
  };
}

function getUserAccessSummary(user) {
  return {
    role: user?.role || null,
    flags: {
      marketingOnly: isMarketingOnlyUser(user),
      restrictedCommercial: isRestrictedCommercialUser(user),
      csmOnly: isCsmOnlyUser(user),
      canEditAgendaCalendar: canEditAgendaCalendarForUser(user),
      canEditReportesPremio: canEditReportesPremioForUser(user),
      canGenerateCloserAiReport: canGenerateCloserAiReportForUser(user),
      canManageUsers: canManageUsersForUser(user)
    },
    homePath: getUserAccessOverride(user)?.homePath || null,
    pages: Object.keys(PAGE_ROLE_ACCESS).filter((pageName) => canAccessPageForUser(user, pageName)),
    resources: Object.keys(RESOURCE_ROLE_ACCESS).filter((resourceName) => canAccessResourceForUser(user, resourceName))
  };
}

module.exports = {
  PAGE_ROLE_ACCESS,
  RESOURCE_ROLE_ACCESS,
  FEATURE_ROLE_ACCESS,
  MARKETING_ONLY_EMAILS,
  RESTRICTED_COMMERCIAL_EMAILS,
  CSM_ONLY_EMAILS,
  USER_ACCESS_OVERRIDES,
  getUserAccessOverride,
  isMarketingOnlyUser,
  isRestrictedCommercialUser,
  isCsmOnlyUser,
  canEditReportesPremioForUser,
  canEditAgendaCalendarForUser,
  canGenerateCloserAiReportForUser,
  canManageUsersForUser,
  canAccessPage,
  canAccessResource,
  canAccessFeature,
  canAccessPageForUser,
  canAccessResourceForUser,
  canAccessFeatureForUser,
  getUserPermissions,
  getUserAccessSummary
};
