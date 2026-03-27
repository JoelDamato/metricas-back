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
      <h2>Esperando un GHL ID</h2>
      <p>Entrá con <code>/contacto-estado/TU_GHL_ID</code> o usá el buscador de arriba para abrir la ficha del contacto.</p>
    </article>
  `;
}

function renderContact(contact) {
  const container = document.getElementById('cardContainer');
  const statusTone = getStatusTone(contact.estado);
  const safeName = escapeHtml(contact.nombre || 'Sin nombre');
  const safeStatus = escapeHtml(contact.estado || 'Sin estado');
  const safeGhlId = escapeHtml(contact.ghlId || 'Sin dato');
  const safeEmail = escapeHtml(contact.email || 'Sin dato');
  const safePhone = escapeHtml(contact.telefono || 'Sin dato');
  container.innerHTML = `
    <article class="contact-card">
      <div class="card-hero">
        <div class="avatar-badge">${escapeHtml(getInitials(contact.nombre))}</div>
        <div class="card-copy">
          <p class="card-kicker">Ficha resumida</p>
          <h2>${safeName}</h2>
          <p class="card-subcopy">Resumen principal del contacto para compartir de forma simple y rápida.</p>
        </div>
        <span class="status-pill ${statusTone}">${safeStatus}</span>
      </div>

      <section class="metric-strip">
        <article class="metric-tile">
          <span>Facturación total</span>
          <strong>${escapeHtml(formatAmount(contact.facturacionTotal))}</strong>
        </article>
        <article class="metric-tile">
          <span>Cash collected total</span>
          <strong>${escapeHtml(formatAmount(contact.cashCollectedTotal))}</strong>
        </article>
      </section>

      <dl class="contact-details">
        <div class="detail">
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
    </article>
  `;
}

async function fetchContact(ghlId) {
  const response = await fetch(`/api/contacto-estado/${encodeURIComponent(ghlId)}`);
  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(data.message || 'No pudimos cargar el contacto');
  }

  return data.contact;
}

async function loadContact() {
  const ghlId = getGhlIdFromLocation();
  const input = document.getElementById('ghlIdInput');
  input.value = ghlId;

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
    const ghlId = String(document.getElementById('ghlIdInput').value || '').trim();
    if (!ghlId) {
      setStatus('Ingresá un GHL ID para hacer la búsqueda.', 'error');
      return;
    }

    window.location.href = `/contacto-estado/${encodeURIComponent(ghlId)}`;
  });
}

setupForm();
loadContact();
