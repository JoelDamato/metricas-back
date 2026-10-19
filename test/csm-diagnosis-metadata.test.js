const test=require('node:test'),assert=require('node:assert/strict'),axios=require('axios');
const {list}=require('../modules/csm/diagnosis-metadata');
test('diagnosis CCM uses initial checkpoint then card owner, without exposing diagnostic content',async()=>{
 const original=axios.get;let calls=0,result;
 axios.get=async()=>{calls++;return{data:[{client_ghlid:'a',initial_csm:'Valeria Calmet',csm_name:'Belén Herrera'},{client_ghlid:'a',csm_name:'Viejo'},{client_ghlid:'b',csm_name:'Belén Herrera'},{client_ghlid:'c',initial_csm:null,csm_name:null}]};};
 try{await list({authUser:{role:'csm'}},{set(){return this;},json(data){result=data;}},e=>{throw e;});assert.deepEqual(result.rows,[{ghlid:'a',ccm:'Valeria Calmet'},{ghlid:'b',ccm:'Belén Herrera'},{ghlid:'c',ccm:''}]);
 let status;await list({}, {status(n){status=n;return this;},json(){}},e=>{throw e;});assert.equal(status,403);assert.equal(calls,1);
 }finally{axios.get=original;}
});
