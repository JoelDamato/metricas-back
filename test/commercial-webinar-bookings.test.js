const {test}=require('node:test');
const assert=require('node:assert/strict');
const {toBookingRows,scopedRows,scopedSales}=require('../modules/commercial-objectives/webinar-bookings');

test('event counts appointment IDs, keeps the early booking, and deduplicates repeated API results',()=>{
 const base={calendarId:'xhVDwXPo3B77U7W7SZpp',contactId:'contact',title:'Asesoría de rentabilidad - Persona y Equipo Matías Randazzo',dateAdded:'2026-11-26T20:24:00-03:00',startTime:'2026-11-27T10:00:00-03:00',endTime:'2026-11-27T10:15:00-03:00',appointmentStatus:'confirmed'};
 const early={...base,id:'early-appointment',calendarId:'YHiIO5Sn6d5JkuuG0nUx',dateAdded:'2026-11-23T12:11:51-03:00'};
 const valid={...base,id:'live-1'};
 const rows=toBookingRows([valid,valid,{...base,id:'live-2',appointmentStatus:'cancelled'},early,
  {...base,id:'previous-webinar',dateAdded:'2026-10-28T21:00:00-03:00'}]);
 assert.equal(rows.length,3);
 assert.equal(rows.filter(r=>r.aplica==='Aplica').length,2);
 assert.equal(rows.find(r=>r.id==='live-1').nombre,'Persona');
 assert.equal(rows.find(r=>r.id==='live-1').duration_minutes,15);
});

test('matching contact and day transfers attribution without losing other agendas or duplicating a call or sale',()=>{
 const booking={id:'a',ghlid:'x',nombre:'Persona',fecha_agenda:'2026-11-27',fecha_llamada:'2026-11-27',llamada_meg:'Pendiente',aplica:'Aplica'};
 const bookings=[booking,{...booking,id:'b'}];
 const lead={...booking,webinar_id:'unassigned',llamada_meg:'Efectuada'};
 const older={...lead,fecha_llamada:'2026-10-29'};
 assert.deepEqual(scopedRows([lead,older],bookings,'unassigned'),[older]);
 const cohort=scopedRows([lead],bookings,'webinar-2');
 assert.equal(cohort.length,1);
 assert.equal(cohort[0].otras_reservas.length,1);
 assert.equal(cohort.filter(r=>r.llamada_meg==='Efectuada').length,0);
 const sale={id:'sale1',ghlid:'x',origen:'Webinar',fecha_de_agendamiento:'2026-11-27T03:00:00Z'};
 assert.deepEqual(scopedSales([sale],[lead],bookings,'webinar-2'),[sale]);
 assert.deepEqual(scopedSales([sale],[lead],bookings,'unassigned'),[]);
});
