const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

process.env.SUPABASE_URL = 'https://supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

const axios = require('axios');
const supabaseService = require('../modules/metricasv2/services/supabase.service');

const originalAxiosGet = axios.get;
const originalAxiosPost = axios.post;

test.after(() => {
  axios.get = originalAxiosGet;
  axios.post = originalAxiosPost;
});

function axiosError(status, message) {
  const error = new Error(message);
  error.response = { status, data: { message } };
  return error;
}

function mockAgendaCheckpointStorage(initialEntries = []) {
  let stored = {
    anio: 2026,
    mes: 7,
    entries: initialEntries,
    updated_at: null,
    updated_by_email: null
  };

  axios.get = async () => ({ data: JSON.stringify(stored) });
  axios.post = async (url, body) => {
    if (url.endsWith('/storage/v1/bucket')) {
      throw axiosError(409, 'already exists');
    }

    if (url.includes('/storage/v1/object/')) {
      stored = JSON.parse(Buffer.isBuffer(body) ? body.toString('utf8') : String(body));
      return { data: {} };
    }

    throw new Error(`URL inesperada en la prueba: ${url}`);
  };

  return () => stored;
}

function basePayload(overrides = {}) {
  return {
    anio: 2026,
    mes: 7,
    closer_nombre: 'Carlos Tu',
    detalle: 'Movimiento de prueba',
    ...overrides
  };
}

test('guarda cantidades múltiples y conserva entradas históricas sin cantidad', async () => {
  mockAgendaCheckpointStorage([
    {
      id: 'legacy-check',
      closer_nombre: 'Carlos Tu',
      tipo: 'check',
      detalle: 'Check histórico'
    }
  ]);

  const result = await supabaseService.updateAgendaCheckpoint(basePayload({
    tipo: 'strike',
    cantidad: 3
  }), { email: 'mati@example.com' });

  assert.equal(result.entries.length, 2);
  assert.equal(result.entries[0].tipo, 'strike');
  assert.equal(result.entries[0].cantidad, 3);
  assert.equal(result.entries[1].id, 'legacy-check');
  assert.equal(result.entries[1].cantidad, 1);
});

test('serializa cargas simultáneas del mismo mes para no perder movimientos', async () => {
  const readStored = mockAgendaCheckpointStorage();

  await Promise.all([
    supabaseService.updateAgendaCheckpoint(basePayload({
      tipo: 'check',
      cantidad: 2,
      detalle: 'Carga simultánea A'
    }), { email: 'mati@example.com' }),
    supabaseService.updateAgendaCheckpoint(basePayload({
      tipo: 'strike',
      cantidad: 1,
      detalle: 'Carga simultánea B'
    }), { email: 'leo@example.com' })
  ]);

  assert.equal(readStored().entries.length, 2);
  assert.deepEqual(
    readStored().entries.map((entry) => entry.tipo).sort(),
    ['check', 'strike']
  );
});

test('suma y resta pendientes parcialmente sin afectar el contrato de checks', async () => {
  const readStored = mockAgendaCheckpointStorage();

  const added = await supabaseService.updateAgendaCheckpoint(basePayload({
    tipo: 'pendiente',
    operacion: 'sumar',
    cantidad: 5
  }), { email: 'leo@example.com' });
  const addition = added.entries[0];

  assert.equal(addition.tipo, 'pendiente');
  assert.equal(addition.operacion, 'sumar');
  assert.equal(addition.cantidad, 5);

  const resolved = await supabaseService.updateAgendaCheckpoint(basePayload({
    tipo: 'pendiente',
    operacion: 'restar',
    cantidad: 2
  }), { email: 'leo@example.com' });
  const resolution = resolved.entries[0];

  assert.equal(resolution.tipo, 'pendiente');
  assert.equal(resolution.operacion, 'restar');
  assert.equal(resolution.cantidad, 2);
  assert.equal(readStored().entries.length, 2);

  await assert.rejects(
    () => supabaseService.updateAgendaCheckpoint(basePayload({
      action: 'delete',
      id: addition.id
    }), { email: 'leo@example.com' }),
    (error) => error.statusCode === 409 && /saldo de pendientes negativo/.test(error.message)
  );

  const withoutResolution = await supabaseService.updateAgendaCheckpoint(basePayload({
    action: 'delete',
    id: resolution.id
  }), { email: 'leo@example.com' });
  assert.equal(withoutResolution.entries.length, 1);

  const empty = await supabaseService.updateAgendaCheckpoint(basePayload({
    action: 'delete',
    id: addition.id
  }), { email: 'leo@example.com' });
  assert.equal(empty.entries.length, 0);
});

test('rechaza cantidades inválidas y no permite resolver más pendientes que el saldo', async () => {
  mockAgendaCheckpointStorage([
    {
      id: 'pending-3',
      closer_nombre: 'Carlos Tu',
      tipo: 'pendiente',
      operacion: 'sumar',
      cantidad: 3,
      detalle: 'Pendientes abiertos'
    }
  ]);

  for (const cantidad of [0, -1, 1.5, 51, 'abc']) {
    await assert.rejects(
      () => supabaseService.updateAgendaCheckpoint(basePayload({ tipo: 'check', cantidad }), {}),
      (error) => error.statusCode === 400 && /entero entre 1 y 50/.test(error.message)
    );
  }

  await assert.rejects(
    () => supabaseService.updateAgendaCheckpoint(basePayload({
      tipo: 'pendiente',
      operacion: 'restar',
      cantidad: 4
    }), {}),
    (error) => error.statusCode === 400 && /saldo actual es 3/.test(error.message)
  );

  await assert.rejects(
    () => supabaseService.updateAgendaCheckpoint(basePayload({
      tipo: 'pendiente',
      operacion: 'ajustar',
      cantidad: 1
    }), {}),
    (error) => error.statusCode === 400 && /sumar o restar/.test(error.message)
  );
});

test('el resumen de la pantalla mantiene pendientes separados del puntaje', () => {
  const viewPath = path.join(__dirname, '../public/metricas-v2/views/mag-sistema-agendas.html');
  const html = fs.readFileSync(viewPath, 'utf8');
  const start = html.indexOf('function summarizeStrikeEntries(entries=[])');
  const end = html.indexOf('function formatStrikeScore(score)', start);

  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const context = {
    closers: [{ name: 'Carlos Tu' }],
    normalizeText: (value) => String(value || '').trim().toLowerCase()
  };
  vm.createContext(context);
  vm.runInContext(html.slice(start, end), context);

  const [summary] = context.summarizeStrikeEntries([
    { closer_nombre: 'Carlos Tu', tipo: 'check', cantidad: 3 },
    { closer_nombre: 'Carlos Tu', tipo: 'strike', cantidad: 1 },
    { closer_nombre: 'Carlos Tu', tipo: 'pendiente', operacion: 'sumar', cantidad: 5 },
    { closer_nombre: 'Carlos Tu', tipo: 'pendiente', operacion: 'restar', cantidad: 2 }
  ]);

  assert.deepEqual(
    JSON.parse(JSON.stringify(summary)),
    { name: 'Carlos Tu', checks: 3, strikes: 1, pendientes: 3, total: 2 }
  );
});

test('mantiene los movimientos de CSM separados de los de agendas', async () => {
  const objects = new Map();
  axios.get = async (url) => {
    if (!objects.has(url)) throw axiosError(404, 'not found');
    return { data: objects.get(url) };
  };
  axios.post = async (url, body) => {
    if (url.endsWith('/storage/v1/bucket')) throw axiosError(409, 'already exists');
    objects.set(url, Buffer.isBuffer(body) ? body.toString('utf8') : String(body));
    return { data: {} };
  };

  await supabaseService.updateAgendaCheckpoint(basePayload({
    tipo: 'check',
    cantidad: 2,
    area: 'agendas'
  }), { email: 'mati@example.com' });
  await supabaseService.updateAgendaCheckpoint(basePayload({
    tipo: 'strike',
    cantidad: 1,
    area: 'csm',
    closer_nombre: 'Sofia Gallardo'
  }), { email: 'mati@example.com' });

  const agendas = await supabaseService.getAgendaCheckpoints({ anio: 2026, mes: 7, area: 'agendas' });
  const csm = await supabaseService.getAgendaCheckpoints({ anio: 2026, mes: 7, area: 'csm' });

  assert.equal(agendas.area, 'agendas');
  assert.deepEqual(agendas.entries.map((entry) => entry.tipo), ['check']);
  assert.equal(csm.area, 'csm');
  assert.deepEqual(csm.entries.map((entry) => entry.tipo), ['strike']);
  assert.notEqual(
    [...objects.keys()].find((url) => url.includes('/config/agendas/')),
    [...objects.keys()].find((url) => url.includes('/config/csm/'))
  );
});

test('activa el bono de USD 40 al alcanzar 40% del cash mensual', () => {
  const viewPath = path.join(__dirname, '../public/metricas-v2/views/mag-sistema-agendas.html');
  const html = fs.readFileSync(viewPath, 'utf8');
  const start = html.indexOf('function monthTotal(c)');
  const end = html.indexOf('/* ═══ RENDER ALL ═══ */', start);
  const context = {
    weeks: [{}, {}],
    MONTHLY_CASH_SHARE_BONUS_PCT: 40,
    MONTHLY_CASH_SHARE_BONUS_USD: 40,
    closers: [
      { name: 'Closer A', weeks: [200, 200] },
      { name: 'Closer B', weeks: [300, 300] }
    ]
  };

  vm.createContext(context);
  vm.runInContext(html.slice(start, end), context);
  const rows = context.getMonthlyCashShareBonusRows();

  assert.equal(rows.find((row) => row.name === 'Closer A').sharePct, 40);
  assert.equal(rows.find((row) => row.name === 'Closer A').active, true);
  assert.equal(rows.find((row) => row.name === 'Closer A').bonus, 40);
  assert.equal(rows.find((row) => row.name === 'Closer B').bonus, 40);
});
