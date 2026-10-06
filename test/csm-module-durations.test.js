const test=require('node:test'),assert=require('node:assert/strict');const {calculate,build}=require('../public/metricas-v2/js/views/csm-module-durations');
test('duración exacta y ventana cerrada usan fechas reales, no el inicio siguiente como fin',()=>{
 const r={modulo_1:'2026-09-01',modulo_1_fin:'2026-09-04',modulo_2:'2026-09-09',modulo_2_fin:'2026-09-11'};
 const a=calculate(r,1,'2026-09-20'),b=calculate(r,2,'2026-09-20');assert.equal(a.days,3);assert.equal(a.windowDays,5);assert.equal(a.status,'Finalizado');assert.equal(b.days,2);assert.equal(b.windowDays,9);assert.equal(b.windowStatus,'Abierta');
});
test('muestra cantidades abiertas y conserva límites amarillos y rojos',()=>{
 const r={acceso:'Acceso',modulo_1:'2026-09-01'};assert.equal(calculate(r,1,'2026-09-08').tone,'yellow');assert.equal(calculate(r,1,'2026-09-15').tone,'red');assert.equal(calculate(r,1,'2026-09-15').days,14);assert.equal(calculate({...r,pausa:'En Pausa'},1,'2026-09-15').tone,'neutral');assert.equal(calculate({...r,modulo_1_fin:'2026-09-03'},1,'2026-09-15').days,2);
});
test('faltantes, fechas invertidas y superposiciones nunca generan tiempos inventados',()=>{
 const r={modulo_1:'2026-09-05',modulo_2:'2026-09-08'};assert.equal(calculate(r,1,'2026-09-20').status,'Falta fecha de fin');assert.equal(calculate(r,1,'2026-09-20').days,null);assert.equal(calculate({...r,modulo_1_fin:'2026-09-03'},1,'2026-09-20').days,null);assert.equal(calculate({...r,modulo_1_fin:'2026-09-10'},1,'2026-09-20').windowStatus,'Fechas superpuestas');assert.equal(calculate({modulo_1:'2026-02-30'},1,'2026-09-20').days,null);
});
test('mismo día es cero, último módulo no tiene ventana y promedios excluyen abiertos',()=>{
 const r={id:'x',modulo_1:'2026-09-01',modulo_1_fin:'2026-09-01',modulo_2:'2026-09-01',modulo_10:'2026-09-01',modulo_10_fin:'2026-09-05'};assert.equal(calculate(r,1,'2026-09-20').days,0);assert.equal(calculate(r,1,'2026-09-20').windowDays,0);assert.equal(calculate(r,10,'2026-09-20').windowDays,null);const m=build([r,{id:'y',modulo_1:'2026-09-01'}],'2026-09-20')[0];assert.equal(m.averageDuration,0);assert.equal(m.finished,1);
});
