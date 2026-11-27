const axios = require('axios');
const { appointmentTimestamp } = require('../ghl/appointment-time');

const WEBINAR = 'webinar-2';
const LIVE_START = Date.parse('2026-11-26T20:23:00-03:00');
const LIVE_DAY_END = Date.parse('2026-11-27T00:00:00-03:00');
// The historical count was verified against GHL creation and cancellation times.
const LIVE_CUTOFF = {at:'2026-11-26T21:39:00-03:00', confirmed:48};
const CALENDARS = ['xhVDwXPo3B77U7W7SZpp', 'egVtctKGs2cC84i9YMdA', 'YHiIO5Sn6d5JkuuG0nUx'];
const EARLY_START = Date.parse('2026-11-23T00:00:00-03:00');
const EARLY_END = Date.parse('2026-11-24T00:00:00-03:00');
const CLOSERS = new Map([
  ['JbSkrxtUBLrKst8jFXSY', 'Patricia Conti'],
  ['b4szcSZVa2zNRkx1rTB2', 'Mauro Gaitan'],
  ['frEN6iKQRyUT96jM4uvw', 'Carlos Tu'],
  ['G5OKD1JQ25SWgQ7LHVGn', 'Claudio Nicolini'],
  ['7YHYaj99YIpxO57MMp9e', 'Walter Alegre']
]);
const STATUS = {
  confirmed:'Pendiente', completed:'Efectuada', showed:'Efectuada',
  noshow:'No show', no_show:'No show', cancelled:'Cancelado', canceled:'Cancelado'
};
const argentineDate = new Intl.DateTimeFormat('sv-SE', {timeZone:'America/Argentina/Buenos_Aires'});
const CACHE_MS = 45_000;
let cached;
let pending;

function toBookingRows(events) {
  const byId = new Map();
  for (const event of events) {
    const booked = Date.parse(event.dateAdded);
    const isLive = CALENDARS.slice(0,2).includes(event.calendarId) && booked >= LIVE_START && booked < LIVE_DAY_END;
    const isEarly = event.calendarId === CALENDARS[2] && booked >= EARLY_START && booked < EARLY_END;
    if ((!isLive && !isEarly) || !event.id || !event.contactId) continue;
    const starts = appointmentTimestamp(event.startTime);
    const ends = appointmentTimestamp(event.endTime);
    const status = event.deleted ? 'Cancelado' : STATUS[String(event.appointmentStatus).toLowerCase()];
    if (!status || !Number.isFinite(starts) || !Number.isFinite(ends) || ends <= starts) continue;
    const date = argentineDate.format(starts);
    const name = String(event.title || '').replace(/^Asesor[ií]a de rentabilidad\s*[-–:]\s*/i,'')
      .replace(/\s+y Equipo Mat[ií]as Randazzo\s*$/i,'').trim();
    byId.set(event.id, {
      id:event.id, nombre:name, ghlid:event.contactId, origen:'Webinar', webinar_id:WEBINAR,
      closer:CLOSERS.get(event.assignedUserId) || 'Sin asignar',
      fecha_agenda:date, fecha_llamada:date, llamada_meg:status,
      aplica:status === 'Cancelado' ? 'No aplica' : 'Aplica', agendo:'Agendo',
      attribution_note:'Reserva verificada en el calendario de GoHighLevel.', early:isEarly,
      booked_at:new Date(booked).toISOString(), starts_at:new Date(starts).toISOString(),
      duration_minutes:(ends-starts)/60_000
    });
  }
  return [...byId.values()].sort((a,b)=>a.starts_at.localeCompare(b.starts_at)||a.booked_at.localeCompare(b.booked_at));
}

async function fetchSnapshot() {
  const key = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID || 'WU2z8kl23Dr3IyBW1hv5';
  if (!key) throw Object.assign(new Error('Falta el acceso de Central al calendario de GoHighLevel.'), {statusCode:503});
  const client = axios.create({
    baseURL:process.env.GHL_API_BASE || 'https://services.leadconnectorhq.com',
    headers:{ Authorization:'Bearer '+key, Version:'2021-07-28', Accept:'application/json' },
    timeout:12000
  });
  let results;
  try {
    results=await Promise.all(CALENDARS.map(calendarId=>client.get('/calendars/events',{
      params:{ calendarId, locationId,
        startTime:Date.parse('2026-11-01T00:00:00-03:00'),
        endTime:Date.parse('2027-01-26T00:00:00-03:00') }
    })));
    if (results.some(response=>!Array.isArray(response.data?.events))) throw new Error('Invalid events response');
  } catch {
    throw Object.assign(new Error('No se pudieron consultar las reservas del Webinar 2 en GoHighLevel.'), {statusCode:502});
  }
  const rows=toBookingRows(results.flatMap(response=>response.data.events));
  if (rows.filter(row=>row.early).length!==1 || rows.length < 48) {
    throw Object.assign(new Error('GoHighLevel devolvió una lista incompleta para el Webinar 2.'), {statusCode:502});
  }
  return { rows, verifiedAt:new Date().toISOString() };
}

async function getSnapshot() {
  if (cached && Date.now()-cached.time<CACHE_MS) return cached.value;
  if (!pending) {
    pending=fetchSnapshot().then(value=>{
      cached={value,time:Date.now()};
      return value;
    }).finally(()=>{pending=null;});
  }
  return pending;
}

const bookingKey = row => [row.ghlid, String(row.fecha_llamada || row.fecha_agenda || '').slice(0,10)].join('|');

function groupByAppointmentDay(rows) {
  const grouped=new Map();
  for (const row of rows) {
    if (!row.ghlid) continue;
    const key=bookingKey(row);
    const group=grouped.get(key)||[];
    group.push(row);
    grouped.set(key,group);
  }
  return grouped;
}

function scopedRows(legacyRows, bookingRows, webinar) {
  const byBooking=groupByAppointmentDay(bookingRows);
  if (webinar !== WEBINAR) {
    return legacyRows.filter(row=>!row.ghlid || !byBooking.has(bookingKey(row))).flatMap(row=>{
      if (row.webinar_id===webinar) return [row];
      if (webinar==='unassigned' && row.webinar_id===WEBINAR) return [{...row,
        attribution_note:'El origen del contacto indica Webinar 2, pero no se encontró una reserva verificada para esta cita.'}];
      return [];
    });
  }
  const byLead=groupByAppointmentDay(legacyRows);
  const enriched=bookingRows.map(booking=>{
    const key=bookingKey(booking);
    const candidates=byLead.get(key)||[];
    const match=candidates.length===1 ? candidates[0] : null;
    const outcome=match?.llamada_meg;
    return {
      ...booking,
      nombre:match?.nombre || booking.nombre,
      llamada_meg:booking.llamada_meg==='Pendiente' && byBooking.get(key).length===1 &&
        ['Efectuada','No show'].includes(outcome) ? outcome : booking.llamada_meg
    };
  });

  // Mirror the launch report: one row per person, ordered by appointment time.
  // Cancelled alternatives remain available in the appointment history.
  const byContact=new Map();
  for (const booking of enriched) {
    const group=byContact.get(booking.ghlid)||[];
    group.push(booking);
    byContact.set(booking.ghlid,group);
  }
  return [...byContact.values()].map(group=>{
    const primary=group.find(row=>row.aplica==='Aplica') || group[0];
    return {...primary,otras_reservas:group.filter(row=>row.id!==primary.id)};
  });
}

function scopedSales(sales, legacyRows, bookings, webinar) {
  const bookingDays=groupByAppointmentDay(bookings.filter(row=>row.aplica==='Aplica'));
  const leadDays=groupByAppointmentDay(legacyRows.map(row=>({...row,fecha_llamada:row.fecha_agenda})));
  return sales.filter(sale=>{
    const instant=appointmentTimestamp(sale.fecha_de_agendamiento);
    if (!Number.isFinite(instant)) return false;
    const localDay=argentineDate.format(instant);
    const utcDay=new Date(instant).toISOString().slice(0,10);
    const keys=[...new Set([localDay,utcDay])].map(day=>sale.ghlid+'|'+day);
    if (keys.some(key=>bookingDays.has(key))) return webinar===WEBINAR;
    const explicit=/webinar[^0-9]*(26[/ -]11|28[/ -]10)/i.exec(sale.origen)?.[1];
    if (explicit) return webinar===(explicit.startsWith('26')?WEBINAR:'webinar-1');
    const possible=new Set((leadDays.get(keys[0])||[]).map(row=>row.webinar_id));
    return webinar===(possible.size===1?[...possible][0]:'unassigned');
  });
}

module.exports={ WEBINAR, LIVE_CUTOFF, getSnapshot, scopedRows, scopedSales, toBookingRows };
