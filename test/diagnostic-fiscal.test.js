const test=require('node:test'),assert=require('node:assert/strict'),core=require('../public/diagnostico/diagnostico-core');
test('puntúa IVA según condición y preserva etapas sin condición histórica',()=>{
 const data=core.emptyData(); const c=data.checkpoints.inicial;
 c.areas.costos.selects.ivaEsCosto='Sí';assert.equal(core.computeAutoScore(c,'costos'),1);
 c.fiscalCondition='monotributista';assert.equal(core.computeAutoScore(c,'costos'),5);
 c.fiscalCondition='responsable_inscripto';assert.equal(core.computeAutoScore(c,'costos'),1);
 c.areas.costos.selects.ivaEsCosto='No';assert.equal(core.computeAutoScore(c,'costos'),5);
 assert.equal(data.checkpoints.final.fiscalCondition,'');
});
test('montos con IVA, sin IVA, mezclado y condición desconocida',()=>{
 for(const condition of ['monotributista','responsable_inscripto']){
 const c=core.emptyData().checkpoints.inicial;c.fiscalCondition=condition;
 for(const answer of ['Ventas y costos con IVA','Ventas y costos sin IVA','Mezclado / no sé']){
 c.areas.resultados.selects.ivaMontosRentabilidad=answer;
 const correct=condition==='monotributista'?'Ventas y costos con IVA':'Ventas y costos sin IVA';
 assert.equal(core.computeAutoScore(c,'resultados'),answer===correct?5:1);
 }
 }
 const c=core.emptyData().checkpoints.inicial;c.areas.resultados.selects.ivaMontosRentabilidad='Ventas y costos con IVA';assert.equal(core.computeAutoScore(c,'resultados'),null);
});
test('no convierte respuestas anteriores Sí/No en una respuesta de montos',()=>{
 const d=core.emptyData();d.checkpoints.inicial.areas.resultados.selects.ivaRentabilidadGeneral='Sí';
 const n=core.normalizeData(d);assert.equal(n.checkpoints.inicial.areas.resultados.selects.ivaRentabilidadGeneral,'Sí');assert.equal(n.checkpoints.inicial.areas.resultados.selects.ivaMontosRentabilidad,'');
 assert.equal(n.checkpoints.inicial.areas.resultados.score,1);
 n.checkpoints.inicial.fiscalCondition='monotributista';core.applyAutoScores(n.checkpoints.inicial);assert.equal(n.checkpoints.inicial.areas.resultados.score,5);
});
