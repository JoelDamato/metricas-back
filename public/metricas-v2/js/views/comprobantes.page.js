(function initComprobantesHubPage() {
  const hint = document.getElementById('comprobantesHubHint');
  if (!hint) return;

  const user = window.metricasAuthUser || null;
  const name = String(user?.nombre || user?.email || '').trim();
  hint.textContent = name
    ? `Entraste como ${name}. Elegí una de las dos opciones para seguir.`
    : 'Elegí una de las dos opciones para seguir.';
})();
