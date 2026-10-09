const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require.resolve('../public/metricas-v2/js/views/dashboard.page.js'), 'utf8');

function setup(state) {
  const timers = new Map();
  let nextId = 0;
  const loader = { hidden: false, classList: { add() {} } };
  const context = vm.createContext({
    refs: { welcomeLoader: loader },
    welcomeSpeechState: state, welcomeLoaderClosing: false,
    welcomeLoaderReadyToClose: false, welcomeCloseTimeout: null,
    welcomeSpeechTimeout: null, startDashboardEffects() {},
    window: {
      setTimeout(fn, delay) { timers.set(++nextId, { fn, delay }); return nextId; },
      clearTimeout(id) { timers.delete(id); },
      speechSynthesis: { cancel() {} }
    }
  });
  for (const name of ['setWelcomeSoundState', 'finishWelcomeLoaderWhenReady', 'closeWelcomeLoader']) {
    const start = source.indexOf(`  function ${name}(`);
    const end = source.indexOf('\n  function ', start + 1);
    vm.runInContext(source.slice(start, end), context);
  }
  function flush() {
    while (timers.size) {
      const [id, timer] = [...timers].sort((a, b) => a[1].delay - b[1].delay)[0];
      timers.delete(id);
      timer.fn();
    }
  }
  return { context, loader, flush };
}

for (const state of ['blocked', 'idle', 'silent', 'started', 'pending', 'waiting']) {
  test(`la bienvenida se cierra con datos listos y voz ${state}`, () => {
    const { context, loader, flush } = setup(state);
    context.closeWelcomeLoader();
    flush();
    assert.equal(loader.hidden, true);
  });
}

test('un error de voz posterior a la carga desbloquea el panel', () => {
  const { context, loader, flush } = setup('pending');
  context.closeWelcomeLoader();
  context.setWelcomeSoundState('blocked', 'Escuchar bienvenida');
  assert.equal(context.welcomeLoaderClosing, true);
  flush();
  assert.equal(loader.hidden, true);
});

test('el bloqueo de audio no cierra la bienvenida antes de cargar los datos', () => {
  const { context, loader, flush } = setup('pending');
  context.setWelcomeSoundState('blocked', 'Escuchar bienvenida');
  flush();
  assert.equal(loader.hidden, false);
  context.closeWelcomeLoader();
  flush();
  assert.equal(loader.hidden, true);
});
