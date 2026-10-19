const test=require('node:test'),assert=require('node:assert/strict'),axios=require('axios');
const {list}=require('../modules/csm/program-metadata');
test('metadatos CSM exigen permisos y proyectan sólo los campos necesarios',async()=>{
 const original=axios.get;let output,called=0;
 axios.get=async(url,{params})=>{called++;assert.equal(params.select.includes('support_active'),true);assert.equal(params.select.includes('*'),false);return {data:[{ghlid:'a',support_active:'Vigente',rubro:'Textil'}]};};
 try{
 let status;await list({}, {status(n){status=n;return this},json(){}},e=>{throw e});assert.equal(status,403);assert.equal(called,0);
 await list({authUser:{role:'csm'}},{set(){return this},json(d){output=d}},e=>{throw e});assert.equal(output.rows[0].rubro,'Textil');assert.equal(called,1);
 }finally{axios.get=original}
});
