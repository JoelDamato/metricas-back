const express = require('express');
const multer = require('multer');
const { randomUUID } = require('node:crypto');
const { createStore, STATUSES } = require('./store');
const { createService, CLIENTS } = require('./notion');
function imageType(buffer) {
  if (buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'image/jpeg';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}
function createRouter(store = createStore(), notion = createService()) {
  const router = express.Router();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 4, fieldSize: 12000 } });
  router.use((req, res, next) => {
    if (!req.authUser) return res.status(401).json({ message: 'Sesión requerida' });
    res.set('Cache-Control', 'no-store');
    next();
  });
  const summary = ({ image, ...ticket }) => ({ ...ticket, hasImage: Boolean(image) });
  const syncing = new Map();
  async function publishTicket(id) {
    const ticket = (await store.read()).find(t => t.id === id);
    const remote = await notion.publish(ticket);
    if (remote) await store.mutate(rows => { const row = rows.find(t => t.id === id); row.notion = { status: 'synced', pageId: remote.notionId }; });
    return remote;
  }
  function syncTicket(id) {
    if (syncing.has(id)) return syncing.get(id);
    const operation = publishTicket(id).finally(() => syncing.delete(id));
    syncing.set(id, operation); return operation;
  }
  router.get('/', async (req, res, next) => {
    try {
      const local = (await store.read()).map(summary).reverse();
      let remote, warning;
      try { remote = await notion.list({ force: req.query.refresh === '1' }); }
      catch (_) { warning = 'No se pudieron actualizar las tareas de Notion. Intentá actualizar nuevamente.'; }
      const remoteIds = new Set((remote?.tickets || []).map(t => t.notionId));
      res.json({ tickets: [...local.filter(t => !t.notion?.pageId && !remoteIds.has(t.notion?.pageId)), ...(remote?.tickets || [])], canManage: req.authUser.role === 'total', notionConnected: Boolean(remote?.connected), syncedAt: remote?.syncedAt, warning });
    } catch (e) { next(e); }
  });
  router.get('/notion/:id', async (req, res, next) => {
    try { res.json({ ticket: await notion.detail(req.params.id) }); } catch (e) { next(Object.assign(new Error(e.statusCode === 404 ? 'Tarea no encontrada' : 'No se pudo cargar el detalle de Notion.'), { statusCode: e.statusCode || 502 })); }
  });
  router.patch('/notion/:id', async (req, res, next) => {
    if (req.authUser.role !== 'total') return res.status(403).json({ message: 'Solo los administradores pueden actualizar el estado.' });
    try { res.json({ ticket: await notion.update(req.params.id, req.body?.status) }); } catch (e) { next(Object.assign(new Error(e.statusCode ? e.message : 'No se pudo actualizar Notion.'), { statusCode: e.statusCode || 502 })); }
  });
  router.post('/:id/sync', async (req, res, next) => {
    try {
      const ticket = (await store.read()).find(t => t.id === req.params.id);
      if (!ticket) return res.status(404).json({ message: 'Ticket no encontrado' });
      if (req.authUser.role !== 'total') return res.status(403).json({ message: 'Solo los administradores pueden reintentar el envío.' });
      const remote = await syncTicket(ticket.id);
      if (!remote) return res.status(503).json({ message: 'Notion todavía no está configurado.' });
      res.json({ ticket: remote });
    } catch (_) { res.status(502).json({ message: 'El ticket sigue guardado. No se pudo confirmar el envío a Notion.' }); }
  });
  router.post('/', upload.single('image'), async (req, res, next) => {
    try {
      const subject = typeof req.body?.subject === 'string' ? req.body?.subject.trim() : '';
      const detail = typeof req.body?.detail === 'string' ? req.body?.detail.trim() : '';
      if (!subject || subject.length > 160 || !detail || detail.length > 10000) return res.status(400).json({ message: 'Completá asunto (hasta 160 caracteres) y detalle (hasta 10.000).' });
      const clientKey = req.body?.clientKey || 'matias-randazzo';
      const area = req.body?.area || 'Sistemas';
      if (!CLIENTS[clientKey] || !['Sistemas', 'Csm', 'Admin', 'Comercial', 'Marketing', 'Otros'].includes(area)) return res.status(400).json({ message: 'Cliente o área inválidos.' });
      const mime = req.file && imageType(req.file.buffer);
      if (req.file && !mime) return res.status(400).json({ message: 'Usá una imagen PNG, JPG o WebP válida.' });
      const ticket = { id: randomUUID(), subject, detail, clientKey, client: CLIENTS[clientKey].name, clients: [clientKey], area, areas: [area], status: 'Abierto', author: req.authUser.nombre || req.authUser.email, createdAt: new Date().toISOString(), notion: { status: 'pending_configuration', pageId: null }, image: req.file ? { mime, data: req.file.buffer.toString('base64') } : null };
      await store.mutate(rows => { rows.push(ticket); });
      try {
        const remote = await syncTicket(ticket.id);
        res.status(201).json({ ticket: remote || summary(ticket) });
      } catch (_) {
        await store.mutate(rows => { rows.find(t => t.id === ticket.id).notion.status = 'pending_sync'; });
        ticket.notion.status = 'pending_sync';
        res.status(201).json({ ticket: summary(ticket), warning: 'Ticket guardado. No se pudo confirmar el envío a Notion; un administrador puede reintentarlo.' });
      }
    } catch (e) { next(e); }
  });
  router.get('/:id/image', async (req, res, next) => {
    try {
      const ticket = (await store.read()).find(row => row.id === req.params.id);
      if (!ticket?.image) return res.status(404).json({ message: 'Imagen no encontrada' });
      res.set('X-Content-Type-Options', 'nosniff').type(ticket.image.mime).send(Buffer.from(ticket.image.data, 'base64'));
    } catch (e) { next(e); }
  });
  router.patch('/:id', async (req, res, next) => {
    if (req.authUser.role !== 'total') return res.status(403).json({ message: 'Solo los administradores pueden actualizar el estado.' });
    if (!STATUSES.includes(req.body?.status)) return res.status(400).json({ message: 'Estado inválido' });
    try {
      const ticket = await store.mutate(rows => {
        const row = rows.find(item => item.id === req.params.id);
        if (!row) return null;
        if (row.notion?.pageId) throw Object.assign(new Error('Actualizá el estado desde la tarea de Notion.'), { statusCode: 409 });
        row.status = req.body?.status; row.updatedAt = new Date().toISOString();
        return row;
      });
      if (!ticket) return res.status(404).json({ message: 'Ticket no encontrado' });
      res.json({ ticket: summary(ticket) });
    } catch (e) { next(e); }
  });
  router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) return res.status(400).json({ message: 'Adjuntá una sola imagen de hasta 5 MB.' });
    next(error);
  });
  return router;
}
module.exports = createRouter();
module.exports.createRouter = createRouter;
