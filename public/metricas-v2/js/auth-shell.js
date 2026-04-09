(async function initAuthShell() {
  if (window.location.pathname.endsWith('/login.html')) return;

  try {
    const response = await fetch('/api/metricas/auth/session', { credentials: 'same-origin' });
    if (!response.ok) return;
    const data = await response.json();
    const user = data.user;
    if (!user) return;
    const permissions = user.permissions || {};
    const onlyMarketingAccess = permissions.onlyMarketingAccess === true;
    const homeHref = onlyMarketingAccess ? '/metricas/views/marketing.html' : '/metricas/dashboard.html';
    const homeLabel = onlyMarketingAccess ? 'Marketing' : 'Dashboard';

    window.metricasAuthUser = user;
    window.metricasAuthPermissions = permissions;

    const shell = document.createElement('div');
    shell.className = 'auth-shell';
    const showHomeLink = window.location.pathname !== homeHref;
    const displayName = user.nombre || user.email;
    const accessLabel = onlyMarketingAccess ? 'marketing' : (String(user.role || '').trim() || 'sin acceso');
    shell.innerHTML = `
      <div class="auth-shell-inner">
        <div class="auth-shell-group auth-shell-group--primary">
          <a class="auth-shell-brand" href="${homeHref}" aria-label="${homeLabel}">
            <img src="/metricas-assets/mati-randazzo-logo-web.png" alt="Mati Randazzo" />
          </a>
          ${showHomeLink ? `<a class="auth-shell-link" href="${homeHref}">${homeLabel}</a>` : ''}
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
