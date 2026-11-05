// Only aggregate reports use this cache. Receipts, permissions and writes stay live.
function createReportReadCache({ ttlMs = 15000, maxEntries = 64, concurrency = 3, now = Date.now } = {}) {
  const completed = new Map();
  const pending = new Map();
  const queue = [];
  let active = 0;
  function drain() {
    while (active < concurrency && queue.length) {
      const { load, resolve, reject } = queue.shift();
      active++;
      Promise.resolve().then(load).then(resolve, reject).finally(() => { active--; drain(); });
    }
  }
  async function read(key, load) {
    const cached = completed.get(key);
    if (cached && cached.expires > now()) return structuredClone(cached.value);
    completed.delete(key);
    if (!pending.has(key)) {
      const request = new Promise((resolve, reject) => { queue.push({ load, resolve, reject }); drain(); })
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
