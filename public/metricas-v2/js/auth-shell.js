(async function initAuthShell() {
  if (window.location.pathname.endsWith('/login.html')) return;

  try {
    const response = await fetch('/api/metricas/auth/session', { credentials: 'same-origin' });
    if (!response.ok) return;
    const data = await response.json();
    const user = data.user;
    if (!user) return;
    const permissions = user.permissions || {};

    window.metricasAuthUser = user;
    window.metricasAuthPermissions = permissions;

    const shell = document.createElement('div');
    shell.className = 'auth-shell';
    shell.innerHTML = `
      <span>${user.email} · ${user.role}</span>
      <button id="logoutMetricas">Salir</button>
    `;
    document.body.appendChild(shell);

    document.querySelectorAll('[data-roles]').forEach((node) => {
      const allowedRoles = String(node.dataset.roles || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

      if (allowedRoles.length && !allowedRoles.includes(user.role)) {
        node.remove();
      }
    });

    if (permissions.canAccessMarketing === false) {
      document.querySelectorAll('a[href="/metricas/views/marketing.html"]').forEach((node) => node.remove());
    }

    document.getElementById('logoutMetricas').addEventListener('click', async () => {
      await fetch('/api/metricas/auth/logout', { method: 'POST', credentials: 'same-origin' });
      window.location.href = '/metricas/login.html';
    });

  } catch (error) {
    // noop
  }
})();
