const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {linksFromNotes, mapAppointments, fetchContactMaterials, productsForContact} = require('../modules/csm/contact-materials');

test('extrae enlaces de notas de texto/HTML, sin duplicados ni credenciales', () => {
  assert.deepEqual(linksFromNotes('https://fathom.video/share/demo\nInforme: <a href="https://drive.google.com/file/d/demo/view?a=1&amp;b=2">Informe</a>\nhttps://fathom.video/share/demo javascript:alert(1) https://user:password@example.com'), [
    {url:'https://fathom.video/share/demo',label:'Ver grabación'},
    {url:'https://drive.google.com/file/d/demo/view?a=1&b=2',label:'Ver informe'}
  ]);
});

test('conserva sesiones repetidas, canceladas y diagnóstico final; identifica citas por calendario', () => {
  const events = [
    {id:'a',calendarId:'costos',title:'Cliente y soporte',startTime:'2026-07-06 12:00:00',notes:'https://fathom.video/share/demo'},
    {id:'b',title:'Costos Nº1',startTime:'2026-07-01 12:00:00',notes:'https://drive.google.com/file/d/demo'},
    {id:'c',title:'Diagnóstico final',startTime:'2026-10-14',appointmentStatus:'cancelled'},
    {id:'d',title:'Costos',deleted:true,notes:'https://example.com'},
    {id:'e',title:'Otra sesión',startTime:'2026-08-01',notes:'https://example.com/material'}
  ];
  const result = mapAppointments(events,{costos:'Sesión de Costos 1 a 1'});
  assert.deepEqual(result.map(a=>a.id),['b','a','e','c']);
  assert.equal(result[1].label,'Costos');
  assert.equal(result[3].label,'Diagnóstico final');
  assert.equal(result[3].status,'cancelled');
});

test('combina productos históricos y renovaciones sin duplicar', () => {
  assert.deepEqual(productsForContact({productos_adquiridos:'MEG 1.0, MEG 2.1'}, {products:['Meg 2.1']},
    [{tipo:'Venta',producto_format:'Renovación MEG'},{tipo:'Cobranza',producto_format:'No es una compra'}]),
  ['MEG 1.0','Meg 2.1','Renovación MEG']);
});

test('consulta GHL y separa fallos de citas de los campos disponibles', async () => {
  const result = await fetchContactMaterials('client', {key:'test',locationId:'location',request:async url => {
    if(url.endsWith('/appointments')) throw Error('GHL unavailable');
    return {data:{contact:{locationId:'location',customFields:[{id:'O4aDm5mD3cSNVAqqboEl',value:'6 meses'}]}}};
  }});
  assert.equal(result.available,false);
  assert.equal(result.fields.support,'6 meses');
  assert.deepEqual(result.appointments,[]);
});

test('rechaza contactos de otra ubicación y filtra eventos ajenos', async () => {
  const wrong = await fetchContactMaterials('client', {key:'test',locationId:'location',request:async()=>({data:{contact:{locationId:'other'}}})});
  assert.deepEqual(wrong,{available:false,fields:{},appointments:[]});
  const result = await fetchContactMaterials('client', {key:'test',locationId:'location',request:async url => {
    if(url.endsWith('/appointments')) return {data:{events:[
      {id:'own',contactId:'client',title:'Diagnóstico',notes:'https://fathom.video/share/demo'},
      {id:'other',contactId:'other',title:'Diagnóstico',notes:'https://fathom.video/share/private'}
    ]}};
    return {data:{contact:{locationId:'location',customFields:[]}}};
  }});
  assert.deepEqual(result.appointments.map(a=>a.id),['own']);
});

const frontend = fs.readFileSync(require.resolve('../public/contacto-estado/sessions.js'),'utf8');
test('render muestra materiales bajo cada sesión, sin ficha CSM y con errores distinguibles', () => {
  const ctx = vm.createContext({URL});
  vm.runInContext(frontend,ctx);
  const html = ctx.renderSessions({csmMaterials:{available:true,appointments:[
    {label:'Costos',date:'2026-07-01',title:'<img src=x onerror=alert(1)>',links:[{label:'Ver grabación',url:'https://fathom.video/share/demo'}]},
    {label:'Costos',date:'2026-07-06',links:[]}
  ]}});
  assert.doesNotMatch(html,/Compartir materiales/);
  assert.match(html,/<details class="csm-appointment/);
  assert.doesNotMatch(html,/<details[^>]+ open/);
  assert.match(html,/01\/07\/2026/);assert.match(html,/06\/07\/2026/);
  assert.match(html,/Sin grabación ni informe registrados/);
  assert.doesNotMatch(html,/<img/);
  assert.match(ctx.renderSessions({}),/no están disponibles temporalmente/);
});
