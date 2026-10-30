const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync('public/metricas-v2/js/views/agendas.page.js','utf8');
test('error inicial visible y botón reintenta filtros antes de cargar métricas',async()=>{
 let calls=0,loads=0;
 const button={disabled:false,addEventListener(_event,fn){this.click=fn;}};
 const status={textContent:''};
 const context={document:{getElementById(id){return id==='reload'?button:status;}},initFilters:async()=>{if(++calls===1)throw Error('statement timeout');},loadAgendaTotales:async()=>{loads++;}};
 vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('let agendaFiltersReady')),context);
 await new Promise(resolve=>setImmediate(resolve));
 assert.match(status.textContent,/No se pudieron cargar.*reintentar/);
 assert.equal(button.disabled,false);
 await button.click();
 assert.equal(calls,2);assert.equal(loads,1);
 await button.click();assert.equal(calls,2);assert.equal(loads,2);
});
test('combina AOV mensual por ventas, no promedio simple entre orígenes',()=>{
 const context={};vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('function combineAovDia1Responses'),source.indexOf('function emptyAovDia1Response')),context);
 const result=context.combineAovDia1Responses([
 {ventasDia1:2,cashCollectedDia1:200,byMonth:{1:{ventasDia1:2,cashCollectedDia1:200}}},
 {ventasDia1:1,cashCollectedDia1:400,byMonth:{1:{ventasDia1:1,cashCollectedDia1:400},2:{ventasDia1:0,cashCollectedDia1:0}}}
 ]);
 assert.equal(result.aovDia1,200);assert.equal(result.byMonth[1].aovDia1,200);assert.equal(result.byMonth[2].aovDia1,0);
 assert.doesNotMatch(source,/monthAovResponses|const aovRequests/);
});
