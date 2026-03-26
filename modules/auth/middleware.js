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
  if (!access.canAccessPage(req.authUser.role, pageName)) {
    if (pageName === 'index.html') {
      return next();
    }
    return res.redirect('/metricas/unauthorized.html');
  }

  next();
}

function metricasApiGuard(req, res, next) {
  if (req.path.startsWith('/auth/')) {
    return next();
  }

  if (!req.authUser) {
    return res.status(401).json({ ok: false, message: 'Sesión requerida' });
  }

  if (req.path === '/views') {
    if (!access.canAccessFeature(req.authUser.role, 'views')) {
      return res.status(403).json({ ok: false, message: 'Sin permiso para ver vistas' });
    }
    return next();
  }

  if (req.path.startsWith('/views/')) {
    const resource = String(req.path.split('/').pop() || '').replace(/[^a-zA-Z0-9_]/g, '');
    if (!access.canAccessResource(req.authUser.role, resource)) {
      return res.status(403).json({ ok: false, message: 'Sin permiso para esa vista' });
    }
    return next();
  }

  if (req.path === '/kpi-closers/rules') {
    if (!access.canAccessFeature(req.authUser.role, 'kpi_closers_rules')) {
      return res.status(403).json({ ok: false, message: 'Sin permiso para reglas KPI' });
    }
    return next();
  }

  if (req.path === '/marketing/inversion' || req.path === '/marketing/inversiones') {
    if (!access.canAccessFeature(req.authUser.role, 'marketing_inversion')) {
      return res.status(403).json({ ok: false, message: 'Sin permiso para inversión marketing' });
    }
    return next();
  }

  if (req.path === '/marketing/aov-dia-1') {
    if (!access.canAccessFeature(req.authUser.role, 'marketing_inversion')) {
      return res.status(403).json({ ok: false, message: 'Sin permiso para KPI marketing' });
    }
    return next();
  }

  if (req.path === '/assistant/ask') {
    if (!access.canAccessFeature(req.authUser.role, 'assistant')) {
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
