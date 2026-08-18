const test = require('node:test');
const assert = require('node:assert/strict');

const authService = require('../modules/auth/service');
const { metricasApiGuard } = require('../modules/auth/middleware');

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

test('la API de carga de comprobantes exige el mismo acceso que la pantalla', async (t) => {
  const deniedUser = {
    email: 'sin-acceso@example.com',
    role: 'sin_acceso'
  };
  t.mock.method(authService, 'getActiveUserByEmail', async () => deniedUser);

  const req = {
    path: '/comprobantes-loader/venta-relacionada',
    method: 'GET',
    authUser: deniedUser
  };
  const res = responseRecorder();
  let nextCalled = false;

  await metricasApiGuard(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body?.message, 'Sin permiso para cargar comprobantes');
});

test('un vendedor con acceso a la pantalla puede usar la API de comprobantes', async (t) => {
  const seller = {
    email: 'vendedor@example.com',
    role: 'comercial'
  };
  t.mock.method(authService, 'getActiveUserByEmail', async () => seller);

  const req = {
    path: '/comprobantes-loader',
    method: 'POST',
    authUser: seller
  };
  const res = responseRecorder();
  let nextCalled = false;

  await metricasApiGuard(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, null);
});

test('la conciliación completa queda restringida a usuarios de Administración', async (t) => {
  const seller = {
    email: 'vendedor@example.com',
    role: 'comercial'
  };
  t.mock.method(authService, 'getActiveUserByEmail', async () => seller);

  const req = {
    path: '/comprobantes-reconciliation',
    method: 'GET',
    authUser: seller
  };
  const res = responseRecorder();
  let nextCalled = false;

  await metricasApiGuard(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body?.message, 'Sin permiso para Administración');
});

test('un usuario de Administración puede listar y cambiar conciliaciones', async (t) => {
  const admin = {
    email: 'matirandazzo@gmail.com',
    role: 'total'
  };
  t.mock.method(authService, 'getActiveUserByEmail', async () => admin);

  for (const req of [
    { path: '/comprobantes-reconciliation', method: 'GET', authUser: admin },
    { path: `/comprobantes-reconciliation/${'49f48251-7a95-800d-9168-fefc4ff0ff16'}`, method: 'PATCH', authUser: admin }
  ]) {
    const res = responseRecorder();
    let nextCalled = false;
    await metricasApiGuard(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, 200);
  }
});
