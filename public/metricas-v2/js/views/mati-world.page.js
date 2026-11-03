(()=>{'use strict';
const $=id=>document.getElementById(id),svgNS='http://www.w3.org/2000/svg';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rooms={agendas:{x:740,y:190,wall:'#c3d9de',floor:'#dae7e2',accent:'#638b9b'},ventas:{x:1195,y:190,wall:'#e7d5b2',floor:'#f0e5ce',accent:'#b5894f'},administracion:{x:1650,y:190,wall:'#dfc1b6',floor:'#eddad0',accent:'#a86e59'},ingreso:{x:955,y:590,wall:'#d4c9df',floor:'#e8e1eb',accent:'#8d779b'},csm:{x:1480,y:590,wall:'#bcd4b7',floor:'#dce9ce',accent:'#62845b'}};
let data=null,selected=null,filterRows=[],listMode=null,listPage=0,loading=false,timer=null,lastSuccess=null;
let camera={x:0,y:0,k:1},drag=null,dragged=false,lastFocus=null;
const positions=new Map(),actors=new Map(),seen=new Map();
function el(tag,attrs={},html=''){const n=document.createElementNS(svgNS,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);if(html)n.innerHTML=html;return n;}
const iso=(u,v,z=0)=>[(u-v)*26,(u+v)*13-z];
const pts=points=>points.map(p=>p.join(',')).join(' ');
function poly(points,fill,stroke){return `<polygon points="${pts(points)}" fill="${fill}"${stroke?` stroke="${stroke}" stroke-width="1"`:''}/>`;}
function box(u,v,w,d,h,top,left,right){const a=iso(u,v),b=iso(u+w,v),c=iso(u+w,v+d),e=iso(u,v+d),lift=p=>[p[0],p[1]-h];return poly([a,b,lift(b),lift(a)],right)+poly([e,c,lift(c),lift(e)],left)+poly([lift(a),lift(b),lift(c),lift(e)],top);}
function plant(u,v){const [x,y]=iso(u,v);return `<g transform="translate(${x} ${y})">${box(0,0,.48,.48,13,'#b57c58','#80583e','#976548')}<path d="M0 -13V-44M0 -29L-12 -37M0 -22L12 -33" stroke="#527744" stroke-width="4"/><path d="M0 -37q-20 -20 -20 -3q8 12 20 8M0 -29q22 -22 24 -7q-4 14 -24 15M0 -43q-3 -19 9 -19q12 12 -9 28" fill="#7b9c62"/></g>`;}
function desk(u,v,c){return box(u,v,1.8,.9,25,'#cfa87d','#9b7857','#b38b63')+box(u+.4,v+.12,.65,.12,45,c,'#354f4f','#41585a')+box(u+.2,v+.5,.7,.22,27,'#f3f0df','#d4c9b4','#bdb49f')+box(u+.65,v+1.2,.6,.6,14,c,'#47665c','#668573');}
function staffAvatar(x,y,name,role,shirt,hair='#44352e'){
 return `<g class="staff" transform="translate(${x} ${y})" role="img" aria-label="${esc(name)} · ${esc(role)}. Representación del equipo, no presencia en vivo"><title>${esc(name)} · ${esc(role)}</title><ellipse cy="1" rx="16" ry="7" fill="#193b32" opacity=".15"/><g shape-rendering="crispEdges"><path d="M-9 -14h7V0h-9v-4h2M2 -14h7V0H0v-4h2" fill="#364451"/><path d="M-11 -32h22v20h-22z" fill="${shirt}"/><path d="M-15 -29h4v17h-4M11 -29h4v17h-4" fill="#d7a27c"/><path d="M-9 -49h18v19h-18z" fill="#e4b18b"/><path d="M-10 -50h20v8h-5v-4H-5v8h-5z" fill="${hair}"/><path d="M-5 -39h2M4 -39h2" stroke="#293d38" stroke-width="2"/></g><rect x="-72" y="-86" width="144" height="35" rx="7" fill="#fbfcf3" stroke="#bccab6"/><text y="-72" text-anchor="middle" font-size="11" font-weight="700" fill="#294d3c">${esc(name)}</text><text y="-59" text-anchor="middle" font-size="9" fill="#6c7d6b">${esc(role)}</text></g>`;
}
function teamOffice(x,y,scalo){
 const accent=scalo?'#5375a0':'#42664f';let art=box(0,0,9,7,14,'#ece7d4','#8d9e84','#b0bba2');
 for(let u=0;u<9;u++)for(let v=0;v<7;v++)art+=poly([iso(u,v,15),iso(u+1,v,15),iso(u+1,v+1,15),iso(u,v+1,15)],(u+v)%2?'#e7e8dc':'#f5f2e6','#dfdfd1');
 art+=poly([iso(0,0,15),iso(9,0,15),iso(9,0,105),iso(0,0,105)],scalo?'#bccdde':'#c0d0b3')+poly([iso(0,0,15),iso(0,7,15),iso(0,7,105),iso(0,0,105)],scalo?'#d1deea':'#dce4cf');
 if(scalo){
  art+=`<g transform="translate(55 -42)"><rect width="108" height="60" rx="4" fill="#23394e"/><text x="10" y="14" fill="#b7d5e6" font-size="8" letter-spacing="2">SCALO / LAB</text><path d="M12 48h84M12 48V25" fill="none" stroke="#6c8393"/><path d="M18 42l14 -8 14 4 16 -15 13 5 15 -10" fill="none" stroke="#9ec9a1" stroke-width="3"/></g>`;
 }else art+=`<rect x="9" y="-78" width="198" height="63" rx="5" fill="#315444"/><image href="/assets/mati-randazzo-logo-web.png" x="13" y="-73" width="190" height="55"/>`;
 art+=plant(.7,.6)+plant(.6,6);
 for(const [i,u,v]of [[0,1,2],[1,6,1.3],[2,5,5]]){
  art+=desk(u,v,accent);const [px,py]=iso(u+.65,v+1.6,15);
  const names=scalo?['Scalo · 01','Scalo · 02','Scalo · 03']:['Mati','Leo','Walter'];
  const roles=scalo?['Puesto de trabajo','Puesto de trabajo','Puesto de trabajo']:['CEO','Director comercial','Director de marketing'];
  art+=staffAvatar(px,py,names[i],roles[i],scalo?['#587b9d','#8d9b65','#a17f9f'][i]:['#f0e5d1','#6e8aa1','#9d8069'][i]);
 }
 art+=`<g transform="translate(-60 -140)"><rect x="-50" y="-23" width="285" height="49" rx="11" fill="${accent}"/><text x="92" y="-2" text-anchor="middle" fill="#fffbed" font-size="16" font-weight="700">${scalo?'SCALO · OPERACIONES':'DIRECCIÓN · MATÍAS RANDAZZO'}</text><text x="92" y="15" text-anchor="middle" fill="#e3ead9" font-size="10">${scalo?'Computadoras · análisis · mediciones':'Mati / Leo / Walter'}</text></g>`;
 return `<g transform="translate(${x} ${y})" filter="url(#shadow)">${art}</g>`;
}
function building(){
 let art='';
 // A cutaway headquarters: connected floors, front facade and a broad entrance staircase.
 art+=poly([[475,265],[1120,-30],[1910,345],[1390,925],[470,540]],'#aab99c');
 art+=poly([[475,245],[1120,-50],[1910,325],[1390,905],[470,520]],'#edf0df','#c1cdb3');
 art+=poly([[470,520],[1390,905],[1390,952],[470,567]],'#b6c4a9');
 art+=poly([[1390,905],[1910,325],[1910,372],[1390,952]],'#91a88d');
 // Glass and timber front, intentionally open above so the operation remains visible.
 for(let n=0;n<8;n++){const x=560+n*67,y=558+n*28;art+=poly([[x,y],[x+50,y+21],[x+50,y+48],[x,y+27]],'#6c999b','#e8edda');}
 art+=`<g transform="translate(1100 39)"><rect x="-174" y="-68" width="348" height="84" rx="12" fill="#315444" stroke="#e4c67f" stroke-width="3"/><image href="/assets/mati-randazzo-logo-web.png" x="-154" y="-65" width="308" height="78"/><text y="38" text-anchor="middle" font-size="12" fill="#5e7459" letter-spacing="5">CASA CENTRAL</text></g>`;
 // Exterior garden paths leading to both standalone offices and the headquarters.
 art+=poly([[210,710],[470,650],[1180,1000],[1985,735],[2170,805],[1190,1120]],'#d7d4bd');
 art+=poly([[210,710],[470,635],[1180,980],[1985,720],[2170,790],[1190,1100]],'#f3efdc','#c9cfb8');
 // Entry staircase, each tread is a real isometric block.
 for(let i=0;i<6;i++){const x=1160-i*9,y=904+i*19;art+=poly([[x-100,y],[x+70,y-36],[x+105,y-19],[x-65,y+17]],'#f7f4e4','#bec6ac')+poly([[x-65,y+17],[x+105,y-19],[x+105,y-11],[x-65,y+25]],'#b5bea5');}
 art+=`<g transform="translate(1248 900)"><rect x="-42" y="-66" width="84" height="62" fill="#789d96" stroke="#e3eadb" stroke-width="5"/><path d="M0 -66v62M-7 -35v12M7 -35v12" stroke="#f2e9cc" stroke-width="3"/><rect x="-61" y="-91" width="122" height="25" rx="5" fill="#315444"/><text y="-74" text-anchor="middle" font-size="11" letter-spacing="2" fill="#fff8db">BIENVENIDOS</text></g>`;
 art+=plantAt(490,730)+plantAt(1830,850)+plantAt(1070,1055)+plantAt(1355,1015);
 return art;
}
function plantAt(x,y){return `<g transform="translate(${x} ${y}) scale(1.5)">${plant(0,0)}</g>`;}
function architecture(){let html=building();
 html+=`<g transform="translate(400 0)" opacity=".8">${poly([[265,400],[815,125],[1440,430],[865,715]],'#c5d0bb')}${poly([[283,401],[815,142],[1420,429],[865,695]],'#f0ecdb')}${poly([[400,530],[720,371],[1310,665],[992,823]],'#eff0dc')}</g>`;
 // Indoor steps link the commercial floor with onboarding and the community.
 for(let i=0;i<7;i++)html+=`<g transform="translate(${1170-i*12} ${440+i*16})">${box(0,0,2.5,.7,9,'#e7dfc8','#a6b39a','#c1c8af')}</g>`;
 for(const [id,r]of Object.entries(rooms)){
 let art='';const w=9,d=7;
 art+=box(0,0,w,d,12,'#d8ddc9','#9ca78e','#b3bda4');
 for(let u=0;u<w;u++)for(let v=0;v<d;v++)art+=poly([iso(u,v,13),iso(u+1,v,13),iso(u+1,v+1,13),iso(u,v+1,13)],(u+v)%2?r.floor:'#f3f0df',r.floor);
 art+=poly([iso(0,0,13),iso(w,0,13),iso(w,0,90),iso(0,0,90)],r.wall)+poly([iso(0,0,13),iso(0,d,13),iso(0,d,90),iso(0,0,90)],r.wall);
 art+=poly([iso(0,0,90),iso(w,0,90),iso(w,0,96),iso(0,0,96)],'#f9f6e8')+poly([iso(0,0,90),iso(0,d,90),iso(0,d,96),iso(0,0,96)],'#fbf8ea');
 // Windows, wall art and handcrafted furniture in world coordinates.
 art+=poly([iso(.7,0,40),iso(2.8,0,40),iso(2.8,0,80),iso(.7,0,80)],'#f7f3df','#a8b7aa')+poly([iso(.85,0,43),iso(2.65,0,43),iso(2.65,0,76),iso(.85,0,76)],'#94b7bd');
 art+=`<path d="M${iso(1.75,0,43).join(' ')}L${iso(1.75,0,76).join(' ')}" stroke="#e6e7d4" stroke-width="3"/>`;
 if(id==='csm'){
 art+=box(3,.6,3,1.4,13,'#b5c58f','#80956b','#93a77b')+box(3,.6,3,.3,28,'#b6c998','#839a73','#99ad80');
 art+=box(.3,3,.6,2,48,'#e5c997','#ac956d','#c8af83');
 for(let v=3.1;v<4.8;v+=.35)art+=box(.32,v,.35,.2,52,'#9cbaaf','#637e74','#8aa39c');
 art+=box(4,2.6,1.5,.8,14,'#dbc395','#aa946f','#c5ad83');
 }else if(id==='ingreso'){
 art+=desk(4,.5,'#a29abb');art+=box(.3,3,.6,1.8,45,'#cdb8b4','#a68c87','#bfa6a0');
 art+=poly([iso(6.6,0,13),iso(8.1,0,13),iso(8.1,0,80),iso(6.6,0,80)],'#8fa78b','#6a8065');
 art+=`<circle cx="${iso(7.7,0,42)[0]}" cy="${iso(7.7,0,42)[1]}" r="3" fill="#f4d086"/>`;
 }else{art+=desk(3,.5,r.accent)+desk(6,.5,r.accent);
 if(id==='administracion')for(let n=0;n<3;n++)art+=box(.3,2+n*.6,.8,.45,22+n*5,'#f8f1d9','#d2c3a3','#e1d5b7');
 else art+=box(.3,3,.7,2,19,r.accent,'#6c8b7d','#8da699');}
 art+=plant(.7,.8)+plant(8.2,5.8);
 const title=data?.zones.find(z=>z.id===id)?.name||id;
 art+=`<g class="room-label" role="button" tabindex="0" aria-label="Ver personas de ${esc(title)}" data-zone="${id}" transform="translate(-60 -115)"><rect x="-60" y="-21" width="260" height="42" rx="12" fill="#fbfbf1" stroke="#c8d3be"/><rect x="-52" y="-13" width="27" height="26" rx="6" fill="${r.accent}"/><text x="-39" y="5" text-anchor="middle" font-size="11" fill="white">${data?.zones.find(z=>z.id===id)?.mark||''}</text><text x="-14" y="4" font-size="13" font-weight="700" fill="#304e3d">${esc(title)}</text><text id="count-${id}" x="184" y="4" text-anchor="end" font-size="13" font-weight="700" fill="${r.accent}">0</text></g>`;
 html+=`<g transform="translate(${r.x} ${r.y})" filter="url(#shadow)">${art}</g>`;
 }
 html+=teamOffice(220,660,false)+teamOffice(2130,660,true);
 html+=`<g transform="translate(1200 1150)"><text fill="#879777" text-anchor="middle" font-size="12" font-family="monospace" letter-spacing="5">MATI WORLD</text><text y="22" fill="#8e9d80" text-anchor="middle" font-size="10">La operación, en perspectiva.</text></g>`;
 $('architecture').innerHTML=html;
 $('architecture').querySelectorAll('[data-zone]').forEach(n=>{const open=()=>showList(n.dataset.zone);n.addEventListener('click',open);n.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();open();}});});
}
function hash(str){let n=0;for(const c of str)n=(Math.imul(n,31)+c.charCodeAt(0))|0;return n>>>0;}
function character(p){const h=hash(p.id),shirts=['#5b8d9c','#af7d5d','#8d7fa3','#9a9d62','#629581','#ac7183'],skin=['#e2b18b','#b98058','#f1c9a8','#8f5e44'],hair=['#47382e','#6b4c35','#a67f49','#303736'];const mark=p.badge==='vigente'?'✓':p.issues.length?'!':p.badge==='venta'?'$':({upcoming:'↑',current:'◷',done:'✓',absent:'×',cancelled:'−'}[p.agenda?.code]||'?');const color=p.issues.length?'#bc7a45':p.badge==='vigente'?'#648661':'#7b9499';
 return `<title>${esc(p.name)} · ${esc(p.state)}</title><ellipse class="selection" cx="0" cy="-1" rx="22" ry="11"/><ellipse cx="0" cy="0" rx="14" ry="6" fill="#486944" opacity=".2"/><g shape-rendering="crispEdges"><path d="M-8 -13h7v14h-9v-5h2zM2 -13h7v14H0v-5h2z" fill="#34464a"/><path d="M-10 -29h20v18h-20z" fill="${shirts[h%shirts.length]}"/><path d="M-14 -26h4v14h-5v-8h1M10 -26h4v14h-4z" fill="${skin[h%4]}"/><path d="M-9 -45h18v18h-18z" fill="${skin[h%4]}"/><path d="M-10 -46h20v8h-4v-4H-5v6h-5z" fill="${hair[(h>>>2)%4]}"/><g class="blink" fill="#39352f"><rect x="-5" y="-36" width="2" height="2"/><rect x="4" y="-36" width="2" height="2"/></g><path d="M-2 -30h4" stroke="#985e46" stroke-width="1"/></g><g transform="translate(13 -48)"><circle r="8" fill="${color}" stroke="#fff7e7" stroke-width="2"/><text text-anchor="middle" y="3" fill="white" font-size="10" font-weight="700">${mark}</text></g><g class="name-tag" transform="translate(0 -75)"><rect x="-88" y="-13" width="176" height="27" rx="7" fill="#233e34"/><text x="0" y="5" text-anchor="middle" font-size="12" fill="#fffbee">${esc(p.name.length>23?p.name.slice(0,22)+'…':p.name)}</text></g>`;
}
const searchKey=v=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
function filtered(){const q=searchKey($('search').value.trim()),area=$('area').value,owner=$('owner').value,state=$('state').value;return (data?.people||[]).filter(p=>(!q||searchKey(p.name).includes(q))&&(!area||p.zone===area)&&(!owner||(owner==='__none'?!p.owner:Object.values(p.owners).includes(owner)))&&(!state||p.state===state));}
function draw(){if(!data)return;filterRows=filtered();const visible=new Set();positions.clear();$('empty').hidden=filterRows.length>0;$('total').textContent=data.people.length;$('visibleCount').textContent=`${filterRows.length} visibles`;
 $('characters').querySelectorAll('.cluster').forEach(n=>n.remove());
 for(const [id,r]of Object.entries(rooms)){
 const all=filterRows.filter(p=>p.zone===id).sort((a,b)=>a.id.localeCompare(b.id));const chosen=all.slice(0,18);const chosenPerson=all.find(p=>p.id===selected);if(chosenPerson&&!chosen.some(p=>p.id===selected))chosen[chosen.length-1]=chosenPerson;
 $(`count-${id}`).textContent=all.length;
 chosen.forEach((p,i)=>{visible.add(p.id);const u=2+(i%6),v=3.2+Math.floor(i/6)*1.05,[dx,dy]=iso(u,v,14),x=r.x+dx,y=r.y+dy;positions.set(p.id,{x,y});
 let actor=actors.get(p.id);if(!actor){actor=el('g',{'class':'actor',role:'button',tabindex:'0'});actor.addEventListener('click',()=>{if(!dragged)select(p.id);});actor.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(p.id);}});$('characters').append(actor);actors.set(p.id,actor);}
 actor.setAttribute('aria-label',`${p.name}. ${p.state}. ${p.owner||'Sin responsable'}`);actor.innerHTML=character(p);actor.classList.toggle('selected',p.id===selected);
 const previous=seen.get(p.id);actor.classList.toggle('fresh',previous!=null&&p.sale.count>previous);seen.set(p.id,p.sale.count);
 actor.style.transform=`translate(${x}px,${y}px)`;});
 if(all.length>18){const [dx,dy]=iso(6.8,6.1,17);const group=el('g',{class:'cluster',role:'button',tabindex:'0',transform:`translate(${r.x+dx} ${r.y+dy})`,'aria-label':`Ver las ${all.length} personas de ${data.zones.find(z=>z.id===id).name}`},`<rect x="-32" y="-19" width="64" height="32" rx="10" fill="${r.accent}" stroke="#f6f3e5" stroke-width="2"/><text y="2" text-anchor="middle" font-size="13" font-weight="700" fill="white">+${all.length-18}</text>`);const open=()=>showList(id);group.addEventListener('click',open);group.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();open();}});$('characters').append(group);}
 }
 for(const [id,node]of actors)if(!visible.has(id)){node.remove();actors.delete(id);}
 // Painter order: lower feet remain in front of higher feet.
 [...actors].sort((a,b)=>positions.get(a[0]).y-positions.get(b[0]).y).forEach(([,node])=>$('characters').append(node));
 if(listMode!==null)renderList();else if(selected){const p=data.people.find(p=>p.id===selected);if(p)renderPerson(p);else{$('panelBody').innerHTML='<h2>La persona salió de esta vista</h2><p>Su situación cambió en la última sincronización.</p>';}}
}
function date(value,time=false){if(!value)return 'Sin información';if(!time)return String(value).slice(0,10).split('-').reverse().join('/');return new Intl.DateTimeFormat('es-AR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Argentina/Buenos_Aires'}).format(new Date(value));}
const pair=(label,value)=>`<dt>${esc(label)}</dt><dd>${esc(value||'Sin información')}</dd>`;
function renderPerson(p){const a=p.agenda;$('panelBody').innerHTML=`<span class="eyebrow">${esc(data.zones.find(z=>z.id===p.zone).name)}</span><div class="avatar-card" style="margin-top:18px">${esc(p.name.split(/\s+/).map(x=>x[0]).slice(0,2).join(''))}</div><h2>${esc(p.name)}</h2><span class="chip">${esc(p.state)}</span><p class="reason">${esc(p.reason)}</p><h3>Pendientes y señales</h3>${p.issues.length?`<ul>${p.issues.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p class="reason">Sin pendientes detectados en los datos disponibles.</p>'}<h3>Responsables</h3><dl>${pair('Comercial',p.owners.commercial||'Sin responsable')}${pair('Setter',p.owners.setter||'Sin responsable')}${pair('Administración',p.owners.administration||'Sin asignación registrada')}${pair('CSM',p.owners.csm||'Sin responsable')}</dl><h3>Agenda relevante</h3><dl>${pair('Fecha y hora',a?(a.start?date(a.start,true):`${date(a.date)} · hora sin información`):null)}${pair('Calendario',a?.calendar)}${pair('Estado registrado',a?.raw)}</dl><h3>Venta y conciliación</h3><dl>${pair('Ventas registradas',String(p.sale.count))}${pair('Última venta',date(p.sale.date))}${pair('Productos',p.sale.products.join(' · '))}${pair('Comprobantes',`${p.payment.conciliated} conciliados · ${p.payment.pending} pendientes · ${p.payment.rejected} rebotados`)}${pair('Primer pendiente: creado el',date(p.payment.waitingSince,true))}</dl><h3>Ingreso al programa</h3><dl>${pair('Contrato',p.contract.status)}${pair('Firma',p.contract.signature)}${pair('Acceso',p.program.access)}${pair('Soporte',p.program.support)}${pair('Fin de programa',date(p.program.end))}${pair('Onboarding',p.program.onboarding)}${pair('Fecha de onboarding',date(p.program.onboardingDate))}</dl><p class="reason">Importes, datos de contacto y documentación se consultan en la ficha autorizada.</p>${p.profileUrl?`<a class="profile" href="${esc(p.profileUrl)}" target="_blank" rel="noopener">Abrir ficha del contacto ↗</a>`:'<p class="reason">Sin ID GHL: no hay enlace de ficha disponible.</p>'}`;}
function select(id,center=true){const p=data?.people.find(p=>p.id===id);if(!p)return;lastFocus=document.activeElement;selected=id;listMode=null;$('panel').hidden=false;draw();renderPerson(p);if(center)focusPerson(id);}
function showList(zone=''){lastFocus=document.activeElement;selected=null;listMode=zone;listPage=0;$('panel').hidden=false;draw();renderList();}
function renderList(){const rows=filterRows.filter(p=>!listMode||p.zone===listMode),pages=Math.max(1,Math.ceil(rows.length/20));listPage=Math.min(listPage,pages-1);$('panelBody').innerHTML=`<span class="eyebrow">Personas en el mundo</span><h2>${esc(data.zones.find(z=>z.id===listMode)?.name||'Directorio')}</h2><p class="reason">${rows.length} personas · elegí una para encontrarla en el mapa.</p><ul class="person-list">${rows.slice(listPage*20,listPage*20+20).map(p=>`<li><button data-person="${esc(p.id)}">${esc(p.name)}<small>${esc(p.owner||'Sin responsable')} · ${esc(p.state)}</small></button></li>`).join('')||'<li>No hay coincidencias.</li>'}</ul><div class="pager"><button class="outline" id="prevPage" ${listPage===0?'disabled':''}>Anterior</button><span>${listPage+1} / ${pages}</span><button class="outline" id="nextPage" ${listPage>=pages-1?'disabled':''}>Siguiente</button></div>`;$('panelBody').querySelectorAll('[data-person]').forEach(n=>n.onclick=()=>select(n.dataset.person));$('prevPage').onclick=()=>{listPage--;renderList();};$('nextPage').onclick=()=>{listPage++;renderList();};}
function applyCamera(){$('scene').setAttribute('transform',`translate(${camera.x} ${camera.y}) scale(${camera.k})`);}
function focusPerson(id){const p=positions.get(id);if(!p)return;camera={k:1.5,x:1200-p.x*1.5,y:500-p.y*1.5};applyCamera();}
function zoom(factor){const k=Math.max(.55,Math.min(3,camera.k*factor)),ratio=k/camera.k;camera.x=1200-(1200-camera.x)*ratio;camera.y=565-(565-camera.y)*ratio;camera.k=k;applyCamera();}
function filter(){selected=null;listMode=null;$('panel').hidden=true;draw();if($('search').value.trim()&&filterRows.length){select(filterRows[0].id);if(filterRows.length>1){listMode='';renderList();}}}
function updateOptions(id,values){const node=$(id),current=node.value;node.querySelectorAll('option[data-value]').forEach(n=>n.remove());for(const value of values){const o=document.createElement('option');o.value=value;o.textContent=value;o.dataset.value='1';node.append(o);}node.value=values.includes(current)||['','__none'].includes(current)?current:'';}
function schedule(seconds=30){clearTimeout(timer);if(!document.hidden)timer=setTimeout(sync,seconds*1000);}
async function sync(){if(loading||document.hidden)return;loading=true;$('refresh').disabled=true;$('connection').textContent='Actualizando…';
 try{const response=await fetch('/api/metricas/mati-world',{cache:'no-store',signal:AbortSignal.timeout(40000)});if(response.status===401){location.href='/login.html';return;}if(response.status===403){location.href='/unauthorized.html';return;}if(!response.ok)throw Error('No se pudo sincronizar');const result=await response.json();if(!Array.isArray(result.people)||!Array.isArray(result.zones))throw Error('Respuesta incompleta');
 const first=!data;data=result;lastSuccess=new Date();if(first){$('area').insertAdjacentHTML('beforeend',data.zones.map(z=>`<option value="${z.id}">${esc(z.name)}</option>`).join(''));architecture();}
 updateOptions('owner',[...new Set(data.people.flatMap(p=>Object.values(p.owners)).filter(Boolean))].sort());updateOptions('state',[...new Set(data.people.map(p=>p.state))].sort());
 $('mappingBody').innerHTML='<p>La ubicación prioriza conciliación pendiente, requisitos de ingreso, soporte vigente, ventas y agendas. Los estados simultáneos permanecen en la ficha.</p><ul>'+data.limitations.map(s=>`<li>${esc(s)}</li>`).join('')+'</ul><p>Las oficinas de Dirección y Scalo son ilustraciones del equipo, no indicadores de presencia. Actualización automática cada 30 segundos. Sin movimientos ni cambios en los sistemas de origen.</p>';
 draw();$('loading').hidden=true;$('connection').dataset.status='ok';$('connection').textContent='● Conectado';$('lastSync').textContent=`Datos sincronizados ${date(data.syncedAt,true)}`;
 }catch(error){$('connection').dataset.status='error';$('connection').textContent='! Error de sincronización';$('lastSync').textContent=lastSuccess?`Último éxito ${date(lastSuccess.toISOString(),true)}`:'No se pudieron obtener los datos';if(!data){$('loading').innerHTML='<strong>No pudimos abrir la oficina</strong><p>La fuente de datos no respondió. Usá Actualizar para reintentar.</p>';}}
 finally{loading=false;$('refresh').disabled=false;schedule();}}
$('refresh').onclick=sync;$('directory').onclick=()=>showList('');$('closePanel').onclick=()=>{selected=null;listMode=null;$('panel').hidden=true;draw();lastFocus?.focus?.();};
let searchTimer;$('search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(filter,220);});for(const id of ['area','owner','state'])$(id).onchange=filter;
for(const [id,x,y,k]of [['visitBuilding',1210,430,1.35],['visitDirection',245,700,2.6],['visitScalo',2150,700,2.6]])$(id).onclick=()=>{camera={x:1200-x*k,y:565-y*k,k};applyCamera();};
$('zoomIn').onclick=()=>zoom(1.2);$('zoomOut').onclick=()=>zoom(1/1.2);$('fit').onclick=()=>{camera={x:0,y:0,k:1};applyCamera();};
const viewport=$('viewport');viewport.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY<0?1.08:1/1.08);},{passive:false});
viewport.addEventListener('pointerdown',e=>{if(e.target.closest('.map-controls,.tour-controls'))return;drag={x:e.clientX,y:e.clientY,cx:camera.x,cy:camera.y};dragged=false;});
viewport.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>6)dragged=true;if(!dragged)return;viewport.classList.add('dragging');const r=$('world').getBoundingClientRect(),scale=Math.min(r.width/$('world').viewBox.baseVal.width,r.height/$('world').viewBox.baseVal.height);camera.x=drag.cx+dx/scale;camera.y=drag.cy+dy/scale;applyCamera();});
window.addEventListener('pointerup',()=>{drag=null;viewport.classList.remove('dragging');setTimeout(()=>{dragged=false;},0);});window.addEventListener('pointercancel',()=>{drag=null;viewport.classList.remove('dragging');});
viewport.addEventListener('keydown',e=>{if(e.target!==viewport)return;const delta={ArrowLeft:[60,0],ArrowRight:[-60,0],ArrowUp:[0,60],ArrowDown:[0,-60]}[e.key];if(delta){e.preventDefault();camera.x+=delta[0];camera.y+=delta[1];applyCamera();}else if(['+','=','-'].includes(e.key)){e.preventDefault();zoom(e.key==='-'?1/1.2:1.2);}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('panel').hidden)$('closePanel').click();});document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(document.hidden){$('connection').textContent='Actualización en pausa';}else sync();});window.addEventListener('online',sync);window.addEventListener('offline',()=>{$('connection').textContent='Sin conexión';$('connection').dataset.status='error';});
sync();
})();
