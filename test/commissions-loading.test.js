const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('public/metricas-v2/js/views/comisiones.page.js','utf8');
function loader(context){const start=source.indexOf('  const pendingPageLoads = new Map();'),end=source.indexOf('  async function saveRules(',start);return vm.runInNewContext(`${source.slice(start,end)}; loadPage`,context);}
test('comisiones carga aunque falle Configuración y evita duplicar solicitudes del mismo mes',async()=>{
 let calls=0,finish;const statuses=[],feedback={};
 const context={state:{month:'2026-11'},document:{getElementById:()=>feedback},console:{error(){}},setStatus:s=>statuses.push(s),loadDashboard:()=>{calls++;return new Promise(resolve=>{finish=resolve;});},loadRulesConfig:async()=>{throw new Error('config unavailable');}};
 const load=loader(context),first=load(),second=load();finish();await Promise.all([first,second]);
 assert.equal(calls,1);assert.deepEqual(statuses,[]);assert.equal(feedback.textContent,'config unavailable');
});
test('una carga vieja que falla no pisa el estado del mes actual',async()=>{
 let reject;const statuses=[];
 const context={state:{month:'2026-10'},document:{getElementById:()=>({})},console:{error(){}},setStatus:s=>statuses.push(s),loadDashboard:()=>new Promise((_,r)=>{reject=r;}),loadRulesConfig:async()=>{}};
 const load=loader(context),pending=load();context.state.month='2026-11';reject(new Error('timeout octubre'));await pending;assert.deepEqual(statuses,[]);
});
