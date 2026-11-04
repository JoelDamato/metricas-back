const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync('public/metricas-v2/js/views/agendas-closer.page.js','utf8');
async function load(closer='') {
 const calls=[], rendered=[];
 const fixture=[{anio:2026,mes:10,origen:'WEBINAR 28/10',closer:'Carlos Tu',total_agendados:1},{anio:2026,mes:11,origen:'WEBINAR 28/10',closer:'Patricia Conti',total_agendados:1}];
 const elements=new Map();
 const context={RESOURCE:'agenda_detalle_por_origen_closer',agendaLoadRevision:0,MONTHS:Array.from({length:12},(_,i)=>({value:i+1})),document:{getElementById(id){if(!elements.has(id))elements.set(id,{replaceChildren(){},textContent:''});return elements.get(id);}},getFilters:()=>({anio:'2026',origen:'WEBINAR 28/10',closer}),setAgendaLoading(){},getYearRange:()=>({from:'2026-01-01',to:'2026-12-31'}),runAgendaRequests:tasks=>Promise.all(tasks.map(t=>t())),fetchAovDia1ForFilters:async()=>({}),fetchInvestmentForFilters:async()=>({}),normalizeCloserRows:r=>r,normalizeText:s=>s.toLowerCase(),buildKpis:r=>rendered.push(r),buildMatrixTable:(r,f,a,i,base)=>rendered.push({rows:r,base}),window:{metricasApi:{fetchAllRows:async(resource,q)=>{calls.push({resource,q});return {rows:resource==='agenda_detalle_por_origen_closer'?fixture.filter(r=>!q.eq_closer||r.closer===q.eq_closer):[]};}}}};
 vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('function applyLocalFilters'),source.indexOf('function getMonthRange')),context);
 vm.runInContext(source.slice(source.indexOf('async function loadAgendaCloser'),source.indexOf('async function initPage')),context);
 await context.loadAgendaCloser();return {calls,rendered,elements};
}
test('Todos conserva las agendas WEBINAR del detalle aunque no existan en agenda_totales',async()=>{const x=await load();assert.equal(x.rendered[0].length,2);assert.equal(x.rendered[1].rows.reduce((n,r)=>n+r.total_agendados,0),2);assert.equal(x.rendered[1].base.totalAgendados,2);assert.ok(x.calls.every(c=>c.resource==='agenda_detalle_por_origen_closer'));assert.match(x.elements.get('status').textContent,/Filas: 2/);});
test('un closer conserva su agenda y usa todos los closers del mismo origen como base de costos',async()=>{const x=await load('Carlos Tu');assert.equal(x.rendered[0].length,1);assert.equal(x.rendered[0][0].closer,'Carlos Tu');assert.equal(x.rendered[1].base.totalAgendados,2);assert.equal(x.calls[1].q.eq_closer,undefined);assert.equal(x.calls[1].q.eq_origen,'WEBINAR 28/10');});
