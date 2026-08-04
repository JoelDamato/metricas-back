const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(
  path.join(__dirname, '../public/metricas-v2/views/carga-comprobantes.html'),
  'utf8'
);
const script = fs.readFileSync(
  path.join(__dirname, '../public/metricas-v2/js/views/carga-comprobantes.page.js'),
  'utf8'
);
const styles = fs.readFileSync(
  path.join(__dirname, '../public/metricas-v2/css/styles.css'),
  'utf8'
);

test('el popup de carga expone progreso y mensajes accesibles', () => {
  assert.match(html, /id="comprobanteCreatingPopup"[\s\S]*role="dialog"[\s\S]*aria-modal="true"/);
  assert.match(html, /id="comprobanteProgressMessage"[\s\S]*role="status"[\s\S]*aria-live="polite"/);
  assert.match(html, /id="comprobanteProgressBar"[\s\S]*role="progressbar"/);
  assert.match(html, /aria-valuemin="0"/);
  assert.match(html, /aria-valuemax="100"/);
  assert.match(html, /id="comprobanteProgressFill"/);
  assert.match(html, /No cierres esta ventana/);
  assert.match(html, /aria-modal="true"[\s\S]*tabindex="-1"/);
});

test('el progreso estimado no llega a 100 antes de la respuesta real', () => {
  assert.match(script, /const SUBMISSION_PROGRESS_MAX_PENDING = 92;/);
  assert.match(script, /progress = Math\.min\(SUBMISSION_PROGRESS_MAX_PENDING/);

  const requestPosition = script.indexOf('await api.createComprobanteManual(payload)');
  const completedPosition = script.indexOf('completeSubmissionProgress(response.created.length)');
  const hundredPosition = script.indexOf('value: 100');
  assert.ok(requestPosition >= 0, 'debe existir la llamada de creación');
  assert.ok(completedPosition > requestPosition, 'el 100% debe aplicarse después de recibir la respuesta');
  assert.ok(hundredPosition >= 0, 'debe existir el estado final de 100%');
});

test('la carga múltiple informa etapas y evita envíos duplicados', () => {
  assert.match(script, /Guardando \$\{count\} \$\{recordPlural\}/);
  assert.match(script, /Los pagos se están guardando en la base de datos/);
  assert.match(script, /cada registro y archivo se guarda por separado/);
  assert.match(script, /SUBMISSION_LONG_WAIT_ROTATION_MS/);
  assert.match(script, /Seguimos guardando la información/);
  assert.ok(
    script.match(/if \(state\.isSubmitting\) return;/g)?.length >= 2,
    'el submit y la confirmación deben bloquear duplicados'
  );
  assert.match(script, /finally \{[\s\S]*stopSubmissionProgress\(\);[\s\S]*removeAttribute\('aria-busy'\)/);
  assert.match(script, /refs\.form\.inert = true/);
  assert.match(script, /refs\.form\.inert = false/);
  assert.match(script, /refs\.creatingPopup\.focus\(\{ preventScroll: true \}\)/);
});

test('la barra contempla tema oscuro, móvil y movimiento reducido', () => {
  assert.match(styles, /\.carga-progress-fill[\s\S]*transition: width 240ms ease/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.carga-progress-fill/);
  assert.match(styles, /:root\[data-theme='dark'\] \.carga-progress-track/);
  assert.match(styles, /@media \(max-width: 860px\)[\s\S]*\.carga-creating-card/);
  assert.match(styles, /\.carga-creating-card[\s\S]*max-height:[\s\S]*overflow-y: auto/);
  assert.match(styles, /\.loading-popup\.is-complete \.carga-progress-fill/);
  assert.match(styles, /\.loading-popup\.is-error \.carga-progress-fill/);
});
