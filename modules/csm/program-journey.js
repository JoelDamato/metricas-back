const {dateLabel}=require('./contact-summary');
const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const day=value=>String(value||'').slice(0,10);
const canceled=a=>['cancelled','canceled','noshow','invalid'].includes(norm(a.status));
const definitions={
 initial:['Diagnóstico inicial','Vale','f_diagnostico'],
 costs:['Auditoría de costos','Contadoras','f_costos_1','costos_1'],
 costs1:['Costos','Contadoras','f_costos_1','costos_1'],
 costs2:['Costos, segunda sesión','Contadoras','f_costos_2','costos_2'],
 economic:['Estado de resultados económico','Contadoras','f_eerr_economico','eerr_economico'],
 intermediate:['Diagnóstico intermedio','Vale'],
 financial:['Sesión financiera','Contadoras','f_eerr_financiero','eerr_financiero'],
 cash:['Cash flow','Contadoras','f_cashflow','cashflow'],
 final:['Diagnóstico final','Vale']
};
function programFor(products){
 const text=norm((products||[]).join(' '));const costs=/costos? rentables?/.test(text),meg=/\bmeg\b/.test(text);
 return costs&&meg?'upgrade':costs?'costs':meg?'meg':null;
}
function buildJourney(row,appointments,products){
 const program=programFor(products);if(!program)return null;
 const keys=program==='costs'?['initial','costs1','costs2','final']:program==='upgrade'?['initial','costs1','costs2','economic','intermediate','financial','cash','final']:['initial','costs','economic','intermediate','financial','cash','final'];
 const sessions=keys.map(key=>{const [label,owner,date,status]=definitions[key];return {key,label,owner,date:dateLabel(row[date]),status:String(row[status]||''),program:program==='upgrade'&&['initial','costs1','costs2'].includes(key)?'Costos Rentables':program==='costs'?'Costos Rentables':'MEG'};});
 if(program==='costs'&&!row.f_costos_2){const second=sessions.find(s=>s.key==='costs2');second.date=dateLabel(row.f_eerr_economico);second.status=String(row.eerr_economico||'');}
 let costsIndex=0;
 const mapped=[...appointments].sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))).map(a=>{
  const label=norm(a.label),title=norm(a.title);let key;
  if(label==='diagnostico final')key='final';
  else if(label==='diagnostico intermedio')key='intermediate';
  else if(label==='diagnostico'||label==='diagnostico inicial')key='initial';
  else if(label==='costos'){
   if(program==='meg')key='costs';
   else {
    const explicitSecond=a.costsSecond||/costos?\s*(?:2|segunda|segundo)/.test(title)||(row.f_costos_2&&day(a.date)===day(row.f_costos_2));
    key=explicitSecond||costsIndex>=1?'costs2':'costs1';
    if(!canceled(a))costsIndex=Math.max(costsIndex,key==='costs2'?2:1);
   }
  }else if(label==='eerr economico'){
   // The economic calendar was historically reused for Costos 2.
   key=program==='costs'||(program==='upgrade'&&row.f_costos_2&&day(a.date)===day(row.f_costos_2))?'costs2':'economic';
  }else if(label==='eerr financiero')key='financial';
  else if(label==='cashflow')key='cash';
  const session=sessions.find(s=>s.key===key);
  return {...a,sessionKey:session?.key||'history:'+a.label,label:session?.label||a.label};
 });
 // Existing extra sessions stay visible as history; no appointment or material is discarded.
 for(const a of mapped){if(!sessions.some(s=>s.key===a.sessionKey))sessions.push({key:a.sessionKey,label:a.label,owner:'',program:'Historial',historical:true});}
 for(const s of sessions){const rows=mapped.filter(a=>a.sessionKey===s.key&&!canceled(a));if(rows.length)s.date=dateLabel(rows[0].date)||s.date;}
 return {program:program==='upgrade'?'Costos Rentables → MEG':program==='costs'?'Costos Rentables':'MEG',total:keys.length,sessions,appointments:mapped};
}
module.exports={programFor,buildJourney};
