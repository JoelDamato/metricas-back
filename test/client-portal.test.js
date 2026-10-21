const {test} = require('node:test');
const assert = require('node:assert/strict');
const {publicPortal,getClientPortal} = require('../controllers/clientPortal');
const {contractLabel} = require('../modules/csm/contact-materials');
const summary = require('../modules/csm/contact-summary');

test('portal público sólo expone nombre, sesiones y carta de rumbo', () => {
  const result = publicPortal('client',{
    nombre:'Cliente',mail:'private@example.com',telefono:'1234',actividad:'Interna',
    contrato:'Con cuotas',facturacion_total:9000,f_costos_1:'2026-07-01'
  },{available:true,fields:{contractType:'Privado'},appointments:[{
    id:'private-id',label:'Costos',date:'2026-07-01',status:'confirmed',
    title:'Nota privada del equipo',notes:'Comentario interno',links:[{url:'https://fathom.video/share/demo',label:'Ver grabación',secret:'privado'}]
  }]},true);
  assert.deepEqual(Object.keys(result),['name','roadmapUrl','csmProgress','csmMaterials']);
  assert.deepEqual(result.csmMaterials.appointments,[{
    label:'Costos',title:'Costos',date:'2026-07-01',status:'confirmed',
    links:[{url:'https://fathom.video/share/demo',label:'Ver grabación'}]
  }]);
  assert.equal(result.roadmapUrl,'/diagnostico/?ghl_id=client&vista=rumbo');
  assert.doesNotMatch(JSON.stringify(result),/private|Privado|privado|9000|Comentario|Interna/);
  assert.equal(publicPortal('client',{}, {available:false,appointments:[]},false).roadmapUrl,null);
});

test('portal rechaza IDs inválidos antes de consultar servicios', async () => {
  const res = {set(){return this;},status(code){this.code=code;return this;},json(body){this.body=body;}};
  await getClientPortal({params:{ghlId:'../other'}},res,error=>{throw error;});
  assert.equal(res.code,400);
  assert.equal(res.body.ok,false);
});

test('contrato con cuotas usa el plan de la última venta, no cuenta las cobranzas', () => {
  const rows = [
    {tipo:'Venta',f_venta:'2026-01-01',cantidad_de_pagos:'6 Pagos'},
    {tipo:'Venta',f_venta:'2026-07-01',cantidad_de_pagos:'3 Pagos'},
    {tipo:'Cobranza',f_venta:'2026-08-01',cantidad_de_pagos:'99 Pagos'}
  ];
  assert.equal(contractLabel('Contrato con cuotas',rows),'Contrato con cuotas · 3 cuotas');
  assert.equal(contractLabel('Contado',rows),'Contado');
  assert.match(contractLabel('Contrato con cuotas',[]),/sin registrar/);
  rows[1].cantidad_de_pagos=null;
  assert.match(contractLabel('Contrato con cuotas',rows),/sin registrar/);
});

test('resumen de CSM ya no contiene Actividad', () => {
  assert(!summary.summary({actividad:'Activo'}).some(item=>item.label==='Actividad'));
});
