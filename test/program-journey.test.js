const {test}=require('node:test'),assert=require('node:assert/strict');
const {buildJourney}=require('../modules/csm/program-journey');
const {mapAppointments}=require('../modules/csm/contact-materials');
const {publicPortal}=require('../controllers/clientPortal');
const ap=(id,label,date,status='showed')=>({id,label,date,status,links:[{url:'https://fathom.video/share/'+id,label:'Ver grabación'}]});
test('MEG muestra siete sesiones y distingue diagnóstico intermedio del inicial',()=>{
 const events=mapAppointments([{id:'mid',calendarId:'mid',title:'Cliente',startTime:'2026-11-01'}],{mid:'Diagnóstico Intermedio - Valeria Calmet'});
 const j=buildJourney({},events,['MEG 2.1']);assert.equal(j.total,7);assert.equal(j.sessions.length,7);
 assert.deepEqual(j.sessions.map(s=>s.label),['Diagnóstico inicial','Auditoría de costos','Estado de resultados económico','Diagnóstico intermedio','Sesión financiera','Cash flow','Diagnóstico final']);
 assert.equal(j.appointments[0].sessionKey,'intermediate');
});
test('Costos conserva dos citas del mismo calendario con materiales propios y cuatro sesiones',()=>{
 const j=buildJourney({},[ap('1','Costos','2026-01-01'),ap('2','Costos','2026-02-01')],['Costos Rentables']);
 assert.equal(j.sessions.length,4);assert.equal(j.appointments[0].sessionKey,'costs1');assert.equal(j.appointments[1].sessionKey,'costs2');
 assert.equal(j.appointments[0].links[0].url,'https://fathom.video/share/1');assert.equal(j.appointments[1].links[0].url,'https://fathom.video/share/2');
 assert(!j.sessions.some(s=>/resultados/i.test(s.label)));
});
test('la cita histórica Económica de Costos se muestra como segunda sesión de Costos',()=>{
 const j=buildJourney({f_eerr_economico:'2026-02-01'},[ap('1','Costos','2026-01-01'),ap('2','EERR económico','2026-02-01')],['Costos Rentables']);
 assert.equal(j.sessions.length,4);assert.equal(j.appointments[1].label,'Costos, segunda sesión');assert.equal(j.sessions[2].date,'01/02/2026');
});
test('una cancelación no consume la primera sesión y el calendario Nº2 identifica su lugar',()=>{
 const events=mapAppointments([{id:'2',calendarId:'second',title:'Cliente',startTime:'2026-02-01'}],{second:'Sesión de Costos 1 a 1 - (Nº2)'});
 const j=buildJourney({},[ap('cancel','Costos','2026-01-01','cancelled'),ap('1','Costos','2026-01-02'),...events],['Costos Rentables']);
 assert.deepEqual(j.appointments.map(a=>a.sessionKey),['costs1','costs1','costs2']);
});
test('pase a MEG conserva los dos programas, ocho pasos y material extra',()=>{
 const j=buildJourney({f_costos_2:'2026-02-01'},[ap('1','Costos','2026-01-01'),ap('2','EERR económico','2026-02-01'),ap('3','EERR económico','2026-03-01'),ap('extra','Apoyo','2026-03-02')],['Costos Rentables','MEG 2.1']);
 assert.equal(j.total,8);assert.equal(j.sessions.filter(s=>!s.historical).length,8);assert.equal(j.appointments.length,4);
 assert.deepEqual(j.appointments.map(a=>a.sessionKey),['costs1','costs2','economic','history:Apoyo']);
 assert.deepEqual(j.sessions.slice(0,3).map(s=>s.program),Array(3).fill('Costos Rentables'));
});
test('el historial de ventas identifica el pase aunque el producto actual sea MEG, sin exponer comprobantes',()=>{
 const p=publicPortal('id',{nombre:'Cliente',productos_adquiridos:'MEG'}, {available:true,fields:{},appointments:[]},false,[{tipo:'Venta',producto_format:'Costos Rentables',mail:'private',facturacion:9000}]);
 assert.equal(p.csmProgress.total,8);assert.doesNotMatch(JSON.stringify(p),/private|9000|facturacion/);
});
