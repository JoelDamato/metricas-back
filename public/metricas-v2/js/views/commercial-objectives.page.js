(()=>{
const $=id=>document.getElementById(id),state={channel:'evergreen',leads:[],leadId:0,data:null,loadId:0,historyId:0,saving:false};
const fields=[['agendas','Agendas aplicables','number'],['calls','Llamadas efectuadas','number'],['sales','Ventas','number'],['billing','Facturación USD','money'],['attendance','Tasa de asistencia','percent'],['closing','Tasa de cierre','percent']];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=(v,d=1)=>Number(v).toLocaleString('es-AR',{maximumFractionDigits:d});
const fmt=(v,type='number')=>v===null||v===undefined?'—':type==='money'?'USD '+number(v,2):type==='percent'?number(v)+'%':number(v);
const monthName=m=>new Date(m+'-15T12:00:00').toLocaleDateString('es-AR',{month:'long',year:'numeric'});
const monthSelect = $('co-month');
const yearSelect = $('co-year');
const currentDateParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit'
}).formatToParts(new Date());
const currentYear = Number(currentDateParts.find(part => part.type === 'year').value);
const currentMonth = currentDateParts.find(part => part.type === 'month').value;
const currentPeriod = `${currentYear}-${currentMonth}`;
const monthFormatter = new Intl.DateTimeFormat('es-AR', { month: 'long', timeZone: 'UTC' });

function selectPeriod(period) {
  const [year, month] = period.split('-');
  yearSelect.value = year;
  monthSelect.value = month;
}

function selectedPeriod() {
  return `${yearSelect.value}-${monthSelect.value}`;
}

for (let month = 1; month <= 12; month++) {
  const label = monthFormatter.format(new Date(Date.UTC(2026, month - 1, 1)));
  const value = String(month).padStart(2, '0');
  monthSelect.add(new Option(label[0].toUpperCase() + label.slice(1), value));
}
const lastSupportedYear = Math.min(currentYear, 2099);
for (let year = lastSupportedYear; year >= 2000; year--) {
  yearSelect.add(new Option(String(year), String(year)));
}
if (lastSupportedYear < 2099) {
  const futureYears = document.createElement('optgroup');
  futureYears.label = 'Años próximos';
  for (let year = lastSupportedYear + 1; year <= 2099; year++) {
    futureYears.append(new Option(String(year), String(year)));
  }
  yearSelect.add(futureYears);
}
selectPeriod(currentPeriod);
$('co-fields').innerHTML=fields.map(([key,label,type])=>`<label>${label}<input name="${key}" type="number" required min="0" max="${type==='percent'?100:1e12}" step="${type==='number'?1:.01}"></label>`).join('');
function card(key,label,type,actual,target){const v=actual[key],goal=target?.[key],ratio=goal>0&&v!==null?v/goal*100:null;const difference=goal!==undefined&&v!==null?v-goal:null;return `<article class="co-card"><div class="co-label">${label}</div><div class="co-number">${fmt(v,type)}</div><div class="co-goal">Objetivo: ${fmt(goal,type)}</div><div class="co-progress" aria-hidden="true"><span style="width:${ratio===null?0:Math.max(0,Math.min(100,ratio))}%"></span></div><div class="co-meta">${ratio===null?'Cumplimiento: —':fmt(ratio,'percent')+' de cumplimiento'}<br>Diferencia: ${difference===null?'—':(difference>0?'+':'')+fmt(difference,type==='percent'?'number':type)+(type==='percent'?' puntos porcentuales':'')}</div></article>`;}
function render(data){const {actual:a,target:t,closers}=data;const current=data.month===currentPeriod; $('co-results').innerHTML=`<h2 class="co-month-heading">${data.channel==='lanzamiento'?'Lanzamiento':'Evergreen'} · ${esc(monthName(data.month))}</h2><p class="co-meta">${current?'Mes en curso · resultados parciales. ':''}${!t&&data.legacyTarget?'Existe un objetivo anterior sin canal asignado; no se aplica automáticamente a esta pestaña. ':''}${t?'Objetivos guardados · '+esc(new Date(t.updatedAt).toLocaleString('es-AR')):'Sin objetivos cargados para este mes. Los resultados reales se muestran igualmente.'}</p><div class="co-funnel">${fields.slice(0,4).map(([k,l,type])=>card(k,l,type,a,t)).join('')}</div><div class="co-rates">${card('fortnightAverage','Promedio de agendas por quincena','number',a,t?{fortnightAverage:t.agendas/2}:null)}${fields.slice(4).map(([k,l,type])=>card(k,l,type,a,t)).join('')}</div><p class="co-meta">Ticket promedio real: <b>${fmt(a.ticket,'money')}</b> · Ticket objetivo: <b>${fmt(t?.sales?t.billing/t.sales:null,'money')}</b></p><section class="co-panel"><h2>Detalle real por closer</h2><div class="co-scroll"><table><thead><tr><th>Closer</th><th>Agendas aplicables</th><th>Llamadas</th><th>Ventas</th><th>Facturación</th><th>Asistencia</th><th>Cierre</th></tr></thead><tbody>${closers.length?closers.map(r=>`<tr><td>${esc(r.closer)}</td>${fields.map(([k,,type])=>`<td>${fmt(r[k],type)}</td>`).join('')}</tr>`).join(''):'<tr><td colspan="7">Sin registros para este mes.</td></tr>'}</tbody><tfoot><tr><th>Total equipo</th>${fields.map(([k,,type])=>`<th>${fmt(a[k],type)}</th>`).join('')}</tr></tfoot></table></div></section>`;}
async function load(){const id=++state.loadId,month=selectedPeriod();state.data=null;state.historyId++;state.leadId++;state.leads=[];$('co-lead-panel').hidden=true;$('co-leads').hidden=true;$('co-lead-search').value='';$('co-lead-status').value='';$('co-channel-description').textContent=state.channel==='lanzamiento'?'Lanzamiento: agendas y ventas atribuidas al webinar. Objetivos independientes de Evergreen.':'Evergreen: resultados habituales, excluyendo Webinar y Lanzamiento. Objetivos independientes por mes.';$('co-history').hidden=true;$('co-editor').hidden=true;$('co-edit').hidden=true;$('co-results').innerHTML='';$('co-status').className='';$('co-status').textContent='Consultando objetivos y resultados reales…';try{const data=await window.http.getJson('/api/metricas/commercial-objectives?month='+encodeURIComponent(month)+'&channel='+state.channel);if(id!==state.loadId)return;state.data=data;render(data);$('co-edit').hidden=!data.canEdit;$('co-lead-panel').hidden=data.canViewLeads!==true;$('co-status').textContent='Datos consultados: '+new Date(data.consultedAt).toLocaleString('es-AR');}catch(e){if(id!==state.loadId)return;$('co-status').className='co-error';$('co-status').textContent=e.message||'No se pudieron cargar los resultados. Reintentá con Actualizar resultados.';}}
monthSelect.addEventListener('change', load);
yearSelect.addEventListener('change', load);
$('co-refresh').addEventListener('click',load);
$('co-edit').onclick=()=>{if(!state.data)return;for(const [key] of fields)$('co-form').elements[key].value=state.data.target?.[key]??'';$('co-example').hidden=state.data.month!=='2026-11'||state.channel!=='evergreen';$('co-save-status').textContent='';$('co-editor').hidden=false;$('co-editor').scrollIntoView({behavior:'smooth'});};
$('co-example').onclick=()=>{const reference={agendas:170,calls:77,sales:19,billing:67000,attendance:45,closing:25};for(const [k,v]of Object.entries(reference))$('co-form').elements[k].value=v;};
$('co-cancel').onclick=()=>{$('co-editor').hidden=true;};
$('co-form').onsubmit=async e=>{e.preventDefault();if(state.saving||!state.data)return;const month=state.data.month;const payload={month,channel:state.channel,...Object.fromEntries(fields.map(([k])=>[k,Number($('co-form').elements[k].value)]))};state.saving=true;$('co-save').disabled=true;monthSelect.disabled=true;yearSelect.disabled=true;$('co-refresh').disabled=true;try{await window.http.postJson('/api/metricas/commercial-objectives',payload);await load();if(state.data)$('co-status').textContent='Objetivos de '+monthName(month)+' guardados correctamente.';else $('co-status').textContent='Los objetivos se guardaron, pero no se pudieron actualizar los resultados. Reintentá con Actualizar resultados.';}catch(error){$('co-save-status').textContent=error.message||'No se pudieron guardar los objetivos.';}finally{state.saving=false;$('co-save').disabled=false;monthSelect.disabled=false;yearSelect.disabled=false;$('co-refresh').disabled=false;}};
$('co-history-button').onclick=async()=>{const id=++state.historyId,year=yearSelect.value;$('co-history').hidden=false;$('co-history-content').textContent='Cargando comparación de '+year+'…';try{const {months}=await window.http.getJson('/api/metricas/commercial-objectives/history?year='+year+'&channel='+state.channel);if(id!==state.historyId)return;$('co-history-content').innerHTML='<p class="co-meta">Cada celda muestra real / objetivo. Seleccioná un mes para consultar o editar sus metas.</p><div class="co-scroll"><table><thead><tr><th>Mes</th>'+fields.map(([,label])=>'<th>'+label+'</th>').join('')+'</tr></thead><tbody>'+months.map(r=>`<tr><td><button data-month="${r.month}">${esc(monthName(r.month))}</button></td>${fields.map(([key,,type])=>`<td>${fmt(r.actual[key],type)} / ${fmt(r.target?.[key],type)}</td>`).join('')}</tr>`).join('')+'</tbody></table></div>';for(const button of $('co-history-content').querySelectorAll('[data-month]'))button.onclick=()=>{if(state.saving)return;selectPeriod(button.dataset.month);load();};}catch(e){if(id===state.historyId)$('co-history-content').textContent=e.message||'No se pudo consultar el historial.';}};
for(const button of document.querySelectorAll('[data-channel]'))button.onclick=()=>{if(state.saving||button.dataset.channel===state.channel)return;state.channel=button.dataset.channel;for(const tab of document.querySelectorAll('[data-channel]'))tab.setAttribute('aria-pressed',String(tab.dataset.channel===state.channel));load();};
const date=value=>value?new Date(String(value).length===10?value+'T12:00:00':value).toLocaleDateString('es-AR',{timeZone:'UTC'}):'—';
function renderLeads(){const closer=$('co-lead-closer').value,status=$('co-lead-status').value,search=$('co-lead-search').value.toLocaleLowerCase('es');const rows=state.leads.filter(r=>(!closer||r.closer===closer)&&(!status||r.status===status)&&r.name.toLocaleLowerCase('es').includes(search));const summary=['Asistió','Ausente','Cancelada','Pendiente','Sin clasificar'].map(s=>s+': '+rows.filter(r=>r.status===s).length).join(' · ');$('co-lead-content').innerHTML=`<p class="co-meta">${rows.length} agendas · ${summary}</p><p class="co-meta">Incluye agendas que no aplican, por eso puede diferir de «Agendas aplicables» del embudo. Los datos se consultan en vivo; pueden diferir de la foto del 19/11.</p><div class="co-scroll"><table><thead><tr><th>Prospecto</th><th>Closer</th><th>Agenda</th><th>Llamada</th><th>Estado</th><th>Calificación</th><th>Contacto</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.name)}</td><td>${esc(r.closer)}</td><td>${date(r.agenda)}</td><td>${date(r.callDate)}</td><td>${esc(r.status)}</td><td>${esc(r.applies)}</td><td>${r.ghlid?`<a href="https://app.gohighlevel.com/v2/location/WU2z8kl23Dr3IyBW1hv5/contacts/detail/${encodeURIComponent(r.ghlid)}" target="_blank" rel="noopener noreferrer">Abrir GHL ↗</a>`:'—'}</td></tr>`).join('')||'<tr><td colspan="7">Sin leads para estos filtros.</td></tr>'}</tbody></table></div>`;}
for(const id of ['co-lead-closer','co-lead-status','co-lead-search'])$(id).addEventListener('input',renderLeads);
$('co-leads-button').onclick=async()=>{if(state.data?.canViewLeads!==true)return;const id=++state.leadId;$('co-leads').hidden=false;$('co-lead-content').textContent='Consultando leads y asistencia…';try{const data=await window.http.getJson('/api/metricas/commercial-objectives/leads?month='+encodeURIComponent(selectedPeriod())+'&channel='+state.channel);if(id!==state.leadId)return;state.leads=data.leads;$('co-lead-closer').innerHTML='<option value="">Todos</option>'+[...new Set(data.leads.map(r=>r.closer))].sort().map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');renderLeads();}catch(e){if(id===state.leadId)$('co-lead-content').textContent=e.message||'No se pudieron consultar los leads.';}};

load();
})();
