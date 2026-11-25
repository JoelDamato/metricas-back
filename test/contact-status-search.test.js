const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const { searchContacts, _test } = require('../modules/csm/contact-search');
const { classifyQuery, filtersFor } = _test;

test('el buscador reconoce mail, teléfono, GHL ID y nombre', () => {
  assert.equal(classifyQuery('ab'), null);
  assert.deepEqual(classifyQuery('  PaoPesara@Gmail.com '), { kind: 'email', q: 'paopesara@gmail.com' });
  assert.deepEqual(classifyQuery('+54 9 351 314-8871'), { kind: 'phone', q: '3148871' });
  assert.deepEqual(classifyQuery('0351 15 314 8871'), { kind: 'phone', q: '3148871' });
  assert.equal(classifyQuery('v8VEe7k9Huub94XJ6E9j').kind, 'ghlId');
  assert.deepEqual(classifyQuery('paola  pesara'), { kind: 'name', q: 'paola pesara' });
  assert.equal(classifyQuery('lautarolodeiro').kind, 'name');
});

test('los filtros no dejan pasar caracteres que rompen la consulta', () => {
  assert.deepEqual(filtersFor({ kind: 'name', q: 'paola,pesara)' }), { and: '(or(nombre.ilike.*p__l_*,mail.ilike.*paola*),or(nombre.ilike.*p_s_r_*,mail.ilike.*pesara*))' });
  assert.equal(filtersFor({ kind: 'name', q: '*,' }), null);
  assert.deepEqual(filtersFor({ kind: 'phone', q: '3148871' }), { telefono: 'ilike.*3148871*' });
});

test('une CSM y leads por GHL ID, prioriza clientes y saca los de prueba', async (t) => {
  const calls = [];
  t.mock.method(axios, 'get', async (url, { params }) => {
    calls.push({ url, params });
    if (url.endsWith('/csm')) return { data: [{ ghlid: 'B', nombre: 'Paola Pesara', mail: 'pao@x.com', telefono: '', ultimo_producto_adquirido: 'MEG' }] };
    return { data: [
      { ghlid: 'A', nombre: 'Paola Gómez', mail: 'pg@x.com', telefono: '+5491111111111', etapa: 'Agendado' },
      { ghlid: 'B', nombre: 'Paola Pesara', mail: 'pao@x.com', telefono: '+543513148871', etapa: 'Venta' },
      { ghlid: 'TEST-1', nombre: 'Paola Test', mail: '', telefono: '', etapa: '' }
    ] };
  });
  const { query, results } = await searchContacts('paola', { supabaseUrl: 'https://s', headers: {} });
  assert.equal(query.kind, 'name');
  assert.equal(calls.length, 2);
  assert.deepEqual(results.map(r => r.ghlId), ['B', 'A']);
  assert.equal(results[0].etapa, 'Cliente · MEG');
  assert.equal(results[0].telefono, '+543513148871');
});
