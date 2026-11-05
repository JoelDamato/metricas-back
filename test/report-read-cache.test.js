const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createReportReadCache } = require('../modules/metricasv2/services/report-read-cache');

test('simultaneous report reads share one query and return isolated values until expiry', async () => {
  let time = 0, calls = 0;
  const cache = createReportReadCache({ ttlMs: 15, now: () => time });
  const load = async () => { calls++; return [{ count: calls }]; };
  const [a,b] = await Promise.all([cache.read('october',load),cache.read('october',load)]);
  a[0].count=99;
  assert.equal(b[0].count,1);
  assert.equal((await cache.read('october',load))[0].count,1);
  assert.equal(calls,1);
  await cache.read('november',load);
  assert.equal(calls,2);
  time=16;
  assert.equal((await cache.read('october',load))[0].count,3);
});
test('failed queries are not cached and distinct requests obey the concurrency limit', async () => {
  const cache=createReportReadCache({concurrency:2});
  let active=0, peak=0;
  const load=async()=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,5));active--;return [];};
  await Promise.all(Array.from({length:8},(_,i)=>cache.read(String(i),load)));
  assert.equal(peak,2);
  await assert.rejects(cache.read('failure',()=>Promise.reject(new Error('offline'))),/offline/);
  assert.deepEqual(await cache.read('failure',async()=>['recovered']),['recovered']);
});
test('completed cache has a bounded size', async()=>{
  const cache=createReportReadCache({maxEntries:2});let calls=0;
  const load=async()=>++calls;
  await cache.read('a',load);await cache.read('b',load);await cache.read('c',load);
  assert.equal(await cache.read('a',load),4);
});
