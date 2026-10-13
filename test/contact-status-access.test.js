const test = require('node:test');
const assert = require('node:assert/strict');
const access = require('../modules/auth/access');

test('Estado de contacto está disponible para todo el equipo, incluso con permisos personalizados', () => {
  const users = [
    { email: 'valecalmet@gmail.com', role: 'csm' },
    { email: 'belenherrera.gestion@gmail.com', role: 'csm' },
    { email: 'glcosta.gc11@gmail.com', role: 'csm' },
    { email: 'sofiangallardod@gmail.com', role: 'csm' },
    { email: 'walteralegre56@gmail.com', role: 'comercial' },
    { email: 'charliecarlostu@gmail.com', role: 'comercial' },
    { email: 'iascinahuel@gmail.com', role: 'comercial' },
    { email: 'juanma@romsconsultora.com', role: 'comercial' },
    { email: 'matirandazzo@gmail.com', role: 'total' },
    { email: 'custom@example.com', role: 'csm', access_config: { useCustomAccess: true, allowedPages: ['dashboard.html'] } }
  ];
  for (const user of users) {
    assert.equal(access.canAccessPageForUser(user, 'estado-contacto-comisiones.html'), true, user.email);
    const { allowedPages } = access.getUserPermissions(user);
    if (allowedPages) assert(allowedPages.includes('estado-contacto-comisiones.html'), user.email);
  }
  assert.equal(access.canAccessPageForUser(null, 'estado-contacto-comisiones.html'), false);
  for (const user of users.filter(u => u.role === 'csm')) {
    for (const page of ['administracion.html', 'conciliacion.html', 'comisiones.html', 'entrenamiento-disc.html']) {
      assert.equal(access.canAccessPageForUser(user, page), false, user.email + ' ' + page);
    }
  }
});
