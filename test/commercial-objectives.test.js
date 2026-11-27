const {test}=require('node:test');const assert=require('node:assert/strict');
const model=require('../modules/commercial-objectives/model');
const api=require('../modules/commercial-objectives/router');
const access=require('../modules/auth/access');
const row=(closer,a,c,s,b)=>({closer,total_aplica:a,total_efectuadas:c,total_ventas:s,facturacion_f_agenda:b});
test('embudo suma orígenes, unifica alias y pondera tasas y ticket del equipo',()=>{const result=model.aggregate([row('Carlos Tu',100,40,8,24000),row('Carlos Tu',20,10,4,16000),row('Pablo Butera Vie',10,8,2,6000),row('Sin closer',1000,1000,1000,1000000)]);assert.equal(result.actual.agendas,130);assert.equal(result.actual.calls,58);assert.equal(result.actual.sales,14);assert.equal(result.actual.billing,46000);assert.equal(result.actual.attendance,58/130*100);assert.equal(result.actual.closing,14/58*100);assert.equal(result.actual.ticket,46000/14);assert.equal(result.closers.length,2);});
test('sin registros no inventa tasas; datos faltantes no se convierten en cero',()=>{assert.equal(model.aggregate([]).actual.attendance,null);assert.equal(model.aggregate([]).actual.ticket,null);assert.throws(()=>model.aggregate([{closer:'Carlos Tu',total_aplica:1}]),/valor válido/);});
test('valida mes, cifras enteras y porcentajes',()=>{for(const m of ['2026-13','2026-00','../config','2026-1'])assert.throws(()=>model.monthKey(m));const data={agendas:170,calls:77,sales:19,billing:67000,attendance:45,closing:25};assert.deepEqual(model.validate(data),data);for(const invalid of [{sales:1.5},{calls:-1},{attendance:101},{billing:null},{closing:''}])assert.throws(()=>model.validate({...data,...invalid}));});
test('lectura hereda acceso de agendas y edición solo Mati/Leo',()=>{assert.equal(api.canEdit({email:'leonardoalaniz19@gmail.com'}),true);assert.equal(api.canEdit({email:'matirandazzo@gmail.com'}),true);assert.equal(api.canEdit({role:'total',email:'otro@test.com'}),false);assert.equal(api.canRead(null),false);assert.equal(api.canRead({role:'comercial',email:'persona@test.com'}),true);const restricted={role:'comercial',access_config:{useCustomAccess:true,allowedPages:['entrenamiento.html']}};assert.equal(access.canAccessPageForUser(restricted,'objetivos-comerciales.html'),false);});
test('persistencia conserva meses separados y no trata errores de permisos como ausencia',async()=>{const axios=require('axios');const get=axios.get,post=axios.post,store=new Map();axios.post=async(url,data)=>{store.set(url,structuredClone(data));return {data:{}};};axios.get=async(url)=>{if(!store.has(url))throw {response:{status:404}};return {data:store.get(url)};};try{const data={agendas:170,calls:77,sales:19,billing:67000,attendance:45,closing:25};await api.save('2026-11',data,{email:'leonardoalaniz19@gmail.com'});await api.save('2026-12',{...data,agendas:200},{email:'matirandazzo@gmail.com'});assert.equal((await api.read('2026-11')).agendas,170);assert.equal((await api.read('2026-12')).agendas,200);assert.equal(await api.read('2027-01'),null);axios.get=async()=>{throw {response:{status:403}};};await assert.rejects(api.read('2026-11'));}finally{axios.get=get;axios.post=post;}});
test('sesión incluye Objetivos comerciales cuando el acceso personalizado permite Agendas',()=>{const user={role:'comercial',email:'custom@example.com',access_config:{useCustomAccess:true,allowedPages:['mag-sistema-agendas.html']}};assert.equal(access.getUserPermissions(user).allowedPages.includes('objetivos-comerciales.html'),true);});
test('Evergreen y Lanzamiento son excluyentes y reconcilian con el total',()=>{const rows=[{...row('Carlos Tu',10,6,2,7000),origen:'VSL'},{...row('Carlos Tu',5,3,1,3500),origen:'Webinar'},{...row('Mauro Gaitan',2,1,0,0),origen:null}];const e=model.aggregate(model.channelRows(rows,'evergreen')).actual,l=model.aggregate(model.channelRows(rows,'lanzamiento')).actual,t=model.aggregate(rows).actual;for(const k of Object.keys(model.fields))assert.equal(e[k]+l[k],t[k]);assert.equal(l.agendas,5);assert.throws(()=>model.channelKey('../legacy'));assert.throws(()=>model.channelRows([row('Carlos Tu',1,1,1,1)],'evergreen'),/origen/);});
test('metas de ambos canales y meta anterior se conservan sin contaminarse',async()=>{const axios=require('axios'),get=axios.get,post=axios.post,store=new Map();axios.post=async(u,d)=>{store.set(u,structuredClone(d));return {data:{}};};axios.get=async u=>{if(!store.has(u))throw {response:{status:404}};return {data:store.get(u)};};try{const data={agendas:170,calls:77,sales:19,billing:67000,attendance:45,closing:25};const actor={email:'test'};await api.save('2026-11',data,actor);await api.save('2026-11',{...data,agendas:100},actor,'evergreen');await api.save('2026-11',{...data,agendas:70},actor,'lanzamiento');assert.equal((await api.read('2026-11')).agendas,170);assert.equal((await api.read('2026-11','evergreen')).agendas,100);assert.equal((await api.read('2026-11','lanzamiento')).agendas,70);assert.equal(await api.read('2026-12','lanzamiento'),null);}finally{axios.get=get;axios.post=post;}});
test('detalle de llamadas clasifica los estados sin exponer campos ajenos',()=>{const base={origen:'Webinar',closer:'Carlos Tu',nombre:'Ejemplo',fecha_agenda:'2026-11-01',agendo:'Agendo',aplica:'Aplica'};const list=model.leadDetails(['Efectuada','No show','Cancelado','Pendiente',''].map(llamada_meg=>({...base,llamada_meg})).concat({...base,aplica:'No aplica'}),'lanzamiento');assert.deepEqual(list.map(r=>r.status),['Asistió','Ausente','Cancelada','Pendiente','Pendiente','Sin clasificar']);assert.equal(model.leadDetails([base],'evergreen').length,0);});

test('acceso a Agendas sin leads_raw permite ver metas y bloquea el detalle de contactos', async t => {
  const axios = require('axios');
  const service = require('../modules/metricasv2/services/supabase.service');
  t.mock.method(axios, 'get', async () => { throw { response: { status: 404 } }; });
  const calls = [];
  t.mock.method(service, 'listAllRows', async resource => {
    calls.push(resource);
    return [];
  });
  const router = api.createRouter();
  function get(path, authUser) {
    const url = new URL(path, 'http://local');
    return new Promise((resolve, reject) => {
      const response = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(body) { resolve({ status: this.statusCode, body }); }
      };
      router.handle({ method: 'GET', url: path, query: Object.fromEntries(url.searchParams), authUser }, response, reject);
    });
  }
  const restrictedUser = {
    role: 'comercial',
    access_config: { useCustomAccess: true, allowedPages: ['mag-sistema-agendas.html'] }
  };
  const summary = await get('/?month=2026-11', restrictedUser);
  assert.equal(summary.status, 200);
  assert.equal(summary.body.canViewLeads, false);
  assert.equal((await get('/leads?month=2026-11', restrictedUser)).status, 403);
  assert.deepEqual(calls, ['agenda_detalle_por_origen_closer']);

  const authorizedUser = { role: 'comercial', email: 'comercial@example.com' };
  assert.equal((await get('/?month=2026-11', authorizedUser)).body.canViewLeads, true);
  assert.equal((await get('/leads?month=2026-11', authorizedUser)).status, 200);
  assert.equal(calls.at(-1), 'closer_webinar_leads');
});

test('lanzamientos ignoran el mes y validan su etiqueta y canal',()=>{
 assert.equal(model.scope({channel:'lanzamiento',webinar:'webinar-1',month:'2026-12'}).month,'2026-10');
 assert.equal(model.scope({channel:'lanzamiento',webinar:'webinar-2'}).month,'2026-11');
 assert.throws(()=>model.scope({channel:'evergreen',webinar:'webinar-2',month:'2026-11'}));
 assert.throws(()=>model.webinarKey('../webinar'));
});
test('metas de eventos se mantienen aisladas del acumulado mensual',async t=>{
 const axios=require('axios'),store=new Map();
 t.mock.method(axios,'post',async(u,d)=>{store.set(u,structuredClone(d));return {data:{}};});
 t.mock.method(axios,'get',async u=>{if(!store.has(u))throw {response:{status:404}};return {data:store.get(u)};});
 const data={agendas:48,calls:20,sales:5,billing:17500,attendance:40,closing:25},actor={email:'test'};
 await api.save('2026-11',data,actor,'lanzamiento');
 await api.save('2026-11',{...data,agendas:50},actor,'lanzamiento','webinar-2');
 await api.save('2026-10',{...data,agendas:70},actor,'lanzamiento','webinar-1');
 assert.equal((await api.read('2026-11','lanzamiento')).agendas,48);
 assert.equal((await api.read('2026-11','lanzamiento','webinar-2')).agendas,50);
 assert.equal((await api.read('2026-10','lanzamiento','webinar-1')).agendas,70);
});
test('resumen y detalle de webinar incluyen todos sus meses y usan la misma etiqueta',async t=>{
 const axios=require('axios'),service=require('../modules/metricasv2/services/supabase.service');
 t.mock.method(axios,'get',async()=>{throw {response:{status:404}};});
 const calls=[];
 t.mock.method(service,'listAllRows',async(resource,options)=>{
  calls.push({resource,options});
  return resource==='commercial_webinar_summary'?[{...row('Carlos Tu',2,1,1,3500),origen:'Webinar',mes:11},{...row('Carlos Tu',3,1,0,0),origen:'Webinar',mes:12}]:[];
 });
 const router=api.createRouter();
 const get=path=>new Promise((resolve,reject)=>{const url=new URL(path,'http://local');router.handle({method:'GET',url:path,query:Object.fromEntries(url.searchParams),authUser:{role:'comercial',email:'test'}},{json:resolve},reject);});
 const data=await get('/?channel=lanzamiento&webinar=webinar-2&month=2026-10');
 assert.equal(data.actual.agendas,5);assert.equal(data.event.id,'webinar-2');
 await get('/leads?channel=lanzamiento&webinar=webinar-2');
 assert.deepEqual(calls.map(c=>c.resource),['commercial_webinar_summary','commercial_webinar_leads']);
 for(const {options} of calls){assert.deepEqual(options.eqFilters,{webinar_id:'webinar-2'});assert.equal(options.from,undefined);assert.equal(options.to,undefined);}
});

test('detalle de cada etapa conserva los predicados del embudo y el responsable de venta',()=>{
 const lead={id:'a',fecha_agenda:'2026-11-27',nombre:'Persona A',closer:'Carlos Tu',origen:'Webinar',aplica:'Aplica',agendo:'Agendo',llamada_meg:'Efectuada',ghlid:'contact-a'};
 const leads=[lead,{...lead,id:'b',llamada_meg:'Cancelado'},{...lead,id:'c',aplica:'No aplica'},{...lead,id:'d',closer:'Sin closer'}];
 assert.deepEqual(model.funnelDetails(leads,'lanzamiento','agendas').map(r=>r.id),['a','b']);
 assert.deepEqual(model.funnelDetails(leads,'lanzamiento','calls').map(r=>r.id),['a']);
 const sale={id:'sale-a',cliente_format:'Persona A',ghlid:'contact-a',origen:'Webinar',responsable_venta:'Pablo Butera Vie',creado_por:'Carlos Tu',facturacion:'3500',producto_format:'MEG',fecha_de_agendamiento:'2026-12-02',f_venta:'2026-12-03'};
 const details=model.funnelDetails([sale],'lanzamiento','billing');
 assert.equal(details[0].closer,'Pablo Butera');assert.equal(details[0].name,'Persona A');assert.equal(details[0].amount,3500);assert.equal(details[0].ghlid,'contact-a');
 assert.equal(model.funnelDetails([sale],'evergreen','sales').length,0);
 assert.throws(()=>model.stageKey('cash'));
});
test('detalle del embudo respeta permisos y consulta la selección completa',async t=>{
 const service=require('../modules/metricasv2/services/supabase.service'),calls=[];
 t.mock.method(service,'listAllRows',async(resource,options)=>{calls.push({resource,options});return [];});
 const router=api.createRouter();
 const get=(stage,authUser)=>new Promise((resolve,reject)=>{const path='/details?channel=lanzamiento&webinar=webinar-2&stage='+stage;const url=new URL(path,'http://local');const res={statusCode:200,status(n){this.statusCode=n;return this;},json(body){resolve({status:this.statusCode,body});}};router.handle({method:'GET',url:path,query:Object.fromEntries(url.searchParams),authUser},res,reject);});
 const restricted={role:'comercial',access_config:{useCustomAccess:true,allowedPages:['mag-sistema-agendas.html']}};
 assert.equal((await get('agendas',restricted)).status,403);
 assert.equal((await get('sales',restricted)).status,403);
 assert.equal(calls.length,0);
 const full={role:'total',email:'test'};
 for(const stage of ['agendas','calls','sales','billing'])assert.equal((await get(stage,full)).status,200);
 assert.deepEqual(calls.map(r=>r.resource),['commercial_webinar_leads','commercial_webinar_leads','commercial_objectives_sales','commercial_objectives_sales']);
 for(const call of calls){assert.deepEqual(call.options.eqFilters,{webinar_id:'webinar-2'});assert.equal(call.options.from,undefined);}
});
