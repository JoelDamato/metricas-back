const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const shell = fs.readFileSync(path.join(root, 'public/metricas-v2/js/auth-shell.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'public/metricas-v2/css/styles.css'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'public/metricas-v2/dashboard.html'), 'utf8');
const shellPages = [
  path.join(root, 'public/metricas-v2/dashboard.html'),
  path.join(root, 'public/metricas-v2/metricas.html'),
  ...fs.readdirSync(path.join(root, 'public/metricas-v2/views'))
    .filter((name) => name.endsWith('.html'))
    .map((name) => path.join(root, 'public/metricas-v2/views', name))
].filter((file) => fs.readFileSync(file, 'utf8').includes('/js/auth-shell.js'));

test('la navegación global se renderiza siempre como sidebar y permanece compacta', () => {
  assert.match(shell, /shell\.className = 'auth-shell auth-sidebar'/);
  assert.doesNotMatch(shell, /id="metricasSidebarToggle"/);
  assert.match(shell, /const isExpanded = false/);
  assert.match(shell, /FAVICON_URL = '\/metricas-assets\/favicon-m\.svg'/);
  assert.doesNotMatch(shell, /class="auth-shell-brand"/);
  assert.match(shell, /setSidebarExpanded\(!shell\.classList\.contains\('is-expanded'\)\)/);
  assert.match(shell, /setSidebarExpanded\(false\)/);
  assert.match(shell, /function shellIcon\(name\)/);
  assert.match(shell, /event\.key === 'Escape'/);
  assert.match(shell, />Navegación<\/span>/);
  assert.match(shell, />Preferencias<\/span>/);
  assert.match(shell, />Usuario<\/span>/);
});

test('el sidebar conserva las utilidades y los accesos filtrados por permiso', () => {
  ['Dashboard', 'Central de Métricas', 'Pantalla dividida', 'Dólar hoy', 'Herramientas', 'Administración', 'Cerrar sesión']
    .forEach((label) => assert.match(shell, new RegExp(label)));
  assert.match(shell, /const canNavigatePage = \(pageName\) => !allowedPages \|\| allowedPages\.includes\(pageName\)/);
  assert.match(shell, /document\.querySelectorAll\('a\[href\^="\/views\/"\]/);
});

test('el sidebar global es fijo, compacto y desplaza el contenido', () => {
  assert.match(styles, /Navegación definitiva: sidebar global compacto con expansión opcional/);
  assert.match(styles, /body \.auth-shell\.auth-sidebar,[\s\S]*position: fixed;[\s\S]*width: 104px/);
  assert.match(styles, /body \.auth-shell\.auth-sidebar\.is-expanded,[\s\S]*width: 296px/);
  assert.match(styles, /body\.auth-sidebar-layout[\s\S]*padding-left: calc\(var\(--metricas-sidebar-width, 104px\) \+ 20px\)/);
  assert.match(styles, /\.auth-sidebar:not\(\.is-expanded\) \.auth-sidebar-item\.is-current::before/);
  assert.match(styles, /body \.auth-sidebar\.is-expanded \.auth-sidebar-section-label/);
  assert.match(shell, /syncSidebarTooltips/);
  assert.match(shell, /item\.dataset\.sidebarTooltip = label/);
  assert.match(shell, /className = 'auth-sidebar-floating-tooltip'/);
  assert.match(shell, /shell\.addEventListener\('pointerover'/);
  assert.match(shell, /shell\.addEventListener\('focusin'/);
  assert.match(shell, /window\.metricasSidebar =/);
  assert.match(styles, /\.auth-sidebar-floating-tooltip\.is-visible/);
  assert.match(styles, /overflow-y: auto;[\s\S]*overscroll-behavior: contain/);
  assert.match(styles, /translateY\(-2px\) scale\(1\.025\)/);
  assert.match(styles, /@media \(max-width: 760px\)/);
});

test('dashboard fuerza la versión nueva de CSS y JavaScript para evitar estilos viejos en caché', () => {
  assert.match(dashboard, /\/css\/styles\.css\?v=20261009-release-1/);
  assert.match(dashboard, /\/js\/auth-shell\.js\?v=20261009-release-1/);
  assert.match(dashboard, /\/js\/views\/dashboard\.page\.js\?v=/);
});

test('todas las vistas del shell cargan la misma versión estable del sidebar', () => {
  assert.ok(shellPages.length >= 40);
  shellPages.forEach((file) => {
    const html = fs.readFileSync(file, 'utf8');
    assert.match(html, /\/css\/styles\.css\?v=20261009-release-1/, path.relative(root, file));
    assert.match(html, /\/js\/auth-shell\.js\?v=20261009-release-1/, path.relative(root, file));
  });
});
