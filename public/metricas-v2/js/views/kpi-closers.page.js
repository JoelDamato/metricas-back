const RESOURCE = 'kpi_closers_mensual';
const EXCLUDED_CLOSERS = ['nahuel', 'shirlet', 'shirley'];
const ALL_CLOSERS_VALUE = '__ALL__';
const CLOSER_ALIAS_MAP = {
  'pablo butera': 'Pablo Butera',
  'pablo butera vie': 'Pablo Butera'
};

const MONTHS = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' }
];

const DEFAULT_RULES = {
  cierreLlamadaPct: 45,
  asistenciaLlamadaPct: 45,
  tasaAsistenciaPct: 45,
  tasaCierrePct: 45,
  cashCollectedMin: 100,
  cashCollected3mMin: 100,
  cierreLlamadaWeight: 20,
  asistenciaLlamadaWeight: 15,
  tasaAsistenciaWeight: 15,
  tasaCierreWeight: 20,
  cashCollectedWeight: 15,
  cashCollected3mWeight: 15,
  facturacionMin: 1
};
const KPI_CLOSERS_INFO = {
  'Cierre seg. llamada': {
    title: 'Cierre seg. llamada',
    viewLabel: '"kpi_closers_mensual"',
    dateLabel: 'Mes de "fecha_llamada" en "leads_raw", cruzado con ventas del closer en ese mismo mes',
    logic: 'Calcula "ventas_llamada" / "efectuadas". "efectuadas" sale de "leads_raw" con "agendo" = "Agendo", "aplica" = "Aplica" y "llamada_meg" = "Efectuada", agrupado por mes de "fecha_llamada". "ventas_llamada" sale de "comprobantes" tipo "Venta" por mes de "f_venta" y "creado_por".'
  },
  'Asistencia seg. llamada': {
    title: 'Asistencia seg. llamada',
    viewLabel: '"kpi_closers_mensual"',
    dateLabel: 'Mes de "fecha_llamada" en "leads_raw"',
    logic: 'Calcula "efectuadas" / "aplica". Ambas salen de "leads_raw" por mes de "fecha_llamada". "efectuadas" exige además "llamada_meg" = "Efectuada".'
  },
  'Tasa asistencia': {
    title: 'Tasa asistencia',
    viewLabel: '"kpi_closers_mensual"',
    dateLabel: 'Mes de "fecha_agenda" en "leads_raw"',
    logic: 'Calcula "efectuadas_agenda" / "aplica_agenda". Ambas salen de "leads_raw" agrupado por mes de "fecha_agenda" y closer.'
  },
  'Tasa cierre': {
    title: 'Tasa cierre',
    viewLabel: '"kpi_closers_mensual"',
    dateLabel: 'Mes de "fecha_agenda" en "leads_raw" + mes de "fecha_de_agendamiento" en "comprobantes"',
    logic: 'Calcula "ventas_agenda" / "efectuadas_agenda". "ventas_agenda" sale de "comprobantes" tipo "Venta" agrupado por mes de "fecha_de_agendamiento" y "creado_por". "efectuadas_agenda" sale de "leads_raw" por mes de "fecha_agenda".'
  },
  'Cash collected': {
    title: 'Cash collected',
    viewLabel: '"kpi_closers_mensual"',
    dateLabel: 'Mes del KPI por "f_venta", con corte de cash por "f_acreditacion"',
    logic: 'Muestra "cash_collected" con la misma lógica de Ranking: suma "cash_collected" por closer y mes de "f_venta", excluye "CLUB" y en el mes actual solo deja pasar filas con "f_acreditacion" hasta hoy Argentina.'
  },
  'CC / Fact %': {
    title: 'Cash collected % sobre facturación',
    viewLabel: '"kpi_closers_mensual"',
    dateLabel: 'Mes del KPI con "cash_collected" y "facturacion" del closer',
    logic: 'Calcula ("cash_collected" / "facturacion") * 100 para el closer y el mes seleccionados. Si el cash cobrado coincide con toda la facturación, el resultado es 100%.'
  },
  'CC 3m': {
    title: 'CC 3m',
    viewLabel: '"kpi_closers_mensual"',
    dateLabel: '3 meses previos completos por "f_venta"',
    logic: 'Muestra "cash_collected_3m" sumando siempre los 3 meses anteriores al mes de la fila. Excluye el mes actual de la fila y, si hace falta, trae meses del año anterior.'
  },
  'CC 3m %': {
    title: 'CC 3m %',
    viewLabel: '"kpi_closers_mensual"',
    dateLabel: 'Rolling 3 meses con "cash_collected_3m" y "facturacion_3m"',
    logic: 'Calcula ("cash_collected_3m" / "facturacion_3m") * 100 para el closer. Sirve para medir qué porcentaje del cash cobrado acumulado de 3 meses representa sobre la facturación acumulada de 3 meses.'
  },
  'Facturación': {
    title: 'Facturación',
    viewLabel: '"kpi_closers_mensual"',
    dateLabel: 'Base mensual de "kpi_closers_mensual"',
    logic: 'Muestra el valor mensual de "facturacion" para el closer en el período seleccionado.'
  },
  'Fact 3m': {
    title: 'Fact 3m',
    viewLabel: '"kpi_closers_mensual"',
    dateLabel: '3 meses previos completos por "f_venta"',
    logic: 'Muestra "facturacion_3m" sumando siempre los 3 meses anteriores al mes de la fila. Solo incluye comprobantes con "tipo" = "Venta", excluye el mes actual de la fila y, si hace falta, trae meses del año anterior.'
  },
  'Objetivo': {
    title: 'Objetivo',
    viewLabel: '"kpi_closers_rules" + "kpi_closers_mensual"',
    dateLabel: '"anio" y "mes"',
    logic: 'La celda de objetivo compara el valor real de "kpi_closers_mensual" contra las reglas guardadas en "kpi_closers_rules" para el mismo "anio" y "mes". En cash collected mensual el objetivo se interpreta como porcentaje de "cash_collected" sobre "facturacion". En "CC 3m %" el objetivo se interpreta como porcentaje de "cash_collected_3m" sobre "facturacion_3m". El objetivo de facturación no se evalúa por closer: se revisa solo en la fila "Team Closers" contra la suma total del equipo.'
  },
  'Ponderación': {
    title: 'Ponderación',
    viewLabel: '"kpi_closers_rules" + "kpi_closers_mensual"',
    dateLabel: '"anio" y "mes"',
    logic: 'En cada closer suma los pesos de los objetivos que quedaron en check. Por ejemplo, si "Tasa cierre" pesa 20% y está cumplido, aporta 20 puntos a la ponderación. La fila "Total" muestra el promedio de ponderación de los closers visibles. La fila "Team Closers" suma los mismos pesos cuando al menos 50% del equipo cumple cada objetivo.'
  }
};

function getCurrentPeriod() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function formatNumber(value) {
  return new Intl.NumberFormat('es-AR').format(Number(value || 0));
}

function getMonthLabel(month) {
  const found = MONTHS.find((item) => Number(item.value) === Number(month));
  return found ? found.label : String(month || '');
}

function showMetricInfo(info) {
  if (!info) return;
  const existing = document.getElementById('metricInfoPopup');
  if (existing) existing.remove();

  const popup = document.createElement('div');
  popup.id = 'metricInfoPopup';
  popup.className = 'kpi-popup metric-info-popup';
  popup.innerHTML = `
    <div class="kpi-popup-card metric-info-card">
      <h3>${info.title}</h3>
      <p><strong>Vista que usa:</strong> ${info.viewLabel || '"kpi_closers_mensual"'}</p>
      <p><strong>Fecha que usa:</strong> ${info.dateLabel}</p>
      <p><strong>Lógica:</strong> ${info.logic}</p>
      <button id="metricInfoPopupClose" type="button">Cerrar</button>
    </div>
  `;
  document.body.appendChild(popup);
  const close = () => popup.remove();
  popup.addEventListener('click', (event) => {
    if (event.target === popup) close();
  });
  document.getElementById('metricInfoPopupClose').addEventListener('click', close);
}

function parseRules(raw) {
  const rules = { ...DEFAULT_RULES, ...(raw || {}) };
  Object.keys(rules).forEach((key) => {
    const n = Number(rules[key]);
    rules[key] = Number.isFinite(n) ? n : DEFAULT_RULES[key];
  });

  // Compatibilidad con reglas viejas donde "cash_collected_min" se guardaba como monto.
  if (rules.cashCollectedMin > 100 && rules.facturacionMin > 0) {
    rules.cashCollectedMin = (rules.cashCollectedMin / rules.facturacionMin) * 100;
  }

  return rules;
}

function fillRuleInputs(rules) {
  document.getElementById('rule_cierre_llamada').value = rules.cierreLlamadaPct;
  document.getElementById('rule_asistencia_llamada').value = rules.asistenciaLlamadaPct;
  document.getElementById('rule_tasa_asistencia').value = rules.tasaAsistenciaPct;
  document.getElementById('rule_tasa_cierre').value = rules.tasaCierrePct;
  document.getElementById('rule_cash_collected').value = rules.cashCollectedMin;
  document.getElementById('rule_cash_collected_3m').value = rules.cashCollected3mMin;
  document.getElementById('weight_cierre_llamada').value = rules.cierreLlamadaWeight;
  document.getElementById('weight_asistencia_llamada').value = rules.asistenciaLlamadaWeight;
  document.getElementById('weight_tasa_asistencia').value = rules.tasaAsistenciaWeight;
  document.getElementById('weight_tasa_cierre').value = rules.tasaCierreWeight;
  document.getElementById('weight_cash_collected').value = rules.cashCollectedWeight;
  document.getElementById('weight_cash_collected_3m').value = rules.cashCollected3mWeight;
  document.getElementById('rule_facturacion').value = rules.facturacionMin;
  updateWeightsSummary(rules);
}

function readRuleInputs() {
  return parseRules({
    cierreLlamadaPct: document.getElementById('rule_cierre_llamada').value,
    asistenciaLlamadaPct: document.getElementById('rule_asistencia_llamada').value,
    tasaAsistenciaPct: document.getElementById('rule_tasa_asistencia').value,
    tasaCierrePct: document.getElementById('rule_tasa_cierre').value,
    cashCollectedMin: document.getElementById('rule_cash_collected').value,
    cashCollected3mMin: document.getElementById('rule_cash_collected_3m').value,
    cierreLlamadaWeight: document.getElementById('weight_cierre_llamada').value,
    asistenciaLlamadaWeight: document.getElementById('weight_asistencia_llamada').value,
    tasaAsistenciaWeight: document.getElementById('weight_tasa_asistencia').value,
    tasaCierreWeight: document.getElementById('weight_tasa_cierre').value,
    cashCollectedWeight: document.getElementById('weight_cash_collected').value,
    cashCollected3mWeight: document.getElementById('weight_cash_collected_3m').value,
    facturacionMin: document.getElementById('rule_facturacion').value
  });
}

function getCloserWeightTotal(rules) {
  return Number(rules.cierreLlamadaWeight || 0)
    + Number(rules.asistenciaLlamadaWeight || 0)
    + Number(rules.tasaAsistenciaWeight || 0)
    + Number(rules.tasaCierreWeight || 0)
    + Number(rules.cashCollectedWeight || 0)
    + Number(rules.cashCollected3mWeight || 0);
}

function updateWeightsSummary(rules) {
  const el = document.getElementById('weightsSummary');
  if (!el) return;
  const total = getCloserWeightTotal(rules);
  el.textContent = `Suma de pesos de closers: ${formatPercent(total)}`;
  el.classList.toggle('is-warning', Math.abs(total - 100) > 0.01);
}

async function fetchRulesFromApi(year, month) {
  const urls = [
    `/api/metricas/kpi-closers/rules?anio=${year}&mes=${month}`,
    `/api/v2/kpi-closers/rules?anio=${year}&mes=${month}`,
    `/api/v2/metricas/kpi-closers/rules?anio=${year}&mes=${month}`,
    `/api/kpi-closers/rules?anio=${year}&mes=${month}`
  ];

  try {
    for (const url of urls) {
      try {
        const response = await window.http.getJson(url);
        const db = response.rules;
        if (!db) return { ...DEFAULT_RULES };

        return parseRules({
          cierreLlamadaPct: db.cierre_llamada_pct,
          asistenciaLlamadaPct: db.asistencia_llamada_pct,
          tasaAsistenciaPct: db.tasa_asistencia_pct,
          tasaCierrePct: db.tasa_cierre_pct,
          cashCollectedMin: db.cash_collected_min,
          cashCollected3mMin: db.cash_collected_3m_min,
          cierreLlamadaWeight: db.cierre_llamada_weight,
          asistenciaLlamadaWeight: db.asistencia_llamada_weight,
          tasaAsistenciaWeight: db.tasa_asistencia_weight,
          tasaCierreWeight: db.tasa_cierre_weight,
          cashCollectedWeight: db.cash_collected_weight,
          cashCollected3mWeight: db.cash_collected_3m_weight,
          facturacionMin: db.facturacion_min
        });
      } catch (err) {
        const message = String(err?.message || '');
        if (!message.includes('404')) throw err;
      }
    }
    return { ...DEFAULT_RULES };
  } catch {
    return { ...DEFAULT_RULES };
  }
}

async function saveRulesToApi(year, month, rules) {
  const payload = {
    anio: year,
    mes: month,
    cierre_llamada_pct: rules.cierreLlamadaPct,
    asistencia_llamada_pct: rules.asistenciaLlamadaPct,
    tasa_asistencia_pct: rules.tasaAsistenciaPct,
    tasa_cierre_pct: rules.tasaCierrePct,
    cash_collected_min: rules.cashCollectedMin,
    cash_collected_3m_min: rules.cashCollected3mMin,
    cierre_llamada_weight: rules.cierreLlamadaWeight,
    asistencia_llamada_weight: rules.asistenciaLlamadaWeight,
    tasa_asistencia_weight: rules.tasaAsistenciaWeight,
    tasa_cierre_weight: rules.tasaCierreWeight,
    cash_collected_weight: rules.cashCollectedWeight,
    cash_collected_3m_weight: rules.cashCollected3mWeight,
    facturacion_min: rules.facturacionMin
  };

  const urls = [
    '/api/metricas/kpi-closers/rules',
    '/api/v2/kpi-closers/rules',
    '/api/v2/metricas/kpi-closers/rules',
    '/api/kpi-closers/rules'
  ];
  let lastError = null;

  for (const url of urls) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) return;

    const body = await res.json().catch(() => ({}));
    const message = body.message || body.error || body.details || `Error guardando reglas (${res.status})`;
    lastError = new Error(message);
    if (res.status !== 404) break;
  }

  throw lastError || new Error('No se pudo guardar reglas.');
}

function setOptions(selectId, options, selectedValue) {
  const select = document.getElementById(selectId);
  select.innerHTML = options
    .map((option) => {
      const value = typeof option === 'object' ? option.value : option;
      const label = typeof option === 'object' ? option.label : option;
      return `<option value="${value}">${label}</option>`;
    })
    .join('');

  if (selectedValue !== undefined && selectedValue !== null && selectedValue !== '') {
    select.value = String(selectedValue);
  }
}

function normalizeCloserName(value) {
  const raw = String(value || '').trim();
  if (!raw) return raw;

  const key = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  return CLOSER_ALIAS_MAP[key] || raw;
}

function normalizeKpiRows(rows) {
  const grouped = new Map();

  (rows || []).forEach((row) => {
    const closer = normalizeCloserName(row.closer);
    const key = String(closer || '').trim().toLowerCase();
    const ventasAgenda = Number(row.tasa_cierre || 0) * Number(row.efectuadas_agenda || 0);
    const current = grouped.get(key) || {
      ...row,
      closer,
      efectuadas: 0,
      aplica: 0,
      ventas_llamada: 0,
      efectuadas_agenda: 0,
      aplica_agenda: 0,
      cash_collected: 0,
      cash_collected_3m: 0,
      facturacion: 0,
      facturacion_3m: 0,
      __ventas_agenda: 0
    };

    current.closer = closer;
    current.efectuadas += Number(row.efectuadas || 0);
    current.aplica += Number(row.aplica || 0);
    current.ventas_llamada += Number(row.ventas_llamada || 0);
    current.efectuadas_agenda += Number(row.efectuadas_agenda || 0);
    current.aplica_agenda += Number(row.aplica_agenda || 0);
    current.cash_collected += Number(row.cash_collected || 0);
    current.cash_collected_3m += Number(row.cash_collected_3m || 0);
    current.facturacion += Number(row.facturacion || 0);
    current.facturacion_3m += Number(row.facturacion_3m || 0);
    current.__ventas_agenda += ventasAgenda;

    grouped.set(key, current);
  });

  return [...grouped.values()].map((row) => {
    const merged = { ...row };
    merged.cierre_segun_llamada = Number(merged.efectuadas || 0) > 0
      ? Number(merged.ventas_llamada || 0) / Number(merged.efectuadas || 0)
      : 0;
    merged.asistencia_segun_llamada = Number(merged.aplica || 0) > 0
      ? Number(merged.efectuadas || 0) / Number(merged.aplica || 0)
      : 0;
    merged.tasa_asistencia = Number(merged.aplica_agenda || 0) > 0
      ? Number(merged.efectuadas_agenda || 0) / Number(merged.aplica_agenda || 0)
      : 0;
    merged.tasa_cierre = Number(merged.efectuadas_agenda || 0) > 0
      ? Number(merged.__ventas_agenda || 0) / Number(merged.efectuadas_agenda || 0)
      : 0;
    delete merged.__ventas_agenda;
    return merged;
  });
}

function computeFlags(row, rules) {
  const cierreLlamadaPct = Number(row.cierre_segun_llamada || 0) * 100;
  const asistenciaLlamadaPct = Number(row.asistencia_segun_llamada || 0) * 100;
  const tasaAsistenciaPct = Number(row.tasa_asistencia || 0) * 100;
  const tasaCierrePct = Number(row.tasa_cierre || 0) * 100;
  const cashCollected = Number(row.cash_collected || 0);
  const facturacion = Number(row.facturacion || 0);
  const cashCollected3m = Number(row.cash_collected_3m || 0);
  const facturacion3m = Number(row.facturacion_3m || 0);
  const cashCollectedPct = facturacion > 0 ? (cashCollected / facturacion) * 100 : 0;
  const cashCollected3mPct = facturacion3m > 0 ? (cashCollected3m / facturacion3m) * 100 : 0;
  const cierreLlamadaOk = cierreLlamadaPct >= rules.cierreLlamadaPct ? 1 : 0;
  const asistenciaLlamadaOk = asistenciaLlamadaPct >= rules.asistenciaLlamadaPct ? 1 : 0;
  const tasaAsistenciaOk = tasaAsistenciaPct >= rules.tasaAsistenciaPct ? 1 : 0;
  const tasaCierreOk = tasaCierrePct >= rules.tasaCierrePct ? 1 : 0;
  const cashCollectedOk = cashCollectedPct >= rules.cashCollectedMin ? 1 : 0;
  const cashCollected3mOk = cashCollected3mPct >= rules.cashCollected3mMin ? 1 : 0;
  const facturacionOk = facturacion >= rules.facturacionMin ? 1 : 0;
  const ponderacionPct =
    (cierreLlamadaOk ? Number(rules.cierreLlamadaWeight || 0) : 0)
    + (asistenciaLlamadaOk ? Number(rules.asistenciaLlamadaWeight || 0) : 0)
    + (tasaAsistenciaOk ? Number(rules.tasaAsistenciaWeight || 0) : 0)
    + (tasaCierreOk ? Number(rules.tasaCierreWeight || 0) : 0)
    + (cashCollectedOk ? Number(rules.cashCollectedWeight || 0) : 0)
    + (cashCollected3mOk ? Number(rules.cashCollected3mWeight || 0) : 0);

  return {
    cierreLlamadaPct,
    cierreLlamadaOk,
    asistenciaLlamadaPct,
    asistenciaLlamadaOk,
    tasaAsistenciaPct,
    tasaAsistenciaOk,
    tasaCierrePct,
    tasaCierreOk,
    cashCollected,
    cashCollectedPct,
    cashCollectedOk,
    cashCollected3m,
    cashCollected3mPct,
    cashCollected3mOk,
    facturacion,
    facturacionOk,
    facturacion3m,
    ponderacionPct
  };
}

function isSinCloserRow(row) {
  return String(row?.closer || '').trim().toLowerCase() === 'sin closer';
}

function isExcludedCloserRow(row) {
  const normalized = String(row?.closer || '').trim().toLowerCase();
  return EXCLUDED_CLOSERS.some((excluded) => normalized.includes(excluded));
}

function getDisplayRows(rows) {
  return (rows || []).filter((row) => !isSinCloserRow(row) && !isExcludedCloserRow(row));
}

function populateCloserFilter(rows, selectedCloser = ALL_CLOSERS_VALUE) {
  const closers = [...new Set(getDisplayRows(rows).map((row) => String(row.closer || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const options = [{ value: ALL_CLOSERS_VALUE, label: 'Todos' }, ...closers.map((closer) => ({ value: closer, label: closer }))];
  const currentValue = options.some((option) => option.value === selectedCloser) ? selectedCloser : ALL_CLOSERS_VALUE;
  setOptions('closer', options, currentValue);
  return currentValue;
}

function teamCheckCell(isOk) {
  return `<div class="rule-cell"><span class="rule-mark ${isOk ? 'ok' : 'fail'}">${isOk ? '✓' : '✗'}</span></div>`;
}

function ruleCell(value, isOk, type = 'number') {
  const formattedRule = type === 'currency' ? formatCurrency(value) : type === 'percent' ? formatPercent(value) : formatNumber(value);
  return `<div class="rule-cell"><span class="rule-target">${formattedRule}</span><span class="rule-mark ${isOk ? 'ok' : 'fail'}">${isOk ? '✓' : '✗'}</span></div>`;
}

function showPopup(message, type = 'success') {
  const existing = document.getElementById('kpiPopup');
  if (existing) existing.remove();

  const popup = document.createElement('div');
  popup.id = 'kpiPopup';
  popup.className = `kpi-popup ${type}`;
  popup.innerHTML = `
    <div class="kpi-popup-card">
      <p>${message}</p>
      <button id="kpiPopupClose">Cerrar</button>
    </div>
  `;
  document.body.appendChild(popup);

  const close = () => popup.remove();
  document.getElementById('kpiPopupClose').addEventListener('click', close);
  setTimeout(close, 2500);
}

async function loadAuthPermissions() {
  if (window.metricasAuthPermissions) return window.metricasAuthPermissions;

  try {
    const response = await window.http.getJson('/api/metricas/auth/session');
    const user = response.user || null;
    window.metricasAuthUser = user;
    window.metricasAuthPermissions = user?.permissions || {};
    return window.metricasAuthPermissions;
  } catch (error) {
    return {};
  }
}

function applyRulesEditPermissions(permissions = {}) {
  const canEdit = permissions.canEditKpiClosersRules !== false;
  const rulesWrap = document.querySelector('.kpi-rules');
  if (!rulesWrap) return;

  rulesWrap.querySelectorAll('input').forEach((input) => {
    input.disabled = !canEdit;
    input.readOnly = !canEdit;
  });

  const saveButton = document.getElementById('saveRules');
  if (saveButton) {
    saveButton.disabled = !canEdit;
    saveButton.hidden = !canEdit;
  }

  let note = document.getElementById('kpiRulesReadOnlyNote');
  if (!canEdit) {
    if (!note) {
      note = document.createElement('p');
      note.id = 'kpiRulesReadOnlyNote';
      note.textContent = 'Modo solo lectura: este usuario puede ver KPI Closers, pero no editar objetivos.';
      rulesWrap.insertAdjacentElement('afterend', note);
    }
  } else if (note) {
    note.remove();
  }
}

function buildTable(rows, rules, options = {}) {
  const wrap = document.getElementById('tableContainer');
  const showMonthColumn = options.showMonthColumn === true;

  const visibleRows = getDisplayRows(rows);

  if (!visibleRows.length) {
    wrap.innerHTML = '<p>No hay datos para el período seleccionado.</p>';
    return;
  }

  const rowsWithFlags = visibleRows.map((row) => ({ ...row, __kpi: computeFlags(row, rules) }));

  const head = `
    <tr>
      ${showMonthColumn ? '<th>Mes</th>' : ''}
      <th>Closer</th>
      <th><button type="button" class="metric-info-trigger" data-info-key="Cierre seg. llamada">Cierre seg. llamada</button></th>
      <th><button type="button" class="metric-info-trigger" data-info-key="Objetivo">Obj. Team</button></th>
      <th><button type="button" class="metric-info-trigger" data-info-key="Asistencia seg. llamada">Asistencia seg. llamada</button></th>
      <th><button type="button" class="metric-info-trigger" data-info-key="Objetivo">Objetivo</button></th>
      <th><button type="button" class="metric-info-trigger" data-info-key="Tasa asistencia">Tasa asistencia</button></th>
      <th><button type="button" class="metric-info-trigger" data-info-key="Objetivo">Objetivo</button></th>
      <th><button type="button" class="metric-info-trigger" data-info-key="Tasa cierre">Tasa cierre</button></th>
      <th><button type="button" class="metric-info-trigger" data-info-key="Objetivo">Objetivo</button></th>
      <th class="kpi-col-wide"><button type="button" class="metric-info-trigger" data-info-key="Cash collected">Cash Collected</button></th>
      <th class="kpi-col-medium"><button type="button" class="metric-info-trigger" data-info-key="Facturación">Facturación</button></th>
      <th><button type="button" class="metric-info-trigger" data-info-key="Objetivo">Obj. Team</button></th>
      <th><button type="button" class="metric-info-trigger" data-info-key="CC / Fact %">CC / Fact %</button></th>
      <th><button type="button" class="metric-info-trigger" data-info-key="Objetivo">Objetivo</button></th>
      <th class="kpi-col-wide"><button type="button" class="metric-info-trigger" data-info-key="CC 3m">CC 3m</button></th>
      <th class="kpi-col-medium"><button type="button" class="metric-info-trigger" data-info-key="Fact 3m">Fact 3m</button></th>
      <th><button type="button" class="metric-info-trigger" data-info-key="CC 3m %">CC 3m %</button></th>
      <th><button type="button" class="metric-info-trigger" data-info-key="Objetivo">Objetivo</button></th>
      <th><button type="button" class="metric-info-trigger" data-info-key="Ponderación">Ponderación</button></th>
    </tr>
  `;

  const body = rowsWithFlags
    .map((row) => {
      const k = row.__kpi;
      return `
        <tr>
          ${showMonthColumn ? `<td>${getMonthLabel(row.mes)}</td>` : ''}
          <td>${row.closer || ''}</td>
          <td>${formatPercent(k.cierreLlamadaPct)}</td>
          <td class="ok-cell ${k.cierreLlamadaOk ? 'is-ok' : ''}">${ruleCell(rules.cierreLlamadaPct, k.cierreLlamadaOk, 'percent')}</td>
          <td>${formatPercent(k.asistenciaLlamadaPct)}</td>
          <td class="ok-cell ${k.asistenciaLlamadaOk ? 'is-ok' : ''}">${ruleCell(rules.asistenciaLlamadaPct, k.asistenciaLlamadaOk, 'percent')}</td>
          <td>${formatPercent(k.tasaAsistenciaPct)}</td>
          <td class="ok-cell ${k.tasaAsistenciaOk ? 'is-ok' : ''}">${ruleCell(rules.tasaAsistenciaPct, k.tasaAsistenciaOk, 'percent')}</td>
          <td>${formatPercent(k.tasaCierrePct)}</td>
          <td class="ok-cell ${k.tasaCierreOk ? 'is-ok' : ''}">${ruleCell(rules.tasaCierrePct, k.tasaCierreOk, 'percent')}</td>
          <td class="kpi-col-wide">${formatCurrency(k.cashCollected)}</td>
          <td class="kpi-col-medium">${formatCurrency(k.facturacion)}</td>
          <td class="ok-cell">-</td>
          <td>${formatPercent(k.cashCollectedPct)}</td>
          <td class="ok-cell ${k.cashCollectedOk ? 'is-ok' : ''}">${ruleCell(rules.cashCollectedMin, k.cashCollectedOk, 'percent')}</td>
          <td class="kpi-col-wide">${formatCurrency(k.cashCollected3m)}</td>
          <td class="kpi-col-medium">${formatCurrency(k.facturacion3m)}</td>
          <td>${formatPercent(k.cashCollected3mPct)}</td>
          <td class="ok-cell ${k.cashCollected3mOk ? 'is-ok' : ''}">${ruleCell(rules.cashCollected3mMin, k.cashCollected3mOk, 'percent')}</td>
          <td><strong>${formatPercent(k.ponderacionPct)}</strong></td>
        </tr>
      `;
    })
    .join('');

  const totals = rowsWithFlags.reduce(
    (acc, row) => {
      const k = row.__kpi;
      acc.cierreLlamadaOk += k.cierreLlamadaOk;
      acc.asistenciaLlamadaOk += k.asistenciaLlamadaOk;
      acc.tasaAsistenciaOk += k.tasaAsistenciaOk;
      acc.tasaCierreOk += k.tasaCierreOk;
      acc.cashCollected += k.cashCollected;
      acc.cashCollectedOk += k.cashCollectedOk;
      acc.cashCollected3m += k.cashCollected3m;
      acc.cashCollected3mOk += k.cashCollected3mOk;
      acc.facturacion += k.facturacion;
      acc.facturacionOk += k.facturacionOk;
      acc.facturacion3m += k.facturacion3m;
      acc.sumPonderacion += k.ponderacionPct;
      acc.sumAplica += Number(row.aplica || 0);
      acc.sumVentasLlamada += Number(row.ventas_llamada || 0);
      acc.sumVentasAgenda += Number(row.tasa_cierre || 0) * Number(row.efectuadas_agenda || 0);
      acc.sumEfectuadas += Number(row.efectuadas || 0);
      acc.sumAplicaAgenda += Number(row.aplica_agenda || 0);
      acc.sumEfectuadasAgenda += Number(row.efectuadas_agenda || 0);
      return acc;
    },
    {
      cierreLlamadaOk: 0,
      asistenciaLlamadaOk: 0,
      tasaAsistenciaOk: 0,
      tasaCierreOk: 0,
      cashCollected: 0,
      cashCollectedOk: 0,
      cashCollected3m: 0,
      cashCollected3mOk: 0,
      facturacion: 0,
      facturacionOk: 0,
      facturacion3m: 0,
      sumPonderacion: 0,
      sumAplica: 0,
      sumVentasLlamada: 0,
      sumVentasAgenda: 0,
      sumEfectuadas: 0,
      sumAplicaAgenda: 0,
      sumEfectuadasAgenda: 0
    }
  );

  const totalCierreLlamadaPct = totals.sumEfectuadas > 0 ? (totals.sumVentasLlamada / totals.sumEfectuadas) * 100 : 0;
  const totalAsistenciaLlamadaPct = totals.sumAplica > 0 ? (totals.sumEfectuadas / totals.sumAplica) * 100 : 0;
  const totalTasaAsistenciaPct = totals.sumAplicaAgenda > 0 ? (totals.sumEfectuadasAgenda / totals.sumAplicaAgenda) * 100 : 0;
  const totalTasaCierrePct = totals.sumEfectuadasAgenda > 0 ? (totals.sumVentasAgenda / totals.sumEfectuadasAgenda) * 100 : 0;
  const totalCashCollectedPct = totals.facturacion > 0 ? (totals.cashCollected / totals.facturacion) * 100 : 0;
  const totalCashCollected3mPct = totals.facturacion3m > 0 ? (totals.cashCollected3m / totals.facturacion3m) * 100 : 0;
  const totalPonderacionPct = rowsWithFlags.length > 0 ? totals.sumPonderacion / rowsWithFlags.length : 0;
  const teamBase = rowsWithFlags.length;
  const teamCierreOk = teamBase > 0 ? (totals.cierreLlamadaOk / teamBase) * 100 >= 50 : false;
  const teamAsistenciaOk = teamBase > 0 ? (totals.asistenciaLlamadaOk / teamBase) * 100 >= 50 : false;
  const teamTasaAsistenciaOk = teamBase > 0 ? (totals.tasaAsistenciaOk / teamBase) * 100 >= 50 : false;
  const teamTasaCierreOk = teamBase > 0 ? (totals.tasaCierreOk / teamBase) * 100 >= 50 : false;
  const teamCashCollectedOk = teamBase > 0 ? (totals.cashCollectedOk / teamBase) * 100 >= 50 : false;
  const teamCashCollected3mOk = teamBase > 0 ? (totals.cashCollected3mOk / teamBase) * 100 >= 50 : false;
  const teamFacturacionOk = totals.facturacion >= rules.facturacionMin;
  const teamPonderacionPct =
    (teamCierreOk ? Number(rules.cierreLlamadaWeight || 0) : 0)
    + (teamAsistenciaOk ? Number(rules.asistenciaLlamadaWeight || 0) : 0)
    + (teamTasaAsistenciaOk ? Number(rules.tasaAsistenciaWeight || 0) : 0)
    + (teamTasaCierreOk ? Number(rules.tasaCierreWeight || 0) : 0)
    + (teamCashCollectedOk ? Number(rules.cashCollectedWeight || 0) : 0)
    + (teamCashCollected3mOk ? Number(rules.cashCollected3mWeight || 0) : 0);

  const totalRow = `
    <tr>
      ${showMonthColumn ? '<td><strong>Todos</strong></td>' : ''}
      <td><strong>Total</strong></td>
      <td><strong>${formatPercent(totalCierreLlamadaPct)}</strong></td>
      <td class="ok-cell"><strong>${formatNumber(totals.cierreLlamadaOk)}</strong></td>
      <td><strong>${formatPercent(totalAsistenciaLlamadaPct)}</strong></td>
      <td class="ok-cell"><strong>${formatNumber(totals.asistenciaLlamadaOk)}</strong></td>
      <td><strong>${formatPercent(totalTasaAsistenciaPct)}</strong></td>
      <td class="ok-cell"><strong>${formatNumber(totals.tasaAsistenciaOk)}</strong></td>
      <td><strong>${formatPercent(totalTasaCierrePct)}</strong></td>
      <td class="ok-cell"><strong>${formatNumber(totals.tasaCierreOk)}</strong></td>
      <td class="kpi-col-wide"><strong>${formatCurrency(totals.cashCollected)}</strong></td>
      <td class="kpi-col-medium"><strong>${formatCurrency(totals.facturacion)}</strong></td>
      <td class="ok-cell"><strong>-</strong></td>
      <td><strong>${formatPercent(totalCashCollectedPct)}</strong></td>
      <td class="ok-cell"><strong>${formatNumber(totals.cashCollectedOk)}</strong></td>
      <td class="kpi-col-wide"><strong>${formatCurrency(totals.cashCollected3m)}</strong></td>
      <td class="kpi-col-medium"><strong>${formatCurrency(totals.facturacion3m)}</strong></td>
      <td><strong>${formatPercent(totalCashCollected3mPct)}</strong></td>
      <td class="ok-cell"><strong>${formatNumber(totals.cashCollected3mOk)}</strong></td>
      <td><strong>${formatPercent(totalPonderacionPct)}</strong></td>
    </tr>
  `;

  const spacerRow = `
    <tr class="kpi-separator-row" aria-hidden="true">
      <td colspan="${showMonthColumn ? 20 : 19}"></td>
    </tr>
  `;

  const teamRow = `
    <tr class="kpi-team-row">
      ${showMonthColumn ? '<td><strong>Todos</strong></td>' : ''}
      <td><strong>Team Closers</strong></td>
      <td><strong>${formatPercent(totalCierreLlamadaPct)}</strong></td>
      <td class="ok-cell ${teamCierreOk ? 'is-ok' : ''}">${teamCheckCell(teamCierreOk)}</td>
      <td><strong>${formatPercent(totalAsistenciaLlamadaPct)}</strong></td>
      <td class="ok-cell ${teamAsistenciaOk ? 'is-ok' : ''}">${teamCheckCell(teamAsistenciaOk)}</td>
      <td><strong>${formatPercent(totalTasaAsistenciaPct)}</strong></td>
      <td class="ok-cell ${teamTasaAsistenciaOk ? 'is-ok' : ''}">${teamCheckCell(teamTasaAsistenciaOk)}</td>
      <td><strong>${formatPercent(totalTasaCierrePct)}</strong></td>
      <td class="ok-cell ${teamTasaCierreOk ? 'is-ok' : ''}">${teamCheckCell(teamTasaCierreOk)}</td>
      <td class="kpi-col-wide"><strong>${formatCurrency(totals.cashCollected)}</strong></td>
      <td class="kpi-col-medium"><strong>${formatCurrency(totals.facturacion)}</strong></td>
      <td class="ok-cell ${teamFacturacionOk ? 'is-ok' : ''}">${teamCheckCell(teamFacturacionOk)}</td>
      <td><strong>${formatPercent(totalCashCollectedPct)}</strong></td>
      <td class="ok-cell ${teamCashCollectedOk ? 'is-ok' : ''}">${teamCheckCell(teamCashCollectedOk)}</td>
      <td class="kpi-col-wide"><strong>${formatCurrency(totals.cashCollected3m)}</strong></td>
      <td class="kpi-col-medium"><strong>${formatCurrency(totals.facturacion3m)}</strong></td>
      <td><strong>${formatPercent(totalCashCollected3mPct)}</strong></td>
      <td class="ok-cell ${teamCashCollected3mOk ? 'is-ok' : ''}">${teamCheckCell(teamCashCollected3mOk)}</td>
      <td><strong>${formatPercent(teamPonderacionPct)}</strong></td>
    </tr>
  `;

  wrap.innerHTML = `
    <div class="table-wrap">
      <table class="kpi-table">
        <thead>${head}</thead>
        <tbody>${body}${totalRow}${spacerRow}${teamRow}</tbody>
      </table>
    </div>
  `;

  wrap.querySelectorAll('.metric-info-trigger').forEach((button) => {
    button.addEventListener('click', () => {
      showMetricInfo(KPI_CLOSERS_INFO[button.dataset.infoKey]);
    });
  });
}

async function initFilters() {
  const status = document.getElementById('status');
  status.textContent = 'Cargando opciones...';

  const response = await window.metricasApi.fetchRows(RESOURCE, {
    limit: 2000,
    orderBy: 'anio',
    orderDir: 'desc'
  });

  const rows = response.rows || [];
  const years = [...new Set(rows.map((r) => Number(r.anio)).filter((y) => Number.isInteger(y) && y >= 2000))].sort((a, b) => b - a);
  const current = getCurrentPeriod();

  setOptions('anio', years, years.includes(current.year) ? current.year : years[0]);
  setOptions('mes', MONTHS, current.month);
  setOptions('closer', [{ value: ALL_CLOSERS_VALUE, label: 'Todos' }], ALL_CLOSERS_VALUE);
}

async function loadKpiTable() {
  const status = document.getElementById('status');
  const year = Number(document.getElementById('anio').value);
  const monthValue = Number(document.getElementById('mes').value);
  const rawSelectedCloser = document.getElementById('closer').value || ALL_CLOSERS_VALUE;
  const selectedCloser = rawSelectedCloser === ALL_CLOSERS_VALUE
    ? ALL_CLOSERS_VALUE
    : normalizeCloserName(rawSelectedCloser);
  status.textContent = 'Cargando kpi_closers_mensual...';

  try {
    const rules = await fetchRulesFromApi(year, monthValue);
    fillRuleInputs(rules);

    const response = await window.metricasApi.fetchRows(RESOURCE, {
      limit: 500,
      eq_anio: year,
      eq_mes: monthValue,
      orderBy: 'closer',
      orderDir: 'asc'
    });

    const rows = normalizeKpiRows((response.rows || []).filter((r) => {
      const sameYear = Number(r.anio) === year;
      const sameMonth = Number(r.mes) === monthValue;
      return sameYear && sameMonth;
    }));
    const effectiveCloser = populateCloserFilter(rows, selectedCloser);
    const filteredRows = effectiveCloser === ALL_CLOSERS_VALUE
      ? rows
      : rows.filter((row) => String(row.closer || '').trim() === effectiveCloser);

    buildTable(filteredRows, rules);
    status.textContent = effectiveCloser === ALL_CLOSERS_VALUE
      ? `Filas: ${getDisplayRows(filteredRows).length} | ${monthValue}/${year}`
      : `Closer: ${effectiveCloser} | ${monthValue}/${year}`;
  } catch (error) {
    status.textContent = error.message;
  }
}

function handleSaveRules() {
  (async () => {
    const permissions = await loadAuthPermissions();
    if (permissions.canEditKpiClosersRules === false) {
      showPopup('Este usuario solo puede visualizar los objetivos.', 'error');
      return;
    }

    const status = document.getElementById('status');
    const year = Number(document.getElementById('anio').value);
    const month = Number(document.getElementById('mes').value);
    const rules = readRuleInputs();

    try {
      await saveRulesToApi(year, month, rules);
      status.textContent = `Reglas guardadas para ${month}/${year}.`;
      showPopup('Objetivos guardados correctamente.');
      await loadKpiTable();
    } catch (error) {
      status.textContent = error.message;
      showPopup(error.message || 'No se pudo guardar.', 'error');
    }
  })();
}

async function initPage() {
  const permissions = await loadAuthPermissions();
  applyRulesEditPermissions(permissions);
  fillRuleInputs(DEFAULT_RULES);
  await initFilters();
  await loadKpiTable();
}

document.getElementById('reload').addEventListener('click', loadKpiTable);
document.getElementById('saveRules').addEventListener('click', handleSaveRules);
document.querySelectorAll('.kpi-rules input').forEach((input) => {
  input.addEventListener('input', () => {
    updateWeightsSummary(readRuleInputs());
  });
});
initPage();
