const axios = require('axios');
const crypto = require('crypto');
const env = require('../metricasv2/config/env');

const SESSION_COOKIE = 'metricas_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

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
        select: '*',
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

async function loginWithPassword(email, password) {
  const user = await findUserByEmail(email);
  if (!user) return null;

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return null;

  return {
    email: user.email,
    nombre: user.nombre || user.email,
    role: user.role
  };
}

module.exports = {
  SESSION_COOKIE,
  createSessionToken,
  parseSessionToken,
  parseCookies,
  serializeCookie,
  clearSessionCookie,
  getSessionUserFromRequest,
  loginWithPassword
};
