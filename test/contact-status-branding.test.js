const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/contacto-estado/index.html'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'public/contacto-estado/styles.css'), 'utf8');

test('Estado de Contacto usa el shell y el branding actual de la Central', () => {
  assert.match(html, /href="\/css\/styles\.css\?v=/);
  assert.match(html, /src="\/js\/auth-shell\.js\?v=/);
  assert.match(html, /class="contact-status-page premium-navy-background"/);
  assert.match(html, /href="\/dashboard\.html"/);
  assert.doesNotMatch(html, /\/metricas\/(?:css|js|dashboard)/);
  assert.match(styles, /#050a14/i);
  assert.match(styles, /#07101e/i);
  assert.match(styles, /Space Grotesk/);
  assert.match(styles, /body\.contact-status-page::before[\s\S]*display:\s*none/);
  assert.doesNotMatch(styles, /radial-gradient\([^)]*\)\s*[0-9]+px\s+[0-9]+px\s*\//i);
});
