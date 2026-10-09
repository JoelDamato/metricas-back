const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const access = require('../modules/auth/access');
const pdiService = require('../modules/metricasv2/services/pdi.service');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('PDI solo permite acceso a Mati y Leo, tanto en la página como en la API', () => {
  const mati = { role: 'total', email: 'matirandazzo@gmail.com' };
  const leo = { role: 'comercial', email: 'leonardoalaniz19@gmail.com' };
  const otherAdmin = { role: 'total', email: 'otra.admin@example.com' };
  const closer = { role: 'comercial', email: 'closer@example.com' };

  for (const user of [mati, leo]) {
    assert.equal(access.canAccessPageForUser(user, 'pdi.html'), true);
    assert.equal(access.canAccessFeatureForUser(user, 'pdi', { method: 'GET' }), true);
    assert.equal(access.canAccessFeatureForUser(user, 'pdi', { method: 'POST' }), true);
    assert.equal(access.getUserPermissions(user).canAccessPdi, true);
  }

  for (const user of [otherAdmin, closer]) {
    assert.equal(access.canAccessPageForUser(user, 'pdi.html'), false);
    assert.equal(access.canAccessFeatureForUser(user, 'pdi', { method: 'GET' }), false);
    assert.equal(access.getUserPermissions(user).canAccessPdi, false);
  }

  const middleware = read('modules/auth/middleware.js');
  const routes = read('routes/metricasV2.js');
  assert.match(middleware, /reqPath === '\/pdi'/);
  assert.match(middleware, /canAccessFeatureForUser\(req\.authUser, 'pdi'/);
  assert.match(routes, /router\.get\('\/pdi', controller\.listPdiRecords\)/);
  assert.match(routes, /router\.post\('\/pdi', controller\.upsertPdiRecord\)/);
  assert.match(routes, /router\.delete\('\/pdi\/:closerKey', controller\.deletePdiRecord\)/);
});

test('Grabaciones es una página autenticada y PDI queda oculto por permiso en el dashboard', () => {
  assert.equal(access.canAccessPageForUser({ role: 'total', email: 'admin@example.com' }, 'grabaciones.html'), true);
  assert.equal(access.canAccessPageForUser({ role: 'comercial', email: 'closer@example.com' }, 'grabaciones.html'), true);
  assert.equal(access.canAccessPageForUser({ role: 'csm', email: 'csm@example.com' }, 'grabaciones.html'), true);
  assert.equal(access.canAccessPageForUser(null, 'grabaciones.html'), false);

  const dashboard = read('public/metricas-v2/js/views/dashboard.page.js');
  const central = read('public/metricas-v2/metricas.html');
  assert.match(dashboard, /page: 'grabaciones\.html', href: '\/views\/grabaciones\.html'/);
  assert.match(dashboard, /page: 'pdi\.html', href: '\/views\/pdi\.html'[^\n]*permission: 'canAccessPdi'/);
  assert.doesNotMatch(central, /href="\/views\/grabaciones\.html"/);
  assert.doesNotMatch(central, /href="\/views\/pdi\.html"/);
});

test('la página PDI conserva las cinco áreas funcionales y guarda por API, no en localStorage', () => {
  const html = read('public/metricas-v2/views/pdi.html');
  const script = read('public/metricas-v2/js/views/pdi.page.js');
  const recordings = read('public/metricas-v2/views/grabaciones.html');

  for (const tab of ['datos', 'disc', 'performance', 'plan', 'gestion']) {
    assert.match(html, new RegExp(`data-pdi-tab="${tab}"`));
    assert.match(html, new RegExp(`data-pdi-panel="${tab}"`));
  }
  assert.match(html, /premium-navy-background/);
  assert.match(html, /Acceso privado · Mati y Leo/);
  assert.match(script, /postJson\('\/api\/metricas\/pdi'/);
  assert.match(script, /deleteJson\(`\/api\/metricas\/pdi\//);
  assert.doesNotMatch(script, /localStorage/);
  assert.match(recordings, /recordings\.page\.js/);
  assert.match(recordings, /premium-navy-background/);
});

test('el payload PDI normaliza el closer y conserva performance y plan', () => {
  const performance = { nombre: 'Claudio Nicolini', disc: { D: 70 }, comps: [] };
  const plan = [{ competencia: 'Empatía', estado: 'Pendiente' }];
  const payload = pdiService._test.buildPayload(
    { closerName: '  Claudio Nicolini  ', performance, plan },
    { email: 'MATIRANDAZZO@gmail.com' }
  );

  assert.equal(payload.closer_key, 'claudio-nicolini');
  assert.equal(payload.closer_name, 'Claudio Nicolini');
  assert.deepEqual(payload.performance, performance);
  assert.deepEqual(payload.action_plan, plan);
  assert.equal(payload.updated_by_email, 'matirandazzo@gmail.com');
});

test('la migración PDI aplica restricciones, RLS y privilegios mínimos', () => {
  const sql = read('supabase/migrations/20260924113000_create_pdi_closer_records.sql');
  assert.match(sql, /closer_key text not null unique/i);
  assert.match(sql, /jsonb_typeof\(performance\) = 'object'/i);
  assert.match(sql, /jsonb_typeof\(action_plan\) = 'array'/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /revoke all[^;]+anon, authenticated/is);
  assert.match(sql, /grant select, insert, update, delete[^;]+service_role/is);
});
