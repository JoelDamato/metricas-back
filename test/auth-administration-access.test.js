const test = require('node:test');
const assert = require('node:assert/strict');

const {
  canAccessAdministrationForUser,
  canAccessPageForUser,
  getUserPermissions
} = require('../modules/auth/access');

test('Matias Randazzo puede acceder a Administracion', () => {
  const user = {
    email: 'matirandazzo@gmail.com',
    role: 'total',
    access_config: {
      canAccessAdministration: true
    }
  };

  assert.equal(canAccessAdministrationForUser(user), true);
  assert.equal(canAccessPageForUser(user, 'administracion.html'), true);
  assert.equal(getUserPermissions(user).canAccessAdministration, true);
});

test('el permiso de Supabase controla el acceso a Administracion', () => {
  const user = {
    email: 'matirandazzo@gmail.com',
    role: 'total',
    access_config: {
      canAccessAdministration: false
    }
  };

  assert.equal(canAccessAdministrationForUser(user), false);
  assert.equal(canAccessPageForUser(user, 'administracion.html'), false);
});
