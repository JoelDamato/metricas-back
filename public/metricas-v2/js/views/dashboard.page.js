(function initPersonalDashboard() {
  const LOGIN_WELCOME_STORAGE_KEY = 'metricas-play-login-welcome';
  const refs = {
    welcome: document.getElementById('dashboardWelcome'),
    greeting: document.getElementById('dashboardGreeting'),
    headlineSummary: document.getElementById('dashboardHeadlineSummary'),
    kpis: document.getElementById('dashboardKpis'),
    ranking: document.getElementById('dashboardRankingTable'),
    rankingDescription: document.getElementById('dashboardRankingDescription'),
    performanceEyebrow: document.getElementById('dashboardPerformanceEyebrow'),
    performanceTitle: document.getElementById('dashboardPerformanceTitle'),
    performanceLink: document.getElementById('dashboardPerformanceLink'),
    alerts: document.getElementById('dashboardAlerts'),
    links: document.getElementById('dashboardQuickLinks'),
    insight: document.getElementById('dashboardMonthlyInsight'),
    insightTitle: document.getElementById('dashboardInsightTitle'),
    insightText: document.getElementById('dashboardInsightText'),
    welcomeLoader: document.getElementById('dashboardWelcomeLoader'),
    welcomeLoaderTitle: document.getElementById('dashboardWelcomeLoaderTitle'),
    welcomeLoaderMessage: document.getElementById('dashboardWelcomeLoaderMessage'),
    welcomeSound: document.getElementById('dashboardWelcomeSound')
  };
  if (!refs.kpis || !refs.ranking || !refs.links) return;

  const shouldPlayLoginWelcome = sessionStorage.getItem(LOGIN_WELCOME_STORAGE_KEY) === '1';
  if (shouldPlayLoginWelcome) {
    sessionStorage.removeItem(LOGIN_WELCOME_STORAGE_KEY);
  } else if (refs.welcomeSound) {
    refs.welcomeSound.hidden = true;
  }
  if (refs.welcomeLoader) refs.welcomeLoader.hidden = false;

  const QUICK_LINKS = [
    {page:'entrenamiento.html',href:'/views/entrenamiento.html',label:'Centro de entrenamiento',description:'Test DISC y resultados de cada participante.',icon:'◇',roles:['total','comercial']},
    { page: 'metricas.html', href: '/metricas.html', label: 'Central de Métricas', description: 'Todos los tableros y reportes.', icon: '▦', roles: ['total', 'comercial', 'csm'] },
    { page: 'carga-comprobantes.html', href: '/views/carga-comprobantes.html', label: 'Cargar Comprobante', description: 'Registrar una venta o cobranza.', icon: '+', roles: ['total', 'comercial', 'csm'] },
    { page: 'instructivos-externos', href: 'https://central.scalo.tech/clientes/matias-randazzo/instructivos', label: 'Instructivos', description: 'Guías, procesos y recursos para usar la Central Matías Randazzo.', icon: '▶', roles: ['total', 'comercial', 'csm'], external: true },
    { page: 'tickets.html', href: '/views/tickets.html', label: 'Central de tickets', description: 'Creá una solicitud y seguí los tickets de todo el equipo.', icon: '✉', roles: ['total', 'comercial', 'csm'] },
    { page: 'estado-contacto-comisiones.html', href: '/contacto-estado/', label: 'Estado de Contacto', description: 'Seguimiento de contactos y comisiones.', icon: '◉', roles: ['total', 'comercial'] },
    { page: 'mis-comprobantes.html', href: '/views/mis-comprobantes.html', label: 'Mis Comprobantes', description: 'Tus cargas y conciliaciones.', icon: '▤', roles: ['total', 'comercial', 'csm'] },
    { page: 'grabaciones.html', href: '/views/grabaciones.html', label: 'Grabaciones', description: 'Biblioteca de grabaciones del equipo.', icon: '▶', roles: ['total', 'comercial', 'csm'] },
    { page: 'pdi.html', href: '/views/pdi.html', label: 'PDI', description: 'Desarrollo y seguimiento de closers.', icon: '◇', roles: ['total', 'comercial'], permission: 'canAccessPdi' },
    { page: 'area-comercial.html', href: '/views/area-comercial.html', label: 'Mi Área Comercial', description: 'Tus comisiones y resultados.', icon: '$', roles: ['total', 'comercial'] },
    { page: 'ranking.html', href: '/views/ranking.html', label: 'Ranking de Ventas', description: 'Ventas, cash y facturación.', icon: '↗', roles: ['total', 'comercial'] },
    { page: 'alertas-operativas.html', href: '/views/alertas-operativas.html', label: 'Alertas Operativas', description: 'Casos que requieren atención.', icon: '!', roles: ['total', 'comercial', 'csm'] },
    { page: 'reportes.html', href: '/views/reportes.html', label: 'Reportes Comerciales', description: 'Ventas y cash por período.', icon: '▥', roles: ['total', 'comercial'] },
    { page: 'mag-sistema-agendas.html', href: '/views/mag-sistema-agendas.html', label: 'Sistema de Agendas', description: 'Objetivos y desempeño quincenal.', icon: '◫', roles: ['total', 'comercial'] },
    { page: 'setting.html', href: '/views/setting.html', label: 'Setting', description: 'Embudo detallado por setter.', icon: '◎', roles: ['total', 'comercial'] },
    { page: 'marketing.html', href: '/views/marketing.html', label: 'Marketing', description: 'Inversión, agendas y rentabilidad.', icon: '◔', roles: ['total', 'comercial', 'csm'] },
    { page: 'csm-tiempo.html', href: '/views/csm-tiempo.html', label: 'CSM por Tiempo', description: 'Sesiones y tiempos reales.', icon: '◷', roles: ['total', 'csm'] },
    { page: 'csm-situacion.html', href: '/views/csm-situacion.html', label: 'CSM por Estado', description: 'Estado y desglose por persona.', icon: '◇', roles: ['total', 'csm'] },
    { page: 'csm-rendimiento.html', href: '/views/csm-rendimiento.html', label: 'Rendimiento CSM', description: 'Checks, strikes y bono mensual.', icon: '✓', roles: ['total', 'csm'] },
    { page: 'diagnostico.html', href: '/views/diagnostico.html', label: 'Diagnóstico', description: 'Carta de rumbo del cliente.', icon: '✦', roles: ['total', 'csm'] },
    { page: 'herramientas.html', href: '/views/herramientas.html', label: 'Herramientas', description: 'Utilidades y generador UTM.', icon: '⚙', roles: ['total', 'comercial', 'csm'] },
    { page: 'administracion.html', href: '/views/administracion.html', label: 'Administración', description: 'Conciliación y facturación.', icon: '⌁', roles: ['total'], permission: 'canAccessAdministration' },
    { page: 'admin-usuarios.html', href: '/views/admin-usuarios.html', label: 'Usuarios y Permisos', description: 'Roles y accesos del sistema.', icon: '♙', roles: ['total'], permission: 'canManageUsers' }
  ];

  const CENTRAL_LINKED_PAGES = new Set([
    'agendas-totales.html',
    'agendas-ultimo-origen.html',
    'agendas-detalle-closer.html',
    'ranking.html',
    'mag-sistema-agendas.html',
    'analisis-ventas.html',
    'kpi-closers.html',
    'reportes.html',
    'leads-bdd.html',
    'marketing.html',
    'alertas-operativas.html',
    'setting.html',
    'admin-usuarios.html',
    'csm-renovaciones.html',
    'herramientas.html',
    'csm-tiempo.html',
    'csm-situacion.html'
  ]);

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  const safeNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const formatInteger = (value) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(safeNumber(value));
  const formatUsd = (value) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(safeNumber(value));
  const formatArs = (value) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(safeNumber(value));
  const normalize = (value) => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const EXCLUDED_RANKING_CLOSERS = ['nahuel', 'shirlet', 'shirley'];
  const hasRankingData = (row = {}) => (
    safeNumber(row.total_ventas) > 0
    || safeNumber(row.facturacion_total) > 0
    || safeNumber(row.cash_collected_total) > 0
    || safeNumber(row.monto_incobrable_total) > 0
  );
  const isExcludedRankingCloser = (name) => EXCLUDED_RANKING_CLOSERS
    .some((excluded) => normalize(name).includes(excluded));
  const getRealRankingRows = (rows = []) => rows
    .filter((row) => hasRankingData(row) && !isExcludedRankingCloser(row.closer));
  const isNahuel = (value) => ['nahuel iasci', 'nahuel', 'nahue'].includes(normalize(value));
  const isNahuelUser = (user = {}) => normalize(user.email) === 'iascinahuel@gmail.com' || isNahuel(user.nombre);
  const now = new Date();
  const monthKey = (year, month) => `${year}-${String(month).padStart(2, '0')}`;
  const argentinaParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: 'numeric' }).formatToParts(now);
  const period = { year: Number(argentinaParts.find(p=>p.type==='year').value), month: Number(argentinaParts.find(p=>p.type==='month').value) };
  period.key = monthKey(period.year, period.month);
  const previousDate = new Date(period.year, period.month - 2, 1);
  const previousPeriod = {
    year: previousDate.getFullYear(),
    month: previousDate.getMonth() + 1
  };
  previousPeriod.key = monthKey(previousPeriod.year, previousPeriod.month);
  const previousMonthName = new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(previousDate);
  let welcomeSpeechState = shouldPlayLoginWelcome ? 'idle' : 'silent';
  let welcomeSpeechTimeout = null;
  let welcomeFirstName = '';
  let welcomeLoaderReadyToClose = false;
  let welcomeLoaderClosing = false;
  let welcomeCloseTimeout = null;
  let dashboardEffectsStarted = false;

  const MALE_VOICE_TOKENS = [
    'male', 'hombre', 'masculino', 'jorge', 'diego', 'pablo', 'carlos', 'antonio',
    'alvaro', 'dario', 'miguel', 'felipe', 'juan', 'tomas', 'mateo', 'enrique',
    'andres', 'raul', 'martin', 'sebastian', 'fernando', 'manuel'
  ];

  function chooseWelcomeVoice(voices = []) {
    return [...voices]
      .filter((voice) => normalize(voice.lang).startsWith('es'))
      .map((voice) => {
        const voiceName = normalize(voice.name);
        const voiceLang = normalize(voice.lang);
        const maleMatch = MALE_VOICE_TOKENS.some((token) => voiceName.includes(token));
        const localeScore = voiceLang === 'es-ar' ? 30 : (voiceLang === 'es-419' ? 24 : 16);
        const qualityScore = /natural|neural|premium|enhanced/.test(voiceName) ? 8 : 0;
        return { voice, score: (maleMatch ? 100 : 0) + localeScore + qualityScore };
      })
      .sort((left, right) => right.score - left.score)[0]?.voice || null;
  }

  function setLoaderUser(user) {
    const firstName = String(user?.nombre || user?.email || '').trim().split(/\s+/)[0];
    welcomeFirstName = firstName;
    if (refs.welcomeLoaderTitle) {
      refs.welcomeLoaderTitle.textContent = firstName
        ? `Bienvenido, ${firstName}, a tu panel.`
        : 'Bienvenido a tu panel.';
    }
    return firstName;
  }

  function setWelcomeSoundState(state, label) {
    welcomeSpeechState = state;
    if (['blocked', 'unavailable', 'finished'].includes(state)) finishWelcomeLoaderWhenReady();
    if (!refs.welcomeSound) return;
    refs.welcomeSound.dataset.state = state;
    const text = refs.welcomeSound.querySelector('b');
    if (text && label) text.textContent = label;
  }

  function finishWelcomeLoaderWhenReady() {
    if (!refs.welcomeLoader || welcomeLoaderClosing || !welcomeLoaderReadyToClose) return false;
    if (!['finished', 'unavailable', 'silent', 'blocked', 'idle'].includes(welcomeSpeechState)) return false;

    welcomeLoaderClosing = true;
    window.clearTimeout(welcomeCloseTimeout);
    window.clearTimeout(welcomeSpeechTimeout);
    const delayAfterVoice = welcomeSpeechState === 'finished'
      ? 450
      : (welcomeSpeechState === 'silent' ? 350 : 1200);
    window.setTimeout(() => {
      refs.welcomeLoader.classList.add('is-leaving');
      window.setTimeout(() => {
        refs.welcomeLoader.hidden = true;
        startDashboardEffects();
      }, 360);
    }, delayAfterVoice);
    return true;
  }

  function speakWelcome({ force = false, firstName = welcomeFirstName } = {}) {
    if (refs.welcomeLoader?.hidden) return false;
    if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== 'function') {
      setWelcomeSoundState('unavailable', 'Voz no disponible');
      finishWelcomeLoaderWhenReady();
      return false;
    }
    if (!force && ['waiting', 'pending', 'started', 'finished'].includes(welcomeSpeechState)) return false;

    try {
      window.clearTimeout(welcomeSpeechTimeout);
      const synth = window.speechSynthesis;
      const begin = (voices = [], immediate = false) => {
        const personalizedName = String(firstName || '').trim();
        const welcomeMessage = personalizedName
          ? `Bienvenido, ${personalizedName}, a la Central Matías Randazzo.`
          : 'Bienvenido a la Central Matías Randazzo.';
        const utterance = new window.SpeechSynthesisUtterance(welcomeMessage);
        utterance.lang = 'es-AR';
        utterance.rate = 0.87;
        utterance.pitch = 0.72;
        utterance.volume = 0.9;
        utterance.voice = chooseWelcomeVoice(voices);
        utterance.onstart = () => {
          window.clearTimeout(welcomeSpeechTimeout);
          setWelcomeSoundState('started', 'Reproduciendo bienvenida…');
        };
        utterance.onend = () => {
          setWelcomeSoundState('finished', 'Bienvenida reproducida');
          finishWelcomeLoaderWhenReady();
        };
        utterance.onerror = () => setWelcomeSoundState('blocked', 'Escuchar bienvenida');

        synth.cancel();
        if (typeof synth.resume === 'function') synth.resume();
        setWelcomeSoundState('pending', 'Activando voz…');
        const play = () => synth.speak(utterance);
        if (immediate) play();
        else window.setTimeout(play, 80);
        welcomeSpeechTimeout = window.setTimeout(() => {
          if (welcomeSpeechState !== 'pending') return;
          synth.cancel();
          setWelcomeSoundState('blocked', 'Escuchar bienvenida');
        }, 1800);
      };

      const voices = typeof synth.getVoices === 'function' ? synth.getVoices() : [];
      if (!voices.length && !force && 'onvoiceschanged' in synth) {
        setWelcomeSoundState('waiting', 'Preparando voz…');
        let initialized = false;
        const initializeVoice = () => {
          if (initialized || refs.welcomeLoader?.hidden) return;
          initialized = true;
          synth.removeEventListener?.('voiceschanged', initializeVoice);
          begin(typeof synth.getVoices === 'function' ? synth.getVoices() : []);
        };
        synth.addEventListener?.('voiceschanged', initializeVoice, { once: true });
        window.setTimeout(initializeVoice, 350);
      } else {
        begin(voices, force);
      }
      return true;
    } catch (error) {
      setWelcomeSoundState('blocked', 'Escuchar bienvenida');
      return false;
    }
  }

  function closeWelcomeLoader({ hasError = false } = {}) {
    if (!refs.welcomeLoader) {
      startDashboardEffects();
      return;
    }
    welcomeLoaderReadyToClose = true;
    // Some mobile browsers never emit speech end/error events.
    // Audio must never keep a loaded dashboard behind the welcome overlay.
    if (welcomeCloseTimeout === null) {
      welcomeCloseTimeout = window.setTimeout(() => {
        setWelcomeSoundState('unavailable', 'Voz no disponible');
        window.speechSynthesis?.cancel();
      }, 6000);
    }
    if (hasError && refs.welcomeLoaderMessage) {
      refs.welcomeLoaderMessage.textContent = 'Tu panel está disponible, aunque algunos datos no pudieron actualizarse.';
      refs.welcomeLoader.classList.add('has-error');
    } else {
      refs.welcomeLoader.classList.add('is-ready');
    }
    finishWelcomeLoaderWhenReady();
  }

  function canOpen(item, user) {
    const permissions = user.permissions || {};
    if (item?.page === 'entrenamiento.html') return ['leonardoalaniz19@gmail.com','matirandazzo@gmail.com'].includes(String(user.email||'').toLowerCase());
    if (item?.page === 'tickets.html') return Boolean(user);
    if (!item || !item.roles.includes(user.role)) return false;
    if (item.permission && permissions[item.permission] !== true) return false;
    if (!item.external && Array.isArray(permissions.allowedPages) && !permissions.allowedPages.includes(item.page)) return false;
    if (item.page === 'marketing.html' && permissions.canAccessMarketing === false) return false;
    return true;
  }

  function canReadResource(user, resource) {
    const allowed = user.permissions?.allowedResources;
    if (Array.isArray(allowed)) return allowed.includes(resource);
    const roleAccess = {
      ranking_closers_mensual: ['total', 'comercial'],
      csm: ['total', 'comercial', 'csm']
    };
    return (roleAccess[resource] || []).includes(user.role);
  }

  function renderQuickLinks(user) {
    const owner = String(user.email||'').toLowerCase()==='matirandazzo@gmail.com';
    const visible = QUICK_LINKS.map(item=>owner&&item.page==='area-comercial.html'?{...item,label:'Visión del negocio',description:'Todas las ventas y radar de ingresos.'}:item).filter((item) => (
      canOpen(item, user)
      && (item.page === 'metricas.html' || !CENTRAL_LINKED_PAGES.has(item.page))
    ));
    const featuredPages = new Set(['metricas.html', 'carga-comprobantes.html', 'instructivos-externos', 'tickets.html']);
    const featured = visible.filter((item) => featuredPages.has(item.page));
    const compact = visible.filter((item) => !featuredPages.has(item.page));
    refs.links.dataset.featuredCount = String(featured.length);
    refs.links.dataset.compactCount = String(compact.length);
    refs.links.innerHTML = `
      <div class="dashboard-quick-featured-grid">
        ${featured.map((item) => {
          const isTickets = item.page === 'tickets.html';
          const isCentral = item.page === 'metricas.html';
          const isInstructions = item.page === 'instructivos-externos';
          const cardVariant = isCentral ? 'primary' : (isInstructions ? 'resource' : 'action');
          const externalAttributes = item.external ? ' target="_blank" rel="noopener noreferrer"' : '';
          return `<a class="dashboard-quick-card dashboard-quick-featured-card dashboard-quick-featured-card-${cardVariant}" href="${escapeHtml(item.href)}"${externalAttributes}>
            <span class="dashboard-quick-featured-badge">${isCentral ? '☆ Principal' : (isInstructions ? '↗ Recurso externo' : 'ϟ Acción rápida')}</span>
            <span class="dashboard-quick-icon" aria-hidden="true">${escapeHtml(item.icon)}</span>
            <span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.description)}</small></span>
            <span class="dashboard-quick-featured-cta"><b>${isTickets ? 'Abrir central' : isCentral ? 'Ir al módulo' : (isInstructions ? 'Abrir instructivos' : 'Cargar ahora')}</b><i aria-hidden="true">${isInstructions ? '↗' : '→'}</i></span>
          </a>`;
        }).join('')}
      </div>
      <div class="dashboard-quick-compact-grid">
        ${compact.map((item, index) => `
      <a class="dashboard-quick-card dashboard-quick-card-${(index % 4) + 1}${item.page === 'mis-comprobantes.html' ? ' dashboard-quick-card-emphasis' : ''}" href="${escapeHtml(item.href)}">
        <span class="dashboard-quick-icon" aria-hidden="true">${escapeHtml(item.icon)}</span>
        <span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.description)}</small></span>
        <b aria-hidden="true">→</b>
      </a>
        `).join('')}
      </div>`;
  }

  function getGreeting(date = now) {
    const hour = date.getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 20) return 'Buenas tardes';
    return 'Buenas noches';
  }

  function buildComparison(current, previous, { kind = 'amount', available = true, noun = 'venta', nounPlural = 'ventas' } = {}) {
    if (!available) return { text: `Comparación con ${previousMonthName} no disponible`, tone: 'neutral' };
    const currentValue = safeNumber(current);
    const previousValue = safeNumber(previous);
    const difference = currentValue - previousValue;
    if (kind === 'count') {
      if (!difference) return { text: `Igual que ${previousMonthName}`, tone: 'neutral' };
      const absolute = formatInteger(Math.abs(difference));
      const countNoun = Math.abs(difference) === 1 ? noun : nounPlural;
      return {
        text: `${absolute} ${countNoun} ${difference > 0 ? 'más' : 'menos'} que ${previousMonthName}`,
        tone: difference > 0 ? 'positive' : 'negative'
      };
    }
    if (!previousValue) {
      return currentValue
        ? { text: `Sin base comparable en ${previousMonthName}`, tone: 'neutral' }
        : { text: `Sin variación frente a ${previousMonthName}`, tone: 'neutral' };
    }
    const percentage = (difference / Math.abs(previousValue)) * 100;
    const prefix = percentage > 0 ? '+' : '';
    return {
      text: `${prefix}${percentage.toFixed(1).replace('.', ',')}% vs ${previousMonthName}`,
      tone: percentage > 0 ? 'positive' : (percentage < 0 ? 'negative' : 'neutral')
    };
  }

  function formatAnimatedValue(value, format) {
    if (format === 'usd') return formatUsd(value);
    if (format === 'ars') return formatArs(value);
    return formatInteger(value);
  }

  function animateKpiCounters() {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    refs.kpis.querySelectorAll('[data-count-value]').forEach((node) => {
      const finalValue = safeNumber(node.dataset.countValue);
      const format = node.dataset.countFormat || 'integer';
      if (reduceMotion || !finalValue) {
        node.textContent = formatAnimatedValue(finalValue, format);
        return;
      }
      const startedAt = performance.now();
      const duration = 1800;
      const update = (timestamp) => {
        const progress = Math.max(0, Math.min(1, (timestamp - startedAt) / duration));
        const eased = 1 - ((1 - progress) ** 3);
        node.textContent = formatAnimatedValue(finalValue * eased, format);
        if (progress < 1) window.requestAnimationFrame(update);
      };
      node.textContent = formatAnimatedValue(0, format);
      window.requestAnimationFrame(update);
    });
  }

  function startDashboardEffects() {
    if (dashboardEffectsStarted) return;
    dashboardEffectsStarted = true;
    document.body.classList.add('dashboard-effects-ready');
    animateKpiCounters();
  }

  function renderDynamicHeader(user, items) {
    const firstName = String(user?.nombre || user?.email || '').trim().split(/\s+/)[0] || 'Hola';
    if (refs.welcome) refs.welcome.textContent = 'Tu panel personalizado';
    if (refs.greeting) refs.greeting.textContent = `${getGreeting()}, ${firstName}`;
    if (!refs.headlineSummary) return;
    if (String(user.email||'').toLowerCase()==='matirandazzo@gmail.com') {
      refs.welcome.textContent='Visión del negocio';
      refs.headlineSummary.textContent=`La empresa registra ${items[2]?.value || '0'} ventas, ${items[0]?.value || formatUsd(0)} de facturación y ${items[1]?.value || formatUsd(0)} de cash neto conciliado este mes.`;
      return;
    }
    if (user.role === 'csm') {
      refs.headlineSummary.textContent = `Este mes registraste ${items[0]?.value || '0'} y ${items[2]?.value || '0'} corresponden a cashflow.`;
      return;
    }
    refs.headlineSummary.textContent = `Este mes facturaste ${items[0]?.value || formatUsd(0)}, llevás ${items[2]?.value || '0'} ventas y tu cash collected es de ${items[1]?.value || formatUsd(0)}.`;
  }

  function renderMonthlyInsight(items, user) {
    if (!refs.insightTitle || !refs.insightText) return;
    const monthName = new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(now);
    refs.insightTitle.textContent = `Resumen de ${monthName}`;
    if (String(user.email||'').toLowerCase()==='matirandazzo@gmail.com') {
      refs.insightText.textContent=`El negocio tiene ${items[3]?.value || formatArs(0)} disponibles antes de otros gastos, una vez descontadas las comisiones del equipo. Las acreditaciones pueden incluir cobranzas de ventas anteriores. Revisá el radar de ingresos para priorizar pendientes y rebotes.`;
      return;
    }
    if (user.role === 'csm') {
      refs.insightText.textContent = `La actividad del período suma ${items[0]?.value || '0'} sesiones. ${items[1]?.comparison?.text || ''} y cashflow mantiene ${items[2]?.value || '0'} registros con fecha real de sesión.`;
      return;
    }
    const facturacion = safeNumber(items[0]?.numericValue);
    const cash = safeNumber(items[1]?.numericValue);
    const cashShare = facturacion > 0 ? Math.round((cash / facturacion) * 100) : 0;
    const cashSentence = facturacion > 0
      ? `El cash collected equivale al ${formatInteger(cashShare)}% de la facturación del período.`
      : 'El cash collected ya refleja el movimiento acreditado del período.';
    const facturationComparison = items[0]?.comparison || {};
    const facturationSentence = ['positive', 'negative'].includes(facturationComparison.tone)
      ? `Tu facturación presenta una variación de ${facturationComparison.text || '0%'}.`
      : `Tu facturación está ${facturationComparison.text?.toLowerCase() || 'en actualización'}.`;
    const salesComparison = items[2]?.comparison?.text?.toLowerCase();
    const salesSentence = `Registraste ${items[2]?.value || '0'} ventas${salesComparison ? `, ${salesComparison}` : ''}.`;
    refs.insightText.textContent = `${facturationSentence} ${salesSentence} ${cashSentence}`;
  }

  function renderKpis(items) {
    refs.kpis.innerHTML = items.map((item, index) => {
      const tag = item.href ? 'a' : 'article';
      const linkAttributes = item.href
        ? ` href="${escapeHtml(item.href)}" aria-label="${escapeHtml(item.actionLabel || `${item.label}: ver desglose`)}"`
        : '';
      const counterAttributes = Number.isFinite(Number(item.numericValue))
        ? ` data-count-value="${safeNumber(item.numericValue)}" data-count-format="${escapeHtml(item.format || 'integer')}"`
        : '';
      const comparison = item.comparison || { text: item.note || '', tone: 'neutral' };
      return `
      <${tag} class="dashboard-kpi dashboard-kpi-${(index % 4) + 1}${item.href ? ' dashboard-kpi-link' : ''}"${linkAttributes} style="--dashboard-card-order:${index}">
        <span class="dashboard-kpi-icon" aria-hidden="true">${escapeHtml(item.icon)}</span>
        <div><small>${escapeHtml(item.label)}</small><strong${counterAttributes}>${escapeHtml(item.value)}</strong><p class="dashboard-kpi-comparison dashboard-kpi-comparison-${escapeHtml(comparison.tone || 'neutral')}">${escapeHtml(comparison.text || '')}</p></div>
        ${item.href ? '<span class="dashboard-kpi-action">Ver desglose <b aria-hidden="true">→</b></span>' : ''}
        <i aria-hidden="true"><b></b><b></b><b></b><b></b></i>
      </${tag}>`;
    }).join('');
  }

  function renderRanking(rows, personalName, hasAccess) {
    const fullLink = document.querySelector('[data-dashboard-page="ranking.html"]');
    if (!hasAccess) {
      fullLink?.remove();
      refs.rankingDescription.textContent = 'La tabla comercial no está habilitada para tu rol.';
      refs.ranking.innerHTML = '<div class="dashboard-panel-empty">Tu dashboard conserva únicamente la información y accesos de tu área.</div>';
      return;
    }
    const sorted = [...rows].sort((a, b) => safeNumber(a.ranking_posicion) - safeNumber(b.ranking_posicion));
    refs.rankingDescription.textContent = `${new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(now)} · tu fila aparece destacada.`;
    refs.ranking.innerHTML = `
      <table class="dashboard-ranking-table">
        <thead><tr><th>#</th><th>Closer</th><th>Facturación</th><th>Cash</th><th>Ventas</th><th>Efectividad</th></tr></thead>
        <tbody>${sorted.length ? sorted.map((row) => {
          const isMine = personalName && normalize(row.closer) === normalize(personalName);
          const facturacion = safeNumber(row.facturacion_total);
          const cash = safeNumber(row.cash_collected_total);
          const effectiveness = facturacion > 0 ? (cash / facturacion) * 100 : 0;
          return `<tr${isMine ? ' class="is-current-user"' : ''}>
            <td><span class="dashboard-rank-position">${escapeHtml(row.ranking_posicion || '—')}</span></td>
            <td><strong>${escapeHtml(row.closer || 'Sin nombre')}</strong>${isMine ? '<small>Tu posición</small>' : ''}</td>
            <td>${escapeHtml(formatUsd(row.facturacion_total))}</td>
            <td>${escapeHtml(formatUsd(row.cash_collected_total))}</td>
            <td>${escapeHtml(formatInteger(row.total_ventas))}</td>
            <td>${escapeHtml(`${effectiveness.toFixed(1).replace('.', ',')}%`)}</td>
          </tr>`;
        }).join('') : '<tr><td colspan="6">Todavía no hay ventas en el ranking del mes.</td></tr>'}</tbody>
      </table>`;
  }

  function buildClubMonthlySeries(rows, year) {
    const values = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, value: 0 }));
    (rows || []).forEach((row) => {
      if (Number(row.year ?? row.anio) !== Number(year)) return;
      const month = Number(row.month ?? row.mes);
      if (month < 1 || month > 12) return;
      values[month - 1].value += safeNumber(row.sales ?? row.venta_club);
    });
    return values;
  }

  function renderClubSalesChart(personal) {
    const series = buildClubMonthlySeries(personal?.clubMonthly, period.year);
    const visibleSeries = series.slice(0, Math.max(period.month, 1));
    const max = Math.max(1, ...visibleSeries.map((item) => item.value));
    const total = visibleSeries.reduce((sum, item) => sum + item.value, 0);
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    refs.performanceEyebrow.textContent = 'Rendimiento Club';
    refs.performanceTitle.textContent = 'Ventas Club mes a mes';
    refs.rankingDescription.textContent = `${period.year} · evolución personal de Nahuel. Total acumulado: ${formatInteger(total)}.`;
    if (refs.performanceLink) {
      refs.performanceLink.href = `/views/mis-comprobantes.html?mes=${encodeURIComponent(period.key)}&club=only`;
      refs.performanceLink.dataset.dashboardPage = 'mis-comprobantes.html';
      refs.performanceLink.innerHTML = 'Ver comprobantes Club <span aria-hidden="true">→</span>';
    }
    refs.ranking.classList.add('dashboard-club-chart-wrap');
    refs.ranking.innerHTML = `
      <div class="dashboard-club-chart" style="--club-month-count:${visibleSeries.length}" role="img" aria-label="Ventas Club de Nahuel por mes en ${period.year}">
        <div class="dashboard-club-chart-grid" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        ${visibleSeries.map((item) => {
          const height = item.value > 0 ? Math.max(10, (item.value / max) * 100) : 3;
          return `<div class="dashboard-club-bar-column" style="--club-bar-order:${item.month - 1}" title="${escapeHtml(`${monthNames[item.month - 1]}: ${formatInteger(item.value)} ventas Club`)}">
            <strong>${escapeHtml(formatInteger(item.value))}</strong>
            <span><i style="height:${height}%"></i></span>
            <small>${escapeHtml(monthNames[item.month - 1])}</small>
          </div>`;
        }).join('')}
      </div>`;
  }

  function renderAlerts({ user, personal = null, csmRows = [], rankingRows = [], nahuelDashboard = false }) {
    const missingDiagnosis = csmRows.filter((row) => String(row.f_onboarding || '').slice(0, 7) === period.key && !row.f_diagnostico);
    const sessionsThisMonth = ['f_diagnostico', 'f_costos_1', 'f_eerr_economico', 'f_eerr_financiero', 'f_cashflow']
      .reduce((sum, field) => sum + csmRows.filter((row) => String(row[field] || '').slice(0, 7) === period.key).length, 0);
    const alerts = personal?.isOwner ? [
      {tone:'warning',icon:'◷',title:'Por conciliar',detail:'Comprobantes que todavía no cuentan como cobro',value:personal.summary.pendingCount},
      {tone:'danger',icon:'!',title:'Comprobantes rebotados',detail:'Revisar y corregir con el equipo',value:personal.summary.bouncedCount},
      {tone:'info',icon:'↗',title:'Todas las ventas',detail:'Visión completa de la empresa en el mes',value:personal.summary.salesCount}
    ] : user.role === 'csm' ? [
      { tone: 'danger', icon: '!', title: 'Onboarding del mes sin diagnóstico', detail: 'Vieron el video este mes y aún no tienen sesión', value: missingDiagnosis.length },
      { tone: 'warning', icon: '◷', title: 'Sesiones del mes', detail: 'Según la fecha real de cada hito', value: sessionsThisMonth }
    ] : [
      { tone: 'danger', icon: '$', title: 'Tu comisión del mes', detail: 'Cálculo privado de tu usuario', value: personal?.summary?.totalCommission ? 'OK' : '—' },
      { tone: 'warning', icon: '▤', title: 'Tus operaciones', detail: 'Operaciones comisionables del mes', value: personal?.summary?.transactionCount || 0 },
      nahuelDashboard
        ? { tone: 'info', icon: '↗', title: 'Tus ventas Club', detail: 'Ventas Club del mes en curso', value: personal?.summary?.clubSales || 0 }
        : { tone: 'info', icon: '↗', title: 'Closers en ranking', detail: 'Con actividad este mes', value: rankingRows.length }
    ];
    refs.alerts.innerHTML = alerts.map((alert) => `
      <div class="dashboard-alert dashboard-alert-${alert.tone}">
        <span>${escapeHtml(alert.icon)}</span>
        <div><strong>${escapeHtml(alert.title)}</strong><small>${escapeHtml(alert.detail)}</small></div>
        <b>${escapeHtml(alert.value)}</b>
      </div>
    `).join('');
  }

  function commercialKpis(rows, personal, previousRows = [], previousPersonal = null, comparisonAvailable = true) {
    if (personal?.isOwner) {
      const s=personal.summary,previous=previousPersonal?.summary || {};
      return [
        ['Facturación registrada','facturacionUsd','usd'],['Cash neto conciliado','cashUsd','usd'],['Ventas registradas','salesCount','integer'],['Disponible antes de otros gastos','availableArs','ars']
      ].map(([label,key,format])=>({icon:'↗',label,value:format==='usd'?formatUsd(s[key]):format==='ars'?formatArs(s[key]):formatInteger(s[key]),numericValue:s[key],format,comparison:buildComparison(s[key],previous[key],{available:comparisonAvailable}),actionLabel:'Ver todas las ventas y el radar de ingresos',href:`/views/area-comercial.html?mes=${encodeURIComponent(period.key)}`}));
    }

    const personalRow = rows.find((row) => normalize(row.closer) === normalize(personal?.person));
    const previousPersonalRow = previousRows.find((row) => normalize(row.closer) === normalize(personal?.person));
    const teamFacturacion = rows.reduce((sum, row) => sum + safeNumber(row.facturacion_total), 0);
    const teamCash = rows.reduce((sum, row) => sum + safeNumber(row.cash_collected_total), 0);
    const teamVentas = rows.reduce((sum, row) => sum + safeNumber(row.total_ventas), 0);
    const previousTeamFacturacion = previousRows.reduce((sum, row) => sum + safeNumber(row.facturacion_total), 0);
    const previousTeamCash = previousRows.reduce((sum, row) => sum + safeNumber(row.cash_collected_total), 0);
    const previousTeamVentas = previousRows.reduce((sum, row) => sum + safeNumber(row.total_ventas), 0);
    const hasPersonalSummary = Boolean(personal?.summary);
    const personalFacturacion = safeNumber(personal?.summary?.facturacionUsd);
    const personalCash = safeNumber(personal?.summary?.cashUsd);
    const personalSales = safeNumber(personal?.summary?.salesCount);
    const isPersonal = hasPersonalSummary || Boolean(personalRow);
    const facturacion = hasPersonalSummary ? personalFacturacion : safeNumber(personalRow?.facturacion_total || teamFacturacion);
    const cash = hasPersonalSummary ? personalCash : safeNumber(personalRow?.cash_collected_total || teamCash);
    const sales = hasPersonalSummary ? personalSales : safeNumber(personalRow?.total_ventas || teamVentas);
    const previousFacturacion = hasPersonalSummary
      ? safeNumber(previousPersonal?.summary?.facturacionUsd)
      : safeNumber(previousPersonalRow?.facturacion_total || previousTeamFacturacion);
    const previousCash = hasPersonalSummary
      ? safeNumber(previousPersonal?.summary?.cashUsd)
      : safeNumber(previousPersonalRow?.cash_collected_total || previousTeamCash);
    const previousSales = hasPersonalSummary
      ? safeNumber(previousPersonal?.summary?.salesCount)
      : safeNumber(previousPersonalRow?.total_ventas || previousTeamVentas);
    const commission = safeNumber(personal?.summary?.totalCommission);
    const previousCommission = safeNumber(previousPersonal?.summary?.totalCommission);
    return [
      { icon: '$', label: personal?.commissionArea ? `Facturación neta · ${personal.commissionArea}` : isPersonal ? 'Tu facturación neta del mes' : 'Facturación del mes', value: formatUsd(facturacion), numericValue: facturacion, format: 'usd', comparison: buildComparison(facturacion, previousFacturacion, { available: comparisonAvailable }) },
      { icon: '↗', label: personal?.commissionArea ? `CC neto · ${personal.commissionArea}` : isPersonal ? 'Tu cash neto' : 'Cash collected', value: formatUsd(cash), numericValue: cash, format: 'usd', comparison: buildComparison(cash, previousCash, { available: comparisonAvailable }) },
      { icon: '▥', label: personal?.commissionArea ? `Ventas · ${personal.commissionArea}` : isPersonal ? 'Tus ventas' : 'Ventas del mes', value: formatInteger(sales), numericValue: sales, format: 'integer', comparison: buildComparison(sales, previousSales, { kind: 'count', available: comparisonAvailable }) },
      {
        icon: '★',
        label: personal?.commissionBreakdown ? 'Comisión total · Marketing + Closer' : personal?.commissionArea ? `Comisión ${personal.commissionArea}` : personal?.summary ? 'Tu comisión calculada' : 'Posición destacada',
        value: personal?.summary
          ? formatArs(commission)
          : (personalRow?.ranking_posicion ? `#${personalRow.ranking_posicion}` : '—'),
        numericValue: personal?.summary ? commission : null,
        format: personal?.summary ? 'ars' : '',
        comparison: personal?.summary
          ? buildComparison(commission, previousCommission, { available: comparisonAvailable })
          : { text: 'Posición del mes en curso', tone: 'neutral' },
        actionLabel: personal?.summary ? 'Detalle privado por comprobante' : '',
        href: personal?.summary ? `/views/area-comercial.html?mes=${encodeURIComponent(period.key)}` : ''
      }
      ,...(personal?.commissionBreakdown ? [
        {icon:'$',label:'Comisión como closer',value:formatArs(personal.commissionBreakdown.closer),numericValue:personal.commissionBreakdown.closer,format:'ars'},
        {icon:'$',label:'Comisión de Marketing',value:formatArs(personal.commissionBreakdown.marketing),numericValue:personal.commissionBreakdown.marketing,format:'ars'}
      ] : [])
    ];
  }

  function csmKpis(rows) {
    const isCurrentMonth = (value) => String(value || '').slice(0, 7) === period.key;
    const isPreviousMonth = (value) => String(value || '').slice(0, 7) === previousPeriod.key;
    const definitions = ['f_diagnostico', 'f_costos_1', 'f_eerr_economico', 'f_eerr_financiero', 'f_cashflow'];
    const sessions = definitions.reduce((total, field) => total + rows.filter((row) => isCurrentMonth(row[field])).length, 0);
    const previousSessions = definitions.reduce((total, field) => total + rows.filter((row) => isPreviousMonth(row[field])).length, 0);
    const diagnoses = rows.filter((row) => isCurrentMonth(row.f_diagnostico)).length;
    const previousDiagnoses = rows.filter((row) => isPreviousMonth(row.f_diagnostico)).length;
    const cashflow = rows.filter((row) => isCurrentMonth(row.f_cashflow)).length;
    const previousCashflow = rows.filter((row) => isPreviousMonth(row.f_cashflow)).length;
    const pendingDiagnosis = rows.filter(row => isCurrentMonth(row.f_onboarding) && !row.f_diagnostico).length;
    return [
      { icon: '✓', label: 'Sesiones del mes', value: formatInteger(sessions), numericValue: sessions, comparison: buildComparison(sessions, previousSessions, { kind: 'count', noun: 'sesión', nounPlural: 'sesiones' }) },
      { icon: '◇', label: 'Diagnósticos realizados', value: formatInteger(diagnoses), numericValue: diagnoses, comparison: buildComparison(diagnoses, previousDiagnoses, { kind: 'count', noun: 'diagnóstico', nounPlural: 'diagnósticos' }) },
      { icon: '$', label: 'Sesiones de cashflow', value: formatInteger(cashflow), numericValue: cashflow, comparison: buildComparison(cashflow, previousCashflow, { kind: 'count', noun: 'sesión', nounPlural: 'sesiones' }) },
      { icon: '!', label: 'Onboarding del mes sin diagnóstico', value: formatInteger(pendingDiagnosis), numericValue: pendingDiagnosis, comparison: { text: 'Según la fecha en que vieron el video', tone: pendingDiagnosis ? 'negative' : 'positive' } }
    ];
  }

  async function load() {
    try {
      const session = await window.http.getJson('/api/metricas/auth/session');
      const user = session.user;
      document.body.classList.toggle('dashboard-csm', user.role === 'csm');
      refs.ranking.closest('.dashboard-ranking-panel').hidden = user.role === 'csm';
      const firstName = setLoaderUser(user);
      if (shouldPlayLoginWelcome) speakWelcome({ firstName });
      renderQuickLinks(user);
      // Navigation only needs the validated session. Slow monthly metrics
      // must not keep the training link (or other tools) behind the overlay.
      refs.kpis.innerHTML = '<div class="dashboard-panel-empty" role="status">Cargando indicadores del mes…</div>';
      refs.ranking.innerHTML = '<div class="dashboard-panel-empty">Cargando resultados…</div>';
      closeWelcomeLoader();

      const rankingItem = QUICK_LINKS.find((item) => item.page === 'ranking.html');
      const rankingAccess = user.role !== 'csm' && canReadResource(user, 'ranking_closers_mensual') && canOpen(rankingItem, user);
      const csmAccess = user.role === 'csm' && canReadResource(user, 'csm');
      const nahuelDashboard = isNahuelUser(user);
      const areaAccount = ['belenherrera.gestion@gmail.com','walteralegre56@gmail.com','leonardoalaniz19@gmail.com'].includes(String(user.email||'').toLowerCase());
      const commercialAccess = areaAccount || ['total', 'comercial'].includes(user.role);
      const requests = await Promise.allSettled([
        rankingAccess && !nahuelDashboard ? window.metricasApi.fetchRows('ranking_closers_mensual', { limit: 50, orderBy: 'ranking_posicion', orderDir: 'asc', eq_anio: period.year, eq_mes: period.month }) : Promise.resolve({ rows: [] }),
        commercialAccess ? window.metricasApi.fetchMyCommercialArea(period.key) : Promise.resolve(null),
        csmAccess ? window.metricasApi.fetchAllRows('csm', { limit: 1000 }) : Promise.resolve({ rows: [] }),
        rankingAccess && !nahuelDashboard ? window.metricasApi.fetchRows('ranking_closers_mensual', { limit: 50, orderBy: 'ranking_posicion', orderDir: 'asc', eq_anio: previousPeriod.year, eq_mes: previousPeriod.month }) : Promise.resolve({ rows: [] }),
        commercialAccess ? window.metricasApi.fetchMyCommercialArea(previousPeriod.key) : Promise.resolve(null)
      ]);
      const value = (index, fallback) => requests[index].status === 'fulfilled' ? requests[index].value : fallback;
      const rankingRows = getRealRankingRows(value(0, { rows: [] }).rows || []);
      const personal = value(1, null);
      if ((user.role === 'comercial' || areaAccount || String(user.email||'').toLowerCase()==='matirandazzo@gmail.com') && !personal?.summary) throw new Error('No se pudieron cargar tus importes netos. Volvé a intentar.');
      if (csmAccess && requests[2].status === 'rejected') throw requests[2].reason;
      const csmByClient = new Map();
      for (const row of value(2, { rows: [] }).rows || []) { const key=row.ghlid||row.id,old=csmByClient.get(key);if(!old||String(row.updated_at||'')>String(old.updated_at||'')) csmByClient.set(key,row); }
      const csmRows = [...csmByClient.values()];
      const previousRankingRows = getRealRankingRows(value(3, { rows: [] }).rows || []);
      const previousPersonal = value(4, null);
      const comparisonAvailable = personal?.summary
        ? requests[4].status === 'fulfilled'
        : requests[3].status === 'fulfilled';
      const kpis = user.role === 'csm'
        ? csmKpis(csmRows)
        : commercialKpis(rankingRows, personal, previousRankingRows, previousPersonal, comparisonAvailable);

      if (user.role === 'csm' && personal?.commissionArea) kpis.push(...commercialKpis([], personal, [], previousPersonal, comparisonAvailable));
      renderDynamicHeader(user, kpis);
      renderKpis(kpis);
      if (user.role === 'csm') { refs.ranking.innerHTML = ''; }
      else if (nahuelDashboard) renderClubSalesChart(personal);
      else renderRanking(rankingRows, personal?.person || user.nombre, rankingAccess);
      renderAlerts({ user, personal, csmRows, rankingRows, nahuelDashboard });
      renderMonthlyInsight(kpis, user);
      window.requestAnimationFrame(() => document.body.classList.add('dashboard-content-ready'));
      closeWelcomeLoader();
    } catch (error) {
      refs.kpis.innerHTML = '<div class="dashboard-panel-empty">No se pudieron cargar los indicadores.</div>';
      refs.ranking.innerHTML = '<div class="dashboard-panel-empty">No se pudo cargar el ranking.</div>';
      closeWelcomeLoader({ hasError: true });
    }
  }

  window.dashboardPageInternals = {
    canOpen,
    canReadResource,
    hasRankingData,
    isExcludedRankingCloser,
    getRealRankingRows,
    commercialKpis,
    csmKpis,
    buildComparison,
    getGreeting,
    renderDynamicHeader,
    renderMonthlyInsight,
    animateKpiCounters,
    startDashboardEffects,
    buildClubMonthlySeries,
    chooseWelcomeVoice,
    setLoaderUser,
    speakWelcome,
    finishWelcomeLoaderWhenReady,
    closeWelcomeLoader
  };
  refs.welcomeSound?.addEventListener('click', () => speakWelcome({ force: true }));
  load();
})();
