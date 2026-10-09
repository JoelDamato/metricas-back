const SESSIONS = [
 ['Onboarding','f_onboarding','onboarding'],
 ['Diagnóstico','f_diagnostico'],
 ['Costos 1','f_costos_1','costos_1'],
 ['Costos 2','f_costos_2','costos_2'],
 ['EERR económico','f_eerr_economico','eerr_economico'],
 ['EERR financiero','f_eerr_financiero','eerr_financiero'],
 ['Cashflow','f_cashflow','cashflow'],
 ['Traffiker','f_traffiker'],
 ['Coaching','f_coaching']
];
const fields = [...new Set([...SESSIONS.flatMap(([,date,status])=>[date,status]).filter(Boolean),'acceso','actividad','progreso_curso','proximo_contacto_csm','ultima_respuesta',...Array.from({length:10},(_,i)=>`modulo_${i+1}`)])];
function dateLabel(value){
 const raw=String(value||'').slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(raw)||Number.isNaN(Date.parse(raw))||new Date(raw).toISOString().slice(0,10)!==raw)return null;
 return raw.split('-').reverse().join('/');
}
function summary(row){
 if(!row)return [{label:'Seguimiento CSM',value:'Sin ficha CSM'}];
 const sessions=SESSIONS.map(([label,date,status])=>{
  const recorded=dateLabel(row[date]),state=status?String(row[status]||'').trim():'';
  return {label,value:recorded?`${state||'Fecha registrada'} · ${recorded}`:state?`${state} · Sin fecha registrada`:'Sin sesión registrada'};
 });
 return [...sessions,
  {label:'Acceso',value:row.acceso||'Sin dato'},
  {label:'Actividad',value:row.actividad||'Sin dato'},
  {label:'Progreso del curso',value:row.progreso_curso||'Sin dato'},
  {label:'Próximo contacto',value:dateLabel(row.proximo_contacto_csm)||'Sin fecha registrada'},
  {label:'Última respuesta',value:dateLabel(row.ultima_respuesta)||'Sin fecha registrada'},
  ...Array.from({length:10},(_,i)=>({label:`Módulo ${i+1}`,value:dateLabel(row[`modulo_${i+1}`])||row[`modulo_${i+1}`]||'Sin avance registrado'}))];
}
module.exports={fields,summary};
