const path = require('path');
const access = require('./access');
const authService = require('./service');

function attachAuthUser(req, res, next) {
  req.authUser = authService.getSessionUserFromRequest(req);
  next();
}

async function hydrateAuthUser(req) {
  if (!req.authUser?.email) return null;
  const freshUser = await authService.getActiveUserByEmail(req.authUser.email);
  req.authUser = freshUser;
  return freshUser;
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

async function metricasPageGuard(req, res, next) {
  try {
    if (isPublicMetricasPath(req.path)) return next();

    if (!req.authUser) {
      return res.redirect('/login.html');
    }

    const freshUser = await hydrateAuthUser(req);
    if (!freshUser) {
      return res.redirect('/login.html');
    }

    const pageName = resolvePageName(req.path);
    if (!access.canAccessPageForUser(req.authUser, pageName)) {
      if (pageName === 'index.html' && !access.isMarketingOnlyUser(req.authUser)) {
        return next();
      }
      return res.redirect('/unauthorized.html');
    }

    next();
  } catch (error) {
    next(error);
  }
}

async function metricasApiGuard(req, res, next) {
  try {
    const reqPath = String(req.path || '');

    if (reqPath === '/auth/login' || reqPath === '/auth/logout') {
      return next();
    }

    if (reqPath === '/auth/session') {
      if (!req.authUser) return next();
      const freshUser = await hydrateAuthUser(req);
      if (!freshUser) {
        req.authUser = null;
      }
      return next();
    }

    if (!req.authUser) {
      return res.status(401).json({ ok: false, message: 'Sesión requerida' });
    }

    const freshUser = await hydrateAuthUser(req);
    if (!freshUser) {
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

    if (reqPath.endsWith('/agenda-bonus/rules')) {
      if (!access.canAccessFeatureForUser(req.authUser, 'agenda_bonus_rules', { method: req.method })) {
        return res.status(403).json({ ok: false, message: 'Sin permiso para reglas de agenda bonus' });
      }
      return next();
    }

    if (reqPath.endsWith('/agenda-calendar/assignments')) {
      if (!access.canAccessFeatureForUser(req.authUser, 'agenda_calendar_assignments', { method: req.method })) {
        return res.status(403).json({ ok: false, message: 'Sin permiso para asignaciones de calendario' });
      }
      return next();
    }

    if (reqPath.endsWith('/agenda-checkpoints')) {
      const checkpointArea = String(req.method === 'GET' ? req.query?.area : req.body?.area || '').toLowerCase();
      if (checkpointArea === 'csm') {
        if (!access.canAccessPageForUser(req.authUser, 'csm-rendimiento.html')) {
          return res.status(403).json({ ok: false, message: 'Sin permiso para rendimiento CSM' });
        }
        if (req.method !== 'GET' && !access.canEditAgendaCheckpointsForUser(req.authUser)) {
          return res.status(403).json({ ok: false, message: 'Sin permiso para editar rendimiento CSM' });
        }
        return next();
      }
      if (!access.canAccessFeatureForUser(req.authUser, 'agenda_checkpoints', { method: req.method })) {
        return res.status(403).json({ ok: false, message: 'Sin permiso para checks, strikes y pendientes' });
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
      reqPath === '/marketing/cash-collected-agenda' ||
      reqPath === '/marketing/campaign-totales'
    ) {
      if (!access.canAccessFeatureForUser(req.authUser, 'marketing_inversion', { method: req.method })) {
        return res.status(403).json({ ok: false, message: 'Sin permiso para KPI marketing' });
      }
      return next();
    }

    if (reqPath === '/alertas-operativas') {
      if (!access.canAccessFeatureForUser(req.authUser, 'alertas_operativas', { method: req.method })) {
        return res.status(403).json({ ok: false, message: 'Sin permiso para ver alertas operativas' });
      }
      return next();
    }

    if (reqPath === '/assistant/ask') {
      if (!access.canAccessFeatureForUser(req.authUser, 'assistant', { method: req.method })) {
        return res.status(403).json({ ok: false, message: 'Sin permiso para usar Scalito' });
      }
      return next();
    }

    if (reqPath === '/utm-builder/presets') {
      if (!access.canAccessFeatureForUser(req.authUser, 'utm_builder', { method: req.method })) {
        return res.status(403).json({ ok: false, message: 'Sin permiso para usar herramientas UTM' });
      }
      return next();
    }

    if (reqPath === '/auth/users' || reqPath.startsWith('/auth/users/')) {
      if (!access.canAccessFeatureForUser(req.authUser, 'user_admin', { method: req.method })) {
        return res.status(403).json({ ok: false, message: 'Sin permiso para administrar usuarios' });
      }
      return next();
    }

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  attachAuthUser,
  metricasPageGuard,
  metricasApiGuard
};
