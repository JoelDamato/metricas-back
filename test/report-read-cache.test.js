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


test('overload rejects new keys but identical callers still share the active query', async () => {
  const cache = createReportReadCache({concurrency:1, maxPending:2});
  let release;
  const blocking = () => new Promise(resolve => { release = resolve; });
  const current = cache.read('running', blocking);
  const queued = cache.read('queued', async () => 2);
  const shared = cache.read('running', () => assert.fail('duplicate query'));
  await assert.rejects(cache.read('other', () => assert.fail('over capacity')), {
    statusCode:503, code:'REPORT_QUEUE_BUSY'
  });
  release(1);
  assert.deepEqual(await Promise.all([current, queued, shared]), [1,2,1]);
});

test('queued requests expire instead of starting late when the database is slow', async () => {
  const cache = createReportReadCache({concurrency:1, queueWaitMs:10});
  let release;
  const current = cache.read('running', () => new Promise(resolve => { release = resolve; }));
  await assert.rejects(cache.read('late', () => assert.fail('expired work reached the database')), {
    statusCode:503, code:'REPORT_QUEUE_BUSY'
  });
  release('finished');
  assert.equal(await current, 'finished');
  assert.equal(await cache.read('late', async () => 'retry'), 'retry');
});
