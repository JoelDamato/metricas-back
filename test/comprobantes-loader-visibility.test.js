const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

const comprobantesLoaderService = require('../modules/metricasv2/services/comprobantes-loader.service');
const env = require('../modules/metricasv2/config/env');

const MATI = { email: 'matirandazzo@gmail.com', nombre: 'Mati Randazzo' };
const NADIA = { email: 'nadia.cavallini@gmail.com', nombre: 'Nadia Cavallini' };
const MAURO = { email: 'gaitanmauro23@gmail.com', nombre: 'Mauro Gaitan' };
const NAHUEL = { email: 'nahuerandazzo@gmail.com', nombre: 'Nahue Randazzo' };

function installSupabaseMock(t, rows, onRequest = () => {}) {
  const previousEnv = {
    supabaseUrl: env.supabaseUrl,
    supabaseKey: env.supabaseKey
  };
  env.supabaseUrl = 'https://supabase.visibility.test';
  env.supabaseKey = 'test-supabase-service-key';
  t.after(() => Object.assign(env, previousEnv));

  t.mock.method(axios, 'get', async (url, config = {}) => {
    assert.equal(url, 'https://supabase.visibility.test/rest/v1/comprobantes');
    onRequest(config.params || {});
    return { data: rows };
  });
}

test('Mati y Nadia tienen vista global de comprobantes; el resto no', () => {
  const { canViewAllComprobantes } = comprobantesLoaderService._test;

  assert.equal(canViewAllComprobantes(MATI), true);
  assert.equal(canViewAllComprobantes(NADIA), true);
  assert.equal(canViewAllComprobantes(MAURO), false);
});

test('cada vendedor recibe sólo sus comprobantes cargados', async (t) => {
  let requestParams = null;
  installSupabaseMock(t, [
    { id: 'own', responsable_venta: 'Mauro Gaitan', cliente_format: 'Cliente propio' }
  ], (params) => {
    requestParams = params;
  });

  const result = await comprobantesLoaderService.listMyComprobantes(MAURO, { limit: 50 });

  assert.equal(requestParams.responsable_venta, 'eq.Mauro Gaitan');
  assert.equal(result.canViewAll, false);
  assert.equal(result.selectedResponsible, 'Mauro Gaitan');
  assert.deepEqual(result.rows.map((row) => row.id), ['own']);
  assert.deepEqual(result.rows.map((row) => row.accessScope), ['mine']);
});

test('Nadia puede ver todos o filtrar por responsable', async (t) => {
  const requestParams = [];
  installSupabaseMock(t, [
    { id: 'mauro', responsable_venta: 'Mauro Gaitan', cliente_format: 'Cliente Mauro' },
    { id: 'nadia', responsable_venta: 'Nadia Cavallini', cliente_format: 'Cliente Nadia' }
  ], (params) => {
    requestParams.push(params);
  });

  const global = await comprobantesLoaderService.listMyComprobantes(NADIA, { limit: 50 });
  const filtered = await comprobantesLoaderService.listMyComprobantes(NADIA, {
    limit: 50,
    responsible: 'Mauro Gaitan'
  });

  assert.equal(requestParams[0].responsable_venta, undefined);
  assert.equal(requestParams[1].responsable_venta, undefined);
  assert.equal(global.canViewAll, true);
  assert.deepEqual(global.rows.map((row) => row.id), ['mauro', 'nadia']);
  assert.deepEqual(global.rows.map((row) => row.accessScope), ['all', 'all']);
  assert.deepEqual(filtered.rows.map((row) => row.id), ['mauro']);
  assert.deepEqual(filtered.responsibleOptions, ['Mauro Gaitan', 'Nadia Cavallini']);
});

test('Nahuel ve sus comprobantes y los que tiene asignados como setter', async (t) => {
  let requestParams = null;
  installSupabaseMock(t, [
    { id: 'own', responsable_venta: 'Nahue Randazzo', setter: 'Otro setter' },
    { id: 'setter', responsable_venta: 'Otro closer', setter: 'Nahue' },
    { id: 'foreign', responsable_venta: 'Otro closer', setter: 'Otro setter' }
  ], (params) => {
    requestParams = params;
  });

  const result = await comprobantesLoaderService.listMyComprobantes(NAHUEL, { limit: 50 });

  assert.equal(requestParams.responsable_venta, undefined);
  assert.match(requestParams.or, /responsable_venta\.eq\.Nahue Randazzo/);
  assert.match(requestParams.or, /setter\.eq\.Nahue/);
  assert.equal(result.canViewAll, false);
  assert.equal(result.canViewBySetter, true);
  assert.deepEqual(result.rows.map((row) => row.id), ['own', 'setter']);
  assert.deepEqual(result.rows.map((row) => row.accessScope), ['mine', 'setter']);
});

test('sólo quien creó un comprobante no conciliado o rebotado puede gestionarlo', () => {
  const { canManageOwnComprobante } = comprobantesLoaderService._test;
  const creator = { nombre: 'Nahuel Iasci' };

  assert.equal(canManageOwnComprobante({ responsable_venta: 'Nahuel Iasci', estado: 'Sin conciliar' }, creator), true);
  assert.equal(canManageOwnComprobante({ info_comprobantes: 'Cargado por: Nahuel Iasci', estado: 'Conciliado' }, creator), false);
  assert.equal(canManageOwnComprobante({ info_comprobantes: 'Cargado por: Nahuel Iasci', estado: 'Conciliado', rebotar_pago: true }, creator), true);
  assert.equal(canManageOwnComprobante({ info_comprobantes: 'Cargado por: Otra persona', responsable_venta: 'Nahuel Iasci', estado: 'Sin conciliar' }, creator), false);
});
