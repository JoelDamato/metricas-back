const axios = require('axios');
const env = require('../metricasv2/config/env');

// Mutations compare their original payload inside a transaction, so concurrent
// instances never overwrite another user's update or replace the whole queue.
function createSupabaseStore() {
  let queue = Promise.resolve();
  const headers = { apikey: env.supabaseKey, Authorization: `Bearer ${env.supabaseKey}` };
  async function read() {
    const rows = [];
    for (let offset = 0; ; offset += 100) {
      const { data } = await axios.get(`${env.supabaseUrl}/rest/v1/support_tickets`, {
        headers, params: { select: 'payload', order: 'id.asc', offset, limit: 100 }, timeout: 30000
      });
      rows.push(...data.map(row => row.payload));
      if (data.length < 100) return rows.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
    }
  }
  function mutate(action) {
    const operation = queue.then(async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const rows = await read();
        const before = new Map(rows.map(row => [row.id, structuredClone(row)]));
        const result = action(rows);
        const after = new Map(rows.map(row => [row.id, row]));
        const changes = [...new Set([...before.keys(), ...after.keys()])]
          .filter(id => JSON.stringify(before.get(id)) !== JSON.stringify(after.get(id)))
          .map(id => ({ id, before: before.get(id) || null, after: after.get(id) || null }));
        if (!changes.length) return result;
        try {
          await axios.post(`${env.supabaseUrl}/rest/v1/rpc/support_tickets_mutate`, { p_changes: changes }, { headers, timeout: 30000 });
          return result;
        } catch (error) {
          if (error.response?.data?.code === '40001' && attempt < 2) continue;
          throw Object.assign(new Error('No se pudo guardar el ticket. Volvé a intentar.'), { statusCode: 503 });
        }
      }
    });
    queue = operation.catch(() => {});
    return operation;
  }
  return { read, mutate };
}
module.exports = { createSupabaseStore };
