(async function initAuthShell() {
  const currentUrl = new URL(window.location.href);
  const LAST_STANDARD_PAGE_KEY = 'metricas-last-standard-page';
  const CURRENT_STANDARD_PAGE_KEY = 'metricas-current-standard-page';
  const isEmbedMode = currentUrl.searchParams.get('embed') === '1' || window.self !== window.top;
  if (isEmbedMode) {
    document.body.classList.add('metricas-embed');
    return;
  }
  if (window.location.pathname.endsWith('/login.html')) return;

  function formatCurrencyArs(value) {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 2
    }).format(Number(value || 0));
  }

  function closeDollarPopup() {
    document.getElementById('dollarMetricasPopup')?.remove();
  }

  async function getJsonWithFallback(url) {
    if (window.http?.getJson) return window.http.getJson(url);

    const response = await fetch(url, {
      credentials: 'same-origin'
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.message || `Error HTTP ${response.status}`);
    }
    return body;
  }

  function isSplitScreenPath(value) {
    return String(value || '').includes('/metricas/views/split-screen.html');
  }

  function getCurrentRelativeUrl() {
    return `${window.location.pathname}${window.location.search}`;
  }

  function rememberStandardPage() {
    if (isSplitScreenPath(window.location.pathname)) return;

    const currentStandardPage = sessionStorage.getItem(CURRENT_STANDARD_PAGE_KEY);
    const currentRelativeUrl = getCurrentRelativeUrl();
    if (currentStandardPage && currentStandardPage !== currentRelativeUrl) {
      sessionStorage.setItem(LAST_STANDARD_PAGE_KEY, currentStandardPage);
    }
    sessionStorage.setItem(CURRENT_STANDARD_PAGE_KEY, currentRelativeUrl);
  }

  function getLastStandardPage(homeHref) {
    const lastStandardPage = sessionStorage.getItem(LAST_STANDARD_PAGE_KEY);
    if (!lastStandardPage) return homeHref;
    if (isSplitScreenPath(lastStandardPage)) return homeHref;
    if (lastStandardPage === getCurrentRelativeUrl()) return homeHref;
    return lastStandardPage;
  }

  function showDollarPopup(quotes, errorMessage = '') {
    closeDollarPopup();

    const popup = document.createElement('div');
    popup.id = 'dollarMetricasPopup';
    popup.className = 'kpi-popup metric-info-popup';
    const hasQuotes = ['blue', 'oficial', 'mep'].some((key) => {
      const quote = quotes?.[key];
      return Number(quote?.compra || 0) > 0 || Number(quote?.venta || 0) > 0;
    });
    popup.innerHTML = `
      <div class="kpi-popup-card metric-info-card dollar-popup-card">
        <h3>Cotización del día</h3>
        ${hasQuotes ? `
          <div class="dollar-popup-grid">
            ${['blue', 'oficial', 'mep'].map((key) => {
              const quote = quotes?.[key];
              return `
                <article class="dollar-popup-item">
                  <h4>${quote?.nombre || key}</h4>
                  <p><strong>Compra:</strong> ${formatCurrencyArs(quote?.compra)}</p>
                  <p><strong>Venta:</strong> ${formatCurrencyArs(quote?.venta)}</p>
                </article>
              `;
            }).join('')}
          </div>
        ` : `
          <p class="dollar-popup-error">${errorMessage || 'No pude cargar la cotización en este momento.'}</p>
        `}
        <div class="metric-info-actions">
          <button id="closeDollarMetricasPopup" type="button">Cerrar</button>
        </div>
      </div>
    `;

    document.body.appendChild(popup);
    popup.addEventListener('click', (event) => {
      if (event.target === popup) closeDollarPopup();
    });
    document.getElementById('closeDollarMetricasPopup')?.addEventListener('click', closeDollarPopup);
  }

  try {
    const response = await fetch('/api/metricas/auth/session', { credentials: 'same-origin' });
    if (!response.ok) return;
    const data = await response.json();
    const user = data.user;
    if (!user) return;
    const permissions = user.permissions || {};
    const onlyMarketingAccess = permissions.onlyMarketingAccess === true;
    const allowedPages = Array.isArray(permissions.allowedPages) ? permissions.allowedPages : null;
    const homeHref = permissions.homePath
      || (onlyMarketingAccess ? '/metricas/views/marketing.html' : '/metricas/dashboard.html');
    const homeLabel = homeHref.includes('/views/setting.html')
      ? 'Setting'
      : (homeHref === '/metricas'
        ? 'Central'
        : (onlyMarketingAccess ? 'Marketing' : 'Dashboard'));

    window.metricasAuthUser = user;
    window.metricasAuthPermissions = permissions;

    const shell = document.createElement('div');
    shell.className = 'auth-shell';
    const showHomeLink = window.location.pathname !== homeHref;
    const displayName = user.nombre || user.email;
    const initials = String(displayName || 'MR')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] || '')
      .join('')
      .toUpperCase() || 'MR';
    const accessLabel = onlyMarketingAccess ? 'marketing' : (String(user.role || '').trim() || 'sin acceso');
    const isSplitScreenPage = window.location.pathname.endsWith('/split-screen.html');
    const splitBaseUrl = new URL('/metricas/views/split-screen.html', window.location.origin);
    splitBaseUrl.searchParams.set('left', `${window.location.pathname}${window.location.search}`);
    const splitToggleHref = isSplitScreenPage
      ? (() => {
          const leftTarget = currentUrl.searchParams.get('left');
          return leftTarget || homeHref;
        })()
      : splitBaseUrl.toString();
    const splitToggleLabel = isSplitScreenPage ? 'Cerrar dividida' : 'Pantalla dividida';
    rememberStandardPage();
    const canGoBack = window.history.length > 1;
    shell.innerHTML = `
      <div class="auth-shell-inner">
        <div class="auth-shell-group auth-shell-group--primary">
          <a class="auth-shell-brand" href="${homeHref}" aria-label="${homeLabel}">
            <img src="/metricas-assets/mati-randazzo-logo-web.png" alt="Mati Randazzo" />
          </a>
          <span class="auth-shell-divider" aria-hidden="true"></span>
          ${canGoBack ? '<button id="metricasGoBack" class="auth-shell-back-icon" type="button" aria-label="Volver"><span aria-hidden="true">←</span></button>' : ''}
          ${showHomeLink ? `<a class="auth-shell-link auth-shell-link-home" href="${homeHref}">${homeLabel}</a>` : ''}
          <a class="auth-shell-link auth-shell-link-secondary" href="${splitToggleHref}">
            <span class="auth-shell-link-icon" aria-hidden="true">◫</span>
            <span>${splitToggleLabel}</span>
          </a>
          <button id="openDollarMetricas" class="auth-shell-button-secondary" type="button">
            <span class="auth-shell-link-icon" aria-hidden="true">↗</span>
            <span>Dólar hoy</span>
          </button>
        </div>
        <div class="auth-shell-group auth-shell-group--secondary">
          <span class="auth-shell-divider" aria-hidden="true"></span>
          <div class="auth-shell-account">
            <span class="auth-shell-avatar" aria-hidden="true">
              <span class="auth-shell-avatar-text">${initials}</span>
              <span class="auth-shell-avatar-dot"></span>
            </span>
            <span class="auth-shell-account-copy">
              <span class="auth-shell-user">${displayName}</span>
              <span class="auth-shell-access">Acceso: <strong>${accessLabel}</strong></span>
            </span>
          </div>
          <button id="logoutMetricas" class="auth-shell-logout-icon" type="button" aria-label="Salir">
            <span aria-hidden="true">⇱</span>
          </button>
        </div>
      </div>
    `;
    document.body.prepend(shell);

    if (user.role !== 'total' && !onlyMarketingAccess) {
      try {
        const commentsResponse = await fetch('/api/metricas/reportes/comentarios?unread=1', {
          credentials: 'same-origin'
        });
        if (commentsResponse.ok) {
          const commentsData = await commentsResponse.json();
          const unreadComments = commentsData.comments || [];
          const firstComment = unreadComments[0] || {};
          if (unreadComments.length) {
            const notice = document.createElement('a');
            const params = new URLSearchParams({
              desde: firstComment.fecha_desde || '',
              hasta: firstComment.fecha_hasta || ''
            });
            notice.className = 'auth-shell-notice';
            notice.href = `/metricas/views/reportes.html?${params.toString()}`;
            notice.textContent = `${unreadComments.length} comentario${unreadComments.length === 1 ? '' : 's'} nuevo${unreadComments.length === 1 ? '' : 's'}`;
            shell.querySelector('.auth-shell-group--secondary')?.prepend(notice);
          }
        }
      } catch (error) {
        // noop
      }
    }

    document.querySelectorAll('[data-roles]').forEach((node) => {
      const allowedRoles = String(node.dataset.roles || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

      if (allowedRoles.length && !allowedRoles.includes(user.role)) {
        node.remove();
      }
    });

    if (allowedPages) {
      document.querySelectorAll('a[href^="/metricas"]').forEach((node) => {
        const href = node.getAttribute('href') || '';
        const pageName = href.split('/').pop()?.split('?')[0] || '';
        if (!pageName || !pageName.endsWith('.html')) return;
        if (!allowedPages.includes(pageName)) {
          node.remove();
        }
      });
    }

    if (permissions.canAccessLeadsBdd === false) {
      document.querySelectorAll('a[href="/metricas/views/leads-bdd.html"]').forEach((node) => node.remove());
    }

    if (permissions.canAccessMarketing === false) {
      document.querySelectorAll('a[href="/metricas/views/marketing.html"]').forEach((node) => node.remove());
    }

    document.getElementById('openDollarMetricas')?.addEventListener('click', async () => {
      try {
        const data = await getJsonWithFallback('/api/metricas/dolar-hoy');
        showDollarPopup(data.quotes || {});
      } catch (error) {
        showDollarPopup({}, error.message);
      }
    });

    document.getElementById('metricasGoBack')?.addEventListener('click', () => {
      if (isSplitScreenPage) {
        window.location.href = splitToggleHref;
        return;
      }

      try {
        const referrer = document.referrer ? new URL(document.referrer) : null;
        const sameOriginReferrer = referrer && referrer.origin === window.location.origin;
        const splitScreenReferrer = sameOriginReferrer && isSplitScreenPath(referrer.pathname);

        if (splitScreenReferrer) {
          window.location.href = getLastStandardPage(homeHref);
          return;
        }

        if (sameOriginReferrer && window.history.length > 1) {
          window.history.back();
          return;
        }
      } catch (error) {
        // noop
      }

      window.location.href = getLastStandardPage(homeHref);
    });

    document.getElementById('logoutMetricas').addEventListener('click', async () => {
      await fetch('/api/metricas/auth/logout', { method: 'POST', credentials: 'same-origin' });
      window.location.href = '/metricas/login.html';
    });

  } catch (error) {
    // noop
  }
})();
