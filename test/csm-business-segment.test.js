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
  assert.deepEqual(seg.fromGhlFields({'Modelo de negocio (lista)': 'Servicios', 'Rubro - Servicios': 'Odontología', 'Rubro - Reventa': 'Dietética'}), {modelo: 'Servicios', rubro: 'Odontología', modelo_codigo: 'SER', rubro_codigo: 'SER-07'});
  assert.deepEqual(seg.fromGhlFields({'Modelo de negocio (lista)': 'Cualquiera'}), {modelo: '', rubro: '', modelo_codigo: '', rubro_codigo: ''});
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

// TA-8962: código fijo por modelo y rubro.
test('cada modelo y rubro tiene un código único con el formato fijo y Otros = 99', () => {
  const codes = new Set();
  for (const m of seg.MODELOS) {
    assert.match(m.codigo, /^[A-Z]{3}$/);
    assert.ok(!codes.has(m.codigo)); codes.add(m.codigo);
    for (const x of m.rubros) {
      assert.match(x.codigo, new RegExp(`^${m.codigo}-\\d{2}$`));
      assert.ok(!codes.has(x.codigo), `código repetido ${x.codigo}`); codes.add(x.codigo);
      x.codigosAntes.forEach(c => { assert.ok(!codes.has(c), `código reutilizado ${c}`); codes.add(c); });
    }
    assert.equal(m.rubros.find(x => x.nombre === 'Otros').codigo, `${m.codigo}-99`);
  }
});

test('los códigos de hoy no cambian (no se reasignan al reordenar la lista)', () => {
  assert.equal(seg.resolve('Reventa', 'Dietética').rubro_codigo, 'REV-03');
  assert.equal(seg.resolve('Servicios', 'Odontología').rubro_codigo, 'SER-07');
  assert.equal(seg.resolve('Gastronomía', 'Panadería').rubro_codigo, 'GAS-02');
  assert.equal(seg.resolve('Fabricación', 'Metalúrgica').rubro_codigo, 'FAB-03');
  assert.equal(seg.resolve('Eventos', 'Salón de eventos').rubro_codigo, 'EVE-03');
});

test('el mismo rubro en dos modelos tiene códigos distintos', () => {
  assert.equal(seg.resolve('Reventa', 'Automotriz').rubro_codigo, 'REV-13');
  assert.equal(seg.resolve('Fabricación', 'Automotriz').rubro_codigo, 'FAB-15');
});

test('reconoce por código, sin importar tildes ni mayúsculas', () => {
  assert.deepEqual(seg.resolve('REV', 'REV-03'), {modelo: 'Reventa', rubro: 'Dietética', modelo_codigo: 'REV', rubro_codigo: 'REV-03'});
  assert.equal(seg.resolve('gastronomia', 'panaderia').rubro_codigo, 'GAS-02');
  assert.equal(seg.resolve('Reventa', 'Panadería').rubro_codigo, '');
});

test('si se renombra una opción, el contacto con el nombre viejo sigue en el mismo código', () => {
  const x = seg.MODELOS.find(m => m.codigo === 'REV').rubros.find(y => y.codigo === 'REV-03');
  const before = {nombre: x.nombre, antes: x.antes};
  try {
    x.nombre = 'Dietética y almacén natural'; x.antes = ['Dietética'];
    // GHL todavía tiene contactos con el texto viejo:
    assert.deepEqual(seg.fromGhlFields({'Modelo de negocio (lista)': 'Reventa', 'Rubro - Reventa': 'Dietética'}), {modelo: 'Reventa', rubro: 'Dietética y almacén natural', modelo_codigo: 'REV', rubro_codigo: 'REV-03'});
    // Lo guardado en el panel muestra el nombre nuevo:
    assert.equal(seg.fromRow({ghlid: 'a', modelo: 'Reventa', rubro: 'Dietética', modelo_codigo: 'REV', rubro_codigo: 'REV-03'}).rubro, 'Dietética y almacén natural');
    // Al guardar, a GHL va el nombre de hoy:
    assert.equal(seg.ghlCustomFields('Reventa', 'Dietética').find(f => f.id === 'BxdcPnDR3Km3eTPJeRnY').field_value, 'Dietética y almacén natural');
  } finally { Object.assign(x, before); }
});

test('si se unifican dos rubros, el código absorbido apunta al que queda', () => {
  const m = seg.MODELOS.find(y => y.codigo === 'SER');
  const salud = m.rubros.find(y => y.codigo === 'SER-05');
  const idx = m.rubros.findIndex(y => y.codigo === 'SER-06');
  const [clinica] = m.rubros.splice(idx, 1);
  try {
    salud.antes = ['Clínica estética']; salud.codigosAntes = ['SER-06'];
    assert.equal(seg.fromRow({modelo_codigo: 'SER', rubro_codigo: 'SER-06'}).rubro_codigo, 'SER-05');
    assert.equal(seg.resolve('Servicios', 'Clínica estética').rubro, 'Salud y bienestar');
  } finally { salud.antes = []; salud.codigosAntes = []; m.rubros.splice(idx, 0, clinica); }
});

test('filas viejas sin código se resuelven por nombre', () => {
  assert.equal(seg.fromRow({ghlid: 'a', modelo: 'Eventos', rubro: 'Fotografía y video'}).rubro_codigo, 'EVE-05');
});

test('save guarda los códigos en la tabla del panel', async () => {
  const posts = [];
  const r = res();
  const http = {get: async () => ({data: {contact: {locationId: 'WU2z8kl23Dr3IyBW1hv5'}}}), put: async () => {}, post: async (url, body) => posts.push(body)};
  await seg.save({authUser: user, params: {ghlid: 'abc'}, body: {modelo: 'Servicios', rubro: 'Odontología'}}, r, fail, {ghlKey: 'k', http});
  assert.equal(r.code, 200);
  assert.equal(posts[0].modelo_codigo, 'SER');
  assert.equal(posts[0].rubro_codigo, 'SER-07');
  assert.equal(r.body.rubro_codigo, 'SER-07');
});
