(function(){
  const MEMBERS=['Valeria Calmet','Sofia Gallardo','Gabriela Costa'];
  const MONTHS=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const state={entries:[],canEdit:false};
  const $=(id)=>document.getElementById(id);
  const esc=(value)=>String(value??'').replace(/[&<>'"]/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const period=()=>({anio:Number($('year').value),mes:Number($('month').value),area:'csm'});
  function setMeta(message,tone=''){ $('meta').textContent=message;$('meta').className=`meta ${tone}`; }
  function setFormEnabled(enabled){['member','type','quantity','detail','save'].forEach((id)=>$(id).disabled=!enabled);}
  function summary(){
    const rows=new Map(MEMBERS.map((name)=>[name,{name,checks:0,strikes:0,pendientes:0,total:0}]));
    state.entries.forEach((entry)=>{const row=rows.get(entry.closer_nombre)||{name:entry.closer_nombre,checks:0,strikes:0,pendientes:0,total:0};const qty=Number(entry.cantidad||1);if(entry.tipo==='check'){row.checks+=qty;row.total+=qty}else if(entry.tipo==='strike'){row.strikes+=qty;row.total-=qty}else if(entry.tipo==='pendiente')row.pendientes+=(entry.operacion==='restar'?-qty:qty);rows.set(row.name,row)});
    return [...rows.values()].sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name,'es'));
  }
  function render(){
    const rows=summary();
    $('cards').innerHTML=rows.map((row)=>`<article class="card"><h3>${esc(row.name)}</h3><div class="pills"><span class="pill check">${row.checks} checks</span><span class="pill strike">${row.strikes} strikes</span><span class="pill pending">${row.pendientes} pendientes</span></div><div class="score">${row.total>0?'+':''}${row.total} pts</div></article>`).join('');
    $('ranking').innerHTML=`<table class="table"><thead><tr><th>Puesto</th><th>CSM</th><th class="number">Checks</th><th class="number">Strikes</th><th class="number">Pendientes</th><th class="number">Puntaje</th></tr></thead><tbody>${rows.map((row,index)=>`<tr><td>${index+1}</td><td>${esc(row.name)}</td><td class="number">${row.checks}</td><td class="number">${row.strikes}</td><td class="number">${row.pendientes}</td><td class="number">${row.total}</td></tr>`).join('')}</tbody></table>`;
    $('history').innerHTML=state.entries.length?`<table class="table"><thead><tr><th>Fecha</th><th>CSM</th><th>Tipo</th><th class="number">Cantidad</th><th>Detalle</th><th></th></tr></thead><tbody>${state.entries.map((entry)=>`<tr><td>${esc(new Date(entry.created_at).toLocaleString('es-AR'))}</td><td>${esc(entry.closer_nombre)}</td><td>${esc(entry.tipo==='pendiente'?(entry.operacion==='restar'?'Pendiente resuelto':'Pendiente'):entry.tipo)}</td><td class="number">${entry.cantidad||1}</td><td>${esc(entry.detalle)}</td><td>${state.canEdit?`<button class="btn danger" data-delete="${esc(entry.id)}">Eliminar</button>`:''}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">Sin movimientos para este mes.</div>';
    setFormEnabled(state.canEdit);
  }
  async function load(){
    setFormEnabled(false);setMeta('Cargando rendimiento CSM...');
    try{const data=await window.metricasApi.fetchAgendaCheckpoints(period());state.entries=data.entries||[];state.canEdit=data.canEdit===true;render();setMeta(state.canEdit?'Edición habilitada.':'Modo lectura.','ok')}catch(error){state.entries=[];state.canEdit=false;render();setMeta(error.message||'No se pudo cargar el rendimiento.','error')}
  }
  async function save(event){
    event.preventDefault();const [tipo,operacion='sumar']=$('type').value.split(':');const cantidad=Number($('quantity').value);if(!Number.isInteger(cantidad)||cantidad<1||cantidad>50)return setMeta('Ingresá una cantidad entre 1 y 50.','error');if(!$('detail').value.trim())return setMeta('Ingresá el detalle.','error');
    try{setFormEnabled(false);const data=await window.metricasApi.saveAgendaCheckpoint({...period(),closer_nombre:$('member').value,tipo,operacion,cantidad,detalle:$('detail').value.trim()});state.entries=data.entries||[];state.canEdit=data.canEdit===true;$('detail').value='';$('quantity').value='1';render();setMeta('Movimiento guardado.','ok')}catch(error){render();setMeta(error.message||'No se pudo guardar.','error')}
  }
  async function remove(id){if(!confirm('¿Eliminar este movimiento?'))return;try{const data=await window.metricasApi.saveAgendaCheckpoint({...period(),action:'delete',id});state.entries=data.entries||[];state.canEdit=data.canEdit===true;render();setMeta('Movimiento eliminado.','ok')}catch(error){setMeta(error.message||'No se pudo eliminar.','error')}}
  function csvCell(value){return `"${String(value??'').replace(/"/g,'""').replace(/\r?\n/g,' ')}"`}
  function exportCsv(){const rows=[['Periodo',`${$('year').value}-${String($('month').value).padStart(2,'0')}`],[],['CSM','Checks','Strikes','Pendientes','Puntaje'],...summary().map(r=>[r.name,r.checks,r.strikes,r.pendientes,r.total]),[],['Fecha','CSM','Tipo','Operacion','Cantidad','Detalle','Cargado por'],...state.entries.map(e=>[e.created_at,e.closer_nombre,e.tipo,e.operacion||'',e.cantidad||1,e.detalle,e.created_by_email||''])];const blob=new Blob([`\uFEFF${rows.map(r=>r.map(csvCell).join(';')).join('\r\n')}`],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`rendimiento-csm-${$('year').value}-${String($('month').value).padStart(2,'0')}.csv`;link.click();URL.revokeObjectURL(url)}
  function init(){const now=new Date();$('year').innerHTML=Array.from({length:5},(_,i)=>now.getFullYear()-2+i).map(y=>`<option value="${y}">${y}</option>`).join('');$('month').innerHTML=MONTHS.map((name,i)=>`<option value="${i+1}">${name}</option>`).join('');$('year').value=now.getFullYear();$('month').value=now.getMonth()+1;$('member').innerHTML=MEMBERS.map(name=>`<option>${esc(name)}</option>`).join('');$('year').addEventListener('change',load);$('month').addEventListener('change',load);$('movement-form').addEventListener('submit',save);$('export').addEventListener('click',exportCsv);$('history').addEventListener('click',(event)=>{const id=event.target.dataset.delete;if(id)remove(id)});load()}
  init();
})();
