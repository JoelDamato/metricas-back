const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const access = require('../modules/auth/access');

const root = path.resolve(__dirname, '..');
const metricas = fs.readFileSync(path.join(root, 'public/metricas-v2/metricas.html'), 'utf8');
const legacyIndex = fs.readFileSync(path.join(root, 'public/metricas-v2/index.html'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'public/metricas-v2/js/views/dashboard.page.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'public/metricas-v2/css/styles.css'), 'utf8');
const server = fs.readFileSync(path.join(root, 'index.js'), 'utf8');

test('Métricas tiene página canónica y el index anterior redirige sin romper enlaces', () => {
  assert.match(metricas, /<title>Central de Métricas<\/title>/);
  assert.match(legacyIndex, /window\.location\.replace\('\/metricas\.html'\)/);
  assert.match(server, /app\.get\('\/index\.html',[\s\S]*res\.redirect\('\/metricas\.html'\)/);
  assert.match(dashboard, /page: 'metricas\.html', href: '\/metricas\.html'/);
  assert.doesNotMatch(dashboard, /href: '\/index\.html'/);
});

test('la Central usa el branding navy premium del dashboard', () => {
  assert.match(metricas, /<body class="[^"]*central-brand-page[^"]*premium-navy-background[^"]*">/);
  assert.match(metricas, /Tu espacio de análisis/);
  assert.match(metricas, /class="central-hero-visual"/);
  assert.match(metricas, /Insights en tiempo real/);
  assert.match(metricas, /class="central-visual-chart"/);
  assert.match(styles, /Central de Métricas: composición premium de la referencia/);
  assert.match(styles, /\.central-hero-visual/);
  assert.match(styles, /\.central-brand-page \.central-group/);
  assert.match(styles, /\.central-brand-page \.central-cards \.card/);
});

test('la Central agrupa Setting y Renovaciones en Ventas sin repetir accesos del Dashboard', () => {
  const ventas = metricas.match(/data-group="ventas"[\s\S]*?<\/details>/)?.[0] || '';
  assert.match(ventas, /href="\/views\/setting\.html"/);
  assert.match(ventas, /href="\/views\/csm-renovaciones\.html"/);
  assert.doesNotMatch(metricas, /data-group="operacion"/);
  assert.doesNotMatch(metricas, /href="\/views\/alertas-operativas\.html"/);
  assert.doesNotMatch(metricas, /href="\/views\/admin-usuarios\.html"/);
});

test('Diagnóstico y Rendimiento CSM salen de Métricas y conserva los tableros métricos CSM', () => {
  const csm = metricas.match(/data-group="csm"[\s\S]*?<\/details>/)?.[0] || '';
  assert.doesNotMatch(csm, /href="\/views\/csm-rendimiento\.html"/);
  assert.doesNotMatch(csm, /href="\/views\/diagnostico\.html"/);
  assert.match(csm, /href="\/views\/csm-tiempo\.html"/);
  assert.match(csm, /href="\/views\/csm-situacion\.html"/);
});

test('los permisos antiguos de index habilitan la nueva página Métricas', () => {
  const legacyUser = {
    role: 'comercial',
    email: 'usuario.legacy@example.com',
    access_config: {
      useCustomAccess: true,
      homePath: '/index.html',
      allowedPages: ['index.html']
    }
  };

  assert.equal(access.canAccessPageForUser(legacyUser, 'metricas.html'), true);
  assert.equal(access.getUserPermissions(legacyUser).homePath, '/metricas.html');
  assert.equal(access.getUserPermissions(legacyUser).allowedPages.includes('metricas.html'), true);
  assert.equal(access.getUserPermissions(legacyUser).allowedPages.includes('index.html'), false);
});
