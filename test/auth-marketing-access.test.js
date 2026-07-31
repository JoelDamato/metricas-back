const test = require('node:test');
const assert = require('node:assert/strict');
const access = require('../modules/auth/access');

test('Walter puede ver y administrar completamente el panel de Marketing', () => {
  const walter = {
    email: 'walteralegre56@gmail.com',
    role: 'comercial'
  };

  assert.equal(access.canAccessPageForUser(walter, 'marketing.html'), true);
  assert.equal(access.canAccessResourceForUser(walter, 'kpi_marketing_diario'), true);
  assert.equal(access.canAccessResourceForUser(walter, 'kpi_marketing_inversiones'), true);

  ['GET', 'POST', 'PATCH', 'DELETE'].forEach((method) => {
    assert.equal(
      access.canAccessFeatureForUser(walter, 'marketing_inversion', { method }),
      true
    );
  });

  assert.equal(access.canAccessPageForUser(walter, 'administracion.html'), false);
});
