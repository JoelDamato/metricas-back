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
    const showDashboardLink = window.location.pathname !== '/metricas/dashboard.html';
    const displayName = user.nombre || user.email;
    const accessLabel = String(user.role || '').trim() || 'sin acceso';
    shell.innerHTML = `
      <div class="auth-shell-inner">
        <div class="auth-shell-group auth-shell-group--primary">
          <a class="auth-shell-brand" href="/metricas/dashboard.html" aria-label="Dashboard">
            <img src="/metricas-assets/mati-randazzo-logo-web.png" alt="Mati Randazzo" />
          </a>
          ${showDashboardLink ? '<a class="auth-shell-link" href="/metricas/dashboard.html">Dashboard</a>' : ''}
        </div>
        <div class="auth-shell-group auth-shell-group--secondary">
          <div class="auth-shell-account">
            <span class="auth-shell-user">${displayName}</span>
            <span class="auth-shell-access">Acceso: <strong>${accessLabel}</strong></span>
          </div>
          <button id="logoutMetricas">Salir</button>
        </div>
      </div>
    `;
    document.body.prepend(shell);

    document.querySelectorAll('[data-roles]').forEach((node) => {
      const allowedRoles = String(node.dataset.roles || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

      if (allowedRoles.length && !allowedRoles.includes(user.role)) {
        node.remove();
      }
    });

    if (permissions.canAccessLeadsBdd === false) {
      document.querySelectorAll('a[href="/metricas/views/leads-bdd.html"]').forEach((node) => node.remove());
    }

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
