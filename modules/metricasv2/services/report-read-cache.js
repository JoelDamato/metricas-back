// Only aggregate reports use this cache. Receipts, permissions and writes stay live.
function createReportReadCache({
  ttlMs = 15_000,
  maxEntries = 64,
  concurrency = 3,
  maxPending = 24,
  queueWaitMs = 5_000,
  now = Date.now
} = {}) {
  const completed = new Map();
  const pending = new Map();
  const queue = [];
  let active = 0;
  function drain() {
    while (active < concurrency && queue.length) {
      const { load, resolve, reject, timer } = queue.shift();
      clearTimeout(timer);
      active++;
      Promise.resolve().then(load).then(resolve, reject).finally(() => { active--; drain(); });
    }
  }
  function queueBusy() {
    return Object.assign(new Error('Hay muchas consultas de reportes en curso. Volvé a intentar en unos segundos.'), {
      statusCode: 503,
      code: 'REPORT_QUEUE_BUSY'
    });
  }

  async function read(key, load) {
    const cached = completed.get(key);
    if (cached && cached.expires > now()) return structuredClone(cached.value);
    completed.delete(key);
    if (!pending.has(key)) {
      if (pending.size >= maxPending) throw queueBusy();
      const request = new Promise((resolve, reject) => {
        const job = { load, resolve, reject, timer: null };
        job.timer = setTimeout(() => {
          const index = queue.indexOf(job);
          if (index < 0) return;
          queue.splice(index, 1);
          reject(queueBusy());
        }, queueWaitMs);
        queue.push(job);
        drain();
      })
        .then(value => {
          for (const [k, entry] of completed) if (entry.expires <= now()) completed.delete(k);
          while (completed.size >= maxEntries) completed.delete(completed.keys().next().value);
          completed.set(key, { value: structuredClone(value), expires: now() + ttlMs });
          return value;
        }).finally(() => pending.delete(key));
      pending.set(key, request);
    }
    return structuredClone(await pending.get(key));
  }
  return { read };
}
module.exports = { createReportReadCache };
