function csmEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function safeMaterialLinks(links) {
  return (links || []).filter(link => {
    try { const url = new URL(link.url); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; }
    catch { return false; }
  });
}

function formatSessionDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date.split('-').reverse().join('/') : 'Sin fecha registrada';
}

function renderSessions(contact, clientView = false) {
  const materials = contact.csmMaterials || {available:false, appointments:[]};
  const active = session => !['Traffiker','Coaching'].includes(session.label);
  const appointments = (materials.appointments || []).filter(active);
  const sessions = [...(contact.csmProgress?.sessions || [
    'Onboarding','Diagnóstico','Costos','EERR económico','EERR financiero','Cashflow'
  ].map(label => ({label})))].filter(active);
  for (const appointment of appointments) {
    if (!sessions.some(session => session.label === appointment.label)) sessions.push({label:appointment.label});
  }
  const statuses = {confirmed:'Confirmada',cancelled:'Cancelada',showed:'Asistió',noshow:'No asistió',new:'Nueva',invalid:'Inválida'};
  return `<section class="csm-appointments" aria-label="Sesiones por cita">
    <p class="card-kicker">ACOMPAÑAMIENTO · CITAS</p><h3>${clientView?'Tus sesiones':'Sesiones del cliente'}</h3>
    <p>Abrí cada sesión para ver sus citas, grabaciones e informes.</p>
    ${!materials.available ? '<p class="materials-warning" role="status">Los materiales no están disponibles temporalmente. Volvé a cargar la página para reintentar.</p>' : ''}
    <div class="csm-appointment-grid">${sessions.map(session => {
      const rows = appointments.filter(a => a.label === session.label);
      const date = session.date || (rows.find(a => a.date)?.date ? formatSessionDate(rows.find(a => a.date).date) : null);
      const count = rows.reduce((total,a) => total + safeMaterialLinks(a.links).length, 0);
      return `<details class="csm-appointment ${date?'has-date':''}">
        <summary><span class="csm-calendar-icon" aria-hidden="true">${date?'✓':'▦'}</span>
          <span class="csm-session-summary"><span class="csm-session-title">${csmEscape(session.label)}</span>
            <strong>${csmEscape(date || 'Sin fecha registrada')}</strong>
            <small>${csmEscape(session.status || (date?'Fecha de cita registrada':'Sin sesión registrada'))}</small>
            <span class="session-toggle">${count ? `${count} ${count===1?'material':'materiales'}` : 'Ver detalle'} <span aria-hidden="true">⌄</span></span>
          </span>
        </summary>
        <div class="csm-session-content">${rows.length ? rows.map(appointment => {
          const links = safeMaterialLinks(appointment.links);
          return `<div class="session-materials">
            <strong>${csmEscape(formatSessionDate(appointment.date))}</strong>
            <small>${csmEscape(appointment.title)}</small>
            <small>${csmEscape(statuses[appointment.status] || appointment.status || 'Sin estado')}</small>
            <div class="session-material-actions">${links.map(link => `<a href="${csmEscape(link.url)}" target="_blank" rel="noopener noreferrer">${csmEscape(link.label)} ↗</a>`).join('')}</div>
            ${!links.length ? '<small>Sin grabación ni informe registrados.</small>' : ''}
          </div>`;
        }).join('') : `<div class="session-materials"><small>${materials.available?'Sin grabación ni informe registrados.':'Materiales no disponibles temporalmente.'}</small></div>`}
        </div></details>`;
    }).join('')}</div>
  </section>`;
}
