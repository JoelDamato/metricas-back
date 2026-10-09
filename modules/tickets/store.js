const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const STATUSES = ['Abierto', 'En progreso', 'Resuelto', 'Cerrado'];
function createStore(directory) {
  if (!directory && !process.env.TICKETS_DATA_DIR) return require('./supabase-store').createSupabaseStore();
  directory = directory || process.env.TICKETS_DATA_DIR;
  let queue = Promise.resolve();
  const file = path.join(directory, 'tickets.json');
  async function read() {
    try { return JSON.parse(await fs.readFile(file, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  }
  function mutate(action) {
    const operation = queue.then(async () => {
      const rows = await read();
      const result = action(rows);
      await fs.mkdir(directory, { recursive: true });
      const temporary = `${file}.${randomUUID()}.tmp`;
      await fs.writeFile(temporary, JSON.stringify(rows), { mode: 0o600 });
      await fs.rename(temporary, file);
      return result;
    });
    queue = operation.catch(() => {});
    return operation;
  }
  return { read, mutate };
}
module.exports = { createStore, STATUSES };
