const {test}=require('node:test'),assert=require('node:assert/strict');
const {summary}=require('../modules/csm/contact-summary');
test('contacto muestra todas las sesiones CSM, estados y fechas sin inferir asistencia',()=>{
 const rows=summary({f_diagnostico:'2026-10-20T00:00:00Z',costos_1:'Agendado',f_costos_1:'2026-10-22',cashflow:'Cancelada',f_cashflow:'2026-10-03',modulo_1:'2026-09-02'});
 const value=label=>rows.find(r=>r.label===label).value;
 assert.equal(value('Diagnóstico'),'Fecha registrada · 20/10/2026');
 assert.equal(value('Costos 1'),'Agendado · 22/10/2026');
 assert.equal(value('Cashflow'),'Cancelada · 03/10/2026');
 assert.equal(value('Coaching'),'Sin sesión registrada');
 assert.equal(value('Módulo 1'),'02/09/2026');
 assert.equal(summary(null)[0].value,'Sin ficha CSM');
});
