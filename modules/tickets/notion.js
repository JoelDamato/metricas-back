const { Client } = require('@notionhq/client');
const DATABASE_ID = '2f55fdea-62e7-814d-9299-c60f8e1bbecf';
const CLIENTS = {
  'matias-randazzo': { id: '2f55fdea-62e7-80e0-8d49-c955ba4822cd', name: 'Matías Randazzo' },
  accelerator: { id: '30e5fdea-62e7-80d8-8ffd-fc00f52ed0e7', name: 'Accelerator' }
};
const STATES = ['Pendiente', 'Bloqueando', 'En progreso', 'Revisar', 'Finalizada'];
const text = values => (values || []).map(v => v.plain_text || v.text?.content || '').join('');
const sameId = (a, b) => String(a).replace(/-/g, '') === String(b).replace(/-/g, '');
function clientKey(page) {
  const p = page.properties || {};
  const matches = Object.entries(CLIENTS).filter(([, c]) => p.Cliente?.relation?.some(r => sameId(r.id, c.id)));
  if (matches.length) return matches.map(([key]) => key);
  // Relation is authoritative when it exists: never expose another client's task based on an old slug.
  if (p.Cliente?.relation?.length) return [];
  const slug = p['Cliente slug']?.select?.name;
  return slug === 'matias-randazzo' ? [slug] : ['accelerator', 'acelerator'].includes(slug) ? ['accelerator'] : [];
}
function normalize(page) {
  const p = page.properties;
  const clients = clientKey(page);
  return { id: `notion-${page.id}`, source: 'notion', notionId: page.id, url: page.url,
    subject: text(p.Tarea?.title) || 'Sin asunto', detail: text(p['Descripción']?.rich_text),
    status: p.Status?.status?.name || 'Pendiente', author: (p.Responsable?.people || []).map(p => p.name).filter(Boolean).join(', ') || 'Sin asignar',
    createdAt: page.created_time, updatedAt: page.last_edited_time, dueDate: p['Fecha fin']?.date?.start || null,
    areas: (p.Area?.multi_select || []).map(v => v.name), clients, client: clients.map(k => CLIENTS[k].name).join(' · '),
    priority: p.Prioridad?.select?.name || null, hasImage: false };
}
function buildFilter() {
  return { and: [{ property: 'Status', status: { does_not_equal: 'Finalizada' } }, { or: [
    ...Object.values(CLIENTS).map(c => ({ property: 'Cliente', relation: { contains: c.id } })),
    ...['matias-randazzo', 'accelerator', 'acelerator'].map(slug => ({ property: 'Cliente slug', select: { equals: slug } }))
  ] }] };
}
function richText(content) {
  const chunks = String(content).match(/[\s\S]{1,1900}/g) || [];
  return chunks.map(content => ({ type: 'text', text: { content } }));
}
function createService({ client, token = process.env.NOTION_TICKETS_API_KEY, fetchImpl = fetch } = {}) {
  const api = client || (token ? new Client({ auth: token, timeoutMs: 20000, logLevel: 'error' }) : null);
  let cache = null, pending = null;
  async function list({ force = false } = {}) {
    if (!api) return { tickets: [], connected: false };
    if (!force && cache && Date.now() - cache.at < 60000) return cache.data;
    if (pending) return pending;
    pending = (async () => {
      let cursor, pages = [];
      do {
        const result = await api.databases.query({ database_id: DATABASE_ID, filter: buildFilter(), page_size: 100, start_cursor: cursor, sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }] });
        pages.push(...result.results); cursor = result.has_more ? result.next_cursor : null;
      } while (cursor);
      const tickets = [...new Map(pages.filter(p => !p.archived && !p.in_trash && p.properties.Status?.status?.name !== 'Finalizada' && clientKey(p).length).map(p => [p.id, normalize(p)])).values()];
      const data = { tickets, connected: true, syncedAt: new Date().toISOString() };
      cache = { at: Date.now(), data }; return data;
    })();
    try { return await pending; } finally { pending = null; }
  }
  async function checkedPage(id) {
    if (!api || !/^[0-9a-f-]{32,36}$/i.test(id)) throw Object.assign(new Error('Tarea no encontrada'), { statusCode: 404 });
    const page = await api.pages.retrieve({ page_id: id });
    if (!sameId(page.parent?.database_id || '', DATABASE_ID) || !clientKey(page).length || page.archived || page.in_trash) throw Object.assign(new Error('Tarea no encontrada'), { statusCode: 404 });
    return page;
  }
  async function detail(id) {
    const page = await checkedPage(id);
    const blocks = []; let cursor;
    do { const r = await api.blocks.children.list({ block_id: id, page_size: 100, start_cursor: cursor }); blocks.push(...r.results); cursor = r.has_more ? r.next_cursor : null; } while (cursor);
    return { ...normalize(page), body: blocks.map(b => text(b[b.type]?.rich_text)).filter(Boolean).join('\n\n'), images: blocks.filter(b => b.type === 'image').map(b => b.image.file?.url || b.image.external?.url).filter(url => /^https:\/\//i.test(url || '')) };
  }
  async function update(id, status) {
    if (!STATES.includes(status)) throw Object.assign(new Error('Estado inválido'), { statusCode: 400 });
    await checkedPage(id);
    const page = await api.pages.update({ page_id: id, properties: { Status: { status: { name: status } } } });
    cache = null; return normalize(page);
  }
  async function uploadImage(image) {
    const headers = { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28' };
    const filename = `captura.${image.mime === 'image/png' ? 'png' : image.mime === 'image/webp' ? 'webp' : 'jpg'}`;
    const create = await fetchImpl('https://api.notion.com/v1/file_uploads', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'single_part', filename, content_type: image.mime }), signal: AbortSignal.timeout(20000) });
    if (!create.ok) throw new Error('No se pudo adjuntar la imagen en Notion');
    const upload = await create.json();
    const form = new FormData(); form.set('file', new Blob([Buffer.from(image.data, 'base64')], { type: image.mime }), filename);
    const send = await fetchImpl(`https://api.notion.com/v1/file_uploads/${upload.id}/send`, { method: 'POST', headers, body: form, signal: AbortSignal.timeout(30000) });
    if (!send.ok) throw new Error('No se pudo adjuntar la imagen en Notion');
    return upload.id;
  }
  async function publish(ticket) {
    if (!api) return null;
    const key = CLIENTS[ticket.clientKey] ? ticket.clientKey : 'matias-randazzo';
    const description = `${ticket.detail}\n\nSolicitado por: ${ticket.author}\nReferencia de ticket: ${ticket.id}`;
    // Reconcile a previous uncertain create before retrying; the local UUID is stable.
    const found = await api.databases.query({ database_id: DATABASE_ID, filter: { and: [{ property: 'Cliente', relation: { contains: CLIENTS[key].id } }, { property: 'Descripción', rich_text: { contains: `Referencia de ticket: ${ticket.id}` } }] }, page_size: 1 });
    if (found.results.length) return normalize(found.results[0]);
    const children = [{ object: 'block', type: 'paragraph', paragraph: { rich_text: richText(description) } }];
    if (ticket.image) { const id = await uploadImage(ticket.image); children.push({ object: 'block', type: 'image', image: { type: 'file_upload', file_upload: { id } } }); }
    const page = await api.pages.create({ parent: { database_id: DATABASE_ID }, properties: {
      Tarea: { title: richText(ticket.subject) }, 'Descripción': { rich_text: richText(description) },
      Cliente: { relation: [{ id: CLIENTS[key].id }] }, 'Cliente slug': { select: { name: key } },
      Status: { status: { name: 'Pendiente' } }, Area: { multi_select: [{ name: ticket.area || 'Sistemas' }] }
    }, children });
    cache = null; return normalize(page);
  }
  return { list, detail, update, publish, configured: Boolean(api) };
}
module.exports = { createService, normalize, clientKey, buildFilter, CLIENTS, STATES, DATABASE_ID };
