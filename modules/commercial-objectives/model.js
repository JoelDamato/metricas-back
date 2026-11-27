const TEAM=['Walter Alegre','Carlos Tu','Claudio Nicolini','Mauro Gaitan','Pablo Butera','Patricia Conti'];
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const name=s=>s==='Sin asignar'?s:TEAM.find(n=>normalize(n)===normalize(s).replace(/ vie$/,''));
const fields={agendas:'total_aplica',calls:'total_efectuadas',sales:'total_ventas',billing:'facturacion_f_agenda'};
function monthKey(value){if(typeof value!=='string'||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(value))throw Object.assign(new Error('Mes inválido (AAAA-MM).'),{statusCode:400});return value;}
function validate(input){const out={};for(const k of [...Object.keys(fields),'attendance','closing']){const v=input[k];if(v===null||v===''||typeof v==='boolean'||!Number.isFinite(Number(v))||Number(v)<0||Number(v)>1e12)throw Object.assign(new Error(`Objetivo inválido: ${k}`),{statusCode:400});out[k]=Number(v);if(['agendas','calls','sales'].includes(k)&&!Number.isInteger(out[k]))throw Object.assign(new Error('Las cantidades deben ser enteras.'),{statusCode:400});}if(out.attendance>100||out.closing>100)throw Object.assign(new Error('Las tasas deben estar entre 0 y 100.'),{statusCode:400});return out;}
function aggregate(rows){const groups=new Map();for(const row of rows){const closer=name(row.closer);if(!closer)continue;const item=groups.get(closer)||{closer,agendas:0,calls:0,sales:0,billing:0};for(const [k,col] of Object.entries(fields)){if(row[col]===undefined||row[col]===null||!Number.isFinite(Number(row[col])))throw new Error(`El reporte no incluye un valor válido para ${col}.`);item[k]+=Number(row[col]);}groups.set(closer,item);}const derived=r=>({...r,attendance:r.agendas?r.calls/r.agendas*100:null,closing:r.calls?r.sales/r.calls*100:null,ticket:r.sales?r.billing/r.sales:null,fortnightAverage:r.agendas/2});const totals={agendas:0,calls:0,sales:0,billing:0};for(const r of groups.values())for(const k of Object.keys(fields))totals[k]+=r[k];return {actual:derived(totals),closers:[...groups.values()].map(derived).sort((a,b)=>a.closer.localeCompare(b.closer,'es'))};}
module.exports={TEAM,fields,monthKey,validate,aggregate};
function channelKey(value='evergreen'){if(!['evergreen','lanzamiento'].includes(value))throw Object.assign(new Error('Canal inválido.'),{statusCode:400});return value;}
function channelRows(rows,channel){channelKey(channel);return rows.filter(r=>{if(r.origen===undefined)throw new Error('Falta el origen para clasificar el resultado.');const launch=/webinar|lanzamiento/.test(normalize(r.origen));return channel==='lanzamiento'?launch:!launch;});}
function leadDetails(rows,channel){return channelRows(rows,channel).filter(r=>name(r.closer)&&r.fecha_agenda).map(r=>{const call=normalize(r.llamada_meg);const status=call==='efectuada'?'Asistió':call==='no show'?'Ausente':call==='cancelado'?'Cancelada':normalize(r.agendo)==='agendo'&&normalize(r.aplica)==='aplica'&&['','pendiente'].includes(call)?'Pendiente':'Sin clasificar';return {name:r.nombre||'Sin nombre',closer:name(r.closer),agenda:r.fecha_agenda,callDate:r.fecha_llamada,status,applies:r.aplica||'Sin calificación',ghlid:r.ghlid||null};});}
Object.assign(module.exports,{channelKey,channelRows,leadDetails});

const WEBINARS = [
  { id: 'webinar-1', label: 'Webinar 1 · 28/10/2026', month: '2026-10' },
  { id: 'webinar-2', label: 'Webinar 2 · 26/11/2026', month: '2026-11', bookingCutoff: require('./webinar-bookings').LIVE_CUTOFF.at },
  { id: 'unassigned', label: 'Sin identificar', month: '2026-11' }
];
function webinarKey(value = 'all') {
  if (value !== 'all' && !WEBINARS.some(w => w.id === value)) {
    throw Object.assign(new Error('Lanzamiento inválido.'), { statusCode: 400 });
  }
  return value;
}
function scope(input) {
  const channel = channelKey(input.channel);
  const webinar = webinarKey(input.webinar);
  if (channel !== 'lanzamiento' && webinar !== 'all') {
    throw Object.assign(new Error('El lanzamiento solo corresponde al canal Lanzamiento.'), { statusCode: 400 });
  }
  const event = WEBINARS.find(w => w.id === webinar);
  return { channel, webinar, month: event ? event.month : monthKey(input.month), event };
}
Object.assign(module.exports, { WEBINARS, webinarKey, scope });

const STAGES = ['agendas', 'calls', 'sales', 'billing'];
function stageKey(value) {
  if (!STAGES.includes(value)) throw Object.assign(new Error('Etapa del embudo inválida.'), {statusCode:400});
  return value;
}
function funnelDetails(records, channel, stage) {
  stageKey(stage);
  return channelRows(records, channel).filter(r => {
    const closer = stage === 'sales' || stage === 'billing'
      ? name(String(r.responsable_venta || '').trim() || r.creado_por) : name(r.closer);
    if (!closer || (!['sales','billing'].includes(stage) && !r.fecha_agenda)) return false;
    if (stage === 'agendas') return r.aplica === 'Aplica';
    if (stage === 'calls') return r.aplica === 'Aplica' && r.agendo === 'Agendo' && r.llamada_meg === 'Efectuada';
    return true; // Sales are prefiltered with the report's SQL predicate.
  }).map(r => {
    const sale = stage === 'sales' || stage === 'billing';
    return {
      id:r.id, name:sale?(r.cliente_format || 'Sin nombre'):(r.nombre || 'Sin nombre'),
      closer:sale?name(String(r.responsable_venta || '').trim() || r.creado_por):name(r.closer),
      ghlid:r.ghlid || null, agenda:sale?r.fecha_de_agendamiento:r.fecha_agenda,
      date:sale?r.f_venta:r.fecha_llamada, status:sale?'Venta':(r.llamada_meg || 'Pendiente'),
      product:sale?(r.producto_format || '—'):null,
      amount:sale?Number(r.facturacion || 0):null,
      attribution:r.attribution_note || null,
      bookedAt:r.booked_at || null,
      durationMinutes:r.duration_minutes ?? null,
      otherBookings:(r.otras_reservas || []).map(booking=>({
        date:booking.fecha_llamada, startsAt:booking.starts_at, status:booking.llamada_meg,
        durationMinutes:booking.duration_minutes, closer:booking.closer
      }))
    };
  });
}
Object.assign(module.exports, {STAGES, stageKey, funnelDetails});
