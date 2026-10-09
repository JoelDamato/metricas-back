const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const styles = fs.readFileSync(path.join(root, 'public/metricas-v2/css/styles.css'), 'utf8');
const administration = fs.readFileSync(path.join(root, 'public/metricas-v2/views/administracion.html'), 'utf8');
const pages = [
  'public/metricas-v2/dashboard.html',
  'public/metricas-v2/metricas.html',
  'public/metricas-v2/views/administracion.html',
  'public/metricas-v2/views/comisiones.html',
  'public/metricas-v2/views/comprobantes.html'
];

test('el fondo premium está en las páginas principales solicitadas', () => {
  pages.forEach((relativePath) => {
    const html = fs.readFileSync(path.join(root, relativePath), 'utf8');
    assert.match(html, /<body class="[^"]*premium-navy-background[^"]*">/);
  });
});

test('el fondo usa navy casi negro, glows suaves y noise imperceptible sin puntos grandes', () => {
  assert.match(styles, /body\.premium-navy-background/);
  assert.match(styles, /linear-gradient\(180deg, #07101e 0%, #050a14 55%, #03070d 100%\)/);
  assert.match(styles, /circle at 15% 10%/);
  assert.match(styles, /circle at 85% 15%/);
  assert.match(styles, /feTurbulence/);
  assert.match(styles, /opacity: \.025/);
  assert.doesNotMatch(
    styles.match(/\/\* Fondo compartido:[\s\S]*$/)?.[0] || '',
    /0 2px, transparent 2px/
  );
});

test('Administración muestra un icono y una flecha para cada acceso', () => {
  const cards = (administration.match(/class="card administration-card/g) || []).length;
  assert.equal((administration.match(/class="administration-card-icon"/g) || []).length, cards);
  assert.equal((administration.match(/class="administration-card-arrow"/g) || []).length, cards);
  assert.match(administration, /administration-card-comisiones/);
  assert.match(administration, /administration-card-club/);
  assert.match(administration, /administration-card-conciliacion/);
  assert.match(administration, /administration-card-comprobantes-lab/);
  assert.match(styles, /\.administration-card-icon svg/);
  assert.match(styles, /\.administration-card-club \.administration-card-icon/);
  assert.match(styles, /\.administration-card-conciliacion \.administration-card-icon/);
});
