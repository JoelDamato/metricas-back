(()=>{'use strict';
const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg',reduced=matchMedia('(prefers-reduced-motion: reduce)');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const rooms={
 agendas:{x:20,y:72,w:580,h:360,name:'Comercial',color:'#386f91',floor:'#a7bfcb',icon:'↗',door:[270,490]},
 ventas:{x:620,y:72,w:360,h:360,name:'Ventas',color:'#b98929',floor:'#efd08c',icon:'▥',door:[790,490]},
 administracion:{x:1000,y:72,w:580,h:360,name:'Administración',color:'#ae6048',floor:'#dfab91',icon:'▤',door:[1310,490]},
 ingreso:{x:20,y:550,w:720,h:400,name:'Contratos',color:'#80649b',floor:'#c8b1d6',icon:'✎',door:[720,720]},
 csm:{x:870,y:550,w:710,h:400,name:'Campus CSM',color:'#44794e',floor:'#c2d1a2',icon:'✓',door:[880,720]}
};
const offices={direction:{x:-620,y:590,w:550,h:430,name:'Dirección',color:'#315a42',floor:'#c4c6a2'},scalo:{x:1700,y:590,w:550,h:430,name:'Scalo',color:'#111315',floor:'#303138'}};
let data=null,currentRoom=null,selected=null,listPage=0,loading=false,timer=null,lastSuccess=null,camera={x:0,y:0,k:1},drag=null,dragged=false;
const actors=new Map(),positions=new Map(),changes=[],moving=new Map();let lastPeople=new Map(),paintedStaff='',nadiaFrame=null,nadiaStart=performance.now(),lastNadiaPaint=0;
const el=(tag,attrs={},html='')=>{const n=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);n.innerHTML=html;return n;};
function hash(s){let n=0;for(const c of String(s))n=(Math.imul(n,31)+c.charCodeAt(0))|0;return n>>>0;}
const poly=(p,fill,stroke='#526044',width=1)=>`<polygon points="${p.map(v=>v.join(',')).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round"/>`;
const rect=(x,y,w,h,fill,stroke='none',rx=0)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}"/>`;
const text=(x,y,value,size=12,fill='#243b2e',extra='')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-family="DM Sans, sans-serif" ${extra}>${esc(value)}</text>`;
function block(x,y,w,d,h,top='#dfb77b',front='#b08450',side='#91663e'){
 return poly([[x,y-h],[x+w,y-h],[x+w+15,y+d-h],[x+15,y+d-h]],top,'#4c4438',1.2)+poly([[x+15,y+d-h],[x+w+15,y+d-h],[x+w+15,y+d],[x+15,y+d]],front,'#4c4438',1.2)+poly([[x+w,y-h],[x+w+15,y+d-h],[x+w+15,y+d],[x+w,y]],side,'#4c4438',1.2);
}
function plant(x,y,s=1){return `<g transform="translate(${x} ${y}) scale(${s})">${block(-10,0,20,15,21,'#ecdfbb','#b78c59','#916c49')}<path d="M3 -14V-60M3 -30L-17 -47M3 -25L23 -45" fill="none" stroke="#31562d" stroke-width="4"/><path d="M3 -43Q-31 -78 -27 -47Q-19 -26 3 -34M3 -38Q30 -82 34 -49Q26 -24 3 -28M3 -53Q-8 -88 9 -85Q25 -65 3 -43" fill="#618f3a" stroke="#31562d" stroke-width="2"/><path d="M-20 -52l18 12M22 -51L6 -35M8 -72L4 -52" stroke="#a7bd59" stroke-width="3"/></g>`;}
function windowArt(x,y,w=140,h=80){let s=rect(x,y,w,h,'#79aac1','#e9e6ce',4);s+=rect(x+6,y+6,w-12,h-12,'#b5d6da','#405d61');s+=poly([[x+7,y+h-10],[x+35,y+32],[x+65,y+h-15],[x+95,y+24],[x+w-8,y+h-8]],'#83a46a','none');s+=`<path d="M${x+w/2} ${y+5}v${h-10}M${x+5} ${y+h/2}h${w-10}" stroke="#f2edda" stroke-width="6"/>`;return s;}
function shelf(x,y,w=75){let s=block(x,y,w,22,100,'#e0bf7d','#b48650','#835d38');s+=rect(x+8,y-91,w-10,82,'#694d37');for(let row=0;row<3;row++){for(let i=0;i<Math.floor(w/13)-1;i++)s+=rect(x+12+i*12,y-84+row*26,8,19,['#668c9b','#d7a956','#b96d57','#94a36a'][i%4],'#3f4437');s+=rect(x+8,y-61+row*26,w-10,4,'#d3a66a');}return s;}
function monitor(x,y,dark=false){return `<g>${block(x,y,35,6,35,dark?'#181b1d':'#394e4b','#263936','#182d2b')}${rect(x+3,y-31,29,20,'#8eb8ad','#142b29')}${rect(x+6,y-28,12,3,'#c6dfb9')}${rect(x+6,y-22,21,2,'#bfd4bf')}${rect(x+11,y+2,24,4,'#243b36')}</g>`;}
function desk(x,y,dark=false){return `<g>${block(x,y,85,36,24,dark?'#323438':'#e6bc7d',dark?'#17191b':'#b3844f',dark?'#0b0d0f':'#8d653c')}${monitor(x+40,y-10,dark)}${poly([[x+47,y+4],[x+74,y+4],[x+81,y+14],[x+54,y+14]],dark?'#575a60':'#f1e3bc','#766a50')}${poly([[x+12,y-12],[x+32,y-12],[x+38,y+1],[x+18,y+1]],'#fff6de','#b9aa8b')}${rect(x+19,y-8,12,1,'#ac9d7b')}${rect(x+20,y-4,11,1,'#ac9d7b')}</g>`;}
function sofa(x,y,w=130,color='#668ea0'){return block(x,y,w,35,17,color,'#416377','#344a5c')+block(x,y-17,w,9,36,color,'#557b8d','#3b5b6c')+block(x-4,y,13,35,30,color,'#416377','#344a5c')+block(x+w-8,y,13,35,30,color,'#416377','#344a5c')+rect(x+25,y-32,24,21,'#d6c28b','#857758',3);}
function table(x,y){return block(x,y,74,38,20,'#e2bd7c','#a87a42','#866234')+poly([[x+18,y-10],[x+41,y-10],[x+47,y+7],[x+24,y+7]],'#fff3d3','#baa782')+rect(x+23,y-6,14,2,'#9d9278');}
function counter(x,y,w,color){return block(x,y,w,32,49,'#f2d5a0',color,'#765b43')+rect(x+22,y-29,w-40,19,'#eadabc','#b1a180',4);}
function frame(x,y,label){y+=43;return rect(x,y,36,39,'#edd9ad','#7c6542',2)+rect(x+5,y+5,26,29,'#fff3d8','#c4b48c')+`<path d="M${x+11} ${y+13}h14M${x+11} ${y+18}h14M${x+11} ${y+23}h9" stroke="#a99a77" stroke-width="2"/>`;}
function zoneIcon(id){if(id==='agendas'||id==='ventas')return '<path d="M4 29V18h6v11M15 29V11h6v18M26 29V3h6v26" fill="#ffe7ac"/>';if(id==='csm')return '<path d="M1 12L18 3 35 12 18 21Z M8 17v10q10 8 20 0V17M34 13v17" fill="none" stroke="#ffe7ac" stroke-width="3"/>';return '<path d="M7 3h17l7 7v24H7ZM24 3v8h7M12 17h13M12 23h13M12 28h8" fill="none" stroke="#ffe7ac" stroke-width="2.5"/>';}

function roomShell(id,r){const dark=id==='scalo';let s='';
 s+=poly([[0,110],[r.w,110],[r.w,r.h],[r.w-22,r.h+25],[20,r.h+25],[0,r.h]],dark?'#161719':'#cebd9a','#615e49',2);
 s+=rect(0,110,r.w,r.h-110,r.floor,'#6d6d53');s+=rect(0,110,r.w,r.h-110,'url(#tile)');
 s+=poly([[0,42],[r.w-35,42],[r.w,68],[r.w,160],[0,160]],r.color,dark?'#08090a':'#695d4d',2);
 s+=poly([[0,42],[30,20],[30,150],[0,182]],dark?'#242629':'#e1d2b6','#685e4b',2);
 s+=poly([[0,42],[30,20],[r.w-20,20],[r.w,42]],dark?'#494c51':'#fff0d9','#8f8065',2);
 s+=poly([[0,r.h],[r.w,r.h],[r.w-22,r.h+25],[20,r.h+25]],dark?'#55585e':'#f6e4c5','#8c7d62',2);
 s+=windowArt(r.w-155,62,125,82);
 s+=text(52,100,r.name.toUpperCase(),21,dark?'#eee9df':'#fff1d4','font-weight="700" letter-spacing="2"');
 if(id==='agendas'){
 s+=counter(35,200,130,'#b68852')+monitor(115,162)+text(68,185,'MW',24,'#335e42','font-weight="700"');
 s+=sofa(235,188,155,'#d4c4a0')+table(285,239)+rect(215,218,190,70,'#547e8b60','none',25);
 s+=shelf(400,185,58)+frame(177,56,'↗');
 s+=rect(45,115,50,28,'#7fb5d3')+rect(45,124,50,9,'#f9f1db')+text(70,134,'☀',12,'#d9ab38','text-anchor="middle"');
 }else if(id==='ventas'){
 s+=rect(140,170,190,145,'#c0984660','none',28)+table(190,211)+monitor(224,195);
 s+=frame(40,60,'↗')+shelf(365,185,65);s+=text(300,127,'★',45,'#ffdd68','stroke="#8d6926" stroke-width="1"');
 s+=desk(30,225)+desk(333,290);
 }else if(id==='administracion'){
 s+=counter(28,197,165,'#b66f4f')+monitor(132,160);
 for(let i=0;i<3;i++)s+=block(38+i*28,158-i*4,22,13,8,'#f6eedb','#b6b4a3','#777f75');
 s+=rect(325,116,168,160,'#f7d3b045','#e9cead',6)+text(409,137,'OFICINA DE NADIA',10,'#fff3d7','text-anchor="middle" font-weight="700"');
 s+=desk(350,205)+shelf(452,223,40)+frame(230,66,'▤');
 s+=block(218,215,50,28,60,'#e9dcc1','#d4c6ab','#a39780');for(let i=0;i<3;i++)s+=rect(232,166+i*17,31,11,'#e6dbc5','#8e8b75')+rect(243,170+i*17,10,2,'#767f75');
 }else if(id==='ingreso'){
 s+=counter(385,208,190,'#a48ab4')+monitor(480,172)+text(417,191,'Contratos',15,'#5a426d','font-weight="700"');
 s+=shelf(35,222,80)+frame(156,62,'✎')+frame(223,62,'✓');
 s+=table(165,235)+table(290,235)+desk(510,305)+plant(625,218);
 s+=text(395,127,'INGRESO AL PROGRAMA',12,'#eee0f3','letter-spacing="1"');
 }else if(id==='csm'){
 s+=rect(80,186,280,145,'#7e806450','#87865d',58)+sofa(75,210,145,'#e1d8ba')+sofa(260,245,90,'#87a76c')+table(190,272);
 s+=shelf(35,200,70)+desk(445,205)+desk(480,320)+frame(220,65,'✓');
 s+=`<path d="M405 133v119h-18" stroke="#665f3c" stroke-width="4"/><path d="M382 134l12 -30h28l12 30Z" fill="#efd38d" stroke="#8a7545"/>`;
 }else if(id==='direction'){
 s+=`<image href="/assets/mati-randazzo-logo-web.png" x="45" y="108" width="180" height="45"/>`+desk(55,215)+desk(215,215)+desk(365,315)+sofa(360,195,120,'#788e61');
 }else if(id==='scalo'){
 s+=rect(75,112,210,78,'#080a0d','#5a6267',5)+text(90,130,'SCALO / ANÁLISIS',11,'#c6d7d7','letter-spacing="2"');
 s+=`<path d="M90 173h175M90 173v-30" stroke="#53646a" fill="none"/><path d="M95 168l30 -12 22 6 32 -20 26 5 30 -13 24 6" stroke="#b4d1ba" stroke-width="3" fill="none"/>`;
 s+=desk(48,250,true)+desk(225,250,true)+desk(390,320,true);
 }
 s+=plant(25,r.h-20,1.05)+plant(r.w-45,r.h-25,1.2);
 return `<g transform="translate(${r.x} ${r.y})" filter="url(#shadow)">${s}</g>`;
}
function architecture(){let s=rect(-1000,-1000,4600,3400,'url(#garden)');
 s+=rect(-30,20,1660,1060,'#ae9672','#655b43',20)+rect(-20,18,1640,1032,'url(#wood)','#e7d1a7',14);
 s+=rect(0,500,1600,55,'#ead6aa','#b79c6e')+rect(735,500,130,520,'#e4c898','#a38a60');
 s+=rect(765,620,70,315,'#677a4b','#b9a06f',3)+rect(775,630,50,294,'none','#d6c088');
 for(let i=0;i<5;i++)s+=rect(720-i*9,1020+i*13,160+i*18,13,'#d4c0a0','#9c8766');
 s+=rect(739,979,122,39,'#517968','#d7c6a0',3)+text(800,1003,'MATI WORLD',12,'#f4dda0','text-anchor="middle" font-weight="700"');
 s+=`<path d="M-50 785H-120M1600 785h100" stroke="#d9c394" stroke-width="50"/>`;
 for(const [id,r]of Object.entries({...rooms,...offices}))s+=roomShell(id,r);
 s+=`<image href="/assets/mati-world/office-background-v1.png" x="0" y="0" width="1600" height="1100" preserveAspectRatio="none"/>`;
 s+=rect(739,1005,122,35,'#315a42','#e7d1a7',3)+text(800,1028,'MATÍAS RANDAZZO',10,'#f4dda0','text-anchor="middle" font-weight="700"');
 $('architecture').innerHTML=s;
 $('roomLabels').innerHTML=Object.entries(rooms).map(([id,r])=>`<g class="room-label" data-zone="${id}" role="button" tabindex="0" aria-label="Entrar a ${r.name}" transform="translate(${r.x+35} ${r.y-15})">${rect(0,0,r.w-70,48,r.color,'#fff3d7',12)}<g transform="translate(12 7)">${zoneIcon(id)}</g>${text(58,31,r.name,23,'#fff9e6','font-weight="700"')}${rect(r.w-150,9,65,30,'#fff2d5','none',12)}${text(r.w-117,31,'0',19,'#2d4934',`id="count-${id}" text-anchor="middle" font-weight="700"`)}</g>`).join('');
 $('roomLabels').querySelectorAll('[data-zone]').forEach(n=>bindSvgButton(n,()=>enterRoom(n.dataset.zone)));
 $('minimap').innerHTML=rect(4,4,312,202,'#dfcba6','#a99069',10)+Object.entries(rooms).map(([id,r])=>`<g data-zone="${id}" role="button" tabindex="0" aria-label="Ir a ${r.name}">${rect(r.x*.19+6,r.y*.17+8,r.w*.19,r.h*.17,r.color,'#fff1d0',5).replace('<rect ',`<rect id="mini-${id}" `)}${text(r.x*.19+r.w*.095+6,r.y*.17+r.h*.085+12,r.name==='Administración'?'Admin.':r.name==='Campus CSM'?'CSM':r.name,10,'#fff8df','text-anchor="middle" font-weight="700"')}</g>`).join('');
 $('minimap').querySelectorAll('[data-zone]').forEach(n=>bindSvgButton(n,()=>enterRoom(n.dataset.zone)));
}
function bindSvgButton(n,action){n.addEventListener('click',()=>{if(!dragged)action();});n.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();action();}});}
function sprite(id,shirtOverride){const h=hash(id),skin=['#e8b48e','#bd835d','#f1ccaa','#8c5c43'][h%4],shirt=shirtOverride||['#588ea1','#b98256','#8d74a0','#a6a05b','#539079','#b86e7f'][h%6],hair=['#493526','#805132','#bc8c43','#282f32'][(h>>>2)%4];
 let s=`<g class="body" shape-rendering="crispEdges" stroke="#30372e" stroke-width="1.3"><path d="M-10 -16h8V0h-12v-5h4M2 -16h8V0H-2v-5h4" fill="#344859"/><path d="M-13 -38h26l3 24H-16Z" fill="${shirt}"/><path d="M-8 -35v17M-6 -34h12" fill="none" stroke="#ffffff40"/><g class="hands"><path d="M-16 -33h5v18h-7v-8h2M11 -33h5v18h-6Z" fill="${skin}"/></g><path d="M-11 -60h22v25h-22Z" fill="${skin}"/><path d="M-13 -61h26v12H8v-7H-7v10h-6Z" fill="${hair}"/><path d="M-6 -46h3M4 -46h3" stroke="#25342e" stroke-width="2.5"/><path d="M-3 -39h6" stroke="#9c624b"/><path d="M-10 -53h18" stroke="#ffffff20"/></g>`;
 if(h%3===0)s+=`<path d="M-9 -48h8v6h-8ZM2 -48h8v6H2ZM-1 -46h3" fill="none" stroke="#33423b" stroke-width="1.5"/>`;
 if(h%4===0)s+=`<path d="M-13 -54q-7 -11 1 -13q5 -8 10 -2q9 -6 14 1q7 4 1 15" fill="${hair}" stroke="#3c372b" stroke-width="1.3"/>`;
 if(h%5===0)s+=`<path d="M-18 -29h7v17h-8Z" fill="#b3a27b" stroke="#4b4c39"/><path d="M-13 -37v22" stroke="#635b41" stroke-width="3"/>`;
 return s;
}
function nameTag(name,staff=false){const label=name.length>21?name.slice(0,20)+'…':name;return `<g class="name-tag" transform="translate(0 -89)">${rect(-79,-12,158,27,staff?'#e6edd1':'#203e2d',staff?'#65794c':'#e6d7ae',7)}${text(0,6,label,12,staff?'#26462e':'#fff4db','text-anchor="middle" font-weight="700"')}</g>`;}
function marker(p){if(p.payment.pending||p.payment.rejected)return '▤';if(p.program.current)return '✓';if(p.zone==='ingreso')return '✎';if(p.sale.count)return '$';return {upcoming:'◷',current:'◷',done:'✓',absent:'×',cancelled:'−'}[p.agenda?.code]||'?';}
function avatar(p){const mark=marker(p),badge=mark==='▤'?'<path d="M-5 -7h7l4 4V7H-5ZM2 -7v4h4M-2 0h5M-2 4h5" fill="none" stroke="#405338" stroke-width="1.5"/>':text(0,4,mark,14,'#405338','text-anchor="middle" font-weight="700"');return `<title>${esc(p.name)} · ${esc(p.state)}</title><ellipse class="selection" cy="1" rx="24" ry="11" fill="#f8df7c55" stroke="#fbca55" stroke-width="2"/><ellipse cy="2" rx="16" ry="6" fill="#263d2c" opacity=".23"/>${sprite(p.id)}<g transform="translate(18 -64)">${rect(-10,-12,21,22,p.issues.length?'#f1dca0':'#d9e8c5','#766a43',6)}${badge}</g>${nameTag(p.name)}`;}
function staff(id,name,role,x,y,shirt){return `<g class="staff working" data-foot-y="${y}" transform="translate(${x} ${y})" role="img" aria-label="${esc(name)} · ${esc(role)} · ambientación"><title>${esc(name)} · ${esc(role)} · ilustración del equipo</title><ellipse cy="2" rx="19" ry="7" fill="#1d3a2a35"/>${sprite(id,shirt)}${nameTag(name,true)}${text(0,17,role,9,'#345737','text-anchor="middle" font-weight="700"')}</g>`;}
function commercialOwners(){return [...new Set((data?.people||[]).filter(p=>p.zone==='agendas'&&p.owners.commercial).map(p=>p.owners.commercial))].sort();}
function ownerStations(id){const r=rooms[id];if(id==='agendas')return commercialOwners().map((name,i)=>({name,x:r.x+75+i*(r.w-135)/Math.max(1,commercialOwners().length-1),y:r.y+220}));if(id==='csm'){const names=[...new Set(data.people.map(p=>p.owners.csm).filter(Boolean))].sort();return names.slice(0,3).map((name,i)=>({name,x:r.x+430+i*75,y:r.y+220}));}return [];}
function paintTeam(){const key=commercialOwners().join('|')+'|'+[...new Set(data.people.map(p=>p.owners.csm).filter(Boolean))].join('|');if(key===paintedStaff)return;paintedStaff=key;let html='';
 ownerStations('agendas').forEach((s,i)=>{html+=staff('staff:'+s.name,s.name,'Closer',s.x,s.y,'#5d8fa6');});
 ownerStations('csm').forEach(s=>{html+=staff('staff:'+s.name,s.name,'CSM',s.x,s.y,'#5c9364');});
 html+=staff('mati','Mati','CEO',-525,860,'#e4d4ae')+staff('leo','Leo','Director comercial',-365,860,'#6c8aa0')+staff('walter','Walter','Director de marketing',-210,960,'#a17b55');
 html+=staff('scalo1','Scalo · 01','Equipo',1780,900,'#638594')+staff('scalo2','Scalo · 02','Equipo',1960,900,'#85966a')+staff('scalo3','Scalo · 03','Equipo',2130,970,'#987da1');
 html+=`<g id="nadia" class="staff working" role="img" aria-label="Nadia · Administración y Contratos · recorrido ilustrativo"><title>Nadia · Administración y Contratos · ambientación, no presencia real</title><ellipse cy="2" rx="20" ry="7" fill="#213d2b35"/>${sprite('nadia','#a288ad')}${nameTag('Nadia',true)}${text(0,17,'Administración / Contratos',9,'#3d4a32','text-anchor="middle" font-weight="700"')}</g>`;
 $('actors').querySelectorAll(':scope > .staff').forEach(n=>n.remove());$('actors').insertAdjacentHTML('beforeend',html);paintDepth();animateNadia(performance.now());
}
// Closed corridor route. Dwells represent ambient writing; they are not business events.
const nadiaRoute=[{x:1460,y:270,t:0},{x:1460,y:270,t:8},{x:1325,y:300,t:11},{x:1275,y:445,t:14},{x:800,y:495,t:21},{x:800,y:745,t:25},{x:730,y:745,t:27},{x:580,y:780,t:30},{x:580,y:780,t:40},{x:730,y:745,t:43},{x:800,y:745,t:45},{x:800,y:495,t:49},{x:1275,y:445,t:56},{x:1325,y:300,t:59},{x:1460,y:270,t:62},{x:1460,y:270,t:64}];
function animateNadia(now){cancelAnimationFrame(nadiaFrame);const node=$('nadia');if(!node)return;
 if(reduced.matches){node.setAttribute('transform','translate(1460 270)');node.classList.remove('walking');node.dataset.footY='270';paintDepth();return;}
 if(!document.hidden&&now-lastNadiaPaint>32){lastNadiaPaint=now;const t=((now-nadiaStart)/1000)%64;let i=0;while(i<nadiaRoute.length-2&&nadiaRoute[i+1].t<t)i++;const a=nadiaRoute[i],b=nadiaRoute[i+1],f=(t-a.t)/(b.t-a.t),walk=a.x!==b.x||a.y!==b.y;node.setAttribute('transform',`translate(${a.x+(b.x-a.x)*f} ${a.y+(b.y-a.y)*f})`);node.classList.toggle('walking',walk);node.classList.toggle('working',!walk);node.dataset.footY=String(a.y+(b.y-a.y)*f);paintDepth();}
 if(!document.hidden)nadiaFrame=requestAnimationFrame(animateNadia);
}
function paintDepth(){const parent=$('actors'),sorted=[...parent.children].filter(n=>n.classList.contains('actor')||n.classList.contains('staff')).sort((a,b)=>Number(a.dataset.footY||0)-Number(b.dataset.footY||0));sorted.forEach((n,i)=>{if(parent.children[i]!==n)parent.insertBefore(n,parent.children[i]||null);});}
function filtered(){const q=norm($('search').value.trim()),area=$('area').value,owner=$('owner').value,state=$('state').value;return (data?.people||[]).filter(p=>(!q||norm(p.name).includes(q))&&(!area||p.zone===area)&&(!owner||(owner==='__none'?!p.owner:Object.values(p.owners).includes(owner)))&&(!state||p.state===state));}
function roomPeople(id){return filtered().filter(p=>p.zone===id).sort((a,b)=>(a.owner||'').localeCompare(b.owner||'','es')||a.name.localeCompare(b.name,'es'));}
function slotsFor(id){const slots={agendas:[[140,435],[350,435],[520,435],[280,285],[400,285],[550,285]],ventas:[[650,415],[790,435],[945,415],[645,285],[950,285],[790,195]],administracion:[[1090,350],[1260,350],[1450,350],[1090,425],[1280,425],[1480,425]],ingreso:[[140,865],[300,865],[460,865],[650,865],[140,940],[300,940],[460,940],[650,940]],csm:[[950,850],[1120,850],[1300,850],[1480,850],[950,940],[1120,940],[1300,940],[1480,940]]};return slots[id].map(([x,y])=>({x,y}));}
function distribute(id,people){const free=slotsFor(id),stations=ownerStations(id),out=[];for(const p of people){const owner=stations.find(s=>s.name===p.owner||s.name===p.owners.commercial||s.name===p.owners.csm);let i=0;if(owner)for(let j=1;j<free.length;j++)if(Math.abs(free[j].x-owner.x)<Math.abs(free[i].x-owner.x))i=j;out.push([p,free.splice(i,1)[0]]);}return out;}
function draw(){if(!data)return;const visible=new Set(),oldPositions=new Map(positions);positions.clear();$('actors').querySelectorAll('.more-people').forEach(n=>n.remove());let shown=0;const rows=filtered();
 for(const [id,r]of Object.entries(rooms)){
 const all=roomPeople(id),limit=currentRoom===id?slotsFor(id).length:4;const priority=all.filter(p=>p.id===selected||(moving.has(p.id)&&moving.get(p.id).until>Date.now())).slice(0,limit);let chosen=priority.concat(all.filter(p=>!priority.includes(p)).slice(0,limit-priority.length));
 $('count-'+id).textContent=data.zones.find(z=>z.id===id)?.count||0;
 for(const [p,pos]of distribute(id,chosen)){visible.add(p.id);positions.set(p.id,pos);shown++;let n=actors.get(p.id);if(!n){n=el('g',{class:'actor',role:'button',tabindex:'0'});bindSvgButton(n,()=>select(p.id));actors.set(p.id,n);$('actors').append(n);}n.innerHTML=avatar(p);n.setAttribute('aria-label',`${p.name}. ${p.state}. ${p.owner||'Sin responsable'}`);n.classList.toggle('selected',p.id===selected);n.classList.toggle('fresh',moving.has(p.id));n.dataset.footY=String(pos.y);n.style.transform=`translate(${pos.x}px,${pos.y}px)`;
 const old=oldPositions.get(p.id),move=moving.get(p.id);if(old&&move&&!move.animated&&!reduced.matches){move.animated=true;const a=rooms[move.from]?.door||[old.x,old.y],b=rooms[p.zone].door;n.animate([{transform:`translate(${old.x}px,${old.y}px)`},{transform:`translate(${a[0]}px,${a[1]}px)`},{transform:`translate(800px,525px)`},{transform:`translate(${b[0]}px,${b[1]}px)`},{transform:`translate(${pos.x}px,${pos.y}px)`}],{duration:2600,easing:'ease-in-out'});}
 }
 if(all.length){const label=`${chosen.length} de ${all.length}${all.length>chosen.length?` · +${all.length-chosen.length} por explorar`:''}`;const g=el('g',{class:'more-people',role:'button',tabindex:'0',transform:`translate(${r.x+r.w/2} ${r.y+r.h+10})`,'aria-label':`${r.name}: ${label}. Ver personas`},rect(-140,-12,280,28,'#fff4d9','#9b8760',9)+text(0,7,label,12,'#3d5338','text-anchor="middle" font-weight="700"'));bindSvgButton(g,()=>{enterRoom(id);showDirectory();});$('actors').append(g);}
 }
 for(const [id,n]of actors)if(!visible.has(id)){n.remove();actors.delete(id);}
 paintDepth();
 $('total').textContent=data.people.length;$('visibleCount').textContent=`${shown} personajes representados · ${rows.length} personas en los filtros`;$('empty').hidden=rows.length>0;
 $('world').classList.toggle('room-view',!!currentRoom);for(const id of Object.keys(rooms))$('mini-'+id).classList.toggle('active-room',id===currentRoom);
 if(rooms[currentRoom]){$('roomCount').textContent=`${roomPeople(currentRoom).length} personas · hasta ${slotsFor(currentRoom).length} visibles a la vez`;}
 paintTeam();if(selected){const p=data.people.find(p=>p.id===selected);if(p)renderPerson(p);else{$('panelBody').innerHTML='<h2>La situación cambió</h2><p>Esta persona ya no está en la vista operativa.</p>';}}else renderDirectory();
}
function portrait(p){return `<svg viewBox="-38 -82 76 88" aria-hidden="true">${sprite(p.id)}</svg>`;}
const pair=(k,v)=>`<dt>${esc(k)}</dt><dd>${esc(v||'Sin información')}</dd>`;
function date(v,time=false){if(!v)return 'Sin información';if(!time)return String(v).slice(0,10).split('-').reverse().join('/');return new Intl.DateTimeFormat('es-AR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Argentina/Buenos_Aires'}).format(new Date(v));}
function renderPerson(p){$('panelContext').textContent=rooms[p.zone].name.toUpperCase();const a=p.agenda;$('panelBody').innerHTML=`<div class="portrait">${portrait(p)}</div><h2>${esc(p.name)}</h2><span class="chip">${esc(p.state)}</span><p>${esc(p.reason)}</p>${p.profileUrl?`<a class="profile" href="${esc(p.profileUrl)}" target="_blank" rel="noopener">Ver ficha ↗</a>`:'<p>Sin ID GHL: ficha no disponible.</p>'}<h3>Pendientes</h3>${p.issues.length?`<ul>${p.issues.map(i=>`<li>${esc(i)}</li>`).join('')}</ul>`:'<p>Sin pendientes detectados en los datos disponibles.</p>'}<h3>Responsables</h3><dl>${pair('Comercial',p.owners.commercial||'Sin responsable')}${pair('Setter',p.owners.setter||'Sin responsable')}${pair('Administración',p.owners.administration||'Sin asignación registrada')}${pair('CSM',p.owners.csm||'Sin responsable')}</dl><h3>Agenda relevante</h3><dl>${pair('Fecha',a?(a.start?date(a.start,true):date(a.date)+' · hora sin información'):null)}${pair('Calendario',a?.calendar)}${pair('Estado registrado',a?.raw)}</dl><h3>Venta y comprobantes</h3><dl>${pair('Ventas registradas',String(p.sale.count))}${pair('Última venta',date(p.sale.date))}${pair('Productos',p.sale.products.join(' · '))}${pair('Conciliación',`${p.payment.conciliated} conciliados · ${p.payment.pending} pendientes · ${p.payment.rejected} rebotados`)}${pair('Primer pendiente: creado el',date(p.payment.waitingSince,true))}</dl><h3>Contrato y programa</h3><dl>${pair('Contrato',p.contract.status)}${pair('Firma',p.contract.signature)}${pair('Acceso',p.program.access)}${pair('Soporte',p.program.support)}${pair('Fin de programa',date(p.program.end))}${pair('Onboarding',p.program.onboarding)}${pair('Fecha onboarding',date(p.program.onboardingDate))}</dl><p>Importes y documentación disponibles en la ficha autorizada.</p>`;}
function directoryRows(){const rows=filtered();return rooms[currentRoom]&&!$('search').value.trim()?rows.filter(p=>p.zone===currentRoom):rows;}
function renderDirectory(){if(offices[currentRoom]){$('panelContext').textContent='OFICINA DEL EQUIPO';$('panelBody').innerHTML=`<span class="eyebrow">Ambiente secundario</span><h2>${offices[currentRoom].name}</h2><p>${currentRoom==='direction'?'Mati · CEO<br>Leo · Director comercial<br>Walter · Director de marketing':'Tres puestos de Scalo, computadoras y pantalla de análisis.'}</p><p>Los personajes del equipo son ilustraciones. No indican conexión ni actividad real.</p><p>Usá Vista general o el minimapa para volver al recorrido de leads y clientes.</p>`;return;}const rows=directoryRows(),pages=Math.max(1,Math.ceil(rows.length/20));listPage=Math.min(listPage,pages-1);$('panelContext').textContent='EXPLORAR PERSONAS';$('panelBody').innerHTML=`<span class="eyebrow">${currentRoom?esc((rooms[currentRoom]||offices[currentRoom])?.name||'Oficina'):'Tu oficina'}</span><h2>${rooms[currentRoom]?rooms[currentRoom].name:'Cada persona,<br>su próximo paso.'}</h2><p>${rows.length} personas disponibles. El mapa muestra un subconjunto; esta lista y la búsqueda permiten encontrar a todas.</p><ul class="person-list">${rows.slice(listPage*20,listPage*20+20).map(p=>`<li><button data-person="${esc(p.id)}"><span class="mini-avatar">${portrait(p)}</span><span>${esc(p.name)}<small>${esc(p.owner||'Sin responsable')} · ${esc(p.state)}</small></span></button></li>`).join('')||'<li>No hay coincidencias.</li>'}</ul><div class="pager"><button id="prevPage" ${listPage===0?'disabled':''}>← Anterior</button><span>${listPage+1} / ${pages}</span><button id="nextPage" ${listPage>=pages-1?'disabled':''}>Siguiente →</button></div>`;$('panelBody').querySelectorAll('[data-person]').forEach(n=>n.onclick=()=>select(n.dataset.person));$('prevPage').onclick=()=>{listPage--;renderDirectory();$('panelBody').scrollTop=0;};$('nextPage').onclick=()=>{listPage++;renderDirectory();$('panelBody').scrollTop=0;};}
function showDirectory(){selected=null;listPage=0;document.body.classList.add('panel-open');draw();}
function applyCamera(){$('scene').setAttribute('transform',`translate(${camera.x} ${camera.y}) scale(${camera.k})`);}
function focusRect(x,y,w,h){const r=$('world').getBoundingClientRect(),baseScale=Math.min(r.width/1600,r.height/1100),k=Math.min(5,Math.min(r.width/(w+65),r.height/(h+80))/baseScale);camera={k,x:800-(x+w/2)*k,y:550-(y+h/2)*k};applyCamera();}
function enterRoom(id,openList=true){const r=rooms[id]||offices[id];if(!r)return;currentRoom=id;selected=null;listPage=0;$('roomContext').hidden=false;$('roomTitle').textContent=r.name;$('roomCount').textContent=rooms[id]?'':'Oficina del equipo · ambientación';$('roomDirectory').hidden=!rooms[id];focusRect(r.x,r.y-35,r.w,r.h+85);if(openList&&innerWidth>800)document.body.classList.add('panel-open');draw();}
function overview(){currentRoom=null;selected=null;listPage=0;camera={x:0,y:0,k:1};applyCamera();$('roomContext').hidden=true;document.body.classList.remove('panel-open');draw();}
function select(id){const p=data?.people.find(p=>p.id===id);if(!p)return;const changed=currentRoom!==p.zone;enterRoom(p.zone,false);selected=id;document.body.classList.add('panel-open');draw();renderPerson(p);$('panelBody').scrollTop=0;
 if(innerWidth<=800){const pos=positions.get(id),r=$('world').getBoundingClientRect(),scale=Math.min(r.width/1600,r.height/1100),k=Math.min(5,1.4/scale),targetY=(r.height*.23-(r.height-1100*scale)/2)/scale;camera={k,x:800-pos.x*k,y:targetY-pos.y*k};applyCamera();}else if(!changed){/* preserve a readable room framing */}}
function zoom(f){const k=Math.max(.65,Math.min(6,camera.k*f)),ratio=k/camera.k;camera={k,x:800-(800-camera.x)*ratio,y:550-(550-camera.y)*ratio};applyCamera();}
function recordChanges(next){const now=new Date();for(const p of next.people){const prev=lastPeople.get(p.id);if(!prev)continue;let message=null;
 if(p.zone!==prev.zone){message=`${p.name}: ${rooms[prev.zone].name} → ${rooms[p.zone].name}`;moving.set(p.id,{from:prev.zone,until:Date.now()+6000});}
 else if(p.program.current&&!prev.program.current)message=`${p.name}: acceso y soporte vigentes detectados`;
 else if(p.sale.count>prev.sale.count)message=`${p.name}: nueva venta registrada detectada`;
 else if(p.payment.conciliated>prev.payment.conciliated)message=`${p.name}: aumentaron los comprobantes conciliados`;
 if(message){changes.unshift({id:p.id,message,at:now.toISOString()});if(p.sale.count>prev.sale.count)moving.set(p.id,{from:prev.zone,until:Date.now()+6000});}}
 changes.splice(12);lastPeople=new Map(next.people.map(p=>[p.id,p]));for(const [id,m]of moving)if(m.until<Date.now())moving.delete(id);
 $('eventCount').textContent=changes.length;$('eventList').innerHTML=changes.length?changes.map(e=>`<li><button data-event-person="${esc(e.id)}">${esc(e.message)}<time>Detectado ${esc(date(e.at,true))}</time></button></li>`).join(''):'<li>Todavía no se detectaron cambios durante esta visita.</li>';$('eventList').querySelectorAll('[data-event-person]').forEach(n=>n.onclick=()=>{if(data.people.some(p=>p.id===n.dataset.eventPerson)){select(n.dataset.eventPerson);$('events').hidden=true;}});
}
function options(id,values){const n=$(id),v=n.value;n.querySelectorAll('option[data-dynamic]').forEach(o=>o.remove());for(const value of values){const o=document.createElement('option');o.value=value;o.textContent=value;o.dataset.dynamic='1';n.append(o);}n.value=values.includes(v)||['','__none'].includes(v)?v:'';}
function schedule(){clearTimeout(timer);if(!document.hidden)timer=setTimeout(sync,30000);}
async function sync(){if(loading||document.hidden)return;loading=true;$('refresh').disabled=true;$('connection').textContent='Actualizando…';
 try{const r=await fetch('/api/metricas/mati-world',{cache:'no-store',signal:AbortSignal.timeout(40000)});if(r.status===401){location.href='/login.html';return;}if(r.status===403){location.href='/unauthorized.html';return;}if(!r.ok)throw Error('No se pudo sincronizar');const next=await r.json();if(!Array.isArray(next.people)||!Array.isArray(next.zones))throw Error('Datos incompletos');const first=!data;recordChanges(next);data=next;lastSuccess=next.syncedAt||next.generatedAt;
 if(first){$('area').insertAdjacentHTML('beforeend',Object.entries(rooms).map(([id,z])=>`<option value="${id}">${z.name}</option>`).join(''));architecture();}
 options('owner',[...new Set(data.people.flatMap(p=>Object.values(p.owners)).filter(Boolean))].sort());options('state',[...new Set(data.people.map(p=>p.state))].sort());draw();if(first&&innerWidth<=800)enterRoom('agendas',false);$('loading').hidden=true;$('connection').textContent='● En vivo';$('lastSync').textContent=`Sincronizado ${date(lastSuccess,true)}`;
 $('mappingBody').innerHTML='<p>Datos reales, sólo lectura. Actualización cada 30 segundos. La ubicación prioriza pendientes administrativos y requisitos de ingreso; vender no implica acceso activo.</p><ul>'+data.limitations.map(s=>`<li>${esc(s)}</li>`).join('')+'</ul><p>Vista general: hasta 4 personas por área. Habitación: hasta 6 u 8, según el espacio. Los conteos, el directorio y la búsqueda incluyen a todas. Equipo ilustrado: los movimientos de Nadia y las poses de escritura son ambientación, no presencia ni actividad real. El feed muestra cambios detectados desde que abriste esta página, no un historial completo.</p>';
 }catch(e){$('connection').textContent='! Sin sincronizar';$('lastSync').textContent=lastSuccess?`Últimos datos: ${date(lastSuccess,true)}`:'No se pudieron obtener los datos';if(!data)$('loading').innerHTML='<strong>No pudimos cargar la oficina</strong><span>Usá el botón de actualización para reintentar.</span>';}
 finally{loading=false;$('refresh').disabled=false;schedule();}}
$('overview').onclick=overview;$('fit').onclick=overview;$('miniOverview').onclick=overview;$('visitDirection').onclick=()=>enterRoom('direction');$('visitScalo').onclick=()=>enterRoom('scalo');$('roomDirectory').onclick=showDirectory;$('directory').onclick=showDirectory;$('closePanel').onclick=()=>{selected=null;document.body.classList.remove('panel-open');draw();};$('refresh').onclick=sync;$('zoomIn').onclick=()=>zoom(1.2);$('zoomOut').onclick=()=>zoom(1/1.2);
$('eventsToggle').onclick=()=>{$('events').hidden=!$('events').hidden;};$('closeEvents').onclick=()=>{$('events').hidden=true;};
let searchTimer;$('search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{selected=null;listPage=0;$('area').value='';$('owner').value='';$('state').value='';const matches=filtered();if($('search').value.trim()&&matches.length){select(matches[0].id);if(matches.length>1){selected=null;renderDirectory();}}else{overview();document.body.classList.add('panel-open');}},200);});
$('area').onchange=()=>{selected=null;listPage=0;if($('area').value)enterRoom($('area').value);else overview();};for(const id of ['owner','state'])$(id).onchange=()=>{selected=null;listPage=0;draw();};
const viewport=$('viewport');viewport.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY<0?1.08:1/1.08);},{passive:false});viewport.addEventListener('pointerdown',e=>{if(e.target.closest('button,.room-context,.tour'))return;drag={x:e.clientX,y:e.clientY,cx:camera.x,cy:camera.y};dragged=false;});viewport.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>6)dragged=true;if(!dragged)return;viewport.classList.add('dragging');const r=$('world').getBoundingClientRect(),scale=Math.min(r.width/1600,r.height/1100);camera.x=drag.cx+dx/scale;camera.y=drag.cy+dy/scale;applyCamera();});
window.addEventListener('pointerup',()=>{drag=null;viewport.classList.remove('dragging');setTimeout(()=>{dragged=false;},0);});window.addEventListener('pointercancel',()=>{drag=null;viewport.classList.remove('dragging');});viewport.addEventListener('keydown',e=>{if(e.target!==viewport)return;const d={ArrowLeft:[60,0],ArrowRight:[-60,0],ArrowUp:[0,60],ArrowDown:[0,-60]}[e.key];if(d){e.preventDefault();camera.x+=d[0];camera.y+=d[1];applyCamera();}else if(['+','=','-'].includes(e.key)){e.preventDefault();zoom(e.key==='-'?1/1.2:1.2);}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('events').hidden=true;selected=null;document.body.classList.remove('panel-open');draw();}});document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(document.hidden){cancelAnimationFrame(nadiaFrame);$('connection').textContent='En pausa';}else{animateNadia(performance.now());sync();}});reduced.addEventListener('change',()=>animateNadia(performance.now()));window.addEventListener('online',sync);window.addEventListener('offline',()=>{$('connection').textContent='Sin conexión';});window.addEventListener('resize',()=>{if(currentRoom){const r=rooms[currentRoom]||offices[currentRoom];focusRect(r.x,r.y-35,r.w,r.h+85);}});
architecture();applyCamera();sync();
})();
