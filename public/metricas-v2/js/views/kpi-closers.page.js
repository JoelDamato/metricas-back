const RESOURCE = 'kpi_closers_mensual';

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
  cashCollectedMin: 1,
  facturacionMin: 1
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

function parseRules(raw) {
  const rules = { ...DEFAULT_RULES, ...(raw || {}) };
  Object.keys(rules).forEach((key) => {
    const n = Number(rules[key]);
    rules[key] = Number.isFinite(n) ? n : DEFAULT_RULES[key];
  });
  return rules;
}

function fillRuleInputs(rules) {
  document.getElementById('rule_cierre_llamada').value = rules.cierreLlamadaPct;
  document.getElementById('rule_asistencia_llamada').value = rules.asistenciaLlamadaPct;
  document.getElementById('rule_tasa_asistencia').value = rules.tasaAsistenciaPct;
  document.getElementById('rule_tasa_cierre').value = rules.tasaCierrePct;
  document.getElementById('rule_cash_collected').value = rules.cashCollectedMin;
  document.getElementById('rule_facturacion').value = rules.facturacionMin;
}

function readRuleInputs() {
  return parseRules({
    cierreLlamadaPct: document.getElementById('rule_cierre_llamada').value,
    asistenciaLlamadaPct: document.getElementById('rule_asistencia_llamada').value,
    tasaAsistenciaPct: document.getElementById('rule_tasa_asistencia').value,
    tasaCierrePct: document.getElementById('rule_tasa_cierre').value,
    cashCollectedMin: document.getElementById('rule_cash_collected').value,
    facturacionMin: document.getElementById('rule_facturacion').value
  });
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

function computeFlags(row, rules) {
  const cierreLlamadaPct = Number(row.cierre_segun_llamada || 0) * 100;
  const asistenciaLlamadaPct = Number(row.asistencia_segun_llamada || 0) * 100;
  const tasaAsistenciaPct = Number(row.tasa_asistencia || 0) * 100;
  const tasaCierrePct = Number(row.tasa_cierre || 0) * 100;
  const cashCollected = Number(row.cash_collected || 0);
  const facturacion = Number(row.facturacion || 0);

  return {
    cierreLlamadaPct,
    cierreLlamadaOk: cierreLlamadaPct >= rules.cierreLlamadaPct ? 1 : 0,
    asistenciaLlamadaPct,
    asistenciaLlamadaOk: asistenciaLlamadaPct >= rules.asistenciaLlamadaPct ? 1 : 0,
    tasaAsistenciaPct,
    tasaAsistenciaOk: tasaAsistenciaPct >= rules.tasaAsistenciaPct ? 1 : 0,
    tasaCierrePct,
    tasaCierreOk: tasaCierrePct >= rules.tasaCierrePct ? 1 : 0,
    cashCollected,
    cashCollectedOk: cashCollected >= rules.cashCollectedMin ? 1 : 0,
    cashCollected3m: Number(row.cash_collected_3m || 0),
    facturacion,
    facturacionOk: facturacion >= rules.facturacionMin ? 1 : 0,
    facturacion3m: Number(row.facturacion_3m || 0)
  };
}

function isSinCloserRow(row) {
  return String(row?.closer || '').trim().toLowerCase() === 'sin closer';
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

function buildTable(rows, rules) {
  const wrap = document.getElementById('tableContainer');

  const visibleRows = (rows || []).filter((row) => !isSinCloserRow(row));

  if (!visibleRows.length) {
    wrap.innerHTML = '<p>No hay datos para el período seleccionado.</p>';
    return;
  }

  const rowsWithFlags = visibleRows.map((row) => ({ ...row, __kpi: computeFlags(row, rules) }));

  const head = `
    <tr>
      <th>Closer</th>
      <th>Cierre seg. llamada</th>
      <th>Objetivo</th>
      <th>Asistencia seg. llamada</th>
      <th>Objetivo</th>
      <th>Tasa asistencia</th>
      <th>Objetivo</th>
      <th>Tasa cierre</th>
      <th>Objetivo</th>
      <th>Cash collected</th>
      <th>Objetivo</th>
      <th>CC 3m</th>
      <th>Facturación</th>
      <th>Objetivo</th>
      <th>Fact 3m</th>
    </tr>
  `;

  const body = rowsWithFlags
    .map((row) => {
      const k = row.__kpi;
      return `
        <tr>
          <td>${row.closer || ''}</td>
          <td>${formatPercent(k.cierreLlamadaPct)}</td>
          <td class="ok-cell ${k.cierreLlamadaOk ? 'is-ok' : ''}">${ruleCell(rules.cierreLlamadaPct, k.cierreLlamadaOk, 'percent')}</td>
          <td>${formatPercent(k.asistenciaLlamadaPct)}</td>
          <td class="ok-cell ${k.asistenciaLlamadaOk ? 'is-ok' : ''}">${ruleCell(rules.asistenciaLlamadaPct, k.asistenciaLlamadaOk, 'percent')}</td>
          <td>${formatPercent(k.tasaAsistenciaPct)}</td>
          <td class="ok-cell ${k.tasaAsistenciaOk ? 'is-ok' : ''}">${ruleCell(rules.tasaAsistenciaPct, k.tasaAsistenciaOk, 'percent')}</td>
          <td>${formatPercent(k.tasaCierrePct)}</td>
          <td class="ok-cell ${k.tasaCierreOk ? 'is-ok' : ''}">${ruleCell(rules.tasaCierrePct, k.tasaCierreOk, 'percent')}</td>
          <td>${formatCurrency(k.cashCollected)}</td>
          <td class="ok-cell ${k.cashCollectedOk ? 'is-ok' : ''}">${ruleCell(rules.cashCollectedMin, k.cashCollectedOk, 'currency')}</td>
          <td>${formatCurrency(k.cashCollected3m)}</td>
          <td>${formatCurrency(k.facturacion)}</td>
          <td class="ok-cell ${k.facturacionOk ? 'is-ok' : ''}">${ruleCell(rules.facturacionMin, k.facturacionOk, 'currency')}</td>
          <td>${formatCurrency(k.facturacion3m)}</td>
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
      acc.facturacion += k.facturacion;
      acc.facturacionOk += k.facturacionOk;
      acc.facturacion3m += k.facturacion3m;
      acc.sumAplica += Number(row.aplica || 0);
      acc.sumVentasLlamada += Number(row.ventas_llamada || 0);
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
      facturacion: 0,
      facturacionOk: 0,
      facturacion3m: 0,
      sumAplica: 0,
      sumVentasLlamada: 0,
      sumEfectuadas: 0,
      sumAplicaAgenda: 0,
      sumEfectuadasAgenda: 0
    }
  );

  const totalCierreLlamadaPct = totals.sumAplica > 0 ? (totals.sumVentasLlamada / totals.sumAplica) * 100 : 0;
  const totalAsistenciaLlamadaPct = totals.sumAplica > 0 ? (totals.sumEfectuadas / totals.sumAplica) * 100 : 0;
  const totalTasaAsistenciaPct = totals.sumAplicaAgenda > 0 ? (totals.sumEfectuadasAgenda / totals.sumAplicaAgenda) * 100 : 0;
  const totalTasaCierrePct = totals.sumEfectuadas > 0 ? (totals.sumVentasLlamada / totals.sumEfectuadas) * 100 : 0;

  const totalRow = `
    <tr>
      <td><strong>Total</strong></td>
      <td><strong>${formatPercent(totalCierreLlamadaPct)}</strong></td>
      <td class="ok-cell"><strong>${formatNumber(totals.cierreLlamadaOk)}</strong></td>
      <td><strong>${formatPercent(totalAsistenciaLlamadaPct)}</strong></td>
      <td class="ok-cell"><strong>${formatNumber(totals.asistenciaLlamadaOk)}</strong></td>
      <td><strong>${formatPercent(totalTasaAsistenciaPct)}</strong></td>
      <td class="ok-cell"><strong>${formatNumber(totals.tasaAsistenciaOk)}</strong></td>
      <td><strong>${formatPercent(totalTasaCierrePct)}</strong></td>
      <td class="ok-cell"><strong>${formatNumber(totals.tasaCierreOk)}</strong></td>
      <td><strong>${formatCurrency(totals.cashCollected)}</strong></td>
      <td class="ok-cell"><strong>${formatNumber(totals.cashCollectedOk)}</strong></td>
      <td><strong>${formatCurrency(totals.cashCollected3m)}</strong></td>
      <td><strong>${formatCurrency(totals.facturacion)}</strong></td>
      <td class="ok-cell"><strong>${formatNumber(totals.facturacionOk)}</strong></td>
      <td><strong>${formatCurrency(totals.facturacion3m)}</strong></td>
    </tr>
  `;

  wrap.innerHTML = `
    <div class="table-wrap">
      <table class="kpi-table">
        <thead>${head}</thead>
        <tbody>${body}${totalRow}</tbody>
      </table>
    </div>
  `;
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
}

async function loadKpiTable() {
  const status = document.getElementById('status');
  const year = Number(document.getElementById('anio').value);
  const month = Number(document.getElementById('mes').value);
  status.textContent = 'Cargando kpi_closers_mensual...';

  try {
    const rules = await fetchRulesFromApi(year, month);
    fillRuleInputs(rules);

    const response = await window.metricasApi.fetchRows(RESOURCE, {
      limit: 500,
      eq_anio: year,
      eq_mes: month,
      orderBy: 'closer',
      orderDir: 'asc'
    });

    const rows = (response.rows || []).filter((r) => Number(r.anio) === year && Number(r.mes) === month);
    buildTable(rows, rules);
    status.textContent = `Filas: ${rows.length} | ${month}/${year}`;
  } catch (error) {
    status.textContent = error.message;
  }
}

function handleSaveRules() {
  (async () => {
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
  fillRuleInputs(DEFAULT_RULES);
  await initFilters();
  await loadKpiTable();
}

document.getElementById('reload').addEventListener('click', loadKpiTable);
document.getElementById('saveRules').addEventListener('click', handleSaveRules);
initPage();
