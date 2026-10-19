const test=require('node:test'),assert=require('node:assert/strict');
const {createHandler,dateOnly}=require('../modules/csm/entry-metadata');
test('entry metadata uses GHL call date, falls back to CRM call date, and never agenda date',async()=>{
 const calls=[];const handler=createHandler(async(table,p)=>{calls.push({table,p});return table==='recording_sources'?[{ghlid:'a',closer:'Carlos Tu',call_date:'2026-10-07'},{ghlid:'b',call_date:null}]:[{ghlid:'a',closer:'Other',fecha_llamada:'2026-10-01'},{ghlid:'b',closer:'Mauro Gaitan',fecha_llamada:'2026-10-08',fecha_agenda:'2026-10-02'},{ghlid:'c',fecha_agenda:'2026-10-03'}];});
 let result;const res={set(){return this;},json(x){result=x;},status(n){throw Error('Unexpected status '+n);}};
 await handler({authUser:{role:'csm',email:'valecalmet@gmail.com'},query:{ids:'a,b,c'}},res,e=>{throw e;});
 assert.deepEqual(result.rows,[{ghlid:'a',closer:'Carlos Tu',call_date:'2026-10-07'},{ghlid:'b',closer:'Mauro Gaitan',call_date:'2026-10-08'},{ghlid:'c',closer:'',call_date:null}]);assert(calls.every(c=>c.p.ghlid==='in.(a,b,c)'));
 assert.equal(dateOnly('2026-02-30'),null);
});
test('unauthorized callers and malformed identifiers never query the database',async()=>{
 let called=false;const handler=createHandler(async()=>{called=true;return [];});
 for(const [req,expected] of [[{query:{ids:'a'}},403],[{authUser:{role:'total'},query:{ids:'a),x'}},400]]){let status;await handler(req,{status(n){status=n;return this;},json(){}},e=>{throw e;});assert.equal(status,expected);}assert.equal(called,false);
});
