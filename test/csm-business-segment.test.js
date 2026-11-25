const test = require('node:test');
const assert = require('node:assert/strict');
const seg = require('../modules/csm/business-segment');

test('valida modelo y rubro contra las listas de GHL', () => {
  assert.equal(seg.validate('Reventa', 'Dietética'), '');
  assert.match(seg.validate('Reventa', 'Panadería'), /rubro/);
  assert.match(seg.validate('Textil', 'Otros'), /modelo/);
  assert.match(seg.validate('constructor', 'Otros'), /modelo/);
});

test('lee el rubro del campo que corresponde al modelo', () => {
  assert.deepEqual(seg.fromGhlFields({'Modelo de negocio (lista)': 'Servicios', 'Rubro - Servicios': 'Odontología', 'Rubro - Reventa': 'Dietética'}), {modelo: 'Servicios', rubro: 'Odontología'});
  assert.deepEqual(seg.fromGhlFields({'Modelo de negocio (lista)': 'Cualquiera'}), {modelo: '', rubro: ''});
});

test('al guardar vacía los rubros de los otros modelos', () => {
  const f = seg.ghlCustomFields('Eventos', 'Salón de eventos');
  assert.equal(f.length, 6);
  assert.deepEqual(f[0], {id: 'pGc4HWnyqDYZlu1LzuYh', field_value: 'Eventos'});
  assert.equal(f.find(x => x.id === 'gD623hcjviGwKQx3cdtF').field_value, 'Salón de eventos');
  assert.equal(f.filter(x => x.field_value === '').length, 4);
});

const access = require('../modules/auth/access');
access.canAccessPageForUser = () => true;
function res() { return {code: 200, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }}; }
const user = {role: 'csm', email: 'ccm@x'};
const fail = e => { throw e; };

test('save rechaza opciones fuera de lista sin tocar GHL', async () => {
  const calls = [];
  const r = res();
  await seg.save({authUser: user, params: {ghlid: 'abc'}, body: {modelo: 'Reventa', rubro: 'Odontología'}}, r, fail, {ghlKey: 'k', http: {get: async () => calls.push('get'), put: async () => calls.push('put'), post: async () => calls.push('post')}});
  assert.equal(r.code, 400);
  assert.deepEqual(calls, []);
});

test('save no escribe en un contacto de otra cuenta', async () => {
  const calls = [];
  const r = res();
  const http = {get: async () => ({data: {contact: {locationId: 'OTRA'}}}), put: async () => calls.push('put'), post: async () => calls.push('post')};
  await seg.save({authUser: user, params: {ghlid: 'abc'}, body: {modelo: 'Reventa', rubro: 'Dietética'}}, r, fail, {ghlKey: 'k', http});
  assert.equal(r.code, 404);
  assert.deepEqual(calls, []);
});

test('save escribe en GHL y en la tabla del panel', async () => {
  const calls = [];
  const r = res();
  const http = {get: async () => ({data: {contact: {locationId: 'WU2z8kl23Dr3IyBW1hv5'}}}), put: async (url, body) => calls.push(['put', url, body.customFields.length]), post: async (url, body) => calls.push(['post', url, body.modelo, body.rubro, body.updated_by])};
  await seg.save({authUser: user, params: {ghlid: 'abc'}, body: {modelo: 'Gastronomía', rubro: 'Panadería'}}, r, fail, {ghlKey: 'k', http});
  assert.equal(r.code, 200);
  assert.match(calls[0][1], /contacts\/abc$/);
  assert.equal(calls[0][2], 6);
  assert.deepEqual(calls[1].slice(2), ['Gastronomía', 'Panadería', 'ccm@x']);
  assert.equal(r.body.source, 'panel');
});

test('sin permiso no guarda', async () => {
  const r = res();
  await seg.save({authUser: {role: 'closer'}, params: {ghlid: 'abc'}, body: {}}, r, fail, {ghlKey: 'k', http: {}});
  assert.equal(r.code, 403);
});
