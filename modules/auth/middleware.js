const path = require('path');
const access = require('./access');
const authService = require('./service');

function attachAuthUser(req, res, next) {
  req.authUser = authService.getSessionUserFromRequest(req);
  next();
}

function isPublicMetricasPath(reqPath) {
  return reqPath === '/login.html'
    || reqPath === '/unauthorized.html'
    || reqPath.startsWith('/js/')
    || reqPath.startsWith('/css/')
    || reqPath.startsWith('/images/')
    || reqPath.startsWith('/fonts/');
}

function resolvePageName(reqPath) {
  if (reqPath === '/' || reqPath === '' || reqPath === '/metricas') return 'index.html';
  return path.basename(reqPath);
}

function metricasPageGuard(req, res, next) {
  if (isPublicMetricasPath(req.path)) return next();

  if (!req.authUser) {
    return res.redirect('/metricas/login.html');
  }

  const pageName = resolvePageName(req.path);
  if (!access.canAccessPageForUser(req.authUser, pageName)) {
    if (pageName === 'index.html' && !access.isMarketingOnlyUser(req.authUser)) {
      return next();
    }
    return res.redirect('/metricas/unauthorized.html');
  }

  next();
}

function metricasApiGuard(req, res, next) {
  const reqPath = String(req.path || '');

  if (req.path.startsWith('/auth/')) {
    return next();
  }

  if (!req.authUser) {
    return res.status(401).json({ ok: false, message: 'Sesión requerida' });
  }

  if (reqPath === '/views') {
    if (!access.canAccessFeatureForUser(req.authUser, 'views', { method: req.method })) {
      return res.status(403).json({ ok: false, message: 'Sin permiso para ver vistas' });
    }
    return next();
  }

  if (reqPath.startsWith('/views/')) {
    const resource = String(reqPath.split('/').pop() || '').replace(/[^a-zA-Z0-9_]/g, '');
    if (!access.canAccessResourceForUser(req.authUser, resource)) {
      return res.status(403).json({ ok: false, message: 'Sin permiso para esa vista' });
    }
    return next();
  }

  if (reqPath.endsWith('/kpi-closers/rules')) {
    if (!access.canAccessFeatureForUser(req.authUser, 'kpi_closers_rules', { method: req.method })) {
      return res.status(403).json({ ok: false, message: 'Sin permiso para reglas KPI' });
    }
    return next();
  }

  if (reqPath === '/reportes/premio') {
    if (!access.canAccessFeatureForUser(req.authUser, 'reportes_premio', { method: req.method })) {
      return res.status(403).json({ ok: false, message: 'Sin permiso para premio de reportes' });
    }
    return next();
  }

  if (reqPath === '/reportes/comentarios' || reqPath.startsWith('/reportes/comentarios/')) {
    if (!access.canAccessFeatureForUser(req.authUser, 'reportes_comentarios', { method: req.method })) {
      return res.status(403).json({ ok: false, message: 'Sin permiso para comentarios de reportes' });
    }
    return next();
  }

  if (reqPath === '/marketing/inversion' || reqPath === '/marketing/inversiones') {
    if (!access.canAccessFeatureForUser(req.authUser, 'marketing_inversion', { method: req.method })) {
      return res.status(403).json({ ok: false, message: 'Sin permiso para inversión marketing' });
    }
    return next();
  }

  if (
    reqPath === '/marketing/aov-dia-1' ||
    reqPath === '/marketing/ventas-totales' ||
    reqPath === '/marketing/campaign-totales'
  ) {
    if (!access.canAccessFeatureForUser(req.authUser, 'marketing_inversion', { method: req.method })) {
      return res.status(403).json({ ok: false, message: 'Sin permiso para KPI marketing' });
    }
    return next();
  }

  if (reqPath === '/assistant/ask') {
    if (!access.canAccessFeatureForUser(req.authUser, 'assistant', { method: req.method })) {
      return res.status(403).json({ ok: false, message: 'Sin permiso para usar Scalito' });
    }
    return next();
  }

  next();
}

module.exports = {
  attachAuthUser,
  metricasPageGuard,
  metricasApiGuard
};
