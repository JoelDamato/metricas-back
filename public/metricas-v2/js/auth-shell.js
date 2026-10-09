(async function initAuthShell() {
  const GHL_CONTACT_BASE_URL = 'https://app.gohighlevel.com/v2/location/WU2z8kl23Dr3IyBW1hv5/contacts/detail/';
  const THEME_STORAGE_KEY = 'metricas-theme';
  const FAVICON_URL = '/metricas-assets/favicon-m.svg';

  function ensureFavicon() {
    if (!document.head) return;
    let link = document.querySelector('link[data-metricas-favicon="true"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('data-metricas-favicon', 'true');
      link.rel = 'icon';
      link.type = 'image/svg+xml';
      document.head.appendChild(link);
    }
    link.href = FAVICON_URL;
  }

  ensureFavicon();

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function shellIcon(name) {
    const icons = {
      open: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>',
      back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6"/></svg>',
      dashboard: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 11 8-7 8 7v9H5v-9"/><path d="M9 20v-6h6v6"/></svg>',
      metrics: '<svg viewBox="0 0 24 24" aria-hidden="true"><g class="shell-dot-grid"><circle cx="6" cy="6" r="1"/><circle cx="12" cy="6" r="1"/><circle cx="18" cy="6" r="1"/><circle cx="6" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="18" cy="12" r="1"/><circle cx="6" cy="18" r="1"/><circle cx="12" cy="18" r="1"/><circle cx="18" cy="18" r="1"/></g></svg>',
      ticket: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4V5Z"/><path d="M15 5v3m0 3v2m0 3v3"/></svg>',
      split: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="1"/><path d="M12 5v14"/></svg>',
      growth: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 18 19 4m-8 0h8v8"/></svg>',
      sparkle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c.8 5.2 3.8 8.2 9 9-5.2.8-8.2 3.8-9 9-.8-5.2-3.8-8.2-9-9 5.2-.8 8.2-3.8 9-9Z"/></svg>',
      settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></svg>',
      moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15.2A8 8 0 0 1 8.8 4 8 8 0 1 0 20 15.2Z"/></svg>',
      sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
      logout: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4H4v16h6m4-4 4-4-4-4m4 4H8"/></svg>'
    };
    return icons[name] || icons.dashboard;
  }

  function normalizeGhlId(value) {
    const text = String(value || '').trim();
    if (!text || text === '-') return '';

    const match = text.match(/contacts\/detail\/([^/?#]+)/i);
    return (match?.[1] || text).trim();
  }

  function buildGhlContactUrl(ghlId) {
    const normalized = normalizeGhlId(ghlId);
    if (!normalized) return '';
    return `${GHL_CONTACT_BASE_URL}${encodeURIComponent(normalized)}`;
  }

  function syncShellOffset() {
    const shell = document.querySelector('.auth-shell');
    const isMobile = window.matchMedia('(max-width: 760px)').matches;
    const width = shell && !isMobile ? Math.ceil(shell.getBoundingClientRect().width) : 0;
    document.documentElement.style.setProperty('--metricas-shell-offset', '0px');
    document.documentElement.style.setProperty('--metricas-sidebar-width', `${width}px`);
    if (shell) document.body.style.paddingTop = isMobile ? `${Math.ceil(shell.getBoundingClientRect().bottom) + 16}px` : '';
  }

  function renderGhlContactCell(label, ghlId) {
    const safeLabel = escapeHtml(label || 'Sin nombre');
    const url = buildGhlContactUrl(ghlId);
    if (!url) return safeLabel;

    return `
      <div class="metricas-ghl-cell">
        <span class="metricas-ghl-name">${safeLabel}</span>
      </div>
    `;
  }

  function resolveTheme(value) {
    return value === 'dark' ? 'dark' : 'light';
  }

  function getStoredTheme() {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (!storedTheme && document.body?.classList.contains('premium-navy-background')) return 'dark';
    return resolveTheme(storedTheme);
  }

  function applyTheme(theme) {
    const resolvedTheme = resolveTheme(theme);
    const isDark = resolvedTheme === 'dark';
    document.documentElement.dataset.theme = resolvedTheme;
    document.body?.setAttribute('data-theme', resolvedTheme);
    document.body?.classList.toggle('theme-dark', isDark);
    document.body?.classList.toggle('mag-theme-dark', isDark && document.body.classList.contains('mag-view'));
    window.dispatchEvent(new CustomEvent('metricas:themechange', {
      detail: { theme: resolvedTheme }
    }));
    return resolvedTheme;
  }

  function setTheme(theme) {
    const resolvedTheme = applyTheme(theme);
    localStorage.setItem(THEME_STORAGE_KEY, resolvedTheme);
    return resolvedTheme;
  }

  function getThemeToggleState() {
    const currentTheme = resolveTheme(document.documentElement.dataset.theme);
    const isDark = currentTheme === 'dark';
    return {
      currentTheme,
      isDark,
      icon: isDark ? '☾' : '☀',
      label: isDark ? 'Dark' : 'Light'
    };
  }

  function syncThemeToggleButton() {
    const button = document.getElementById('metricasThemeToggle');
    if (!button) return;
    const state = getThemeToggleState();
    button.setAttribute('aria-pressed', String(state.isDark));
    button.setAttribute('aria-label', `Cambiar a modo ${state.isDark ? 'claro' : 'oscuro'}`);
    button.innerHTML = `
      <span class="auth-shell-link-icon" aria-hidden="true">${shellIcon(state.isDark ? 'moon' : 'sun')}</span>
      <span class="auth-sidebar-label">${state.label}</span>
    `;
  }

  applyTheme(getStoredTheme());

  window.metricasTheme = {
    get: getStoredTheme,
    set: setTheme,
    apply: applyTheme
  };

  window.addEventListener('storage', (event) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    applyTheme(event.newValue);
    syncThemeToggleButton();
  });

  window.metricasGhl = {
    baseUrl: GHL_CONTACT_BASE_URL,
    normalizeId: normalizeGhlId,
    buildContactUrl: buildGhlContactUrl,
    renderContactCell: renderGhlContactCell
  };

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
    const popup = document.getElementById('dollarMetricasPopup');
    popup?.close();
    popup?.remove();
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
    return String(value || '').includes('/views/split-screen.html');
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

    const popup = document.createElement('dialog');
    popup.setAttribute('aria-labelledby', 'dollarPopupTitle');
    popup.id = 'dollarMetricasPopup';
    popup.className = 'kpi-popup metric-info-popup';
    const hasQuotes = ['blue', 'oficial', 'mep'].some((key) => {
      const quote = quotes?.[key];
      return Number(quote?.compra || 0) > 0 || Number(quote?.venta || 0) > 0;
    });
    popup.innerHTML = `
      <div class="kpi-popup-card metric-info-card dollar-popup-card">
        <h3 id="dollarPopupTitle">Dólar hoy</h3>
        ${hasQuotes ? `
          <div class="dollar-popup-grid">
            ${['blue', 'oficial', 'mep'].map((key) => {
              const quote = quotes?.[key];
              return `
                <article class="dollar-popup-item">
                  <h4>${escapeHtml(quote?.nombre || key)}</h4>
                  <p><strong>Compra:</strong> ${formatCurrencyArs(quote?.compra)}</p>
                  <p><strong>Venta:</strong> ${formatCurrencyArs(quote?.venta)}</p>
                </article>
              `;
            }).join('')}
          </div>
        ` : `
          <p class="dollar-popup-error">${escapeHtml(errorMessage || 'No pude cargar la cotización en este momento.')}</p>
        `}
        <div class="metric-info-actions">
          <button id="closeDollarMetricasPopup" type="button">Cerrar</button>
        </div>
      </div>
    `;

    document.body.appendChild(popup);
    popup.showModal();
    popup.addEventListener('cancel', (event) => { event.preventDefault(); closeDollarPopup(); });
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
    const allowedFeatures = permissions.allowedFeatures;
    const canReadReportComments = !allowedFeatures
      || (Array.isArray(allowedFeatures.reportes_comentarios)
        && allowedFeatures.reportes_comentarios.includes('GET'));
    const homeHref = permissions.homePath
      || (onlyMarketingAccess ? '/views/marketing.html' : '/dashboard.html');
    const homeLabel = homeHref.includes('/views/setting.html')
      ? 'Setting'
      : (['/index.html', '/metricas.html'].includes(homeHref)
        ? 'Central'
        : (onlyMarketingAccess ? 'Marketing' : 'Dashboard'));

    window.metricasAuthUser = user;
    window.metricasAuthPermissions = permissions;

    const shell = document.createElement('div');
    shell.className = 'auth-shell auth-sidebar';
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
    const splitBaseUrl = new URL('/views/split-screen.html', window.location.origin);
    splitBaseUrl.searchParams.set('left', `${window.location.pathname}${window.location.search}`);
    const splitToggleHref = isSplitScreenPage
      ? (() => {
          const leftTarget = currentUrl.searchParams.get('left');
          return leftTarget || homeHref;
        })()
      : splitBaseUrl.toString();
    const splitToggleLabel = isSplitScreenPage ? 'Cerrar dividida' : 'Pantalla dividida';
    const toolsLink = !onlyMarketingAccess
      ? `<a class="auth-shell-link auth-sidebar-item auth-shell-icon-only-top" href="/views/herramientas.html"><span class="auth-shell-link-icon" aria-hidden="true">${shellIcon('sparkle')}</span><span class="auth-sidebar-label">Herramientas</span></a>`
      : '';
    rememberStandardPage();
    const canGoBack = window.history.length > 1;
    const adminLink = permissions.canManageUsers === true
      ? `<a class="auth-shell-link auth-sidebar-item auth-shell-link-admin-icon auth-shell-icon-only-top" href="/views/admin-usuarios.html"><span class="auth-shell-link-icon" aria-hidden="true">${shellIcon('settings')}</span><span class="auth-sidebar-label">Administración</span></a>`
      : '';
    const canNavigatePage = (pageName) => !allowedPages || allowedPages.includes(pageName);
    const navCurrentClass = (href) => {
      try {
        return new URL(href, window.location.origin).pathname === window.location.pathname ? ' is-current' : '';
      } catch (error) {
        return '';
      }
    };
    const dashboardLink = homeHref !== '/dashboard.html' && canNavigatePage('dashboard.html')
      ? `<a class="auth-shell-link auth-sidebar-item${navCurrentClass('/dashboard.html')}" href="/dashboard.html"><span class="auth-shell-link-icon" aria-hidden="true">${shellIcon('dashboard')}</span><span class="auth-sidebar-label">Dashboard</span></a>`
      : '';
    const metricsLink = homeHref !== '/metricas.html' && canNavigatePage('metricas.html')
      ? `<a class="auth-shell-link auth-sidebar-item${navCurrentClass('/metricas.html')}" href="/metricas.html"><span class="auth-shell-link-icon" aria-hidden="true">${shellIcon('metrics')}</span><span class="auth-sidebar-label">Central de Métricas</span></a>`
      : '';
    const homeIcon = homeHref === '/metricas.html' ? shellIcon('metrics') : shellIcon('dashboard');
    shell.innerHTML = `
      <button id="metricasSidebarBackdrop" class="auth-shell-backdrop" type="button" aria-label="Cerrar menú" hidden></button>
      <div class="auth-shell-inner">
        <div class="auth-shell-brand" aria-label="Matías Randazzo">
          <span class="auth-shell-brand-mark" aria-hidden="true">${shellIcon('open')}</span>
          <img class="auth-shell-brand-full" src="/metricas-assets/mati-randazzo-logo-web.png" alt="Mati Randazzo" />
          </div>
        <span class="auth-shell-divider" aria-hidden="true"></span>
        <nav id="metricasSidebarNav" class="auth-shell-group auth-shell-group--primary auth-sidebar-nav" aria-label="Navegación principal">
          <span class="auth-sidebar-section-label">Navegación</span>
          ${canGoBack ? `<button id="metricasGoBack" class="auth-shell-back-icon auth-sidebar-item" type="button"><span class="auth-shell-link-icon" aria-hidden="true">${shellIcon('back')}</span><span class="auth-sidebar-label">Volver</span></button>` : ''}
          <a class="auth-shell-link auth-shell-link-home auth-sidebar-item${navCurrentClass(homeHref)}" href="${homeHref}">
            <span class="auth-shell-link-icon" aria-hidden="true">${homeIcon}</span>
            <span class="auth-sidebar-label">${escapeHtml(homeLabel)}</span>
          </a>
          ${dashboardLink}
          ${metricsLink}
          <a class="auth-shell-link auth-sidebar-item${navCurrentClass('/views/tickets.html')}" href="/views/tickets.html"><span class="auth-shell-link-icon" aria-hidden="true">${shellIcon('ticket')}</span><span class="auth-sidebar-label">Central de tickets</span></a>
          <a class="auth-shell-link auth-sidebar-item${navCurrentClass(splitToggleHref)}" href="${splitToggleHref}">
            <span class="auth-shell-link-icon" aria-hidden="true">${shellIcon('split')}</span>
            <span class="auth-sidebar-label">${splitToggleLabel}</span>
          </a>
          <button id="openDollarMetricas" class="auth-shell-button-secondary auth-sidebar-item" type="button">
            <span class="auth-shell-link-icon" aria-hidden="true">${shellIcon('growth')}</span>
            <span class="auth-sidebar-label">Dólar hoy</span>
          </button>
          ${toolsLink}
          ${adminLink}
        </nav>
        <div class="auth-shell-group auth-shell-group--secondary auth-sidebar-footer">
          <span class="auth-sidebar-section-label">Preferencias</span>
          <button id="metricasThemeToggle" class="auth-shell-link auth-shell-link-theme auth-sidebar-item" type="button" aria-pressed="false"></button>
          <span class="auth-sidebar-section-label auth-sidebar-user-label">Usuario</span>
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
          <button id="logoutMetricas" class="auth-shell-logout-icon auth-sidebar-item auth-shell-icon-only-top" type="button">
            <span class="auth-shell-link-icon" aria-hidden="true">${shellIcon('logout')}</span>
            <span class="auth-sidebar-label">Cerrar sesión</span>
          </button>
        </div>
      </div>
    `;
    document.body.prepend(shell);
    document.body.classList.add('auth-sidebar-layout');
    const sidebarToggle = document.getElementById('metricasSidebarToggle');
    const sidebarBackdrop = document.getElementById('metricasSidebarBackdrop');
    const sidebarViewport = window.matchMedia('(max-width: 760px)');
    const sidebarTooltip = document.createElement('div');
    sidebarTooltip.id = 'metricasSidebarTooltip';
    sidebarTooltip.className = 'auth-sidebar-floating-tooltip';
    sidebarTooltip.setAttribute('role', 'tooltip');
    sidebarTooltip.setAttribute('aria-hidden', 'true');
    document.body.appendChild(sidebarTooltip);
    let activeTooltipTarget = null;
    let tooltipFrame = 0;

    const hideSidebarTooltip = () => {
      if (tooltipFrame) window.cancelAnimationFrame(tooltipFrame);
      tooltipFrame = 0;
      activeTooltipTarget?.removeAttribute('aria-describedby');
      activeTooltipTarget = null;
      sidebarTooltip.classList.remove('is-visible');
      sidebarTooltip.setAttribute('aria-hidden', 'true');
    };

    const showSidebarTooltip = (target) => {
      const label = target?.dataset?.sidebarTooltip?.trim();
      if (!label || shell.classList.contains('is-expanded') || sidebarViewport.matches) {
        hideSidebarTooltip();
        return;
      }

      if (tooltipFrame) window.cancelAnimationFrame(tooltipFrame);
      activeTooltipTarget?.removeAttribute('aria-describedby');
      activeTooltipTarget = target;
      target.setAttribute('aria-describedby', sidebarTooltip.id);
      sidebarTooltip.textContent = label;
      sidebarTooltip.setAttribute('aria-hidden', 'false');
      sidebarTooltip.classList.remove('is-visible');

      tooltipFrame = window.requestAnimationFrame(() => {
        tooltipFrame = 0;
        if (activeTooltipTarget !== target || shell.classList.contains('is-expanded')) return;
        const targetRect = target.getBoundingClientRect();
        const tooltipRect = sidebarTooltip.getBoundingClientRect();
        const gutter = 12;
        const left = Math.min(targetRect.right + 14, window.innerWidth - tooltipRect.width - gutter);
        const centeredTop = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
        const top = Math.max(gutter, Math.min(centeredTop, window.innerHeight - tooltipRect.height - gutter));
        sidebarTooltip.style.left = `${Math.max(gutter, left)}px`;
        sidebarTooltip.style.top = `${top}px`;
        sidebarTooltip.classList.add('is-visible');
      });
    };

    const syncSidebarTooltips = () => {
      shell.querySelectorAll('.auth-sidebar-item').forEach((item) => {
        const label = item.querySelector('.auth-sidebar-label')?.textContent?.trim()
          || item.getAttribute('aria-label')
          || '';
        if (!label) return;
        item.dataset.sidebarTooltip = label;
        if (!item.getAttribute('aria-label')) item.setAttribute('aria-label', label);
      });
      if (sidebarToggle) sidebarToggle.dataset.sidebarTooltip = sidebarToggle.getAttribute('aria-label') || 'Abrir menú de navegación';
      const sidebarAccount = shell.querySelector('.auth-shell-account');
      if (sidebarAccount) {
        sidebarAccount.dataset.sidebarTooltip = `${displayName} · Acceso: ${accessLabel}`;
        sidebarAccount.setAttribute('aria-label', `${displayName}. Acceso: ${accessLabel}`);
        sidebarAccount.tabIndex = 0;
      }
    };
    syncSidebarTooltips();
    const setSidebarExpanded = (expanded) => {
      const isExpanded = false;
      hideSidebarTooltip();
      shell.classList.toggle('is-expanded', isExpanded);
      document.body.classList.toggle('auth-sidebar-expanded', isExpanded);
      sidebarToggle?.setAttribute('aria-expanded', String(isExpanded));
      sidebarToggle?.setAttribute('aria-label', isExpanded ? 'Cerrar menú de navegación' : 'Abrir menú de navegación');
      if (sidebarToggle) sidebarToggle.dataset.sidebarTooltip = sidebarToggle.getAttribute('aria-label');
      if (sidebarBackdrop) sidebarBackdrop.hidden = !isExpanded || !sidebarViewport.matches;
      syncShellOffset();
    };
    const toggleSidebar = () => setSidebarExpanded(!shell.classList.contains('is-expanded'));
    const syncSidebarViewport = () => {
      const isExpanded = shell.classList.contains('is-expanded');
      if (sidebarBackdrop) sidebarBackdrop.hidden = !isExpanded || !sidebarViewport.matches;
      hideSidebarTooltip();
      syncShellOffset();
    };
    setSidebarExpanded(false);
    sidebarToggle?.addEventListener('click', toggleSidebar);
    sidebarBackdrop?.addEventListener('click', () => setSidebarExpanded(false));
    shell.addEventListener('pointerover', (event) => {
      const target = event.target.closest?.('[data-sidebar-tooltip]');
      if (!target || !shell.contains(target) || target.contains(event.relatedTarget)) return;
      showSidebarTooltip(target);
    });
    shell.addEventListener('pointerout', (event) => {
      const target = event.target.closest?.('[data-sidebar-tooltip]');
      if (!target || target.contains(event.relatedTarget)) return;
      hideSidebarTooltip();
    });
    shell.addEventListener('focusin', (event) => {
      const target = event.target.closest?.('[data-sidebar-tooltip]');
      if (target && shell.contains(target)) showSidebarTooltip(target);
    });
    shell.addEventListener('focusout', (event) => {
      const target = event.target.closest?.('[data-sidebar-tooltip]');
      if (target && !target.contains(event.relatedTarget)) hideSidebarTooltip();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && shell.classList.contains('is-expanded')) setSidebarExpanded(false);
    });
    shell.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        if (window.matchMedia('(max-width: 760px)').matches) setSidebarExpanded(false);
      });
    });
    syncShellOffset();
    window.addEventListener('resize', syncSidebarViewport);
    window.addEventListener('scroll', hideSidebarTooltip, true);
    window.addEventListener('load', syncSidebarViewport);
    sidebarViewport.addEventListener?.('change', syncSidebarViewport);
    if (typeof ResizeObserver !== 'undefined') {
      const shellObserver = new ResizeObserver(() => syncShellOffset());
      shellObserver.observe(shell);
    }
    window.metricasSidebar = {
      open: () => setSidebarExpanded(true),
      close: () => setSidebarExpanded(false),
      toggle: toggleSidebar,
      isExpanded: () => shell.classList.contains('is-expanded')
    };
    syncThemeToggleButton();

    if (user.role !== 'total' && !onlyMarketingAccess && canReadReportComments) {
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
            notice.href = `/views/reportes.html?${params.toString()}`;
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
      document.querySelectorAll('a[href^="/views/"], a[href="/dashboard.html"], a[href="/metricas.html"], a[href="/index.html"]').forEach((node) => {
        const href = node.getAttribute('href') || '';
        const pageName = href.split('/').pop()?.split('?')[0] || '';
        if (!pageName || !pageName.endsWith('.html')) return;
        if (!allowedPages.includes(pageName)) {
          node.remove();
        }
      });
    }

    document.querySelectorAll('[data-requires-permission="comisiones"]').forEach((node) => {
      if (permissions.canAccessComisiones !== true) {
        node.remove();
      }
    });

    document.querySelectorAll('[data-requires-permission="administracion"]').forEach((node) => {
      if (permissions.canAccessAdministration !== true) {
        node.remove();
      }
    });

    document.querySelectorAll('[data-requires-permission="pdi"]').forEach((node) => {
      if (permissions.canAccessPdi !== true) {
        node.remove();
      }
    });

    if (permissions.canAccessLeadsBdd === false) {
      document.querySelectorAll('a[href="/views/leads-bdd.html"]').forEach((node) => node.remove());
    }

    if (permissions.canAccessMarketing === false) {
      document.querySelectorAll('a[href="/views/marketing.html"]').forEach((node) => node.remove());
    }

    document.getElementById('openDollarMetricas')?.addEventListener('click', async () => {
      try {
        const data = await getJsonWithFallback('/api/metricas/dolar-hoy');
        showDollarPopup(data.quotes || {});
      } catch (error) {
        showDollarPopup({}, error.message);
      }
    });

    document.getElementById('metricasThemeToggle')?.addEventListener('click', () => {
      const nextTheme = getThemeToggleState().isDark ? 'light' : 'dark';
      setTheme(nextTheme);
      syncThemeToggleButton();
      syncSidebarTooltips();
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
      window.location.href = '/login.html';
    });

  } catch (error) {
    // noop
  }
})();
