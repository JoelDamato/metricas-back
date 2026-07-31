(function () {
  const MONTHS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const FALLBACK_RULES = {
    members: ['Valeria Calmet', 'Sofía Gallardo', 'Gabriela Costarelli'],
    categories: {
      strike: [
        'Ausencia, llegada tarde o falta de preparación (reunión con cliente o interna del equipo)',
        'Incumplimiento de plazo o tarea recurrente no realizada',
        'Registro no realizado (CRM / ficha del cliente)',
        'Traspaso de tarea fallido entre compañeras',
        'Error en la ejecución (entregable con error significativo)',
        'Falta de detección o supervisión oportuna',
        'Trato y conducta',
        'Imagen profesional',
        'Compromiso indebido con el cliente',
        'Confidencialidad',
        'Uso indebido de recursos o herramientas internas',
        'Contacto con cliente fuera de horario sin justificar',
        'Inconsistencia de información entre profesionales',
        'Otro'
      ],
      check: [
        'Propuesta implementada (mejora, documento o proceso ya hecho)',
        'Resolución proactiva de un problema, con evidencia',
        'Otro'
      ]
    },
    baseSalaryUsd: 850,
    bonusRules: [
      { label: 'Negativo', bonusUsd: 0, totalUsd: 850 },
      { label: '0', bonusUsd: 100, totalUsd: 950 },
      { label: '+1', bonusUsd: 125, totalUsd: 975 },
      { label: '+2', bonusUsd: 150, totalUsd: 1000 },
      { label: '+3', bonusUsd: 175, totalUsd: 1025 },
      { label: '+4', bonusUsd: 250, totalUsd: 1100 },
      { label: '+5', bonusUsd: 275, totalUsd: 1125 },
      { label: '+6', bonusUsd: 300, totalUsd: 1150 },
      { label: '+7', bonusUsd: 325, totalUsd: 1175 },
      { label: '+8 o más', bonusUsd: 350, totalUsd: 1200 }
    ],
    cutoff: 'El mes cierra el último día hábil (lunes a viernes); las cargas posteriores pasan al mes siguiente.'
  };

  const state = {
    entries: [],
    canEdit: false,
    csmReport: null,
    rules: FALLBACK_RULES
  };

  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(
    /[&<>'"]/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])
  );
  const period = () => ({
    anio: Number($('year').value),
    mes: Number($('month').value),
    area: 'csm'
  });

  function todayLocal() {
    const now = new Date();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0')
    ].join('-');
  }

  function setMeta(message, tone = '') {
    $('meta').textContent = message;
    $('meta').className = `meta${tone ? ` ${tone}` : ''}`;
  }

  function setFormEnabled(enabled) {
    ['member', 'date', 'type', 'category', 'detail', 'save'].forEach((id) => {
      $(id).disabled = !enabled;
    });
  }

  function formatUsd(value) {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(Number(value || 0));
  }

  function formatScore(value) {
    const score = Number(value || 0);
    return score > 0 ? `+${score}` : String(score);
  }

  function monthLabel(year, month) {
    return `${MONTHS[Number(month) - 1] || month} ${year}`;
  }

  function humanCreator(email) {
    const normalizedEmail = String(email || '').toLowerCase();
    if (normalizedEmail === 'belenherrera.gestion@gmail.com') return 'Belén Herrera';
    if (normalizedEmail === 'matirandazzo@gmail.com') return 'Mati Randazzo';
    return email || '—';
  }

  function renderCategoryOptions() {
    const type = $('type').value || 'check';
    const categories = state.rules.categories?.[type] || [];
    $('category').innerHTML = categories.map((category, index) => (
      `<option value="${esc(category)}">${index + 1}. ${esc(category)}</option>`
    )).join('');
  }

  function renderFormOptions() {
    const selectedMember = $('member').value;
    $('member').innerHTML = state.rules.members.map((name) => (
      `<option value="${esc(name)}">${esc(name)}</option>`
    )).join('');
    if (state.rules.members.includes(selectedMember)) $('member').value = selectedMember;
    renderCategoryOptions();
    $('cutoff-policy').textContent = state.rules.cutoff;
  }

  function currentRows() {
    return state.csmReport?.current?.members || state.rules.members.map((name) => ({
      name,
      checks: 0,
      strikes: 0,
      score: 0,
      bonusUsd: 100,
      baseSalaryUsd: state.rules.baseSalaryUsd,
      totalUsd: state.rules.baseSalaryUsd + 100,
      negative: false
    }));
  }

  function renderAlerts() {
    const alerts = state.csmReport?.alerts || [];
    if (!alerts.length) {
      $('alerts').innerHTML = '<div class="alert clear"><strong>Sin alertas de reincidencia.</strong><span>No hay una racha negativa activa de 3 o 6 meses.</span></div>';
      return;
    }

    $('alerts').innerHTML = alerts.map((alert) => (
      `<div class="alert warning">
        <strong>${esc(alert.name)} · ${alert.threshold} meses negativos</strong>
        <span>Acumula ${alert.consecutiveNegativeMonths} meses consecutivos con resultado negativo.</span>
      </div>`
    )).join('');
  }

  function renderCards() {
    $('cards').innerHTML = currentRows().map((row) => {
      const scoreClass = row.score < 0 ? 'negative' : row.score > 0 ? 'positive' : 'neutral';
      return `<article class="card">
        <div class="card-head">
          <div><span class="eyebrow">CSM</span><h3>${esc(row.name)}</h3></div>
          <span class="score ${scoreClass}">${formatScore(row.score)}</span>
        </div>
        <div class="pills">
          <span class="pill check">${row.checks} checks</span>
          <span class="pill strike">${row.strikes} strikes</span>
        </div>
        <div class="money-grid">
          <div><span>Fijo</span><strong>${formatUsd(row.baseSalaryUsd)}</strong></div>
          <div><span>Bono</span><strong>${formatUsd(row.bonusUsd)}</strong></div>
          <div class="money-total"><span>Total</span><strong>${formatUsd(row.totalUsd)}</strong></div>
        </div>
      </article>`;
    }).join('');
  }

  function renderMonthlyReport() {
    $('monthly-report').innerHTML = `<table class="table report-table">
      <thead><tr>
        <th>Persona</th><th class="number">Checks</th><th class="number">Strikes</th>
        <th class="number">Resultado</th><th class="number">Fijo</th>
        <th class="number">Bono</th><th class="number">Total a pagar</th>
      </tr></thead>
      <tbody>${currentRows().map((row) => `<tr>
        <td><strong>${esc(row.name)}</strong></td>
        <td class="number">${row.checks}</td>
        <td class="number">${row.strikes}</td>
        <td class="number score-cell ${row.negative ? 'negative' : ''}">${formatScore(row.score)}</td>
        <td class="number">${formatUsd(row.baseSalaryUsd)}</td>
        <td class="number">${formatUsd(row.bonusUsd)}</td>
        <td class="number total-cell">${formatUsd(row.totalUsd)}</td>
      </tr>`).join('')}</tbody>
    </table>`;
  }

  function renderBonusRules() {
    $('bonus-rules').innerHTML = `<table class="table compact">
      <thead><tr><th>Resultado del mes</th><th class="number">Bono</th><th class="number">Total mensual</th></tr></thead>
      <tbody>${state.rules.bonusRules.map((rule) => `<tr>
        <td>${esc(rule.label)}</td>
        <td class="number">${formatUsd(rule.bonusUsd)}</td>
        <td class="number">${formatUsd(rule.totalUsd)}</td>
      </tr>`).join('')}</tbody>
    </table>`;
  }

  function renderDetail() {
    $('detail-count').textContent = `${state.entries.length} registro${state.entries.length === 1 ? '' : 's'}`;
    $('detail-history').innerHTML = state.entries.length
      ? `<table class="table detail-table">
          <thead><tr>
            <th>Fecha</th><th>Persona</th><th>Tipo</th><th>Categoría</th>
            <th>Detalle de la situación</th><th>Cargado por</th><th></th>
          </tr></thead>
          <tbody>${state.entries.map((entry) => `<tr>
            <td>${esc(entry.fecha || String(entry.created_at || '').slice(0, 10) || '—')}</td>
            <td><strong>${esc(entry.closer_nombre)}</strong></td>
            <td><span class="type-badge ${esc(entry.tipo)}">${esc(entry.tipo)}</span></td>
            <td>${esc(entry.categoria || 'Sin categoría (registro anterior)')}</td>
            <td class="detail-text">${esc(entry.detalle)}</td>
            <td>${esc(humanCreator(entry.created_by_email))}</td>
            <td>${state.canEdit ? `<button class="btn danger" data-delete="${esc(entry.id)}" type="button">Eliminar</button>` : ''}</td>
          </tr>`).join('')}</tbody>
        </table>`
      : '<div class="empty">Sin checks ni strikes cargados para este mes.</div>';
  }

  function render() {
    renderFormOptions();
    renderAlerts();
    renderCards();
    renderMonthlyReport();
    renderBonusRules();
    renderDetail();
    setFormEnabled(state.canEdit);
  }

  function applyResponse(data) {
    state.entries = data.entries || [];
    state.canEdit = data.canEdit === true;
    state.csmReport = data.csmReport || null;
    state.rules = data.csmReport?.rules || FALLBACK_RULES;

    if (Number(data.anio) && Number(data.mes)) {
      $('year').value = String(data.anio);
      $('month').value = String(data.mes);
    }
  }

  async function load() {
    setFormEnabled(false);
    setMeta('Cargando reporte mensual CSM...');
    try {
      const data = await window.metricasApi.fetchAgendaCheckpoints(period());
      applyResponse(data);
      render();
      setMeta(
        state.canEdit
          ? 'Edición habilitada para Belén Herrera y Mati.'
          : 'Modo lectura. La carga está habilitada únicamente para Belén Herrera y Mati.',
        'ok'
      );
    } catch (error) {
      state.entries = [];
      state.canEdit = false;
      state.csmReport = null;
      render();
      setMeta(error.message || 'No se pudo cargar el rendimiento.', 'error');
    }
  }

  async function save(event) {
    event.preventDefault();
    const detalle = $('detail').value.trim();
    if (!detalle) {
      setMeta('Ingresá el detalle de la situación.', 'error');
      return;
    }

    const selected = period();
    try {
      setFormEnabled(false);
      setMeta('Guardando movimiento...');
      const data = await window.metricasApi.saveAgendaCheckpoint({
        ...selected,
        closer_nombre: $('member').value,
        fecha: $('date').value,
        tipo: $('type').value,
        categoria: $('category').value,
        detalle
      });
      applyResponse(data);
      $('detail').value = '';
      $('date').value = todayLocal();
      render();

      const movedToNextPeriod = selected.anio !== Number(data.anio) || selected.mes !== Number(data.mes);
      setMeta(
        movedToNextPeriod
          ? `Movimiento guardado en ${monthLabel(data.anio, data.mes)} por la regla de cierre del último día hábil.`
          : 'Movimiento guardado.',
        'ok'
      );
    } catch (error) {
      render();
      setMeta(error.message || 'No se pudo guardar.', 'error');
    }
  }

  async function remove(id) {
    if (!window.confirm('¿Eliminar este movimiento de CSM?')) return;
    try {
      setMeta('Eliminando movimiento...');
      const data = await window.metricasApi.saveAgendaCheckpoint({
        ...period(),
        action: 'delete',
        id
      });
      applyResponse(data);
      render();
      setMeta('Movimiento eliminado.', 'ok');
    } catch (error) {
      setMeta(error.message || 'No se pudo eliminar.', 'error');
    }
  }

  function csvCell(value) {
    return `"${String(value ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
  }

  function exportCsv() {
    const selected = period();
    const rows = [
      ['Reporte CSM', monthLabel(selected.anio, selected.mes)],
      [],
      ['Persona', 'Checks', 'Strikes', 'Resultado', 'Fijo USD', 'Bono USD', 'Total USD'],
      ...currentRows().map((row) => [
        row.name, row.checks, row.strikes, row.score,
        row.baseSalaryUsd, row.bonusUsd, row.totalUsd
      ]),
      [],
      ['Fecha', 'Persona', 'Tipo', 'Categoría', 'Detalle', 'Cargado por'],
      ...state.entries.map((entry) => [
        entry.fecha || String(entry.created_at || '').slice(0, 10),
        entry.closer_nombre,
        entry.tipo,
        entry.categoria || 'Sin categoría (registro anterior)',
        entry.detalle,
        humanCreator(entry.created_by_email)
      ])
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reporte-csm-${selected.anio}-${String(selected.mes).padStart(2, '0')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setMeta('Reporte mensual exportado.', 'ok');
  }

  function init() {
    const now = new Date();
    $('year').innerHTML = Array.from(
      { length: 7 },
      (_, index) => now.getFullYear() - 4 + index
    ).map((year) => `<option value="${year}">${year}</option>`).join('');
    $('month').innerHTML = MONTHS.map((name, index) => (
      `<option value="${index + 1}">${name}</option>`
    )).join('');
    $('year').value = String(now.getFullYear());
    $('month').value = String(now.getMonth() + 1);
    $('date').value = todayLocal();
    state.rules = FALLBACK_RULES;
    renderFormOptions();

    $('year').addEventListener('change', load);
    $('month').addEventListener('change', load);
    $('type').addEventListener('change', renderCategoryOptions);
    $('movement-form').addEventListener('submit', save);
    $('export').addEventListener('click', exportCsv);
    $('detail-history').addEventListener('click', (event) => {
      const id = event.target.dataset.delete;
      if (id) remove(id);
    });
    load();
  }

  init();
})();
