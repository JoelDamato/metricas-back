const {test}=require('node:test');
const assert=require('node:assert/strict');
const cache=require('../modules/metricasv2/services/request-data-cache');
test('marketing shares concurrent reads only within the same request',async()=>{
 let calls=0;const read=()=>cache.once('rows',async()=>++calls);
 assert.deepEqual(await cache.run(()=>Promise.all([read(),read()])),[1,1]);
 assert.deepEqual(await cache.run(()=>Promise.all([read(),read()])),[2,2]);
 assert.equal(await read(),3);
});
test('a failed request cannot poison the next request',async()=>{
 await assert.rejects(cache.run(()=>cache.once('rows',()=>Promise.reject(new Error('offline')))),/offline/);
 assert.equal(await cache.run(()=>cache.once('rows',()=>42)),42);
});
