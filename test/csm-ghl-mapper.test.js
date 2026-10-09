const test=require('node:test'),assert=require('node:assert/strict');
const {mapGhlCsm,parseDate}=require('../modules/csm/ghl-csm-mapper');
test('mapea módulos, productos y NPS numérico sin interpretar Sí como nota',()=>{
 const payload={contact_id:'abc',full_name:'Prueba',email:'test@example.test','Producto Adquirido':['Meg','Renovacion'],'NPS - 1':'Si','NPS - 2':'Si','En una escala de 0 a 10, ¿qué tan probable es que recomiendes la Unidad 1 del MEG a otro/a dueño/a de pyme?':'0','F. Inicio MP1':'2026-01-20','F. Inicio MP2':'2026-02-20','F. Inicio MP3':'2026-03-20','modelo de negocio':'','FV - (2) ¿Cuál es tu modelo de negocio? ':'Reventa',Pausa:'',Activos:false};
 const {patch}=mapGhlCsm(payload);assert.equal(patch.modulo_8,'2026-01-20T00:00:00.000Z');assert.equal(patch.modulo_10_format,'20/03/26');assert.equal(patch.productos_adquiridos,'Meg,Renovacion');assert.equal(patch.nps_1,0);assert.ok(!('nps_2'in patch));assert.ok(!('pausa'in patch));assert.equal(patch.activos,false);assert.equal(patch.modelo_negocio,'Reventa');assert.ok(!('id'in patch));
});
test('fechas sin desplazamiento de día y errores conservados como advertencias',()=>{
 assert.equal(parseDate('2026-10-06'),'2026-10-06T00:00:00.000Z');assert.equal(parseDate('2026-02-30'),null);assert.equal(parseDate('06/10/2026'),null);
 const result=mapGhlCsm({'F. Onboarding':'mala',Closer:{id:'x'},'Notion Id':'wrong',customData:{extra:{anything:true}}});assert.deepEqual(result.patch,{});assert.equal(result.warnings.length,2);
});
test('mapea las diez fechas de fin de módulos y pilares',()=>{
 const payload={};for(let n=1;n<=10;n++)payload['F. Fin '+(n<=7?'M'+n:'MP'+(n-7))]='2026-10-06';const {patch,warnings}=mapGhlCsm(payload);assert.equal(warnings.length,0);for(let n=1;n<=10;n++)assert.equal(patch[`modulo_${n}_fin`],'2026-10-06T00:00:00.000Z');
});
