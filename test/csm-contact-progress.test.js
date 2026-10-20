const test=require('node:test'),assert=require('node:assert/strict');
const {progress,fields}=require('../modules/csm/contact-summary');
test('progreso distingue módulo iniciado, finalizado y sesiones independientes',()=>{
 const result=progress({modulo_1:'2026-10-01',modulo_1_fin:'2026-10-03',modulo_3:'2026-10-10',f_diagnostico:'2026-10-05'});
 assert.equal(result.current,3);assert.equal(result.completed,1);assert.equal(result.modules[1].completed,false);
 assert.equal(result.sessions.find(s=>s.label==='Diagnóstico').date,'05/10/2026');
 assert(fields.includes('modulo_10_fin'));
});
test('sin ficha, fechas inválidas y fin anterior a inicio no inventan avance',()=>{
 assert.equal(progress(null),null);assert.equal(progress({}).current,null);
 assert.equal(progress({modulo_1:'2026-10-10',modulo_1_fin:'2026-10-01'}).completed,0);
 assert.equal(progress({modulo_1:'2026-02-30'}).current,null);
 assert.equal(progress({progreso_curso:'90%'}).completed,0);
});
