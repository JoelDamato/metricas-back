const authService = require('../../auth/service');

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
    res.json({ ok: true, user });
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

  res.json({ ok: true, user: req.authUser });
}

module.exports = {
  login,
  logout,
  session
};
