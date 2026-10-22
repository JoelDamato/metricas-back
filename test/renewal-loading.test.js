const test=require('node:test'),assert=require('node:assert/strict'),axios=require('axios');
const {load,list}=require('../modules/csm/renewal-data');
const {readUser}=require('../modules/auth/read-user');
test('renovaciones consulta sólo los leads de CSM y no transmite sus campos pesados',async t=>{
 const calls=[];t.mock.method(axios,'get',async(url,{params})=>{calls.push({url,params});return {data:url.endsWith('/csm')?[{id:'c',ghlid:'g',nombre:'Cliente',fecha_final:'2026-11-01',extra:'pesado'}]:url.endsWith('/leads_raw')?[{id:'l',ghlid:'g',nombre:'Cliente',closer:'Leo'}]:[]};});
 const data=await load();assert.equal(data.csmRows[0].fecha_final,'2026-11-01');assert.equal(data.csmRows[0].extra,undefined);assert.equal(data.leadRows[0].closer,'Leo');
 const lead=calls.find(c=>c.url.endsWith('/leads_raw'));assert.equal(lead.params.ghlid,'in.("g")');assert.equal(lead.params.select,'id,ghlid,nombre,closer');
});
test('endpoint conserva permisos de página y recursos',async()=>{
 let status;await list({authUser:{role:'csm'}},{status(n){status=n;return this},json(){}},e=>{throw e});assert.equal(status,403);
});
test('lectura de usuario reintenta conexión cortada y exige respuesta nueva',async t=>{
 let count=0;t.mock.method(axios,'get',async(url,opts)=>{assert.equal(opts.timeout,8000);if(++count===1)throw Object.assign(new Error('socket hang up'),{code:'ECONNRESET'});return {data:[]};});
 assert.deepEqual((await readUser('url',{})).data,[]);assert.equal(count,2);
});
test('lectura de usuario no reintenta permisos denegados y no devuelve datos viejos',async t=>{
 let count=0;t.mock.method(axios,'get',async()=>{count++;throw Object.assign(new Error('denied'),{response:{status:403}});});await assert.rejects(readUser('url',{}),/denied/);assert.equal(count,1);
});
