const SESSIONS = [
 ['Onboarding','f_onboarding','onboarding'],
 ['Diagnóstico','f_diagnostico'],
 ['Costos','f_costos_1','costos_1'],
 ['EERR económico','f_eerr_economico','eerr_economico'],
 ['EERR financiero','f_eerr_financiero','eerr_financiero'],
 ['Cashflow','f_cashflow','cashflow']
];
const fields = [...new Set([...SESSIONS.flatMap(([,date,status])=>[date,status]).filter(Boolean),'acceso','actividad','progreso_curso','proximo_contacto_csm','ultima_respuesta','productos_adquiridos','pausa','fecha_final','fecha_final_renovacion',...Array.from({length:10},(_,i)=>[`modulo_${i+1}`,`modulo_${i+1}_fin`]).flat()])];
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
  {label:'Progreso del curso',value:row.progreso_curso||'Sin dato'},
  {label:'Próximo contacto',value:dateLabel(row.proximo_contacto_csm)||'Sin fecha registrada'},
  {label:'Última respuesta',value:dateLabel(row.ultima_respuesta)||'Sin fecha registrada'},
  ...Array.from({length:10},(_,i)=>({label:`Módulo ${i+1}`,value:dateLabel(row[`modulo_${i+1}`])||row[`modulo_${i+1}`]||'Sin avance registrado'}))];
}
function progress(row) {
 if(!row)return null;
 const modules=Array.from({length:10},(_,i)=>{
  const start=dateLabel(row[`modulo_${i+1}`]),end=dateLabel(row[`modulo_${i+1}_fin`]);
  const invalid=Boolean(start&&end&&String(row[`modulo_${i+1}_fin`]).slice(0,10)<String(row[`modulo_${i+1}`]).slice(0,10));
  return {number:i+1,start,end,completed:Boolean(end&&!invalid),invalid};
 });
 const current=modules.filter(m=>m.start||m.completed).at(-1)?.number||null;
 return {modules,current,completed:modules.filter(m=>m.completed).length,total:modules.length,
  platformProgress:row.progreso_curso||null,
  sessions:SESSIONS.map(([label,date,status])=>({label,date:dateLabel(row[date]),status:status?String(row[status]||'').trim():''}))};
}
module.exports={fields,summary,progress,dateLabel};
