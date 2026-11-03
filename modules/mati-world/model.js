const {isClientSession}=require('../../public/metricas-v2/js/marketing-cohort');
const {effectiveSetter}=require('../metricasv2/services/webinar-setter.service');
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const text=v=>typeof v==='string'?v.trim():'';
const zones=[{id:'agendas',name:'Recepción comercial',subtitle:'Agendas y reuniones',mark:'01',color:'#80b9d7'},
{id:'ventas',name:'Sala de cierres',subtitle:'Ventas registradas',mark:'02',color:'#e5b668'},
{id:'administracion',name:'Administración',subtitle:'Conciliación de pagos',mark:'03',color:'#de987d'},
{id:'ingreso',name:'Puerta al programa',subtitle:'Contrato y onboarding',mark:'04',color:'#b7a3d5'},
{id:'csm',name:'Campus CSM',subtitle:'Acceso y soporte vigente',mark:'05',color:'#88b8a2'}];
function validDate(value){const d=String(value||'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d?d:null;}
function timestamp(value,timezone){let s=String(value||'');if(!/T\d{2}:\d{2}/.test(s))return null;
 if(!/(Z|[+-]\d\d:\d\d)$/.test(s)){if(!['America/Argentina/Buenos_Aires','America/Buenos_Aires'].includes(timezone))return null;s+='-03:00';}
 const n=Date.parse(s);return Number.isFinite(n)?new Date(n).toISOString():null;}
function agendaFor(row,now){
 // Client sessions are not commercial agendas. Same classifier as the marketing cohort.
 if(isClientSession(row.origen_actual)||/onboarding|diagnostico|cashflow|coaching|sesion|soporte/i.test(norm(row.calendar_name)))return null;
 const start=timestamp(row.appointment_start,row.appointment_timezone),end=timestamp(row.appointment_end,row.appointment_timezone);
 const day=validDate(row.appointment_start)||validDate(row.fecha_llamada)||validDate(row.fecha_agenda);
 if(!day)return null;
 const raw=text(row.appointment_status)||text(row.llamada_meg),state=norm(raw);
 let status='Estado sin informar',code='unknown';
 if(['noshow','no show','no-show'].includes(state)){status='Ausente';code='absent';}
 else if(['showed','efectuada','realizada'].includes(state)){status='Realizada';code='done';}
 else if(['cancelled','canceled','cancelado','invalid'].includes(state)){status='Cancelada';code='cancelled';}
 else if(start&&end&&Date.parse(start)<=now.getTime()&&Date.parse(end)>now.getTime()){status='En horario previsto';code='current';}
 else if((start?Date.parse(start)>now.getTime():day>=now.toISOString().slice(0,10))){status='Próxima';code='upcoming';}
 else if(['new','confirmed','booked','pendiente'].includes(state)){status='Pasada · resultado sin informar';code='unknown';}
 return {date:day,start,end,status,code,raw:raw||'Sin información',calendar:text(row.calendar_name)||'Calendario sin información',timeKnown:!!start};
}
function programFor(r,now){
 // Same explicit access/support gates used by csm.page.js getSupportStatus/hasCurrentSupport.
 const access=norm(r.acceso)==='acceso',end=validDate(r.fecha_final);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires'}).format(now);
 const paused=norm(r.pausa)==='en pausa',abandoned=norm(r.abandono).includes('abandono'),farewell=!!text(r.despedida);
 const current=!!(r.csm_id&&access&&end&&end>today&&['vigente','activo'].includes(norm(r.support_active))&&!paused&&!abandoned&&!farewell);
 return {current,access:text(r.acceso)||'Sin información',support:text(r.support_active)||'Sin información',end,
 status:paused?'En pausa':abandoned?'Abandono registrado':farewell?'Despedida registrada':current?'Acceso y soporte vigentes':access?'Con acceso · soporte por verificar':norm(r.acceso)==='sin acceso'?'Sin acceso':'Ingreso sin información'};
}
function mapPerson(row,now=new Date()){
 const receipts=Array.isArray(row.receipts)?row.receipts:[],sales=receipts.filter(r=>norm(r.tipo)==='venta');
 const bounced=r=>norm(r.estado)==='rebotado'||String(r.rebotar_pago)==='true';
 const pending=receipts.filter(r=>!bounced(r)&&norm(r.estado)!=='conciliado');
 const rejected=receipts.filter(bounced),confirmed=receipts.filter(r=>!bounced(r)&&norm(r.estado)==='conciliado');
 const program=programFor(row,now),agenda=agendaFor(row,now),contract=text(row.contrato)||'Sin información',onboarding=text(row.onboarding)||'Sin información';
 const latestSale=sales.map(r=>validDate(r.saleDate)).filter(Boolean).sort().at(-1)||null;
 const recentCutoff=new Date(now.getTime()-90*86400000).toISOString().slice(0,10),agendaCutoff=new Date(now.getTime()-30*86400000).toISOString().slice(0,10);
 const contractPending=norm(contract)==='pendiente',onboardingPending=norm(onboarding)==='pendiente';
 if(!pending.length&&!rejected.length&&!program.current&&norm(row.acceso)!=='acceso'&&!contractPending&&!onboardingPending&&!(latestSale&&latestSale>=recentCutoff)&&!(agenda&&agenda.date>=agendaCutoff))return null;
 const issues=[];
 if(rejected.length)issues.push(`${rejected.length} comprobante(s) rebotado(s)`);
 if(pending.length)issues.push(`${pending.length} comprobante(s) sin conciliar`);
 if(contractPending)issues.push('Contrato pendiente');
 if(onboardingPending)issues.push('Onboarding pendiente');
 if(row.csm_id&&!program.current)issues.push(program.status);
 if(sales.length&&!row.csm_id)issues.push('Ingreso al programa sin información');
 if(contract==='Sin información'&&sales.length)issues.push('Contrato sin información');
 let zone='agendas',reason='Agenda comercial registrada',state=agenda?.status||'Sin información',badge='agenda';
 if(pending.length||rejected.length){zone='administracion';reason='Hay comprobantes que requieren una acción administrativa';state=rejected.length?'Comprobante rebotado':'Pendiente de conciliación';badge=rejected.length?'observado':'pendiente';}
 else if(contractPending||onboardingPending||(row.csm_id&&!program.current&&(norm(row.acceso)==='acceso'||latestSale>=recentCutoff))){zone='ingreso';reason='Hay requisitos o estado de ingreso que requieren revisión';state=contractPending?'Contrato pendiente':onboardingPending?'Onboarding pendiente':program.status;badge='pendiente';}
 else if(program.current){zone='csm';reason='Acceso habilitado y soporte vigente según las reglas CSM';state=program.status;badge='vigente';}
 else if(sales.length){zone='ventas';reason='Venta registrada; no se presume ingreso activo al programa';state=confirmed.length?'Venta con comprobantes conciliados':'Venta registrada';badge='venta';}
 const closer=text(row.closer)||text(sales[0]?.closer)||null;
 const setter=effectiveSetter({setter:row.setter,webinarSetters:row.webinar_setter?[row.webinar_setter]:[]})||null;
 const owner=zone==='csm'?text(row.ccm)||null:zone==='administracion'?null:closer;
 const waitingDates=[...pending,...rejected].map(r=>timestamp(r.createdAt)).filter(Boolean).sort();
 return {id:row.id,name:text(row.name)||'Sin nombre',ghlid:row.ghlid||null,zone,reason,state,badge,owner,
 owners:{commercial:closer,setter,csm:text(row.ccm)||null,administration:null},agenda,
 sale:{count:sales.length,date:latestSale,products:[...new Set(sales.map(r=>text(r.product)).filter(Boolean))]},
 payment:{total:receipts.length,conciliated:confirmed.length,pending:pending.length,rejected:rejected.length,waitingSince:waitingDates[0]||null},
 contract:{status:contract,signature: 'Sin información de firma verificable'},
 program:{...program,onboarding,onboardingDate:validDate(row.f_onboarding)},issues,
 sourceUpdatedAt:row.source_updated_at||null,
 profileUrl:row.ghlid?`/contacto-estado/${encodeURIComponent(row.ghlid)}`:null};
}
function buildWorld(rows,now=new Date()){
 const unique=new Map();for(const row of rows){const p=mapPerson(row,now);if(p&&!unique.has(p.id))unique.set(p.id,p);}
 const people=[...unique.values()].sort((a,b)=>a.name.localeCompare(b.name,'es'));
 return {generatedAt:now.toISOString(),people,zones:zones.map(z=>({...z,count:people.filter(p=>p.zone===z.id).length})),
 limitations:['Agendas: últimos 30 días y futuras. Ventas: últimos 90 días; los pendientes de conciliación y contrato se mantienen aunque sean anteriores.',
 'Se muestra la última agenda sincronizada por contacto; no existe un historial completo de citas en esta proyección.',
 'Contrato “Realizado” es el estado registrado, no una firma verificada. No hay evidencia de firma digital disponible.',
 'Administración no tiene responsable ni fecha de entrada a revisión por comprobante. La espera usa la fecha de creación cuando existe.',
 'No se presume activo a un cliente sin acceso y soporte vigentes. Los registros sin ID GHL se agrupan por la relación CRM disponible.']};
}
module.exports={buildWorld,mapPerson,agendaFor,programFor,zones};
