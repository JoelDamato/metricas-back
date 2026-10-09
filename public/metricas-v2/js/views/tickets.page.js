(() => {
  const $ = id => document.getElementById(id);
  const statuses = ['Abierto', 'En progreso', 'Resuelto', 'Cerrado'];
  const notionStatuses = ['Pendiente', 'Bloqueando', 'En progreso', 'Revisar', 'Finalizada'];
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const folded = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const priorityRank = value => {
    const label = folded(value).trim();
    if (/urgente|critica|critical|urgent|highest/.test(label)) return 0;
    if (/alta|alto|high/.test(label)) return 1;
    if (/media|medio|medium|normal/.test(label)) return 2;
    if (/baja|bajo|low/.test(label)) return 3;
    return 4;
  };
  const done = t => ['Finalizada', 'Resuelto', 'Cerrado'].includes(t.status);
  let tickets = [], canManage = false, previewUrl, limit = 30;
  async function request(path = '', options = {}) {
    const response = await fetch(`/api/metricas/tickets${path}`, { credentials: 'same-origin', ...options });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'No se pudo completar la operación.');
    return data;
  }
  function render() {
    const query = folded($('searchTickets').value);
    const filtered = tickets.filter(t => !done(t) && (!$('statusFilter').value || t.status === $('statusFilter').value)
      && (!$('clientFilter').value || (t.clients || ['matias-randazzo']).includes($('clientFilter').value))
      && (!$('areaFilter').value || (t.areas || []).includes($('areaFilter').value))
      && folded(`${t.subject} ${t.detail} ${t.author}`).includes(query))
      .sort((a,b) => priorityRank(a.priority) - priorityRank(b.priority) || (Date.parse(b.updatedAt || b.createdAt) || 0) - (Date.parse(a.updatedAt || a.createdAt) || 0) || String(a.id).localeCompare(String(b.id)));
    $('ticketCount').textContent = `${filtered.length} tareas sin finalizar`;
    $('ticketList').innerHTML = filtered.length ? filtered.slice(0,limit).map(t => `<details class="ticket-row" data-detail="${escape(t.id)}"><summary><span class="ticket-row-title"><strong>${escape(t.subject)}</strong><small>${escape(t.client || 'Matías Randazzo')}${t.areas?.length ? ` · ${escape(t.areas.join(' · '))}` : ''}</small></span><span class="ticket-priority" data-priority="${priorityRank(t.priority)}">${escape(t.priority || 'Sin prioridad')}</span><span class="ticket-status" data-status="${escape(t.status)}">${escape(t.status)}</span><span class="ticket-row-arrow" aria-hidden="true">›</span></summary><div class="ticket-expanded"><p class="ticket-meta">${escape(t.author)} · ${escape(new Date(t.createdAt).toLocaleDateString('es-AR'))}${t.dueDate ? ` · Vence: ${escape(t.dueDate)}` : ''}${t.priority ? ` · Prioridad ${escape(t.priority)}` : ''}</p><p class="ticket-detail">${escape(t.detail || (t.source === 'notion' ? 'Cargando detalle…' : 'Sin detalle adicional.'))}</p><div class="ticket-body"></div>${t.hasImage ? `<a href="/api/metricas/tickets/${encodeURIComponent(t.id)}/image" target="_blank" rel="noopener"><img class="ticket-attachment" loading="lazy" src="/api/metricas/tickets/${encodeURIComponent(t.id)}/image" alt="Imagen adjunta"></a>` : ''}${t.notion?.status === 'pending_sync' || t.notion?.status === 'pending_configuration' ? `<p class="ticket-note">Pendiente de envío a Notion.</p>${canManage ? `<button type="button" data-sync="${escape(t.id)}">Reintentar envío</button>` : ''}` : ''}${canManage ? `<label class="ticket-state-edit">Actualizar estado<select data-ticket="${escape(t.id)}">${(t.source === 'notion' ? notionStatuses : statuses).map(s => `<option${s === t.status ? ' selected' : ''}>${s}</option>`).join('')}</select></label>` : ''}</div></details>`).join('') : `<div class="ticket-empty">${tickets.length ? 'No hay tareas que coincidan con los filtros.' : 'No hay tareas actuales. Podés abrir un ticket cuando necesites ayuda.'}</div>`;
    $('loadMoreTickets').hidden = filtered.length <= limit;
  }
  async function load(force = false) {
    $('refreshTickets').disabled = true; $('listMessage').textContent = 'Actualizando tareas de Notion…';
    try {
      const data = await request(force ? '?refresh=1' : '');
      if (data.warning && tickets.some(t => t.source === 'notion')) tickets = [...data.tickets, ...tickets.filter(t => t.source === 'notion')];
      else tickets = data.tickets;
      canManage = data.canManage; render();
      $('listMessage').textContent = data.warning || (data.notionConnected ? `Sincronizado con Notion · ${new Date(data.syncedAt).toLocaleTimeString('es-AR')}` : 'Notion todavía no está conectado.');
    } catch (error) { $('listMessage').textContent = error.message; $('ticketCount').textContent = 'No se pudo actualizar la lista.'; }
    finally { $('refreshTickets').disabled = false; }
  }
  function clearImage() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null; $('image').value = ''; $('imagePreview').hidden = true; $('imagePreview').removeAttribute('src'); $('removeImage').hidden = true;
  }
  $('image').addEventListener('change', () => {
    const file = $('image').files[0];
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (!file) return clearImage();
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { clearImage(); $('formMessage').textContent = 'Elegí una imagen PNG, JPG o WebP de hasta 5 MB.'; return; }
    previewUrl = URL.createObjectURL(file); $('imagePreview').src = previewUrl; $('imagePreview').hidden = false; $('removeImage').hidden = false; $('formMessage').textContent = '';
  });
  $('removeImage').addEventListener('click', clearImage);
  $('ticketForm').addEventListener('submit', async event => {
    event.preventDefault(); $('submitTicket').disabled = true; $('formMessage').textContent = 'Guardando ticket y enviando a Notion…';
    try {
      const body = new FormData(); body.set('subject', $('subject').value); body.set('detail', $('detail').value); body.set('clientKey', $('ticketClient').value); body.set('area', $('ticketArea').value);
      if ($('image').files[0]) body.set('image', $('image').files[0]);
      const data = await request('', { method: 'POST', body });
      tickets.unshift(data.ticket); $('clientFilter').value = $('ticketClient').value; ['statusFilter','searchTickets','areaFilter'].forEach(id => $(id).value = ''); limit = 30; render();
      $('newTicketDialog').close();
      $('ticketForm').reset(); clearImage(); $('formMessage').textContent = ''; $('listMessage').textContent = data.warning || (data.ticket.source === 'notion' ? 'Ticket creado y enviado a las tareas de Scalo en Notion.' : 'Ticket guardado.');
    } catch (error) { $('formMessage').textContent = error.message; }
    finally { $('submitTicket').disabled = false; }
  });
  $('ticketList').addEventListener('toggle', async event => {
    const el = event.target;
    if (!el.open || el.dataset.loaded) return;
    const ticket = tickets.find(t => t.id === el.dataset.detail);
    if (ticket?.source !== 'notion') return;
    el.dataset.loaded = 'loading';
    try {
      const { ticket: detail } = await request(`/notion/${encodeURIComponent(ticket.notionId)}`);
      el.querySelector('.ticket-detail').textContent = detail.detail || (!detail.body ? 'Sin detalle adicional.' : '');
      const container = el.querySelector('.ticket-body');
      const paragraph = document.createElement('p'); paragraph.className = 'ticket-detail'; paragraph.textContent = detail.body; container.append(paragraph);
      for (const url of detail.images) { const img = document.createElement('img'); img.className = 'ticket-attachment'; img.alt = 'Imagen de la tarea'; img.loading = 'lazy'; img.src = url; container.append(img); }
      el.dataset.loaded = 'true';
    } catch (error) { el.querySelector('.ticket-detail').textContent = error.message + ' Cerrá y volvé a abrir para reintentar.'; delete el.dataset.loaded; }
  }, true);
  $('ticketList').addEventListener('change', async event => {
    const select = event.target;
    const ticket = tickets.find(t => t.id === select.dataset.ticket);
    if (!ticket) return;
    select.disabled = true;
    try { const data = await request(ticket.source === 'notion' ? `/notion/${ticket.notionId}` : `/${encodeURIComponent(ticket.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: select.value }) }); tickets = tickets.map(t => t.id === ticket.id ? data.ticket : t); render(); $('listMessage').textContent = 'Estado actualizado.'; }
    catch (error) { render(); $('listMessage').textContent = error.message; }
  });
  $('ticketList').addEventListener('click', async event => {
    const button = event.target.closest('[data-sync]'); if (!button) return;
    button.disabled = true;
    try { const data = await request(`/${encodeURIComponent(button.dataset.sync)}/sync`, { method: 'POST' }); tickets = tickets.filter(t => t.id !== button.dataset.sync && t.id !== data.ticket.id); tickets.unshift(data.ticket); render(); $('listMessage').textContent = 'Ticket enviado a Notion.'; }
    catch (error) { button.disabled = false; $('listMessage').textContent = error.message; }
  });
  for (const id of ['searchTickets','statusFilter','clientFilter','areaFilter']) $(id).addEventListener(id === 'searchTickets' ? 'input' : 'change', () => { limit = 30; render(); });
  $('loadMoreTickets').addEventListener('click', () => { limit += 30; render(); });
  $('openTicketDialog').addEventListener('click', () => { $('ticketClient').value = $('clientFilter').value; $('newTicketDialog').showModal(); $('subject').focus(); });
  $('closeTicketDialog').addEventListener('click', () => $('newTicketDialog').close());
  $('toggleTicketFilters').addEventListener('click', () => {
    const show = $('ticketFilters').hidden; $('ticketFilters').hidden = !show;
    $('toggleTicketFilters').setAttribute('aria-expanded', String(show));
  });
  $('refreshTickets').addEventListener('click', () => load(true));
  load();
})();
