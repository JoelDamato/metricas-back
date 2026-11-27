const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const script = fs.readFileSync(path.join(__dirname, '../public/metricas-v2/js/api/http.js'), 'utf8');
const session = '/api/metricas/auth/session';
const login = '/api/metricas/auth/login';

function makeDocument() {
  const requests = [];
  const window = { location: { pathname: '/dashboard.html' } };
  function fetch(url, options) {
    return new Promise((resolve, reject) => {
      requests.push({
        url, options, reject,
        respond(data, ok = true) { resolve({ ok, status: ok ? 200 : 401, json: async () => data }); }
      });
    });
  }
  vm.runInNewContext(script, { fetch, window, document: { readyState: 'complete' }, structuredClone });
  return { requests, http: window.http };
}

test('lecturas simultáneas de sesión comparten la solicitud y conservan copias separadas', async () => {
  const { requests, http } = makeDocument();
  const first = http.getJson(session);
  const second = http.getJson(session);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.cache, 'no-store');
  requests[0].respond({ user: { email: 'a@example.test', permissions: { canEdit: true } } });
  const [a, b] = await Promise.all([first, second]);
  a.user.permissions.canEdit = false;
  assert.equal(b.user.permissions.canEdit, true);

  const next = http.getJson(session);
  assert.equal(requests.length, 2);
  requests[1].respond({ user: { email: 'a@example.test', permissions: { canEdit: false } } });
  assert.equal((await next).user.permissions.canEdit, false);
});

test('un fallo compartido no impide consultar la sesión de nuevo', async () => {
  const { requests, http } = makeDocument();
  const first = http.getJson(session);
  const second = http.getJson(session);
  assert.equal(requests.length, 1);
  requests[0].respond({ message: 'Sesión no iniciada' }, false);
  await Promise.all([assert.rejects(first, /Sesión no iniciada/), assert.rejects(second, /Sesión no iniciada/)]);

  const next = http.getJson(session);
  assert.equal(requests.length, 2);
  requests[1].respond({ user: { email: 'a@example.test' } });
  assert.equal((await next).user.email, 'a@example.test');
});

test('una cuenta nueva no reutiliza una consulta pendiente de la anterior', async () => {
  const { requests, http } = makeDocument();
  const previous = http.getJson(session);
  const changingAccount = http.postJson(login, { email: 'b@example.test' });
  const duringChange = http.getJson(session);
  assert.deepEqual(requests.map(request => request.url), [session, login, session]);
  requests[1].respond({ ok: true });
  await changingAccount;

  const current = http.getJson(session);
  assert.equal(requests.length, 4);
  requests[0].respond({ user: { email: 'a@example.test' } });
  requests[2].respond({ user: { email: 'a@example.test' } });
  assert.equal((await previous).user.email, 'a@example.test');
  assert.equal((await duringChange).user.email, 'a@example.test');

  const sameCurrent = http.getJson(session);
  assert.equal(requests.length, 4);
  requests[3].respond({ user: { email: 'b@example.test' } });
  assert.equal((await current).user.email, 'b@example.test');
  assert.equal((await sameCurrent).user.email, 'b@example.test');
});

test('documentos distintos no comparten la sesión ni las consultas explícitamente frescas', async () => {
  const a = makeDocument();
  const b = makeDocument();
  const sessionA = a.http.getJson(session);
  const sessionB = b.http.getJson(session);
  const refresh = a.http.getJson(session, { fresh: true });
  assert.equal(a.requests.length, 2);
  assert.equal(b.requests.length, 1);
  a.requests[0].respond({ user: { email: 'a@example.test' } });
  a.requests[1].respond({ user: { email: 'a@example.test', role: 'comercial' } });
  b.requests[0].respond({ user: { email: 'b@example.test' } });
  assert.equal((await sessionA).user.email, 'a@example.test');
  assert.equal((await sessionB).user.email, 'b@example.test');
  assert.equal((await refresh).user.role, 'comercial');
});
