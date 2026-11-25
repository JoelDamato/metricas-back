function getGhlIdFromLocation() {
  const searchParams = new URLSearchParams(window.location.search);
  const fromQuery = String(searchParams.get('ghlId') || '').trim();
  if (fromQuery) return fromQuery;

  const parts = window.location.pathname.split('/').filter(Boolean);
  const index = parts.indexOf('contacto-estado');
  if (index >= 0 && parts[index + 1]) {
    return decodeURIComponent(parts[index + 1]).trim();
  }

  return '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildGhlContactUrl(ghlId) {
  const normalized = String(ghlId || '').trim();
  if (!normalized) return '';
  return `https://app.gohighlevel.com/v2/location/WU2z8kl23Dr3IyBW1hv5/contacts/detail/${encodeURIComponent(normalized)}`;
}

function getInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) return 'SC';
  return parts.map((part) => part[0]?.toUpperCase() || '').join('');
}

function getStatusTone(status) {
  const normalized = String(status || '').toLowerCase().trim();
  if (normalized.includes('club')) return 'tone-club';
  if (normalized.includes('meg')) return 'tone-meg';
  if (normalized.includes('venta') || normalized.includes('pago')) return 'tone-hot';
  return 'tone-neutral';
}

function formatAmount(value) {
  if (value === null || value === undefined || value === '') return 'Sin dato';
  if (typeof value === 'number') {
    return new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  const parsed = Number(String(value).replace(/,/g, ''));
  if (Number.isFinite(parsed)) {
    return new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(parsed);
  }

  return String(value);
}

function setStatus(message, tone = 'info') {
  const box = document.getElementById('statusBox');
  box.hidden = false;
  box.className = `status-box ${tone}`;
  box.textContent = message;
}

function clearStatus() {
  const box = document.getElementById('statusBox');
  box.hidden = true;
  box.textContent = '';
  box.className = 'status-box';
}

function renderEmptyState() {
  const container = document.getElementById('cardContainer');
  container.innerHTML = `
    <article class="contact-card empty-state">
      <p class="card-kicker">Ficha lista para consultar</p>
      <h2>Buscá un contacto</h2>
      <p>Escribí arriba el nombre, el mail o el teléfono (o el GHL ID) y abrí su ficha.</p>
    </article>
  `;
}

function renderReceipts(contact) {
  const rows=Array.isArray(contact.comprobantes)?contact.comprobantes:[];
  const money=(value,currency='USD')=>value==null?'Sin dato':new Intl.NumberFormat('es-AR',{style:'currency',currency}).format(Number(value||0));
  return `<section class="contact-receipts"><p class="card-kicker">Historial completo</p><h3>Comprobantes <span>${rows.length}</span></h3>
    <p>Ventas, cobranzas y devoluciones anteriores y nuevas. Sólo lo conciliado cuenta como cobrado. El importe recibido y el importe sin IVA se muestran por separado. Cuando el cash ya está cargado sin IVA, no se vuelve a descontar.</p>
    ${contact.historicalOpeningBalance?`<p>Histórico anterior incluido en los totales: facturación <b>${escapeHtml(money(contact.historicalOpeningBalance.facturacion))}</b> · cobrado <b>${escapeHtml(money(contact.historicalOpeningBalance.cash_collected))}</b>. Sin comprobantes individuales disponibles.</p>`:''}
    <div class="receipt-summary"><span>Recibido conciliado con IVA: <b>${escapeHtml(money(contact.receiptTotals?.cobradoBruto))}</b></span><span>Cobrado conciliado sin IVA: <b>${escapeHtml(money(contact.receiptTotals?.cobrado))}</b></span><span>Pendiente sin IVA: <b>${escapeHtml(money(contact.receiptTotals?.pendiente))}</b></span><span>Rebotado sin IVA: <b>${escapeHtml(money(contact.receiptTotals?.rebotado))}</b></span><span>Saldo: <b>${escapeHtml(money(contact.receiptTotals?.saldo))}</b></span></div>
    ${rows.length?`<div class="receipt-scroll" tabindex="0" role="region" aria-label="Historial de comprobantes"><table><thead><tr><th>Fecha</th><th>Tipo / producto</th><th>Cuotas pactadas</th><th>Medio</th><th>Recibido con IVA ARS</th><th>Recibido con IVA USD</th><th>Sin IVA USD</th><th>Estado</th><th>Referencia</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${escapeHtml(String(r.f_acreditacion||r.fecha_creado||r.f_venta||'').slice(0,10)||'Sin fecha')}</td><td><strong>${escapeHtml(r.tipo||'Sin tipo')}</strong><small>${escapeHtml(r.producto_format||'')}</small></td><td>${escapeHtml(r.cantidad_de_pagos||'Sin registrar')}</td><td>${escapeHtml(r.medios_de_pago_format||'Sin dato')}</td><td>${escapeHtml(money(r.received_cash_ars,'ARS'))}</td><td>${escapeHtml(money(r.received_cash_usd))}</td><td>${escapeHtml(money(r.cash_without_iva_usd))}</td><td><span class="receipt-state">${escapeHtml(String(r.rebotar_pago)==='true'?'Rebotado':r.estado||'No conciliado')}</span></td><td><details><summary>Ver ID</summary><code>${escapeHtml(r.id)}</code>${r.venta_relacionada?`<small>Venta: ${escapeHtml(r.venta_relacionada)}</small>`:''}</details></td></tr>`).join('')}</tbody></table></div>`:'<p>Este cliente todavía no tiene comprobantes.</p>'}
  </section>`;
}

function renderCsmProgress(progress) {
  if (!progress) return '';
  const percent = Math.round(progress.completed / progress.total * 100);
  return `<section class="csm-learning" aria-label="Avance en la plataforma">
    <div class="csm-learning-heading"><div><p class="card-kicker">PLATAFORMA · MÓDULOS</p><h3>${progress.completed===progress.total?'Recorrido completado':progress.current?`Módulo ${progress.current}`:'Sin módulo registrado'}</h3><p>Último módulo con avance registrado</p></div><div class="csm-learning-score"><strong>${percent}%</strong><span>${progress.completed} de ${progress.total} módulos finalizados</span></div></div>
    <div class="csm-progress-track" role="progressbar" aria-label="Módulos con fecha de fin registrada" aria-valuemin="0" aria-valuemax="${progress.total}" aria-valuenow="${progress.completed}"><span style="width:${percent}%"></span></div>
    <div class="csm-module-steps">${progress.modules.map(m=>`<div class="csm-module-step ${m.completed?'is-complete':m.number===progress.current?'is-current':''}" ${m.number===progress.current?'aria-current="step"':''}><b>${m.completed?'✓ ':''}M${m.number}</b><span>${m.invalid?'Revisar fechas':m.completed?'Finalizado':m.start?'Iniciado':'Sin registro'}</span><small>${m.completed?'Fin: '+escapeHtml(m.end):m.start?'Inicio: '+escapeHtml(m.start):'—'}</small></div>`).join('')}</div>
    <p class="csm-progress-note">La barra cuenta módulos con fecha de finalización. Iniciar un módulo no marca los anteriores como completados.${progress.platformProgress?` Avance informado por la plataforma: ${escapeHtml(progress.platformProgress)}.`:''}</p>
  </section>`;
}

function renderNps(nps) {
  if (!nps) return '';
  const number = value => new Intl.NumberFormat('es-AR', {maximumFractionDigits: 2}).format(value);
  return `<section class="csm-learning" aria-label="Satisfacción por unidad"><p class="card-kicker">NPS · SATISFACCIÓN</p><h3>Promedio: ${nps.average === null ? 'Sin respuestas' : escapeHtml(number(nps.average)) + ' / 10'}</h3><p>${nps.count} respuestas registradas. Las unidades sin respuesta no se incluyen en el promedio.</p><div class="csm-module-steps">${nps.units.map(unit => `<div class="csm-module-step"><b>Unidad ${unit.number}</b><span>${unit.score === null ? 'Sin respuesta' : escapeHtml(number(unit.score)) + ' / 10'}</span></div>`).join('')}</div></section>`;
}

function setupPortalLink(contact) {
  const button = document.getElementById('copyPortalLink');
  const input = document.getElementById('portalLink');
  const status = document.getElementById('portalLinkStatus');
  input.value = new URL(contact.portalUrl, window.location.origin).href;
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(input.value);
      status.textContent = 'Enlace del portal copiado. Ya podés enviárselo al cliente.';
    } catch {
      input.focus(); input.select();
      status.textContent = 'Seleccionamos el enlace. Copialo para enviárselo al cliente.';
    }
  });
}

function renderContact(contact) {
  const container = document.getElementById('cardContainer');
  const isDebtor = contact.deudor === true;
  const isApurar = !isDebtor && contact.apurar === true;
  const statusTone = isDebtor ? 'tone-debtor' : isApurar ? 'tone-apurar' : getStatusTone(contact.estado);
  const safeName = escapeHtml(contact.nombre || 'Sin nombre');
  const safeStatus = escapeHtml(isDebtor ? 'Deudor' : isApurar ? 'Apurar' : contact.estado || 'Sin estado');
  const safeGhlId = escapeHtml(contact.ghlId || 'Sin dato');
  const safeEmail = escapeHtml(contact.email || 'Sin dato');
  const safePhone = escapeHtml(contact.telefono || 'Sin dato');
  const ghlUrl = buildGhlContactUrl(contact.ghlId);
  const areaSections = [
    { key: 'comercial', label: 'Area comercial' },
    { key: 'csm', label: 'CSM' },
    { key: 'administracion', label: 'Administracion' }
  ];
  const areaMarkup = areaSections.map((section, index) => {
    const allItems = Array.isArray(contact.areas?.[section.key]) ? contact.areas[section.key] : [];
    const items = section.key === 'csm' && contact.csmProgress ? allItems.filter(item => ['Acceso','Próximo contacto','Última respuesta','Pausa','Fecha de pausa','Días de pausa','Fecha final del programa','Fecha final de renovación','Meses de soporte'].includes(item.label)) : allItems;
    const itemsMarkup = items.map((item) => `
      <div class="area-detail">
        <dt>${escapeHtml(item.label || 'Dato')}</dt>
        <dd>${escapeHtml(item.type === 'amount' ? formatAmount(item.value) : (item.value || 'Sin dato'))}</dd>
      </div>
    `).join('');

    return `
      <details class="area-accordion"${index === 0 ? ' open' : ''}>
        <summary>${escapeHtml(section.label)}</summary>
        <dl class="area-details">
          ${itemsMarkup || '<div class="area-detail"><dt>Dato</dt><dd>Sin dato</dd></div>'}
        </dl>
      </details>
    `;
  }).join('');

  container.innerHTML = `
    <article class="contact-card${isDebtor ? ' is-debtor' : isApurar ? ' is-apurar' : ''}">
      <div class="card-hero">
        <div class="avatar-badge">${escapeHtml(getInitials(contact.nombre))}</div>
        <div class="card-copy">
          <p class="card-kicker">Ficha resumida</p>
          <h2>${safeName}</h2>
          <p class="card-subcopy">Resumen interno del contacto y sus sesiones.</p>
          <div class="contact-actions" aria-label="Accesos del cliente">
            ${contact.diagnosticUrl ? `<a class="contact-action contact-action-primary contact-roadmap-link" href="${escapeHtml(contact.diagnosticUrl)}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 4-6 3v14l6-3 6 3 6-3V4l-6 3-6-3Z"/><path d="M9 4v14M15 7v14"/></svg><span>Carta de rumbo</span><svg class="contact-action-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg></a>` : ''}
            ${ghlUrl ? `<a class="contact-action contact-action-secondary" href="${ghlUrl}" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="8" r="3"/><path d="M4 20v-2a6 6 0 0 1 12 0v2M17 3h4v4M16 8l5-5"/></svg><span>Abrir en GHL</span><svg class="contact-action-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg></a>` : ''}
          </div>
          ${!contact.diagnosticUrl ? '<p class="card-subcopy">Carta de rumbo: todavía no registrada.</p>' : ''}
        </div>
        <span class="status-pill ${statusTone}">${safeStatus}</span>
      </div>

      <section class="metric-strip">
        <article class="metric-tile">
          <span>Facturación total</span>
          <strong>${escapeHtml(formatAmount(contact.facturacionTotal))}</strong>
        </article>
        <article class="metric-tile">
          <span>Cobrado conciliado sin IVA</span>
          <strong>${escapeHtml(formatAmount(contact.cashCollectedTotal))}</strong>
        </article>
      </section>

      <dl class="contact-details">
        <div class="detail">
          <dt>Productos adquiridos</dt><dd>${escapeHtml((contact.products || []).join(' · ') || 'Sin dato')}</dd>
        </div><div class="detail">
          <dt>GHL ID</dt>
          <dd>${safeGhlId}</dd>
        </div>
        <div class="detail">
          <dt>Email</dt>
          <dd>${safeEmail}</dd>
        </div>
        <div class="detail">
          <dt>Teléfono</dt>
          <dd>${safePhone}</dd>
        </div>
      </dl>

      ${renderCsmProgress(contact.csmProgress)}
      ${renderNps(contact.csmProgress?.nps)}
      <section class="portal-link-panel" aria-label="Portal del cliente">
        <div><p class="card-kicker">PARA COMPARTIR CON EL CLIENTE</p><h3>Un portal para todo su recorrido</h3><p>Carta de rumbo, grabaciones e informes de sus sesiones en un único enlace.</p></div>
        <div class="portal-link-actions"><a href="${escapeHtml(contact.portalUrl)}" target="_blank" rel="noopener">Abrir portal del cliente ↗</a><button id="copyPortalLink" type="button">Copiar enlace del portal</button></div>
        <label for="portalLink">Enlace del cliente</label><input id="portalLink" type="text" readonly />
        <p id="portalLinkStatus" role="status" aria-live="polite"></p>
      </section>
      ${renderSessions(contact)}
      <section class="areas-block">
        <div class="areas-header">
          <p class="card-kicker">Resumen por área</p>
          <h3>Datos clave del contacto</h3>
        </div>
        <div class="areas-stack">
          ${areaMarkup}
        </div>
      </section>
      ${renderReceipts(contact)}
    </article>
  `;
}

async function fetchContact(ghlId) {
  const response = await fetch(`/api/contacto-estado/${encodeURIComponent(ghlId)}`,{cache:'no-store'});
  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(data.message || 'No pudimos cargar el contacto');
  }

  return data.contact;
}

function getSearchFromLocation() {
  return String(new URLSearchParams(window.location.search).get('q') || '').trim();
}

function renderSearchResults(q, results) {
  const container = document.getElementById('cardContainer');
  if (!results.length) {
    container.innerHTML = `
      <article class="contact-card empty-state">
        <p class="card-kicker">Sin resultados</p>
        <h2>No encontramos «${escapeHtml(q)}»</h2>
        <p>Probá con otra parte del nombre, el mail completo o los últimos números del teléfono.</p>
      </article>`;
    return;
  }
  container.innerHTML = `
    <article class="contact-card search-results">
      <p class="card-kicker">Resultados para «${escapeHtml(q)}»</p>
      <h2>${results.length === 1 ? '1 contacto' : `${results.length} contactos`}</h2>
      <ul class="search-list">
        ${results.map((r) => `
          <li>
            <a class="search-item" href="/contacto-estado/${encodeURIComponent(r.ghlId)}">
              <span class="search-avatar">${escapeHtml(getInitials(r.nombre))}</span>
              <span class="search-main">
                <strong>${escapeHtml(r.nombre || 'Sin nombre')}</strong>
                <small>${escapeHtml([r.email, r.telefono].filter(Boolean).join(' · ') || 'Sin mail ni teléfono')}</small>
              </span>
              <span class="search-stage ${r.esCliente ? 'is-client' : ''}">${escapeHtml(r.etapa || 'Sin estado')}</span>
            </a>
          </li>`).join('')}
      </ul>
      ${results.length >= 15 ? '<p class="search-more">Hay más coincidencias: escribí algo más preciso para achicar la lista.</p>' : ''}
    </article>`;
}

async function runSearch(q) {
  setStatus('Buscando contacto...', 'loading');
  document.getElementById('cardContainer').innerHTML = '';
  try {
    const response = await fetch(`/api/contacto-estado-buscar?q=${encodeURIComponent(q)}`, { cache: 'no-store', credentials: 'same-origin' });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) throw new Error('Tu sesión venció. Volvé a ingresar para buscar contactos.');
    if (!response.ok || !data.ok) throw new Error(data.message || 'No pudimos hacer la búsqueda');
    const results = data.results || [];
    // Un solo resultado (o un GHL ID pegado tal cual): directo a la ficha.
    if (results.length === 1 || (data.kind === 'ghlId' && !results.length)) {
      window.location.replace(`/contacto-estado/${encodeURIComponent(results[0]?.ghlId || q)}`);
      return;
    }
    clearStatus();
    renderSearchResults(q, results);
  } catch (error) {
    setStatus(error.message || 'No pudimos hacer la búsqueda', 'error');
  }
}

async function loadContact() {
  const ghlId = getGhlIdFromLocation();
  const input = document.getElementById('ghlIdInput');
  const q = getSearchFromLocation();
  input.value = ghlId || q;

  if (!ghlId && q) {
    runSearch(q);
    return;
  }

  if (!ghlId) {
    clearStatus();
    renderEmptyState();
    return;
  }

  setStatus('Buscando contacto...', 'loading');
  document.getElementById('cardContainer').innerHTML = `
    <article class="contact-card loading-card">
      <div class="loading-line wide"></div>
      <div class="loading-line medium"></div>
      <div class="loading-grid">
        <div class="loading-box"></div>
        <div class="loading-box"></div>
      </div>
      <div class="loading-line full"></div>
      <div class="loading-line full"></div>
    </article>
  `;

  try {
    const contact = await fetchContact(ghlId);
    renderContact(contact);
    setupPortalLink(contact);
    clearStatus();
  } catch (error) {
    document.getElementById('cardContainer').innerHTML = '';
    setStatus(error.message || 'No pudimos cargar el contacto', 'error');
  }
}

function setupForm() {
  const form = document.getElementById('lookupForm');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const q = String(document.getElementById('ghlIdInput').value || '').trim();
    if (q.length < 3) {
      setStatus('Escribí al menos 3 letras o números: nombre, mail, teléfono o GHL ID.', 'error');
      return;
    }

    // La búsqueda queda en la dirección: «atrás» desde una ficha vuelve a la lista.
    window.location.href = `/contacto-estado/?q=${encodeURIComponent(q)}`;
  });
}

setupForm();
loadContact();
