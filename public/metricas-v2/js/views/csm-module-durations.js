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
 function render(container,rows){
  const modules=build(rows);let selected=1,query='';
  container.innerHTML=`<div class="csm-duration-head"><div><span>Semáforo · Módulos y ventanas</span><h2>Tiempo de cursada y espera entre módulos</h2><p>Duración = fin − inicio. Ventana = inicio siguiente − fin anterior. Mismo día: 0 días. Los tiempos abiertos llegan hasta hoy; no se inventan fechas faltantes.</p></div><label>Módulo<select data-duration-module>${definitions.map(d=>`<option value="${d.number}">${d.label}</option>`).join('')}</select></label><label>Buscar cliente<input data-duration-search type="search" placeholder="Nombre del cliente" /></label></div><div data-duration-results></div>`;
  function update(){const m=modules[selected-1],records=m.records.filter(r=>norm(r.nombre).includes(norm(query))).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));container.querySelector('[data-duration-results]').innerHTML=`<div class="csm-duration-summary"><span>Duración promedio finalizados: <b>${amount(m.averageDuration)}</b> (${m.finished})</span><span>Ventana promedio cerrada: <b>${amount(m.averageWindow)}</b> (${m.closedWindows})</span><span>En curso: <b>${m.records.filter(r=>r.status==='En curso').length}</b></span></div><p class="csm-duration-note">${m.red===null?'Este módulo no tiene umbrales de color definidos.':`En curso: amarillo desde ${m.yellow} días y rojo desde ${m.red}.`} Las ventanas muestran días sin color de alerta. Pausas y clientes sin acceso no generan alertas; los días son calendario, sin descontar pausas. Promedios sobre todos los registros del módulo.</p><div class="csm-duration-scroll" role="region" aria-label="Duraciones y ventanas" tabindex="0"><table><thead><tr><th>Cliente</th><th>Inicio ${m.label}</th><th>Fin ${m.label}</th><th>Duración</th><th>Estado</th><th>${selected<10?'Inicio '+definitions[selected].label:'Siguiente'}</th><th>Ventana</th><th>Estado ventana</th></tr></thead><tbody>${records.map(r=>`<tr><td>${r.ghlid?`<a href="https://app.gohighlevel.com/v2/location/WU2z8kl23Dr3IyBW1hv5/contacts/detail/${encodeURIComponent(r.ghlid)}" target="_blank" rel="noopener noreferrer">${esc(r.nombre)}</a>`:esc(r.nombre)}</td><td>${date(r.start)}</td><td>${date(r.end)}</td><td><span class="csm-duration-tone ${r.tone}">${amount(r.days)}</span></td><td>${esc(r.status)}${r.status==='En curso'&&!r.eligible?' · sin alerta':''}</td><td>${date(r.next)}</td><td>${amount(r.windowDays)}</td><td>${esc(r.windowStatus)}</td></tr>`).join('')||'<tr><td colspan="8">Sin fechas registradas para este módulo.</td></tr>'}</tbody></table></div>`;}
  container.querySelector('[data-duration-module]').addEventListener('change',e=>{selected=Number(e.target.value);update();});container.querySelector('[data-duration-search]').addEventListener('input',e=>{query=e.target.value;update();});update();
 }
 async function mount(){const container=document.getElementById('csmModuleDurations');if(!container)return;container.innerHTML='<p>Cargando módulos y ventanas…</p>';try{const response=await window.metricasApi.fetchAllRows('csm',{limit:1000});render(container,Array.isArray(response)?response:response.rows||[]);}catch(e){container.textContent='No se pudieron cargar módulos y ventanas: '+e.message;}}
 return {calculate,build,interval,render,mount};
});
