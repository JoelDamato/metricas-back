const {test}=require('node:test'),assert=require('node:assert/strict');
const {mapGhlLead,dateValue}=require('../modules/leads/ghl-mapper');
const catalog=require('../modules/leads/ghl-field-catalog.json');
test('fechas conservan día calendario y convierten instantes a Argentina una sola vez',()=>{
 assert.equal(dateValue('2026-10-09'),'2026-10-09');assert.equal(dateValue('09/10/2026'),'2026-10-09');
 assert.equal(dateValue('2026-10-09T03:15:00Z'),'2026-10-09T00:15:00');
 assert.equal(dateValue('2026-10-09T00:15:00-03:00'),'2026-10-09T00:15:00');
 for(const v of ['2026-02-30','31/02/2026','10/09/26',true,123,'mañana','2026-10-09T25:15:00Z'])assert.equal(dateValue(v),null);
});
test('payload completo y nuevos campos preservan valores y tipos sin escribir cálculos financieros',()=>{
 const payload={contact_id:'abc',full_name:'Cliente',email:'a@example.com','Origen Actual':'RT','Primer origen':'Postulacion MEG VSL B','Fecha de agendamiento':'15/09/2026',
 'Lista negra':false,'Cliente viejo':0,Score:0,'Nueva lista':['A','B'],'Nuevo número':12,'Nuevo objeto':{active:false,nested:[1]},'Campo vacío':'',saldo:999,facturacion_total:999,etapa:'Inventada'};
 const r=mapGhlLead(payload);assert.equal(r.patch.fecha_agenda,'2026-09-15');assert.equal(r.patch.lista_negra,false);assert.equal(r.patch.cliente_viejo,false);assert.equal(r.patch.score,0);
 assert.equal(r.patch.origen_actual,'RT');assert.equal(r.patch.primer_origen,'Postulacion MEG VSL B');
 assert(!('saldo' in r.patch));assert(!('facturacion_total' in r.patch));assert(!('etapa' in r.patch));
 assert.deepEqual(r.fields['Nuevo objeto'].value,payload['Nuevo objeto']);assert.equal(r.fields['Nueva lista'].type,'array');assert.equal(r.fields['Nuevo número'].type,'number');assert.equal(r.fields['Campo vacío'].value,'');
});
test('actualizaciones parciales omiten vacíos e inválidos; facturación de encuesta queda como texto',()=>{
 const r=mapGhlLead({nombre:'',Closer:null,'Fecha de llamada':'2026-02-30',Score:'mucho',Facturacion:'Entre 10 y 20 millones','Lista negra':'talvez'});
 assert.deepEqual(r.patch,{facturacion:'Entre 10 y 20 millones'});assert.equal(r.warnings.length,3);
});
test('formato API de contacto con customFields por ID se mapea usando el catálogo',()=>{
 const [key]=Object.entries(catalog).find(([,f])=>f.label==='Fecha de agendamiento');
 const r=mapGhlLead({contact:{id:'abc',firstName:'Ana',lastName:'García',customFields:[{id:key.slice(7),value:'2026-10-09'},{id:'nuevo',value:{x:0}}]}},catalog);
 assert.equal(r.patch.nombre,'Ana García');assert.equal(r.patch.fecha_agenda,'2026-10-09');assert.equal(r.fields[key].declaredType,'DATE');assert.deepEqual(r.fields['custom:nuevo'].value,{x:0});assert(r.warnings.some(w=>w.reason==='unmapped_custom_id_preserved'));
});
test('customData y nombres de campos nuevos no pueden inyectar columnas ni identidades',()=>{
 const r=mapGhlLead({full_name:'Cliente',id:'evil',customData:{ghlid:'evil',archived:true,created_time:'bad',"x');drop table leads_raw;--":42}});
 assert.deepEqual(r.patch,{nombre:'Cliente'});assert.equal(r.fields["x');drop table leads_raw;--"].value,42);
});
test('aliases observados en envíos reales mantienen origen, estrategia, confirmación y productos',()=>{
 const r=mapGhlLead({contact_source:'Postulación MEG - VSL',source:'ghl',date_created:'2026-10-09T03:30:00Z','Estrategia aperturas':'B','Call Confirmer':'Exitoso',Confirmo:'Confirmo','Seguimientos Setting':'2','Seguimiento Closing':'Seguimiento','Producto Adquirido':'["Meg 2.1","Costos Rentables"]'});
 assert.equal(r.patch.origen,'Postulación MEG - VSL');assert.equal(r.patch.estrategia_a,'B');assert.equal(r.patch.call_confirm,'Exitoso');assert.equal(r.patch.confirmo_mensaje,'Confirmo');assert.equal(r.patch.seguimiento_setting,'2');assert.equal(r.patch.producto_adq,'Meg 2.1, Costos Rentables');assert.equal(r.patch.fecha_creada,'2026-10-09T00:30:00');
});
test('campos distintos con el mismo nombre y valores conflictivos no eligen un responsable al azar',()=>{
 const r=mapGhlLead({customFields:[{id:'a',name:'Closer',value:'Carlos'},{id:'b',name:'Closer',value:'Claudio'}]});assert(!('closer' in r.patch));assert(r.warnings.some(w=>w.reason==='ambiguous_field_preserved'));
});
