const {commissionAreaForUser} = require('../metricasv2/services/commission-area-identity');
const PAGE_ROLE_ACCESS = {
  'tickets.html': ['total', 'comercial', 'csm'],
  'dashboard.html': ['total', 'comercial', 'csm'],
  'metricas.html': ['total', 'comercial', 'csm'],
  'index.html': ['total', 'comercial', 'csm'],
  'split-screen.html': ['total', 'comercial', 'csm'],
  'ranking.html': ['total', 'comercial'],
  'agendas-totales.html': ['total', 'comercial'],
  'agendas-ultimo-origen.html': ['total', 'comercial'],
  'agendas-detalle-closer.html': ['total', 'comercial'],
  'analisis-ventas.html': ['total', 'comercial'],
  'administracion.html': ['total'],
  'mercado-pago-club.html': ['total'],
  'demo-facturacion-club.html': ['total'],
  'conciliacion.html': ['total'],
  'comprobantes-config.html': ['total'],
  'kpi-closers.html': ['total', 'comercial'],
  'setting.html': ['total', 'comercial'],
  'reportes.html': ['total', 'comercial'],
  'alertas-operativas.html': ['total', 'comercial', 'csm'],
  'mag-sistema-agendas.html': ['total', 'comercial'],
  'mag-reportes-personales.html': ['total', 'comercial'],
  'mag-reporte-equipo.html': ['total', 'comercial'],
  'mag-reporte-closers-2026.html': ['total', 'comercial'],
  'mag-reporte-mensual-final.html': ['total', 'comercial'],
  'mag-manual-closers.html': ['total', 'comercial'],
  'reporte_mayo_checkpoints_strikes.html': ['total', 'comercial'],
  'admin-usuarios.html': ['total'],
  'leads-bdd.html': ['total', 'comercial', 'csm'],
  'marketing.html': ['total', 'comercial', 'csm'],
  'comisiones.html': ['total', 'comercial', 'csm'],
  'comprobantes.html': ['total', 'comercial', 'csm'],
  'carga-comprobantes.html': ['total', 'comercial', 'csm'],
  'mis-comprobantes.html': ['total', 'comercial', 'csm'],
  'estado-contacto-comisiones.html': ['total', 'comercial'],
  'csm-tiempo.html': ['total', 'csm'],
  'csm-situacion.html': ['total', 'csm'],
  'csm-cuadro.html': ['total', 'csm'],
  'csm-rendimiento.html': ['total', 'csm'],
  'diagnostico.html': ['total', 'csm'],
  'csm-renovaciones.html': ['total', 'comercial'],
  'herramientas.html': ['total', 'comercial', 'csm'],
  'generador-params.html': ['total', 'comercial', 'csm'],
  'area-comercial.html': ['total', 'comercial'],
  'grabaciones.html': ['total', 'comercial', 'csm'],
  'pdi.html': ['total', 'comercial'],
  'view.html': ['total']
};

const CSM_OPERATIONAL_PAGES = new Set([
  'csm-rendimiento.html',
  'diagnostico.html'
]);

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
  agenda_checkpoints: ['total', 'comercial'],
  reportes_premio: ['total', 'comercial'],
  reportes_comentarios: ['total', 'comercial'],
  marketing_inversion: ['total', 'comercial', 'csm'],
  utm_builder: ['total', 'comercial', 'csm'],
  alertas_operativas: ['total', 'comercial', 'csm'],
  auth_session: ['total', 'comercial', 'csm'],
  assistant: ['total', 'comercial', 'csm'],
  commercial_area: ['total', 'comercial'],
  pdi: ['total', 'comercial'],
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

const AGENDA_CHECKPOINT_EDITOR_EMAILS = new Set([
  'leonardoalaniz19@gmail.com',
  'matirandazzo@gmail.com'
]);

const CSM_CHECKPOINT_EDITOR_EMAILS = new Set([
  'belenherrera.gestion@gmail.com',
  'matirandazzo@gmail.com'
]);

const CLOSER_AI_REPORT_EDITOR_EMAILS = new Set([
  'leonardoalaniz19@gmail.com',
  'matirandazzo@gmail.com'
]);

const PDI_ALLOWED_EMAILS = new Set([
  'leonardoalaniz19@gmail.com',
  'matirandazzo@gmail.com'
]);

const MARKETING_FORCE_ALLOW_EMAILS = new Set([
  'walteralegre56@gmail.com'
]);

const COMMISSIONS_ALLOWED_EMAILS = new Set([
  'matirandazzo@gmail.com',
  'nadia.cavallini@gmail.com',
  'nahuerandazzo@gmail.com'
]);

const ADMINISTRATION_ALLOWED_EMAILS = new Set([
  'matirandazzo@gmail.com',
  'nadia.cavallini@gmail.com'
]);

const COMPROBANTES_LAB_ALLOWED_EMAILS = new Set([
  'matirandazzo@gmail.com',
  'nadia.cavallini@gmail.com'
]);

const USER_ACCESS_OVERRIDES = {
  'iascinahuel@gmail.com': {
    homePath: '/dashboard.html',
    allowedPages: new Set([
      'dashboard.html',
      'metricas.html',
      'split-screen.html',
      'ranking.html',
      'agendas-totales.html',
      'agendas-ultimo-origen.html',
      'agendas-detalle-closer.html',
      'analisis-ventas.html',
      'kpi-closers.html',
      'setting.html',
      'reportes.html',
      'mag-sistema-agendas.html',
      'mag-reportes-personales.html',
      'mag-reporte-equipo.html',
      'mag-reporte-closers-2026.html',
      'mag-reporte-mensual-final.html',
      'mag-manual-closers.html',
      'reporte_mayo_checkpoints_strikes.html',
      'comprobantes.html',
      'carga-comprobantes.html',
      'mis-comprobantes.html',
      'estado-contacto-comisiones.html',
      'area-comercial.html'
    ]),
    allowedResources: new Set([
      'ranking_closers_mensual',
      'agenda_totales',
      'agenda_totales_ultimo_origen',
      'agenda_detalle_por_origen_closer',
      'kpi_closers_mensual',
      'setters',
      'setting',
      'agenda_detalle_diario_closer',
      'ventas_diario_closer',
      'cash_collected_diario_closer',
      'comprobantes'
    ]),
    allowedFeatures: {
      views: ['GET'],
      commercial_area: ['GET']
    }
  },
  'sofiangallardod@gmail.com': {
    homePath: '/dashboard.html',
    allowedPages: new Set([
      'dashboard.html',
      'csm-tiempo.html',
      'csm-situacion.html',
      'csm-cuadro.html',
      'csm-rendimiento.html',
      'csm-renovaciones.html',
      'comprobantes.html',
      'carga-comprobantes.html',
      'mis-comprobantes.html'
    ]),
    allowedResources: new Set([
      'csm',
      'comprobantes',
      'leads_raw'
    ]),
    allowedFeatures: {
      views: ['GET']
    }
  },
  'nahuerandazzo@gmail.com': {
    homePath: '/dashboard.html',
    allowedPages: new Set(Object.keys(PAGE_ROLE_ACCESS)),
    allowedResources: new Set(Object.keys(RESOURCE_ROLE_ACCESS)),
    allowedFeatures: Object.fromEntries(
      Object.keys(FEATURE_ROLE_ACCESS).map((feature) => [feature, ['GET', 'POST', 'PATCH', 'DELETE']])
    )
  },
  'robertoboero83@gmail.com': {
    homePath: '/dashboard.html',
    allowedPages: new Set([
      'dashboard.html',
      'metricas.html',
      'ranking.html',
      'agendas-totales.html',
      'analisis-ventas.html',
      'mag-sistema-agendas.html',
      'mag-reportes-personales.html',
      'mag-reporte-equipo.html',
      'mag-reporte-closers-2026.html',
      'mag-reporte-mensual-final.html',
      'mag-manual-closers.html',
      'reporte_mayo_checkpoints_strikes.html',
      'setting.html',
      'leads-bdd.html',
      'marketing.html',
      'comprobantes.html',
      'carga-comprobantes.html',
      'mis-comprobantes.html',
      'area-comercial.html',
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
      marketing_inversion: ['GET'],
      commercial_area: ['GET']
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

function canonicalPageName(pageName) {
  return pageName === 'index.html' ? 'metricas.html' : pageName;
}

function canonicalHomePath(homePath) {
  return homePath === '/index.html' ? '/metricas.html' : homePath;
}

function canAccessCommissionsForUser(userOrEmail) {
  const email = typeof userOrEmail === 'string'
    ? normalizeEmail(userOrEmail)
    : normalizeEmail(userOrEmail?.email);

  return COMMISSIONS_ALLOWED_EMAILS.has(email);
}

function canAccessAdministrationForUser(userOrEmail) {
  const configValue = getConfigBoolean(userOrEmail, 'canAccessAdministration');
  if (configValue !== null) return configValue;
  const email = typeof userOrEmail === 'string'
    ? normalizeEmail(userOrEmail)
    : normalizeEmail(userOrEmail?.email);
  return ADMINISTRATION_ALLOWED_EMAILS.has(email);
}

function canAccessComprobantesLabForUser(userOrEmail) {
  const email = typeof userOrEmail === 'string'
    ? normalizeEmail(userOrEmail)
    : normalizeEmail(userOrEmail?.email);
  return COMPROBANTES_LAB_ALLOWED_EMAILS.has(email);
}

function canAccessPdiForUser(userOrEmail) {
  const email = typeof userOrEmail === 'string'
    ? normalizeEmail(userOrEmail)
    : normalizeEmail(userOrEmail?.email);
  return PDI_ALLOWED_EMAILS.has(email);
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
  const rawAllowedPages = Array.isArray(rawOverride.allowedPages)
    ? rawOverride.allowedPages
    : Array.from(rawOverride.allowedPages || []);
  return {
    homePath: rawOverride.homePath ? canonicalHomePath(String(rawOverride.homePath).trim()) : null,
    allowedPages: new Set(rawAllowedPages.map(canonicalPageName)),
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
  const email = typeof userOrEmail === 'string'
    ? normalizeEmail(userOrEmail)
    : normalizeEmail(userOrEmail?.email);
  const hasCustomOverride = config.useCustomAccess === true
    || (Array.isArray(config.allowedPages) && config.allowedPages.length > 0)
    || (Array.isArray(config.allowedResources) && config.allowedResources.length > 0)
    || String(config.homePath || '').trim() !== ''
    || (config.allowedFeatures && typeof config.allowedFeatures === 'object' && Object.keys(config.allowedFeatures).length > 0);

  if (hasCustomOverride) {
    const override = normalizeOverride(config);
    // El panel personal de Nahuel depende de estos accesos aunque su
    // configuración histórica de Supabase todavía no los incluya.
    if (email === 'iascinahuel@gmail.com') {
      override.allowedPages.add('area-comercial.html');
      override.allowedPages.add('estado-contacto-comisiones.html');
      override.allowedFeatures.commercial_area = [
        ...new Set([...(override.allowedFeatures.commercial_area || []), 'GET'])
      ];
    }
    return override;
  }

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

function canEditAgendaCheckpointsForUser(user) {
  const configValue = getConfigBoolean(user, 'canEditAgendaCheckpoints');
  if (configValue !== null) return configValue;
  const email = normalizeEmail(user?.email);
  return AGENDA_CHECKPOINT_EDITOR_EMAILS.has(email);
}

function canEditCsmCheckpointsForUser(user) {
  const email = normalizeEmail(user?.email);
  return CSM_CHECKPOINT_EDITOR_EMAILS.has(email);
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
  pageName = canonicalPageName(pageName);
  if (pageName === 'area-comercial.html' && commissionAreaForUser(user)) return true;
  if (pageName === 'tickets.html') return Boolean(user);
  if (pageName === 'pdi.html') return canAccessPdiForUser(user);
  if (pageName === 'grabaciones.html') return Boolean(user) && canAccessPage(user?.role, pageName);
  if (pageName === 'comprobantes-config.html') return canAccessComprobantesLabForUser(user);
  if (pageName === 'administracion.html' || pageName === 'mercado-pago-club.html' || pageName === 'demo-facturacion-club.html' || pageName === 'conciliacion.html') {
    return canAccessAdministrationForUser(user);
  }
  if (pageName === 'admin-usuarios.html') return canManageUsersForUser(user);
  if (pageName === 'comisiones.html') return canAccessCommissionsForUser(user);
  if (CSM_OPERATIONAL_PAGES.has(pageName)) return ['total', 'csm'].includes(user?.role);
  if (hasForcedMarketingAccess(user) && pageName === 'marketing.html') return true;
  // The personalized dashboard is the common authenticated landing page. User
  // overrides still control every link and dataset rendered inside it.
  if (pageName === 'dashboard.html') return Boolean(user) && !isMarketingOnlyUser(user);
  const override = getUserAccessOverride(user);
  if (override) return override.allowedPages.has(pageName);
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
  if (featureName === 'commercial_area' && commissionAreaForUser(user)) return String(options.method || 'GET').toUpperCase() === 'GET';
  if (featureName === 'pdi') {
    return canAccessPdiForUser(user);
  }

  if (featureName === 'user_admin') {
    return canManageUsersForUser(user);
  }

  if (
    hasForcedMarketingAccess(user)
    && featureName === 'marketing_inversion'
  ) {
    return true;
  }

  if (featureName === 'agenda_checkpoints') {
    const method = String(options.method || 'GET').toUpperCase();
    if (method !== 'GET') return canEditAgendaCheckpointsForUser(user);
    const override = getUserAccessOverride(user);
    if (override) return override.allowedPages.has('mag-sistema-agendas.html');
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
    featureName === 'agenda_checkpoints'
    && String(options.method || 'GET').toUpperCase() !== 'GET'
  ) {
    return canEditAgendaCheckpointsForUser(user);
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
  const allowedPages = override ? new Set(override.allowedPages) : null;
  if (allowedPages && user) allowedPages.add('tickets.html');
  if (allowedPages && canAccessPageForUser(user, 'dashboard.html')) {
    allowedPages.add('dashboard.html');
  }
  if (allowedPages && canAccessPageForUser(user, 'grabaciones.html')) {
    allowedPages.add('grabaciones.html');
  }
  if (allowedPages && canAccessPageForUser(user, 'pdi.html')) {
    allowedPages.add('pdi.html');
  }
  if (allowedPages) {
    CSM_OPERATIONAL_PAGES.forEach((pageName) => {
      if (canAccessPageForUser(user, pageName)) allowedPages.add(pageName);
    });
  }
  return {
    onlyMarketingAccess: isMarketingOnlyUser(user),
    homePath: canonicalHomePath(override?.homePath || null),
    allowedPages: allowedPages ? Array.from(allowedPages) : null,
    allowedResources: override ? Array.from(override.allowedResources) : null,
    allowedFeatures: override ? override.allowedFeatures : null,
    canAccessComisiones: canAccessPageForUser(user, 'comisiones.html'),
    canAccessAdministration: canAccessAdministrationForUser(user),
    canAccessComprobantesLab: canAccessComprobantesLabForUser(user),
    canAccessLeadsBdd: canAccessPageForUser(user, 'leads-bdd.html'),
    canAccessMarketing: canAccessPageForUser(user, 'marketing.html'),
    canAccessPdi: canAccessPdiForUser(user),
    canEditKpiClosersRules: canAccessFeatureForUser(user, 'kpi_closers_rules', { method: 'POST' }),
    canEditAgendaBonusRules: canAccessFeatureForUser(user, 'agenda_bonus_rules', { method: 'POST' }),
    canEditAgendaCalendar: canAccessFeatureForUser(user, 'agenda_calendar_assignments', { method: 'POST' }),
    canEditAgendaCheckpoints: canAccessFeatureForUser(user, 'agenda_checkpoints', { method: 'POST' }),
    canEditCsmCheckpoints: canEditCsmCheckpointsForUser(user),
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
      canEditAgendaCheckpoints: canEditAgendaCheckpointsForUser(user),
      canEditCsmCheckpoints: canEditCsmCheckpointsForUser(user),
      canEditReportesPremio: canEditReportesPremioForUser(user),
      canGenerateCloserAiReport: canGenerateCloserAiReportForUser(user),
      canManageUsers: canManageUsersForUser(user)
    },
    homePath: canonicalHomePath(getUserAccessOverride(user)?.homePath || null),
    pages: Object.keys(PAGE_ROLE_ACCESS)
      .filter((pageName) => pageName !== 'index.html')
      .filter((pageName) => canAccessPageForUser(user, pageName)),
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
  COMPROBANTES_LAB_ALLOWED_EMAILS,
  PDI_ALLOWED_EMAILS,
  USER_ACCESS_OVERRIDES,
  canAccessCommissionsForUser,
  canAccessAdministrationForUser,
  canAccessComprobantesLabForUser,
  canAccessPdiForUser,
  getUserAccessOverride,
  isMarketingOnlyUser,
  isRestrictedCommercialUser,
  isCsmOnlyUser,
  canEditReportesPremioForUser,
  canEditAgendaCalendarForUser,
  canEditAgendaCheckpointsForUser,
  canEditCsmCheckpointsForUser,
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
