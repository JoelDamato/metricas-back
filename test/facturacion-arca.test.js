const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const axios = require('axios');
const { PGlite } = require('@electric-sql/pglite');

const service = require('../modules/metricasv2/services/facturacion-arca.service');
const env = require('../modules/metricasv2/config/env');
const { isEligible, isBilled } = service._test;

const ID = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

function installEnv(t) {
  const previous = { supabaseUrl: env.supabaseUrl, supabaseKey: env.supabaseKey };
  env.supabaseUrl = 'https://supabase.arca.test';
  env.supabaseKey = 'test-service-key';
  service._test.resetAuthorColumn();
  t.after(() => Object.assign(env, previous));
}

const base = { tipo_banco: 'Propia', f_acreditacion: '2026-11-03T00:00:00+00:00', producto_format: 'Meg 2.1', medios_de_pago_format: 'Mercado Pago' };

test('entran sólo cuentas propias desde el 1/11, sin Club, Efectivo ni PayPal (Exentos sí)', () => {
  assert.equal(isEligible(base), true);
  assert.equal(isEligible({ ...base, medios_de_pago_format: 'Exentos' }), true);
  assert.equal(isEligible({ ...base, medios_de_pago_format: 'E-cheq Bco Frances' }), true);
  assert.equal(isEligible({ ...base, f_acreditacion: '2026-11-01T00:00:00+00:00' }), true);
  assert.equal(isEligible({ ...base, f_acreditacion: '2026-10-31T23:00:00+00:00' }), false);
  assert.equal(isEligible({ ...base, f_acreditacion: null }), false);
  assert.equal(isEligible({ ...base, tipo_banco: 'Financiera' }), false);
  assert.equal(isEligible({ ...base, producto_format: 'Club' }), false);
  assert.equal(isEligible({ ...base, producto_format: 'Renovación - Club' }), false);
  assert.equal(isEligible({ ...base, medios_de_pago_format: 'Club - Transferencias', producto_format: '' }), false);
  assert.equal(isEligible({ ...base, medios_de_pago_format: 'Efectivo' }), false);
  assert.equal(isEligible({ ...base, medios_de_pago_format: 'Paypal' }), false);
  assert.equal(isBilled({ facturacion_arca: 'true' }), true);
  assert.equal(isBilled({ facturacion_arca: 'false' }), false);
  assert.equal(isBilled({ facturacion_arca: null }), false);
});

test('lista con filtro en la base y separa pendientes de facturados', async (t) => {
  installEnv(t);
  const original = axios.get; t.after(() => { axios.get = original; });
  let params;
  axios.get = async (url, options) => {
    params = options.params;
    return { data: [
      { ...base, id: ID(1), facturacion_arca: null, info_comprobantes: '' },
      { ...base, id: ID(2), facturacion_arca: 'true', facturado_arca_por: 'Nadia', info_comprobantes: '' },
      { ...base, id: ID(3), medios_de_pago_format: 'Efectivo' },
      { ...base, id: ID(4), producto_format: 'Club' }
    ] };
  };
  const result = await service.listArcaComprobantes();
  assert.equal(params.tipo_banco, 'eq.Propia');
  assert.equal(params.f_acreditacion, 'gte.2026-11-01');
  assert.match(params.select, /facturado_arca_por/);
  assert.deepEqual(result.rows.map((row) => row.id), [ID(1), ID(2)]);
  assert.deepEqual(result.summary, { all: 2, pending: 1, billed: 1 });
  assert.equal(result.rows[1].facturado_arca_por, 'Nadia');
});

test('antes de la migración lista igual, sin la columna del autor', async (t) => {
  installEnv(t);
  const original = axios.get; t.after(() => { axios.get = original; });
  let calls = 0;
  axios.get = async (url, options) => {
    calls += 1;
    if (options.params.select.includes('facturado_arca_por')) {
      const error = new Error('400'); error.response = { data: { message: 'column comprobantes.facturado_arca_por does not exist' } }; throw error;
    }
    return { data: [{ ...base, id: ID(1) }] };
  };
  const result = await service.listArcaComprobantes();
  assert.equal(calls, 2);
  assert.equal(result.rows.length, 1);
  assert.equal(result.canRecordAuthor, false);
});

test('marcar valida que el comprobante esté en la lista y guarda quién', async (t) => {
  installEnv(t);
  const get = axios.get, post = axios.post; t.after(() => { axios.get = get; axios.post = post; });
  axios.get = async (url, options) => ({ data: options.params.id.includes(ID(9)) ? [{ ...base, id: ID(9), medios_de_pago_format: 'Efectivo' }] : [{ ...base, id: ID(1) }] });
  let sent;
  axios.post = async (url, body) => { sent = { url, body }; return { data: { rows: [{ id: ID(1), facturacion_arca: body.p_billed ? 'true' : null, facturado_arca_por: 'Nadia' }] } }; };
  const result = await service.setArcaBilled({ ids: [ID(1)], billed: true }, { nombre: 'Nadia', email: 'nadia@example.test' });
  assert(sent.url.endsWith('/rpc/metricas_set_arca_billed'));
  assert.deepEqual(sent.body, { p_ids: [ID(1)], p_billed: true, p_author: 'Nadia' });
  assert.equal(result.rows[0].facturado_arca, true);
  await assert.rejects(service.setArcaBilled({ ids: [ID(9)], billed: true }, { nombre: 'Nadia' }), { statusCode: 409 });
  await assert.rejects(service.setArcaBilled({ ids: [], billed: true }, { nombre: 'Nadia' }), { statusCode: 400 });
  await assert.rejects(service.setArcaBilled({ ids: ['x;drop'], billed: true }, { nombre: 'Nadia' }), { statusCode: 400 });
  await assert.rejects(service.setArcaBilled({ ids: [ID(1)], billed: 'si' }, { nombre: 'Nadia' }), { statusCode: 400 });
});

test('la función de la base pasa el guard de comprobantes, es reversible, audita y no toca cuentas financieras', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;
      create table leads_raw(id text primary key, facturacion_total numeric, cash_collected_total numeric, saldo numeric);
      create table comprobantes(id text primary key, tipo text, cliente text, ghlid text, venta_relacionada text, tipo_banco text,
        facturacion_arca text, fecha_facturado timestamptz, estado text);`);
    const runtime = fs.readFileSync('supabase/migrations/20261003120000_comprobantes_internal_runtime.sql', 'utf8');
    // Sólo hace falta el guard y sus tablas de control; el resto del runtime no interviene acá.
    await db.exec(runtime.slice(0, runtime.indexOf('create trigger metricas_lead_totals_guard_v2')) + 'commit;');
    await db.exec(fs.readFileSync('supabase/migrations/20261126120000_facturacion_arca.sql', 'utf8'));
    await db.exec(`set metricas.receipt_write='on';
      insert into comprobantes(id,tipo_banco,estado) values('a','Propia','Conciliado'),('b','Financiera',null);
      insert into comprobantes_control_v2(id) values('a'),('b');
      reset metricas.receipt_write;`);
    // Un PATCH suelto no pasa el guard: por eso la función.
    await db.exec(`update comprobantes set facturacion_arca='true' where id='a'`);
    assert.equal((await db.query(`select facturacion_arca from comprobantes where id='a'`)).rows[0].facturacion_arca, null);

    const run = (ids, billed) => db.query('select metricas_set_arca_billed($1::text[],$2,$3) r', [ids, billed, 'Nadia']);
    const marked = (await run(['a', 'b'], true)).rows[0].r.rows;
    assert.deepEqual(marked.map((row) => row.id), ['a']);
    let row = (await db.query(`select * from comprobantes where id='a'`)).rows[0];
    assert.equal(row.facturacion_arca, 'true');
    assert.equal(row.facturado_arca_por, 'Nadia');
    assert(row.fecha_facturado);
    assert.equal(row.estado, 'Conciliado');
    assert.equal((await db.query(`select facturacion_arca from comprobantes where id='b'`)).rows[0].facturacion_arca, null);

    await run(['a'], false);
    row = (await db.query(`select * from comprobantes where id='a'`)).rows[0];
    assert.equal(row.facturacion_arca, null);
    assert.equal(row.fecha_facturado, null);
    assert.equal(row.facturado_arca_por, null);

    const events = (await db.query(`select action, actor_email from comprobantes_eventos_v2 order by id`)).rows;
    assert.deepEqual(events.map((event) => event.action), ['arca_facturado', 'arca_pendiente']);
    await assert.rejects(run([], true), /inválida/);
    await db.exec('set role anon');
    await assert.rejects(run(['a'], true), /permission denied/);
  } finally { await db.close(); }
});
