(function initSplitScreenPage() {
  const PAGE_OPTIONS = [
    { value: '/dashboard.html', label: 'Dashboard' },
    { value: '/index.html', label: 'Central de Métricas' },
    { value: '/views/ranking.html', label: 'Ranking Closers' },
    { value: '/views/agendas-totales.html', label: 'Agendas Totales' },
    { value: '/views/agendas-ultimo-origen.html', label: 'Agendas por Último Origen' },
    { value: '/views/agendas-detalle-closer.html', label: 'Agendas por Closer' },
    { value: '/views/analisis-ventas.html', label: 'Analisis de Ventas' },
    { value: '/views/kpi-closers.html', label: 'KPI Closers' },
    { value: '/views/reportes.html', label: 'Reportes' },
    { value: '/views/alertas-operativas.html', label: 'Alertas Operativas' },
    { value: '/views/mag-sistema-agendas.html', label: 'Sistema de Agendas' },
    { value: '/views/mag-reporte-closers-2026.html', label: 'Reporte Closers' },
    { value: '/views/setting.html', label: 'Setting' },
    { value: '/views/marketing.html', label: 'Totales MKT' },
    { value: '/views/leads-bdd.html', label: 'Informe Por Respuestas' },
    { value: '/views/csm-tiempo.html', label: 'CSM por Tiempo' },
    { value: '/views/csm-situacion.html', label: 'CSM por Situación' },
    { value: '/views/csm-renovaciones.html', label: 'Renovaciones' },
    { value: '/contacto-estado/', label: 'Estado de Contacto' },
    { value: '/views/comisiones.html', label: 'Comisiones' }
  ];

  const workspace = document.getElementById('splitScreenWorkspace');
  const divider = document.getElementById('splitScreenDivider');
  const leftFrame = document.getElementById('splitLeftFrame');
  const rightFrame = document.getElementById('splitRightFrame');
  const leftSelect = document.getElementById('splitLeftSelect');
  const rightSelect = document.getElementById('splitRightSelect');
  const swapButton = document.getElementById('swapSplitScreens');

  const params = new URLSearchParams(window.location.search);
  const normalizePath = (value) => {
    if (!value) return '';
    try {
      const url = new URL(value, window.location.origin);
      return `${url.pathname}${url.search}`;
    } catch (error) {
      return value;
    }
  };
  const withEmbedParam = (value) => {
    const url = new URL(value, window.location.origin);
    url.searchParams.set('embed', '1');
    return `${url.pathname}${url.search}`;
  };

  const leftDefault = normalizePath(params.get('left')) || '/views/ranking.html';
  const rightDefault = normalizePath(params.get('right')) || '/views/agendas-totales.html';

  function setOptions(select, selectedValue) {
    select.innerHTML = PAGE_OPTIONS.map((option) => `
      <option value="${option.value}">${option.label}</option>
    `).join('');
    select.value = selectedValue;
  }

  function syncUrl() {
    const next = new URL(window.location.href);
    next.searchParams.set('left', leftSelect.value);
    next.searchParams.set('right', rightSelect.value);
    window.history.replaceState({}, '', next);
  }

  function loadFrames() {
    leftFrame.src = withEmbedParam(leftSelect.value);
    rightFrame.src = withEmbedParam(rightSelect.value);
    syncUrl();
  }

  function setSplitByClientX(clientX) {
    const rect = workspace.getBoundingClientRect();
    const clamped = Math.min(Math.max(clientX - rect.left, rect.width * 0.2), rect.width * 0.8);
    workspace.style.setProperty('--split-left', `${(clamped / rect.width) * 100}%`);
  }

  let dragging = false;
  let rafId = 0;
  let pendingClientX = null;

  function flushDrag() {
    rafId = 0;
    if (pendingClientX === null) return;
    setSplitByClientX(pendingClientX);
  }

  function queueDrag(clientX) {
    pendingClientX = clientX;
    if (rafId) return;
    rafId = window.requestAnimationFrame(flushDrag);
  }

  divider.addEventListener('pointerdown', (event) => {
    dragging = true;
    pendingClientX = event.clientX;
    document.body.classList.add('split-screen-dragging');
    divider.setPointerCapture(event.pointerId);
    queueDrag(event.clientX);
  });

  divider.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    queueDrag(event.clientX);
  });

  function stopDragging() {
    if (!dragging) return;
    dragging = false;
    pendingClientX = null;
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
    document.body.classList.remove('split-screen-dragging');
  }

  divider.addEventListener('pointerup', stopDragging);
  divider.addEventListener('pointercancel', stopDragging);

  divider.addEventListener('keydown', (event) => {
    const current = parseFloat(workspace.style.getPropertyValue('--split-left') || '50');
    if (event.key === 'ArrowLeft') {
      workspace.style.setProperty('--split-left', `${Math.max(20, current - 3)}%`);
    } else if (event.key === 'ArrowRight') {
      workspace.style.setProperty('--split-left', `${Math.min(80, current + 3)}%`);
    }
  });

  leftSelect.addEventListener('change', loadFrames);
  rightSelect.addEventListener('change', loadFrames);
  swapButton.addEventListener('click', () => {
    const currentLeft = leftSelect.value;
    leftSelect.value = rightSelect.value;
    rightSelect.value = currentLeft;
    loadFrames();
  });

  setOptions(leftSelect, leftDefault);
  setOptions(rightSelect, rightDefault);
  loadFrames();
})();
