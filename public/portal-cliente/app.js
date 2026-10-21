(async () => {
  const status = document.getElementById('portalStatus');
  const id = location.pathname.split('/').filter(Boolean)[1] || '';
  try {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) throw Error('El enlace del portal no es válido.');
    const response = await fetch(`/api/portal-cliente/${encodeURIComponent(id)}`, {cache:'no-store'});
    const data = await response.json();
    if (!response.ok || !data.ok) throw Error(data.message || 'No pudimos cargar tu portal.');
    const portal = data.portal;
    document.getElementById('clientName').textContent = portal.name;
    document.title = `${portal.name} · Mi portal MEG`;
    const roadmap = document.getElementById('rumbo');
    roadmap.innerHTML = '<p class="card-kicker">TU DIRECCIÓN</p><h2 id="roadmapTitle">Carta de rumbo</h2>';
    if (portal.roadmapUrl) {
      const link = document.createElement('a');
      link.href = portal.roadmapUrl; link.target = '_blank'; link.rel = 'noopener noreferrer';
      link.className = 'portal-roadmap-link'; link.textContent = 'Abrir carta en pantalla completa ↗';
      roadmap.append(link);
      const details = document.createElement('details');
      details.className = 'roadmap-disclosure';
      const summary = document.createElement('summary'); summary.textContent = 'Ver mi carta de rumbo';
      details.append(summary);
      // Load the existing client-only roadmap when opened, inside the portal.
      details.addEventListener('toggle', () => {
        if (!details.open || details.querySelector('iframe')) return;
        const frame = document.createElement('iframe');
        frame.src = portal.roadmapUrl; frame.title = 'Tu carta de rumbo'; frame.referrerPolicy = 'no-referrer';
        details.append(frame);
      });
      roadmap.append(details);
    } else {
      const note = document.createElement('p'); note.textContent = 'Tu carta de rumbo aparecerá aquí cuando esté registrada.'; roadmap.append(note);
    }
    document.getElementById('sesiones').innerHTML = renderSessions(portal, true);
    document.getElementById('portalContent').hidden = false;
    status.hidden = true;
  } catch (error) { status.textContent = error.message || 'No pudimos cargar tu portal. Volvé a intentarlo.'; }
})();
