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
