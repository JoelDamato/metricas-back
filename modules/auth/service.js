const axios = require('axios');
const crypto = require('crypto');
const env = require('../metricasv2/config/env');

const SESSION_COOKIE = 'metricas_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const USER_COLUMNS = '*';

function requiredEnv() {
  if (!env.supabaseUrl || !env.supabaseKey) {
    const error = new Error('Faltan variables de Supabase para auth');
    error.statusCode = 500;
    throw error;
  }
}

function buildHeaders(extra = {}) {
  requiredEnv();
  return {
    apikey: env.supabaseKey,
    Authorization: `Bearer ${env.supabaseKey}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

function isMissingAccessConfigColumnError(err) {
  const message = String(err?.response?.data?.message || err?.message || '').toLowerCase();
  return message.includes('access_config') && (message.includes('column') || message.includes('schema cache'));
}

function sessionSecret() {
  return process.env.METRICAS_AUTH_SECRET || env.supabaseKey || 'metricas-local-secret';
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function readBase64url(input) {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function signValue(value) {
  return crypto.createHmac('sha256', sessionSecret()).update(value).digest('base64url');
}

function createSessionToken(user) {
  const payload = {
    email: user.email,
    nombre: user.nombre,
    role: user.role,
    exp: Date.now() + SESSION_TTL_MS
  };

  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = signValue(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function parseSessionToken(token) {
  if (!token || !token.includes('.')) return null;
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;
  if (signValue(encodedPayload) !== signature) return null;

  try {
    const payload = JSON.parse(readBase64url(encodedPayload));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch (error) {
    return null;
  }
}

function parseCookies(cookieHeader) {
  const cookies = {};
  String(cookieHeader || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const idx = part.indexOf('=');
      if (idx === -1) return;
      const key = part.slice(0, idx).trim();
      const value = part.slice(idx + 1).trim();
      cookies[key] = decodeURIComponent(value);
    });
  return cookies;
}

function serializeCookie(name, value, maxAgeMs = SESSION_TTL_MS) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`
  ];

  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }

  return parts.join('; ');
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function getSessionUserFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie);
  return parseSessionToken(cookies[SESSION_COOKIE] || '');
}

async function scryptAsync(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) return reject(error);
      resolve(derivedKey.toString('hex'));
    });
  });
}

async function hashPassword(password) {
  if (!password) {
    const error = new Error('La contraseña es obligatoria');
    error.statusCode = 400;
    throw error;
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scryptAsync(password, salt);
  return `${salt}:${derived}`;
}

async function verifyPassword(password, storedHash) {
  if (!password || !storedHash || !storedHash.includes(':')) return false;
  const [salt, hash] = storedHash.split(':');
  const derived = await scryptAsync(password, salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derived, 'hex'));
}

async function findUserByEmail(email) {
  const url = `${env.supabaseUrl}/rest/v1/metricas_usuarios`;

  try {
    const response = await axios.get(url, {
      headers: buildHeaders(),
      params: {
        select: USER_COLUMNS,
        email: `eq.${String(email || '').trim().toLowerCase()}`,
        activo: 'eq.true',
        limit: 1
      }
    });

    return response.data?.[0] || null;
  } catch (err) {
    const message = err.response?.data?.message || err.message;
    const error = new Error(`Error leyendo usuario de métricas: ${message}`);
    error.statusCode = err.response?.status || 500;
    throw error;
  }
}

function normalizeAccessConfig(accessConfig = {}) {
  const source = accessConfig && typeof accessConfig === 'object' ? accessConfig : {};
  const allowedFeatures = source.allowedFeatures && typeof source.allowedFeatures === 'object'
    ? Object.fromEntries(
        Object.entries(source.allowedFeatures)
          .map(([key, value]) => [
            key,
            Array.isArray(value)
              ? value.map((item) => String(item || '').toUpperCase()).filter(Boolean)
              : []
          ])
          .filter(([, value]) => value.length)
      )
    : {};

  return {
    useCustomAccess: source.useCustomAccess === true,
    homePath: source.homePath ? String(source.homePath).trim() : null,
    allowedPages: Array.isArray(source.allowedPages) ? source.allowedPages.map((value) => String(value || '').trim()).filter(Boolean) : [],
    allowedResources: Array.isArray(source.allowedResources) ? source.allowedResources.map((value) => String(value || '').trim()).filter(Boolean) : [],
    allowedFeatures,
    marketingOnly: source.marketingOnly === true,
    restrictedCommercial: source.restrictedCommercial === true,
    csmOnly: source.csmOnly === true,
    canEditReportesPremio: source.canEditReportesPremio === true,
    canGenerateCloserAiReport: source.canGenerateCloserAiReport === true,
    canManageUsers: source.canManageUsers === true
  };
}

function toSessionUser(record) {
  if (!record) return null;
  return {
    id: record.id,
    email: record.email,
    nombre: record.nombre || record.email,
    role: record.role,
    activo: record.activo !== false,
    access_config: normalizeAccessConfig(record.access_config || {})
  };
}

async function findAnyUserByEmail(email) {
  const url = `${env.supabaseUrl}/rest/v1/metricas_usuarios`;

  try {
    const response = await axios.get(url, {
      headers: buildHeaders(),
      params: {
        select: USER_COLUMNS,
        email: `eq.${String(email || '').trim().toLowerCase()}`,
        limit: 1
      }
    });

    return response.data?.[0] || null;
  } catch (err) {
    const message = err.response?.data?.message || err.message;
    const error = new Error(`Error leyendo usuario de métricas: ${message}`);
    error.statusCode = err.response?.status || 500;
    throw error;
  }
}

async function findUserById(id) {
  const url = `${env.supabaseUrl}/rest/v1/metricas_usuarios`;

  try {
    const response = await axios.get(url, {
      headers: buildHeaders(),
      params: {
        select: USER_COLUMNS,
        id: `eq.${Number(id || 0)}`,
        limit: 1
      }
    });

    return response.data?.[0] || null;
  } catch (err) {
    const message = err.response?.data?.message || err.message;
    const error = new Error(`Error leyendo usuario de métricas: ${message}`);
    error.statusCode = err.response?.status || 500;
    throw error;
  }
}

async function getActiveUserByEmail(email) {
  const record = await findUserByEmail(email);
  return toSessionUser(record);
}

async function listUsers() {
  const url = `${env.supabaseUrl}/rest/v1/metricas_usuarios`;

  try {
    const response = await axios.get(url, {
      headers: buildHeaders(),
      params: {
        select: USER_COLUMNS,
        order: 'email.asc'
      }
    });

    return (response.data || []).map((row) => ({
      ...row,
      access_config: normalizeAccessConfig(row.access_config || {})
    }));
  } catch (err) {
    const message = err.response?.data?.message || err.message;
    const error = new Error(`Error listando usuarios de métricas: ${message}`);
    error.statusCode = err.response?.status || 500;
    throw error;
  }
}

async function createUser(payload = {}) {
  const email = String(payload.email || '').trim().toLowerCase();
  const nombre = String(payload.nombre || '').trim();
  const role = String(payload.role || '').trim();
  const password = String(payload.password || '');
  const activo = payload.activo !== false;
  const accessConfig = normalizeAccessConfig(payload.access_config || payload.accessConfig || {});

  if (!email || !role || !password) {
    const error = new Error('Email, rol y contraseña son obligatorios');
    error.statusCode = 400;
    throw error;
  }

  const passwordHash = await hashPassword(password);
  const url = `${env.supabaseUrl}/rest/v1/metricas_usuarios`;

  try {
    const response = await axios.post(url, {
      email,
      nombre: nombre || email,
      role,
      password_hash: passwordHash,
      activo,
      access_config: accessConfig
    }, {
      headers: buildHeaders({
        Prefer: 'return=representation'
      })
    });

    return {
      ...(response.data?.[0] || {}),
      access_config: accessConfig
    };
  } catch (err) {
    if (isMissingAccessConfigColumnError(err)) {
      const response = await axios.post(url, {
        email,
        nombre: nombre || email,
        role,
        password_hash: passwordHash,
        activo
      }, {
        headers: buildHeaders({
          Prefer: 'return=representation'
        })
      });

      return {
        ...(response.data?.[0] || {}),
        access_config: {}
      };
    }

    const message = err.response?.data?.message || err.message;
    const error = new Error(`Error creando usuario de métricas: ${message}`);
    error.statusCode = err.response?.status || 500;
    throw error;
  }
}

async function updateUser(userId, payload = {}) {
  const id = Number(userId || 0);
  if (!id) {
    const error = new Error('Falta el usuario a actualizar');
    error.statusCode = 400;
    throw error;
  }

  const body = {};
  if ('nombre' in payload) body.nombre = String(payload.nombre || '').trim() || null;
  if ('role' in payload) body.role = String(payload.role || '').trim();
  if ('activo' in payload) body.activo = payload.activo === true;
  const hasAccessConfig = 'access_config' in payload || 'accessConfig' in payload;
  if (hasAccessConfig) {
    body.access_config = normalizeAccessConfig(payload.access_config || payload.accessConfig || {});
  }
  body.updated_at = new Date().toISOString();

  const url = `${env.supabaseUrl}/rest/v1/metricas_usuarios`;

  try {
    const response = await axios.patch(url, body, {
      headers: buildHeaders({
        Prefer: 'return=representation'
      }),
      params: {
        id: `eq.${id}`,
        select: USER_COLUMNS
      }
    });

    return {
      ...(response.data?.[0] || null),
      access_config: normalizeAccessConfig(response.data?.[0]?.access_config || body.access_config || {})
    };
  } catch (err) {
    if (hasAccessConfig && isMissingAccessConfigColumnError(err)) {
      const fallbackBody = { ...body };
      delete fallbackBody.access_config;
      const response = await axios.patch(url, fallbackBody, {
        headers: buildHeaders({
          Prefer: 'return=representation'
        }),
        params: {
          id: `eq.${id}`,
          select: USER_COLUMNS
        }
      });

      return {
        ...(response.data?.[0] || null),
        access_config: normalizeAccessConfig(response.data?.[0]?.access_config || {})
      };
    }

    const message = err.response?.data?.message || err.message;
    const error = new Error(`Error actualizando usuario de métricas: ${message}`);
    error.statusCode = err.response?.status || 500;
    throw error;
  }
}

async function updateUserPassword(userId, password) {
  const id = Number(userId || 0);
  if (!id) {
    const error = new Error('Falta el usuario para cambiar la contraseña');
    error.statusCode = 400;
    throw error;
  }

  const passwordHash = await hashPassword(String(password || ''));
  const url = `${env.supabaseUrl}/rest/v1/metricas_usuarios`;

  try {
    const response = await axios.patch(url, {
      password_hash: passwordHash,
      updated_at: new Date().toISOString()
    }, {
      headers: buildHeaders({
        Prefer: 'return=representation'
      }),
      params: {
        id: `eq.${id}`,
        select: USER_COLUMNS
      }
    });

    return {
      ...(response.data?.[0] || null),
      access_config: normalizeAccessConfig(response.data?.[0]?.access_config || {})
    };
  } catch (err) {
    const message = err.response?.data?.message || err.message;
    const error = new Error(`Error cambiando contraseña de métricas: ${message}`);
    error.statusCode = err.response?.status || 500;
    throw error;
  }
}

async function deleteUser(userId) {
  const id = Number(userId || 0);
  if (!id) {
    const error = new Error('Falta el usuario a borrar');
    error.statusCode = 400;
    throw error;
  }

  const url = `${env.supabaseUrl}/rest/v1/metricas_usuarios`;

  try {
    await axios.delete(url, {
      headers: buildHeaders(),
      params: {
        id: `eq.${id}`
      }
    });
    return { id };
  } catch (err) {
    const message = err.response?.data?.message || err.message;
    const error = new Error(`Error borrando usuario de métricas: ${message}`);
    error.statusCode = err.response?.status || 500;
    throw error;
  }
}

async function loginWithPassword(email, password) {
  const user = await findUserByEmail(email);
  if (!user) return null;

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return null;

  return toSessionUser(user);
}

module.exports = {
  SESSION_COOKIE,
  createSessionToken,
  parseSessionToken,
  parseCookies,
  serializeCookie,
  clearSessionCookie,
  getSessionUserFromRequest,
  hashPassword,
  normalizeAccessConfig,
  toSessionUser,
  getActiveUserByEmail,
  findUserById,
  listUsers,
  createUser,
  updateUser,
  updateUserPassword,
  deleteUser,
  loginWithPassword
};
