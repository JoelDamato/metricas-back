const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const script = fs.readFileSync(path.join(__dirname, '../public/metricas-v2/js/views/carga-comprobantes.page.js'), 'utf8');
const renderPreview = script.slice(script.indexOf('  function renderPreview(payload)'), script.indexOf('  function closeSuccessPopup()'));

function previewContext({ submitting = false, warnings = [] } = {}) {
  const context = {
    state: { isSubmitting: submitting },
    refs: {
      previewAlerts: {}, previewGrid: {},
      previewSection: { hidden: true, scrollIntoView() {} },
      // Same state left by confirmSubmit after a successful submission.
      confirmSubmitBtn: { disabled: true }, editPreviewBtn: { disabled: true }
    },
    buildPreviewWarnings: () => warnings,
    countDraftOperations: () => 1,
    previewRowsFromPayload: () => [],
    escapeHtml: value => value
  };
  vm.createContext(context);
  vm.runInContext(renderPreview + '\nrenderPreview({});', context);
  return context.refs;
}

test('una nueva revisión rehabilita confirmar y editar después de la carga anterior', () => {
  const refs = previewContext();
  assert.equal(refs.previewSection.hidden, false);
  assert.equal(refs.confirmSubmitBtn.disabled, false);
  assert.equal(refs.editPreviewBtn.disabled, false);
});

test('la revisión no habilita otro envío mientras se está guardando', () => {
  const refs = previewContext({ submitting: true });
  assert.equal(refs.confirmSubmitBtn.disabled, true);
  assert.equal(refs.editPreviewBtn.disabled, true);
});

test('una revisión con advertencias permite editar pero no confirmar', () => {
  const refs = previewContext({ warnings: ['Falta adjuntar el comprobante.'] });
  assert.equal(refs.confirmSubmitBtn.disabled, true);
  assert.equal(refs.editPreviewBtn.disabled, false);
  assert.match(refs.previewAlerts.innerHTML, /Falta adjuntar/);
});
