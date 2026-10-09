(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root){root.csmModuleDurations=api;if(root.document)root.document.addEventListener('DOMContentLoaded',()=>api.mount());}})(typeof window!=='undefined'?window:null,function(){
 const definitions=Array.from({length:10},(_,i)=>({number:i+1,label:i<7?`M${i+1}`:`MP${i-6}`,yellow:[7,14,14,7,null,14,14,null,null,null][i],red:[14,21,21,14,null,21,21,null,null,null][i]}));
 const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 function day(value){const s=String(value||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;const n=Date.parse(s+'T00:00:00Z');return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===s?n:null;}
 function interval(start,end){const a=day(start),b=day(end);if(a===null||b===null)return null;return Math.round((b-a)/86400000);}
 function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
 function rawFields(row){let p=row.ghl_latest_payload||{};if(p.data&&typeof p.data==='object')p=p.data;return {...(p.contact||{}),...p,...(p.customData||{})};}
 function calculate(row,number,asOf=today()){
  const def=definitions[number-1],raw=rawFields(row),label=def.label;
  const start=row[`modulo_${number}`]||raw[`F. Inicio ${label}`]||null,end=row[`modulo_${number}_fin`]||raw[`F. Fin ${label}`]||null;
  const nextDef=definitions[number],next=nextDef?(row[`modulo_${number+1}`]||raw[`F. Inicio ${nextDef.label}`]||null):null;
  const later=definitions.slice(number).some(d=>row[`modulo_${d.number}`]||raw[`F. Inicio ${d.label}`]);
  const eligible=norm(row.acceso)==='acceso'&&norm(row.pausa)!=='en pausa'&&!norm(row.abandono).includes('abandono');
  let status='Sin iniciar',days=null,windowStatus=nextDef?'Sin fecha de fin':'Último módulo',windowDays=null;
  if(start||end){
   if((start&&day(start)===null)||(end&&day(end)===null)||(start&&interval(start,asOf)<0)||(end&&interval(end,asOf)<0)){status='Fecha inválida o futura';}
   else if(!start)status='Falta inicio';
   else if(end){days=interval(start,end);if(days<0){days=null;status='Fin anterior al inicio';}else status='Finalizado';}
   else if(later)status='Falta fecha de fin';
   else {days=interval(start,asOf);status='En curso';}
  }
  if(nextDef&&end){
   if(day(end)===null||interval(end,asOf)<0)windowStatus='Fecha de fin inválida';
   else if(next){windowDays=interval(end,next);if(windowDays===null||interval(next,asOf)<0){windowDays=null;windowStatus='Inicio siguiente inválido';}else if(windowDays<0){windowDays=null;windowStatus='Fechas superpuestas';}else windowStatus='Cerrada';}
   else if(later)windowStatus=`Falta inicio ${nextDef.label}`;
   else {windowDays=interval(end,asOf);windowStatus='Abierta';}
  }
  const tone=status==='En curso'&&eligible&&def.red!==null?(days>=def.red?'red':days>=def.yellow?'yellow':'green'):'neutral';
  return {number,label,start,end,next,nextLabel:nextDef?.label,status,days,windowStatus,windowDays,tone,eligible,nombre:row.nombre||'Sin nombre',ghlid:row.ghlid||'',id:row.id};
 }
 function build(rows,asOf=today()){
  const unique=new Map();for(const r of rows){const id=r.ghlid||r.id;const old=unique.get(id);if(!old||String(r.updated_at||'')>String(old.updated_at||''))unique.set(id,r);}
  return definitions.map(d=>{const records=[...unique.values()].map(r=>calculate(r,d.number,asOf)).filter(r=>r.start||r.end||r.next);const finished=records.filter(r=>r.status==='Finalizado'),windows=records.filter(r=>r.windowStatus==='Cerrada');const avg=(a,k)=>a.length?a.reduce((n,r)=>n+r[k],0)/a.length:null;return {...d,records,averageDuration:avg(finished,'days'),averageWindow:avg(windows,'windowDays'),finished:finished.length,closedWindows:windows.length};});
 }
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const date=v=>day(v)===null?'—':String(v).slice(0,10).split('-').reverse().join('/');
 const amount=v=>v===null?'—':new Intl.NumberFormat('es-AR',{maximumFractionDigits:1}).format(v)+' días';
 const sessions=[['Diagnóstico','f_diagnostico'],['Costos','f_costos_1'],['Económica','f_eerr_economico'],['Financiera','f_eerr_financiero'],['Cashflow','f_cashflow']];
 function exclusion(row,asOf=today()){
  const entry=row.f_pago_con_acceso||row.f_acceso||row.fecha_inicio_estimada||row.f_onboarding;
  if(day(entry)===null)return 'Sin fecha de ingreso';
  if(day(entry)<day('2026-01-01'))return 'Ingreso anterior a 2026';
  if(day(entry)>day(asOf))return 'Ingreso futuro';
  if(/renovac/.test(norm(row.productos_adquiridos+' '+row.ultimo_producto_adquirido))||day(row.fecha_inicio_renovacion)!==null)return 'Renovación';
  if(/personaliz/.test(norm(row.productos_adquiridos+' '+row.ultimo_producto_adquirido)))return 'Personalizado';
  if(norm(row.acceso)!=='acceso')return 'Sin acceso';
  if(norm(row.pausa)==='en pausa')return 'En pausa';
  if(/abandono|abandonado/.test(norm(row.abandono+' '+row.actividad)))return 'Abandono';
  return '';
 }
 function orderRecords(records,sort='priority'){
  const priority={red:0,yellow:1,green:2,neutral:3};
  return [...records].sort((a,b)=>{
   if(sort==='name')return a.nombre.localeCompare(b.nombre,'es');
   if(sort==='days-asc')return (a.days??Infinity)-(b.days??Infinity)||a.nombre.localeCompare(b.nombre,'es');
   if(sort==='days-desc')return (b.days??-1)-(a.days??-1)||a.nombre.localeCompare(b.nombre,'es');
   return priority[a.tone]-priority[b.tone]||(b.days??-1)-(a.days??-1)||a.nombre.localeCompare(b.nombre,'es');
  });
 }
 const thresholds={yellow:null,red:null}; // Windows/session thresholds are explicit, never inferred from module limits.
 function trafficTone(days,active,limits){return active&&days!==null&&limits.red!==null?(days>=limits.red?'red':days>=limits.yellow?'yellow':'green'):'neutral';}
 function operationalLists(rows,mode='modules',asOf=today(),rules={}){
  const eligible=rows.filter(r=>!exclusion(r,asOf));
  if(mode==='sessions')return sessions.slice(0,-1).map(([label,field],i)=>({key:'s'+i,label:label+' → '+sessions[i+1][0],...(rules['s'+i]||thresholds),records:eligible.map(row=>{
   const start=row[field],end=row[sessions[i+1][1]],later=sessions.slice(i+2).some(s=>row[s[1]]);let days=null,status='Sin iniciar';
   if(start){days=interval(start,end||asOf);status=end?'Finalizado':'En curso';if(day(start)===null||days===null||days<0||interval(start,asOf)<0||(end&&interval(end,asOf)<0)){days=null;status='Fechas inválidas';}else if(!end&&later){days=null;status='Falta fecha de sesión';}}
   return {id:row.id,ghlid:row.ghlid,nombre:row.nombre||'Sin nombre',start,end,days,status,tone:trafficTone(days,status==='En curso',rules['s'+i]||thresholds)};
  }).filter(r=>r.start||r.end)}));
  return build(eligible,asOf).flatMap(m=>{
   const module={...m,key:'m'+m.number,records:m.records};
   if(m.number===10)return [module];
   return [module,{key:'w'+m.number,label:'Ventana '+m.label+'–'+definitions[m.number].label,...(rules['w'+m.number]||thresholds),records:m.records.filter(r=>r.end).map(r=>({...r,start:r.end,end:r.next,days:r.windowDays,status:r.windowStatus==='Abierta'?'En curso':r.windowStatus==='Cerrada'?'Finalizado':r.windowStatus,tone:trafficTone(r.windowDays,r.windowStatus==='Abierta',rules['w'+m.number]||thresholds)}))}];
  });
 }
 let followupPromise;
 async function getFollowup(){if(!followupPromise)followupPromise=fetch('/api/metricas/csm-followup').then(async r=>{if(!r.ok)throw Error('No se pudo cargar el seguimiento compartido');return r.json();}).catch(e=>{followupPromise=null;throw e;});return followupPromise;}
 async function render(container,source,options={}){
  container.innerHTML='<p role="status">Preparando seguimiento de clientes…</p>';
  let followup;try{followup=await getFollowup();}catch(e){container.innerHTML=`<p role="alert">${esc(e.message)}. Recargá la página para reintentar.</p>`;return;}
  const profiles=new Map(followup.profiles.map(p=>[p.ghlid,p])),notes=new Map(followup.notes.map(n=>[n.ghlid,n]));
  const unique=new Map();for(const r of source){const old=unique.get(r.ghlid||r.id);if(!old||String(r.updated_at||'')>String(old.updated_at||''))unique.set(r.ghlid||r.id,{...r,...profiles.get(r.ghlid)});}
  const rows=[...unique.values()],rules=Object.fromEntries((followup.rules||[]).map(r=>[r.stage,r]));let lists=operationalLists(rows,options.mode,today(),rules);
  let selected=lists[0]?.key,query='';const states=new Map(lists.map(l=>[l.key,{filter:l.red===null?'open':'alerts',sort:'priority',hidden:new Set()}]));
  container.innerHTML=`<div class="csm-duration-head"><div><span class="csm-followup-eyebrow">Seguimiento CSM · Ingresos desde 2026</span><h2>${options.mode==='sessions'?'Semáforo de sesiones':'Semáforo de plataforma'}</h2><p>Priorizá a quienes necesitan seguimiento. Abrí su ficha o dejá contexto para el equipo.</p></div></div><div class="csm-followup-stages" role="group" aria-label="Etapas"></div><div class="csm-followup-tools"><label>Buscar cliente<input data-duration-search type="search" placeholder="Nombre del cliente"></label><label>Mostrar<select data-followup-filter><option value="alerts">Rojos y amarillos</option><option value="red">Sólo rojos</option><option value="yellow">Sólo amarillos</option><option value="open">En curso</option><option value="all">Todos los estados</option><option value="missing">Datos incompletos</option><option value="hidden">Ocultos de esta lista</option></select></label><label>Ordenar<select data-followup-sort><option value="priority">Prioridad: rojos primero</option><option value="days-desc">Más días primero</option><option value="days-asc">Menos días primero</option><option value="name">Nombre A–Z</option></select></label><button type="button" data-configure-rule>Configurar semáforo</button><button type="button" data-followup-reset>Restaurar ocultos</button></div><div data-duration-results aria-live="polite"></div>`;
  function update(){const list=lists.find(l=>l.key===selected),state=states.get(selected);if(!list)return;container.querySelector('[data-configure-rule]').hidden=selected[0]==='m';
   container.querySelector('[data-followup-filter]').value=state.filter;container.querySelector('[data-followup-sort]').value=state.sort;
   container.querySelector('.csm-followup-stages').innerHTML=lists.map(l=>{const red=l.records.filter(r=>r.tone==='red').length,yellow=l.records.filter(r=>r.tone==='yellow').length;return `<button type="button" data-stage="${l.key}" aria-pressed="${l.key===selected}" class="${l.key[0]==='w'?'is-window':''}"><strong>${esc(l.label)}</strong><span>${l.red===null?'Sin reglas de color':`<i class="red">${red} rojos</i><i class="yellow">${yellow} amarillos</i>`}</span><small>${l.records.filter(r=>r.status==='En curso').length} en curso</small></button>`;}).join('');
   container.querySelectorAll('[data-stage]').forEach(b=>b.onclick=()=>{selected=b.dataset.stage;update();});
   const visible=orderRecords(list.records.filter(r=>norm(r.nombre).includes(norm(query))).filter(r=>state.filter==='hidden'?state.hidden.has(r.ghlid||r.id):!state.hidden.has(r.ghlid||r.id)).filter(r=>state.filter==='alerts'?['red','yellow'].includes(r.tone):['red','yellow'].includes(state.filter)?r.tone===state.filter:state.filter==='open'?r.status==='En curso':state.filter==='missing'?!['En curso','Finalizado','Sin iniciar'].includes(r.status):true),state.sort);
   const finished=list.records.filter(r=>r.status==='Finalizado'&&r.days!==null),avg=finished.length?finished.reduce((n,r)=>n+r.days,0)/finished.length:null;
   container.querySelector('[data-duration-results]').innerHTML=`<div class="csm-duration-summary"><span><b>${visible.length}</b> clientes en esta lista</span><span>Promedio finalizados: <b>${amount(avg)}</b></span><span><b>${state.hidden.size}</b> ocultos en esta vista</span></div><p class="csm-duration-note">${list.red===null?'Sin umbrales definidos: se muestran los días y el estado.':`Amarillo desde ${list.yellow} días · Rojo desde ${list.red} días.`} Días calendario; un tramo sin finalizar cuenta hasta hoy. Ocultar sólo afecta esta vista y se revierte al recargar.</p><div class="csm-followup-clients">${visible.map(r=>{const note=notes.get(r.ghlid);return `<article class="csm-followup-client is-${r.tone}"><div class="csm-followup-client-main"><span class="csm-followup-status ${r.tone}">${esc(r.status)}${r.tone==='red'?' · Prioritario':r.tone==='yellow'?' · Atención':''}</span><h3>${r.ghlid?`<a href="https://app.gohighlevel.com/v2/location/WU2z8kl23Dr3IyBW1hv5/contacts/detail/${encodeURIComponent(r.ghlid)}" target="_blank" rel="noopener noreferrer">${esc(r.nombre)} ↗</a>`:esc(r.nombre)}</h3><p>Inicio: ${date(r.start)} · Fin: ${date(r.end)}</p></div><strong class="csm-followup-days">${amount(r.days)}</strong><div class="csm-followup-context"><p>${esc(note?.note||'Sin nota de seguimiento')}</p>${note?`<small>${esc(note.updated_by)} · ${date(note.updated_at)}</small>`:''}<button type="button" data-note="${esc(r.ghlid)}" ${!r.ghlid?'disabled':''}>${note?.note?'Editar contexto':'Agregar contexto'}</button></div><button type="button" data-hide="${esc(r.ghlid||r.id)}">${state.filter==='hidden'?'Restaurar':'Ocultar de esta lista'}</button></article>`;}).join('')||'<div class="csm-followup-empty">No hay clientes con estos filtros. Podés cambiar el estado o elegir otra etapa.</div>'}</div>`;
   container.querySelectorAll('[data-hide]').forEach(b=>b.onclick=()=>{state.hidden.has(b.dataset.hide)?state.hidden.delete(b.dataset.hide):state.hidden.add(b.dataset.hide);update();});
   container.querySelectorAll('[data-note]').forEach(b=>b.onclick=()=>editNote(b.dataset.note));
  }
  function editRule(){const key=selected,previous=rules[key],dialog=document.createElement('dialog');dialog.className='csm-followup-dialog';dialog.innerHTML=`<form><h2>Reglas · ${esc(lists.find(l=>l.key===key).label)}</h2><p>Se aplican a todo el equipo, desde el día indicado inclusive.</p><label>Amarillo desde (días)<input name="yellow" type="number" min="0" max="3649" step="1" required value="${previous?.yellow??''}"></label><label>Rojo desde (días)<input name="red" type="number" min="1" max="3650" step="1" required value="${previous?.red??''}"></label><p role="alert"></p><button type="button">Cancelar</button><button type="submit">Guardar reglas</button></form>`;document.body.append(dialog);dialog.querySelector('[type=button]').onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();const button=dialog.querySelector('[type=submit]');button.disabled=true;try{const yellow=Number(dialog.querySelector('[name=yellow]').value),red=Number(dialog.querySelector('[name=red]').value);if(red<=yellow)throw Error('Rojo debe ser mayor que amarillo');const response=await fetch('/api/metricas/csm-followup-rules/'+key,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({yellow,red,revision:previous?.revision||0})});const saved=await response.json();if(response.status===409)throw Error('Otra persona cambió las reglas. Recargá la página.');if(!response.ok)throw Error(saved.message||'No se pudo guardar');rules[key]=saved;lists=operationalLists(rows,options.mode,today(),rules);states.get(key).filter='alerts';followupPromise=null;dialog.close();update();}catch(err){dialog.querySelector('[role=alert]').textContent=err.message;button.disabled=false;}};dialog.showModal();}
  function editNote(id){const previous=notes.get(id),dialog=document.createElement('dialog');dialog.className='csm-followup-dialog';dialog.innerHTML=`<form><h2>Contexto para el equipo</h2><label>Motivo o último seguimiento<textarea maxlength="4000" rows="6" required>${esc(previous?.note||'')}</textarea></label><p data-note-error role="alert"></p><div><button type="button" data-cancel>Cancelar</button><button type="submit">Guardar nota compartida</button></div></form>`;document.body.append(dialog);dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove());dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();const button=dialog.querySelector('[type=submit]');button.disabled=true;try{const response=await fetch('/api/metricas/csm-followup/'+encodeURIComponent(id),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({note:dialog.querySelector('textarea').value,revision:previous?.revision||0})});const saved=await response.json();if(response.status===409)throw Error('Otra persona cambió la nota. Copiá tu texto y recargá antes de guardar.');if(!response.ok)throw Error(saved.message||'No se pudo guardar');notes.set(id,saved);followupPromise=null;dialog.close();update();}catch(err){dialog.querySelector('[data-note-error]').textContent=err.message;button.disabled=false;}};dialog.showModal();}
  container.querySelector('[data-configure-rule]').onclick=editRule;
  container.querySelector('[data-duration-search]').oninput=e=>{query=e.target.value;update();};container.querySelector('[data-followup-filter]').onchange=e=>{states.get(selected).filter=e.target.value;update();};container.querySelector('[data-followup-sort]').onchange=e=>{states.get(selected).sort=e.target.value;update();};container.querySelector('[data-followup-reset]').onclick=()=>{states.get(selected).hidden.clear();update();};update();
 }
 async function mount(){const container=document.getElementById('csmModuleDurations');if(!container)return;container.innerHTML='<p>Cargando módulos y ventanas…</p>';try{const response=await window.metricasApi.fetchAllRows('csm',{limit:1000});render(container,Array.isArray(response)?response:response.rows||[]);}catch(e){container.textContent='No se pudieron cargar módulos y ventanas: '+e.message;}}
 return {calculate,build,interval,render,mount,exclusion,operationalLists,orderRecords,sessions};
});
