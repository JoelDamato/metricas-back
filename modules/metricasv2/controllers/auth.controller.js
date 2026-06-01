const authService = require('../../auth/service');
const access = require('../../auth/access');

function withPermissions(user) {
  if (!user) return user;
  return {
    ...user,
    permissions: access.getUserPermissions(user)
  };
}

function serializeManagedUser(record) {
  if (!record) return null;
  const user = {
    id: record.id,
    email: record.email,
    nombre: record.nombre || record.email,
    role: record.role,
    activo: record.activo !== false,
    access_config: record.access_config || {}
  };

  return {
    ...user,
    permissions: access.getUserPermissions(user),
    accessSummary: access.getUserAccessSummary(user)
  };
}

async function login(req, res, next) {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ ok: false, message: 'Email y contraseña son obligatorios' });
    }

    const user = await authService.loginWithPassword(email, password);
    if (!user) {
      return res.status(401).json({ ok: false, message: 'Credenciales inválidas' });
    }

    const token = authService.createSessionToken(user);
    res.setHeader('Set-Cookie', authService.serializeCookie(authService.SESSION_COOKIE, token));
    res.json({ ok: true, user: withPermissions(user) });
  } catch (error) {
    next(error);
  }
}

async function logout(req, res) {
  res.setHeader('Set-Cookie', authService.clearSessionCookie());
  res.json({ ok: true });
}

async function session(req, res) {
  if (!req.authUser) {
    return res.status(401).json({ ok: false, message: 'Sesión no iniciada' });
  }

  res.json({ ok: true, user: withPermissions(req.authUser) });
}

async function listUsers(req, res, next) {
  try {
    const users = await authService.listUsers();
    res.json({
      ok: true,
      users: users.map(serializeManagedUser)
    });
  } catch (error) {
    next(error);
  }
}

async function createUser(req, res, next) {
  try {
    const user = await authService.createUser(req.body || {});
    res.json({
      ok: true,
      user: serializeManagedUser(user)
    });
  } catch (error) {
    next(error);
  }
}

async function updateUser(req, res, next) {
  try {
    const target = await authService.findUserById(req.params.id);
    if (!target) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado' });
    }

    const isSelf = String(req.authUser?.email || '').toLowerCase() === String(target.email || '').toLowerCase();
    const accessConfig = req.body?.accessConfig || req.body?.access_config || {};
    if (isSelf) {
      if (req.body?.activo === false) {
        return res.status(400).json({ ok: false, message: 'No podés desactivar tu propia cuenta desde esta pantalla' });
      }
      if (String(req.body?.role || target.role) !== 'total') {
        return res.status(400).json({ ok: false, message: 'No podés bajarte tu propio rol admin desde esta pantalla' });
      }
      if (accessConfig && typeof accessConfig === 'object' && accessConfig.canManageUsers === false) {
        return res.status(400).json({ ok: false, message: 'No podés sacarte tu propio acceso de administración' });
      }
    }

    const user = await authService.updateUser(req.params.id, req.body || {});
    res.json({
      ok: true,
      user: serializeManagedUser(user)
    });
  } catch (error) {
    next(error);
  }
}

async function updateUserPassword(req, res, next) {
  try {
    const password = String(req.body?.password || '');
    if (!password) {
      return res.status(400).json({ ok: false, message: 'La contraseña es obligatoria' });
    }

    const user = await authService.updateUserPassword(req.params.id, password);
    res.json({
      ok: true,
      user: serializeManagedUser(user)
    });
  } catch (error) {
    next(error);
  }
}

async function deleteUser(req, res, next) {
  try {
    const target = await authService.findUserById(req.params.id);
    if (!target) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado' });
    }

    if (String(req.authUser?.email || '').toLowerCase() === String(target.email || '').toLowerCase()) {
      return res.status(400).json({ ok: false, message: 'No podés borrarte a vos mismo desde esta pantalla' });
    }

    const result = await authService.deleteUser(req.params.id);
    res.json({
      ok: true,
      deleted: result
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  login,
  logout,
  session,
  listUsers,
  createUser,
  updateUser,
  updateUserPassword,
  deleteUser
};
