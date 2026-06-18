let csmChart = null;
let csmPeriodFiltersInitialized = false;
const MONTH_FILTER_OPTIONS = [
  { value: 'all', label: 'Anual' },
  { value: '1', label: 'Enero' },
  { value: '2', label: 'Febrero' },
  { value: '3', label: 'Marzo' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Mayo' },
  { value: '6', label: 'Junio' },
  { value: '7', label: 'Julio' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' }
];

function formatInteger(value) {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDecimal(value, digits = 1) {
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(Number(value || 0));
}

function formatDays(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'Sin base';
  return `${formatDecimal(value, 1)} d`;
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'Sin base';
  return `${formatDecimal(value, 1)}%`;
}

function formatCountWithPercent(count, base) {
  if (!Number(base)) return formatInteger(count);
  return `${formatInteger(count)} (${formatPercent((Number(count || 0) / Number(base || 0)) * 100)})`;
}

function toDateOnly(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function formatDate(value) {
  const dateOnly = toDateOnly(value);
  if (!dateOnly) return '—';
  const match = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return dateOnly;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function safeDiv(a, b) {
  if (!Number(b)) return 0;
  return Number(a || 0) / Number(b || 0);
}

function average(values) {
  const valid = (values || []).filter((value) => value !== null && value !== undefined && Number.isFinite(Number(value)));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + Number(value), 0) / valid.length;
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function daysBetween(start, end) {
  if (!(start instanceof Date) || !(end instanceof Date)) return null;
  return (end.getTime() - start.getTime()) / 86400000;
}

function startOfLocalDay(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDateAsLocalDay(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return startOfLocalDay(parsed);
}

function calendarDaysUntil(date, today = new Date()) {
  const target = parseDateAsLocalDay(date);
  const current = startOfLocalDay(today);
  if (!target || !current) return null;
  return Math.round((target.getTime() - current.getTime()) / 86400000);
}

function getDefaultRenewalRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    from: from.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10)
  };
}

function getDefaultCsmPeriod() {
  const now = new Date();
  return {
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1)
  };
}

function setSelectOptions(select, options, selectedValue) {
  if (!select) return;
  select.innerHTML = options
    .map((option) => `<option value="${escapeHtml(option.value)}"${String(option.value) === String(selectedValue) ? ' selected' : ''}>${escapeHtml(option.label)}</option>`)
    .join('');
}

function getYearMonthFromValue(value) {
  const date = toDateOnly(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return {
    year: date.slice(0, 4),
    month: String(Number(date.slice(5, 7)))
  };
}

function setupCsmPeriodFilters(rows) {
  const yearSelect = document.getElementById('csmYear');
  const monthSelect = document.getElementById('csmMonth');
  if (!yearSelect || !monthSelect) return;

  const defaults = getDefaultCsmPeriod();
  const params = new URLSearchParams(window.location.search);
  const requestedYear = params.get('anio') || defaults.year;
  const requestedMonth = params.get('mes') || defaults.month;

  const yearSet = new Set();
  (rows || []).forEach((row) => {
    const period = getYearMonthFromValue(row.f_pago_con_acceso);
    if (period?.year) yearSet.add(period.year);
  });

  if (!yearSet.size) {
    yearSet.add(defaults.year);
  }

  const years = [...yearSet].sort((a, b) => Number(b) - Number(a));
  const effectiveYear = years.includes(String(requestedYear)) ? String(requestedYear) : years[0];
  const effectiveMonth = ['all', ...MONTH_FILTER_OPTIONS.slice(1).map((option) => option.value)].includes(String(requestedMonth))
    ? String(requestedMonth)
    : defaults.month;

  setSelectOptions(yearSelect, years.map((year) => ({ value: year, label: year })), effectiveYear);
  setSelectOptions(monthSelect, MONTH_FILTER_OPTIONS, effectiveMonth);
  csmPeriodFiltersInitialized = true;
}

function getCsmPeriodFilters() {
  return {
    year: document.getElementById('csmYear')?.value || getDefaultCsmPeriod().year,
    month: document.getElementById('csmMonth')?.value || getDefaultCsmPeriod().month
  };
}

function filterRowsByPayAccessPeriod(rows, filters = {}) {
  const year = String(filters.year || '').trim();
  const month = String(filters.month || '').trim();

  return (rows || []).filter((row) => {
    const period = getYearMonthFromValue(row.f_pago_con_acceso);
    if (!period?.year) return false;
    if (year && period.year !== year) return false;
    if (month && month !== 'all' && period.month !== String(Number(month))) return false;
    return true;
  });
}

function describeCsmPeriod(filters = {}) {
  const year = String(filters.year || '').trim();
  const month = String(filters.month || '').trim();
  if (month === 'all') {
    return `año ${year}`;
  }

  const monthLabel = MONTH_FILTER_OPTIONS.find((option) => option.value === String(Number(month)))?.label || 'Mes';
  return `${monthLabel.toLowerCase()} ${year}`;
}

function setupRenewalFilters() {
  const desde = document.getElementById('desde');
  const hasta = document.getElementById('hasta');
  if (!desde || !hasta) return;

  const defaults = getDefaultRenewalRange();
  const params = new URLSearchParams(window.location.search);
  const from = params.get('desde') || defaults.from;
  const to = params.get('hasta') || defaults.to;

  desde.value = from;
  hasta.value = to;
}

function getRenewalFilters() {
  return {
    from: document.getElementById('desde')?.value || '',
    to: document.getElementById('hasta')?.value || ''
  };
}

function isDateInRange(value, filters) {
  const date = toDateOnly(value);
  if (!date) return false;
  if (filters.from && date < filters.from) return false;
  if (filters.to && date > filters.to) return false;
  return true;
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function isAnonymousCloser(value) {
  const normalized = normalizeText(value);
  return !normalized || normalized === 'anonymous' || normalized === 'anonimo' || normalized === 'anónimo';
}

function pickFirstNamedCloser(...values) {
  for (const value of values) {
    if (!isAnonymousCloser(value)) return String(value).trim();
  }
  return '';
}

function buildRenewalCloserLookup(rows = [], context = {}) {
  const lookup = new Map();
  const nameLookup = new Map();

  function registerLookup(ghlid, rawName, rawCloser) {
    const closer = pickFirstNamedCloser(rawCloser);
    const name = String(rawName || '').trim();
    const normalizedName = normalizeText(name);
    const normalizedGhlid = String(ghlid || '').trim();
    if (normalizedGhlid && closer && !lookup.has(normalizedGhlid)) {
      lookup.set(normalizedGhlid, closer);
    }
    if (normalizedName && closer && !nameLookup.has(normalizedName)) {
      nameLookup.set(normalizedName, closer);
    }
  }

  (rows || []).forEach((row) => {
    registerLookup(row?.ghlid, row?.nombre, row?.closer);
  });

  (context.comprobanteRows || []).forEach((row) => {
    registerLookup(row?.ghlid, row?.nombre || row?.cliente_format, pickFirstNamedCloser(row?.responsable_venta, row?.creado_por));
  });

  (context.leadRows || []).forEach((row) => {
    registerLookup(row?.ghlid || row?.contact_id || row?.id, row?.nombre, pickFirstNamedCloser(row?.closer, row?.responsable));
  });

  return {
    byGhlid: lookup,
    byName: nameLookup
  };
}

function resolveRenewalCloser(row, closerLookup) {
  return pickFirstNamedCloser(
    row?.closer,
    closerLookup?.byGhlid?.get(String(row?.ghlid || '').trim()),
    closerLookup?.byName?.get(normalizeText(row?.nombre))
  ) || 'Sin closer';
}

function isAbandonmentActivity(row) {
  const abandono = normalizeText(row?.abandono);
  return abandono.includes('abandono');
}

function hasText(value) {
  return String(value || '').trim() !== '';
}

function asTruthy(value) {
  if (value === true) return true;
  if (value === false || value === null || value === undefined) return false;
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'si', 'sí', 'yes', 'y', 'x'].includes(normalized);
}

function parseMetricNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  const text = String(value).trim();
  if (!text) return null;

  const normalized = text
    .toLowerCase()
    .replace(/d[ií]as?/g, '')
    .replace(/,/g, '.')
    .replace(/[^\d.-]/g, '');

  if (!normalized || ['-', '.', '-.'].includes(normalized)) return null;

  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeDayMetric(value) {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return numeric;
}

function parseUnderSevenMetric(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value;

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;

  if (normalized === '1') return true;
  if (normalized === '0') return false;
  if (['si', 'sí', 'true', 'yes', 'y', 'x'].includes(normalized)) return true;
  if (['no', 'false', 'n'].includes(normalized)) return false;

  const numeric = parseMetricNumber(value);
  if (numeric === null) return null;
  return numeric <= 7;
}

function normalizeModel(value) {
  const text = String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (text.includes('reventa')) return 'Reventa';
  if (text.includes('gastro')) return 'Gastronomicos';
  if (text.includes('fabric')) return 'Fabricantes';
  if (text.includes('serv')) return 'Servicios';
  return 'Etc';
}

function isRenewalProduct(value) {
  return normalizeText(value).includes('renovac');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function buildMetricRow({ key, label, value, base, fieldsLabel, logic, detailColumns, detailRows }) {
  return {
    key,
    label,
    value,
    base,
    note: logic,
    info: {
      title: label,
      base,
      fieldsLabel,
      logic,
      detailColumns: detailColumns || [],
      detailRows: detailRows || []
    }
  };
}

function createContactCell(label, ghlid) {
  return {
    type: 'ghl-contact',
    label: label || 'Sin nombre',
    ghlid: ghlid || ''
  };
}

function createGhlLinkCell(ghlid, label = 'Ir a GHL') {
  return {
    type: 'ghl-link',
    label,
    ghlid: ghlid || ''
  };
}

function renderDetailCell(cell) {
  if (cell && typeof cell === 'object' && cell.type === 'ghl-contact') {
    return window.metricasGhl?.renderContactCell(cell.label, cell.ghlid) || escapeHtml(cell.label);
  }
  if (cell && typeof cell === 'object' && cell.type === 'ghl-link') {
    const url = window.metricasGhl?.buildContactUrl?.(cell.ghlid || '');
    if (!url) return escapeHtml(cell.label || 'Ir a GHL');
    return `<a class="metricas-ghl-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(cell.label || 'Ir a GHL')}</a>`;
  }
  return escapeHtml(cell);
}

function showMetricInfo(info) {
  if (!info) return;

  const existing = document.getElementById('csmMetricPopup');
  if (existing) existing.remove();

  const detailTable = Array.isArray(info.detailRows) && info.detailRows.length
    ? `
      <div class="metric-info-detail">
        <p><strong>Detalle:</strong></p>
        <input id="csmMetricSearch" class="metric-info-search" type="search" placeholder="Buscar cliente..." autocomplete="off" />
        <div class="table-wrap csm-table-wrap">
          <table class="csm-table csm-detail-table">
            <thead>
              <tr>${(info.detailColumns || []).map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${info.detailRows.map((row) => `
                <tr>${row.map((cell) => `<td>${renderDetailCell(cell)}</td>`).join('')}</tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `
    : '';

  const popup = document.createElement('div');
  popup.id = 'csmMetricPopup';
  popup.className = 'kpi-popup metric-info-popup';
  const cardClass = (info.detailColumns || []).length >= 8 ? 'kpi-popup-card metric-info-card metric-info-card-wide' : 'kpi-popup-card metric-info-card';
  popup.innerHTML = `
    <div class="${cardClass}">
      <h3>${escapeHtml(info.title)}</h3>
      <p><strong>Base que contabiliza:</strong> ${escapeHtml(info.base || 'Sin base informada')}</p>
      <p><strong>Campo que toma:</strong> ${escapeHtml(info.fieldsLabel || 'Sin campo')}</p>
      <p><strong>Muestra:</strong> ${escapeHtml(info.logic || 'Sin descripcion')}</p>
      ${detailTable}
      <div class="metric-info-actions">
        <button id="csmMetricPopupClose" type="button">Cerrar</button>
      </div>
    </div>
  `;

  document.body.appendChild(popup);

  const close = () => popup.remove();
  popup.addEventListener('click', (event) => {
    if (event.target === popup) close();
  });
  document.getElementById('csmMetricPopupClose').addEventListener('click', close);

  const searchInput = document.getElementById('csmMetricSearch');
  if (searchInput) {
    const rows = Array.from(popup.querySelectorAll('.csm-detail-table tbody tr'));
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.trim().toLowerCase();
      rows.forEach((row) => {
        const text = row.textContent.toLowerCase();
        row.style.display = !query || text.includes(query) ? '' : 'none';
      });
    });
    searchInput.focus();
  }
}

function attachMetricInfo(root, infoMap) {
  const nodes = [];
  if (root?.matches?.('[data-info-key]')) nodes.push(root);
  root.querySelectorAll?.('[data-info-key]').forEach((node) => nodes.push(node));

  nodes.forEach((node) => {
    const open = () => showMetricInfo(infoMap[node.dataset.infoKey]);
    node.addEventListener('click', open);
    node.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
  });
}

function getLatestDate(...dates) {
  const valid = dates.filter(Boolean);
  if (!valid.length) return null;
  return valid.sort((a, b) => a.getTime() - b.getTime())[valid.length - 1];
}

function discardDatesBeforeReference(dates, referenceDate) {
  return (dates || []).map((date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
    if (!(referenceDate instanceof Date) || Number.isNaN(referenceDate.getTime())) return date;
    return date.getTime() < referenceDate.getTime() ? null : date;
  });
}

function enrichRows(rows) {
  return (rows || []).map((row) => {
    const rawModuleDates = Array.from({ length: 10 }, (_, index) => parseDate(row[`modulo_${index + 1}`]));
    const accessDate = parseDate(row.f_acceso);
    const payAccessDate = parseDate(row.f_pago_con_acceso);
    const onboardingDateRaw = parseDate(row.f_onboarding);
    const diagnosisDateRaw = parseDate(row.f_diagnostico || row.modulo_1);
    const payReferenceDate = payAccessDate || accessDate;
    const onboardingDate = (
      onboardingDateRaw instanceof Date
      && payReferenceDate instanceof Date
      && onboardingDateRaw.getTime() < payReferenceDate.getTime()
    ) ? null : onboardingDateRaw;
    const diagnosisDate = (
      diagnosisDateRaw instanceof Date
      && onboardingDate instanceof Date
      && diagnosisDateRaw.getTime() < onboardingDate.getTime()
    ) ? null : diagnosisDateRaw;
    const moduleDates = discardDatesBeforeReference(rawModuleDates, payReferenceDate || onboardingDate || null);
    const firstResultDate = parseDate(row.f_primer_resultado);
    const successDate = parseDate(row.caso_de_exito);
    const abandonDate = parseDate(row.f_abandono);
    const finalDate = parseDate(row.fecha_final);
    const renewalCompletedDate = parseDate(row.fecha_final_renovacion);
    const advanceDate = parseDate(row.ultima_fecha_de_avance);
    const responseDate = parseDate(row.ultima_respuesta);
    const payToOnboardingMetric = normalizeDayMetric(parseMetricNumber(row.pago_a_onbo));
    const payToDiagnosisMetric = normalizeDayMetric(parseMetricNumber(row.pago_a_diagnostico));
    const diagnosisUnder7Flag = parseUnderSevenMetric(row.diagnostico_7dias);
    const npsValues = Array.from({ length: 10 }, (_, index) => {
      const value = Number(row[`nps_${index + 1}`]);
      return Number.isFinite(value) ? value : null;
    });

    return {
      ...row,
      modelBucket: normalizeModel(row.modelo_negocio),
      accessDate,
      payAccessDate,
      payReferenceDate,
      onboardingDate,
      payToOnboardingMetric,
      payToOnboardingSource: 'pago_a_onbo',
      payToDiagnosisMetric,
      diagnosisUnder7Flag,
      diagnosisDate,
      successDate,
      abandonDate,
      finalDate,
      renewalCompletedDate,
      advanceDate,
      responseDate,
      firstResultDate,
      moduleDates,
      npsValues,
      isActive: row.activos === true,
      abandono: row.abandono,
      hasInsatisfaction: hasText(row.insatisfecho),
      hasRefundRequest: hasText(row.solicito_devolucion),
      hasFarewell: hasText(row.despedida),
      isRenewable15: asTruthy(row.proximo_renovar_15d),
      isRenewable30: asTruthy(row.proximo_renovar_30d),
      engagementDate: getLatestDate(advanceDate, responseDate),
      programStartDate: onboardingDate
    };
  });
}

function collectDayDiffs(rows, getStart, getEnd) {
  return (rows || [])
    .map((row) => daysBetween(getStart(row), getEnd(row)))
    .filter((value) => value !== null && Number.isFinite(value) && value >= 0);
}

function renderKpiCards(metrics, kpiKeys, infoMap) {
  const wrap = document.getElementById('kpiContainer');
  const selected = metrics.filter((metric) => kpiKeys.includes(metric.key));

  wrap.innerHTML = selected.map((metric) => `
    <article class="card metric-card" data-info-key="${escapeHtml(metric.key)}" role="button" tabindex="0">
      <h4>${escapeHtml(metric.label)}</h4>
      <p>${escapeHtml(metric.value)}</p>
    </article>
  `).join('');

  attachMetricInfo(wrap, infoMap);
}

function renderMetricsTable(metrics, infoMap) {
  const container = document.getElementById('tableContainer');
  container.innerHTML = `
    <div class="table-wrap csm-table-wrap">
      <table class="csm-table">
        <thead>
          <tr>
            <th>Métrica</th>
            <th>Valor</th>
            <th>Base</th>
            <th>Lectura</th>
          </tr>
        </thead>
        <tbody>
          ${metrics.map((metric) => `
            <tr>
              <td><button type="button" class="metric-info-trigger metric-label" data-info-key="${escapeHtml(metric.key)}">${escapeHtml(metric.label)}</button></td>
              <td>${escapeHtml(metric.value)}</td>
              <td>${escapeHtml(metric.base)}</td>
              <td>${escapeHtml(metric.note)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  attachMetricInfo(container, infoMap);
}

function renderSections(sections, infoMap = {}) {
  const container = document.getElementById('detailContainer');
  const hasModuleCards = (sections || []).some((section) => section.layout === 'half');
  const sectionMarkup = (sections || []).map((section) => `
    <section
      class="table-wrap csm-detail-panel${section.layout === 'half' ? ' csm-detail-panel-half' : ''}${section.infoKey ? ' csm-detail-panel-clickable' : ''}"
      ${section.infoKey ? `data-info-key="${escapeHtml(section.infoKey)}" role="button" tabindex="0"` : ''}
    >
      <div class="csm-detail-head">
        <h3>${escapeHtml(section.title)}</h3>
        <p>${escapeHtml(section.description || '')}</p>
      </div>
      <table class="csm-table csm-detail-table">
        <thead>
          <tr>${section.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${section.rows.length ? section.rows.map((row) => `
            <tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>
          `).join('') : '<tr><td colspan="' + section.columns.length + '">Sin base suficiente.</td></tr>'}
        </tbody>
      </table>
    </section>
  `).join('');

  container.innerHTML = `
    ${hasModuleCards ? `
      <div class="csm-detail-group-title">
        <h3>Modulos del Meg</h3>
      </div>
    ` : ''}
    ${sectionMarkup}
  `;

  attachMetricInfo(container, infoMap);
}

function renderChart(config, infoMap = {}) {
  const canvas = document.getElementById('csmChart');
  const panel = canvas?.closest('.chart-panel');
  if (!canvas || typeof Chart === 'undefined' || !config) return;

  document.getElementById('chartTitle').textContent = config.title;
  document.getElementById('chartDescription').textContent = config.description;

  if (panel) {
    if (config.infoKey) {
      panel.dataset.infoKey = config.infoKey;
      panel.setAttribute('role', 'button');
      panel.setAttribute('tabindex', '0');
      panel.classList.add('csm-chart-panel-clickable');
      attachMetricInfo(panel, infoMap);
    } else {
      delete panel.dataset.infoKey;
      panel.removeAttribute('role');
      panel.removeAttribute('tabindex');
      panel.classList.remove('csm-chart-panel-clickable');
    }
  }

  if (csmChart) csmChart.destroy();

  csmChart = new Chart(canvas, {
    type: config.type || 'bar',
    data: {
      labels: config.labels,
      datasets: config.datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true
        }
      },
      plugins: {
        legend: {
          display: config.datasets.length > 1
        }
      }
    }
  });
}

function buildTimePage(rows) {
  const activeProgramRows = rows.filter((row) => !isAbandonmentActivity(row));
  const payToOnboardingRows = activeProgramRows
    .filter((row) => row.payToOnboardingMetric !== null && Number.isFinite(row.payToOnboardingMetric))
    .map((row) => ({
      nombre: row.nombre || 'Sin nombre',
      ghlid: row.ghlid || '',
      value: row.payToOnboardingMetric,
      payDate: toDateOnly(row.payReferenceDate),
      onboardingDate: toDateOnly(row.f_onboarding || ''),
      source: row.payToOnboardingSource
    }))
    .sort((a, b) => a.value - b.value || a.nombre.localeCompare(b.nombre));
  const payToOnboarding = payToOnboardingRows
    .map((row) => row.value)
    .filter((value) => value !== null && Number.isFinite(value));
  const payToDiagnosisRows = activeProgramRows
    .filter((row) => row.payToDiagnosisMetric !== null && Number.isFinite(row.payToDiagnosisMetric))
    .map((row) => ({
      nombre: row.nombre || 'Sin nombre',
      ghlid: row.ghlid || '',
      value: row.payToDiagnosisMetric,
      payDate: toDateOnly(row.payReferenceDate),
      diagnosisDate: toDateOnly(row.diagnosisDate),
      source: row.payAccessDate ? 'f_pago_con_acceso' : row.accessDate ? 'f_acceso' : 'notion_field'
    }))
    .sort((a, b) => a.value - b.value || a.nombre.localeCompare(b.nombre));
  const payToDiagnosis = payToDiagnosisRows
    .map((row) => row.value)
    .filter((value) => value !== null && Number.isFinite(value));
  const diagnosisUnder7Rows = activeProgramRows
    .map((row) => {
      const elapsedDays = row.payReferenceDate && row.diagnosisDate
        ? daysBetween(row.payReferenceDate, row.diagnosisDate)
        : row.payToDiagnosisMetric;

      const normalizedElapsed = elapsedDays !== null && Number.isFinite(elapsedDays) ? elapsedDays : null;
      if (normalizedElapsed === null || normalizedElapsed < 0 || normalizedElapsed > 7) return null;

      return {
        nombre: row.nombre || 'Sin nombre',
        ghlid: row.ghlid || '',
        elapsedDays: normalizedElapsed,
        diagnosisDate: toDateOnly(row.diagnosisDate),
        payDate: toDateOnly(row.f_pago_con_acceso || row.f_acceso || '')
      };
    })
    .filter(Boolean)
    .map((row) => ({
      ...row
    }))
    .sort((a, b) => a.elapsedDays - b.elapsedDays || a.nombre.localeCompare(b.nombre));
  const diagnosisOver7Rows = activeProgramRows
    .map((row) => {
      const elapsedDays = row.payReferenceDate
        ? (row.diagnosisDate
          ? daysBetween(row.payReferenceDate, row.diagnosisDate)
          : daysBetween(row.payReferenceDate, new Date()))
        : null;

      const normalizedElapsed = elapsedDays !== null && Number.isFinite(elapsedDays) ? elapsedDays : null;
      if (normalizedElapsed === null || normalizedElapsed <= 7) return null;

      return {
        nombre: row.nombre || 'Sin nombre',
        ghlid: row.ghlid || '',
        elapsedDays: normalizedElapsed,
        status: row.diagnosisDate ? 'Ya la hizo' : 'Aun no',
        diagnosisDate: toDateOnly(row.diagnosisDate),
        payDate: toDateOnly(row.f_pago_con_acceso || row.f_acceso || '')
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.elapsedDays - a.elapsedDays || a.nombre.localeCompare(b.nombre));
  const pendingOnboardingRows = activeProgramRows
    .map((row) => {
      if (!row.payReferenceDate) return null;
      if (row.onboardingDate) return null;

      const elapsedDays = daysBetween(row.payReferenceDate, new Date());
      return {
        nombre: row.nombre || 'Sin nombre',
        ghlid: row.ghlid || '',
        payDate: toDateOnly(row.f_pago_con_acceso || row.f_acceso || ''),
        elapsedDays: elapsedDays !== null && Number.isFinite(elapsedDays) ? elapsedDays : null
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b.elapsedDays ?? -1) - (a.elapsedDays ?? -1) || a.nombre.localeCompare(b.nombre));
  const onboardingToFirstResultRows = activeProgramRows
    .map((row) => ({
      nombre: row.nombre || 'Sin nombre',
      ghlid: row.ghlid || '',
      value: daysBetween(row.onboardingDate, row.firstResultDate),
      onboardingDate: toDateOnly(row.f_onboarding || ''),
      firstResultDate: toDateOnly(row.f_primer_resultado || '')
    }))
    .filter((row) => row.value !== null && Number.isFinite(row.value) && row.value >= 0);
  const onboardingToFirstResult = onboardingToFirstResultRows.map((row) => row.value);
  const onboardingToSuccessRows = activeProgramRows
    .map((row) => ({
      nombre: row.nombre || 'Sin nombre',
      ghlid: row.ghlid || '',
      value: daysBetween(row.onboardingDate, row.successDate),
      onboardingDate: toDateOnly(row.f_onboarding || ''),
      successDate: toDateOnly(row.caso_de_exito || '')
    }))
    .filter((row) => row.value !== null && Number.isFinite(row.value) && row.value >= 0);
  const onboardingToSuccess = onboardingToSuccessRows.map((row) => row.value);
  const entryToModule7Rows = activeProgramRows
    .map((row) => ({
      nombre: row.nombre || 'Sin nombre',
      ghlid: row.ghlid || '',
      value: daysBetween(row.payReferenceDate, row.moduleDates[6]),
      payDate: toDateOnly(row.f_pago_con_acceso || row.f_acceso || ''),
      module7Date: toDateOnly(row.modulo_7 || '')
    }))
    .filter((row) => row.value !== null && Number.isFinite(row.value) && row.value >= 0)
    .sort((a, b) => a.value - b.value || a.nombre.localeCompare(b.nombre));
  const entryToModule7 = entryToModule7Rows.map((row) => row.value);

  const unitStats = Array.from({ length: 10 }, (_, index) => {
    const diffs = activeProgramRows
      .map((row) => {
        const current = row.moduleDates[index];
        const previous = index === 0
          ? (row.payReferenceDate || row.onboardingDate)
          : row.moduleDates[index - 1];
        return daysBetween(previous, current);
      })
      .filter((value) => value !== null && Number.isFinite(value) && value >= 0);

    const completed = activeProgramRows.filter((row) => row.moduleDates[index]).length;
    return {
      unit: `Unidad ${index + 1}`,
      avgDays: average(diffs),
      completed
    };
  });
  const unitClientRows = activeProgramRows
    .map((row) => {
      const unitValues = Array.from({ length: 10 }, (_, index) => {
        const current = row.moduleDates[index];
        const previous = index === 0
          ? (row.payReferenceDate || row.onboardingDate)
          : row.moduleDates[index - 1];
        const value = daysBetween(previous, current);
        return value !== null && Number.isFinite(value) && value >= 0 ? formatDays(value) : '-';
      });
      return [createContactCell(row.nombre || 'Sin nombre', row.ghlid || ''), ...unitValues];
    })
    .sort((a, b) => String(a[0]?.label || '').localeCompare(String(b[0]?.label || ''), 'es'));

  const diagnosticUnder7 = diagnosisUnder7Rows.length;
  const diagnosticUnder7Base = activeProgramRows.filter((row) => row.payReferenceDate).length;
  const diagnosticOver7 = diagnosisOver7Rows.length;
  const averageUnit = average(unitStats.map((row) => row.avgDays).filter((value) => value !== null));

  const metrics = [
    buildMetricRow({
      key: 'pay_to_onboarding',
      label: 'Tiempo promedio desde pago a ver onboarding',
      value: formatDays(average(payToOnboarding)),
      base: `${formatInteger(payToOnboarding.length)} clientes con "pago_a_onbo" y sin "abandono" en CSM`,
      fieldsLabel: '"pago_a_onbo"',
      logic: 'Promedio del campo "pago_a_onbo".',
      detailColumns: ['Cliente', 'Pago a onbo'],
      detailRows: payToOnboardingRows.map((row) => [
        createContactCell(row.nombre, row.ghlid),
        formatDays(row.value)
      ])
    }),
    buildMetricRow({
      key: 'pay_to_diagnosis',
      label: 'Tiempo promedio desde pago a sesión diagnóstico',
      value: formatDays(average(payToDiagnosis)),
      base: `${formatInteger(payToDiagnosis.length)} clientes con "pago_a_diagnostico" y sin "abandono" en CSM`,
      fieldsLabel: '"pago_a_diagnostico"',
      logic: 'Promedio del campo "pago_a_diagnostico".',
      detailColumns: ['Cliente', 'Pago a diagnóstico'],
      detailRows: payToDiagnosisRows.map((row) => [
        createContactCell(row.nombre, row.ghlid),
        formatDays(row.value)
      ])
    }),
    buildMetricRow({
      key: 'diagnosis_under_7',
      label: 'Cantidad de sesiones diagnóstico menor a 7 días',
      value: formatInteger(diagnosticUnder7),
      base: `${formatInteger(diagnosticUnder7Base)} clientes con fecha de ingreso y sin "abandono" en CSM`,
      fieldsLabel: '"f_pago_con_acceso" o "f_acceso", "modulo_1"',
      logic: 'Cantidad de clientes que hicieron la sesión diagnóstico dentro de los primeros 7 días desde su ingreso.',
      detailColumns: ['Cliente', 'Tiempo desde pago', 'Pago con acceso', 'Sesión diagnóstico'],
      detailRows: diagnosisUnder7Rows.map((row) => [
        createContactCell(row.nombre, row.ghlid),
        formatDays(row.elapsedDays),
        row.payDate || '-',
        row.diagnosisDate || '-'
      ])
    }),
    buildMetricRow({
      key: 'diagnosis_over_7',
      label: 'Cantidad de sesiones diagnóstico mayor a 7 días',
      value: formatInteger(diagnosticOver7),
      base: `${formatInteger(diagnosticUnder7Base)} clientes con fecha de ingreso y sin "abandono" en CSM`,
      fieldsLabel: '"f_pago_con_acceso" o "f_acceso", "modulo_1"',
      logic: 'Cantidad de clientes que tardaron más de 7 días en llegar a la sesión diagnóstico. Si todavía no la hicieron, también se listan cuando ya superaron los 7 días desde el ingreso.',
      detailColumns: ['Cliente', 'Estado', 'Tiempo desde pago', 'Pago con acceso', 'Sesión diagnóstico'],
      detailRows: diagnosisOver7Rows.map((row) => [
        createContactCell(row.nombre, row.ghlid),
        row.status,
        formatDays(row.elapsedDays),
        row.payDate || '-',
        row.diagnosisDate || '-'
      ])
    }),
    buildMetricRow({
      key: 'pending_onboarding_diagnosis',
      label: 'Clientes del mes sin onboarding',
      value: formatInteger(pendingOnboardingRows.length),
      base: `${formatInteger(diagnosticUnder7Base)} clientes con fecha de ingreso y sin "abandono" en CSM`,
      fieldsLabel: '"f_pago_con_acceso" o "f_acceso", "f_onboarding"',
      logic: 'Cuenta clientes del mes filtrado por ingreso que todavía no tienen onboarding cargado.',
      detailColumns: ['Cliente', 'Pago con acceso', 'Días desde ingreso'],
      detailRows: pendingOnboardingRows.map((row) => [
        createContactCell(row.nombre, row.ghlid),
        row.payDate || '-',
        row.elapsedDays !== null ? formatDays(row.elapsedDays) : '-'
      ])
    }),
    buildMetricRow({
      key: 'onboarding_to_first_result',
      label: 'Tiempo promedio a primer resultado',
      value: formatDays(average(onboardingToFirstResult)),
      base: `${formatInteger(onboardingToFirstResult.length)} clientes activos con onboarding y "f_primer_resultado"`,
      fieldsLabel: '"f_onboarding", "f_primer_resultado"',
      logic: 'Promedio de días entre onboarding y primer resultado.',
      detailColumns: ['Cliente', 'Tiempo a primer resultado'],
      detailRows: onboardingToFirstResultRows.map((row) => [
        createContactCell(row.nombre, row.ghlid),
        formatDays(row.value)
      ])
    }),
    buildMetricRow({
      key: 'onboarding_to_success',
      label: 'Tiempo promedio a caso de éxito',
      value: formatDays(average(onboardingToSuccess)),
      base: `${formatInteger(onboardingToSuccess.length)} clientes activos con onboarding y caso de éxito`,
      fieldsLabel: '"f_onboarding", "caso_de_exito"',
      logic: 'Promedio de días entre onboarding y caso de éxito.',
      detailColumns: ['Cliente', 'Tiempo a caso de éxito'],
      detailRows: onboardingToSuccessRows.map((row) => [
        createContactCell(row.nombre, row.ghlid),
        formatDays(row.value)
      ])
    }),
    buildMetricRow({
      key: 'unit_average_time',
      label: 'Tiempo promedio en cada unidad',
      value: formatDays(averageUnit),
      base: `${formatInteger(unitStats.filter((row) => row.avgDays !== null).length)} unidades con base calculable sobre clientes sin "abandono"`,
      fieldsLabel: '"f_onboarding", "modulo_1" a "modulo_10"',
      logic: 'Promedio de días por unidad.',
      detailColumns: ['Cliente', 'U1', 'U2', 'U3', 'U4', 'U5', 'U6', 'U7', 'U8', 'U9', 'U10'],
      detailRows: unitClientRows
    }),
    buildMetricRow({
      key: 'entry_to_module_7',
      label: 'Tiempo promedio desde ingreso a módulo 7',
      value: formatDays(average(entryToModule7)),
      base: `${formatInteger(entryToModule7.length)} clientes con fecha de ingreso y "modulo_7"`,
      fieldsLabel: '"f_pago_con_acceso" o "f_acceso", "modulo_7"',
      logic: 'Promedio de días entre el ingreso y la llegada al módulo 7.',
      detailColumns: ['Cliente', 'Ingreso a módulo 7', 'Ingreso', 'Módulo 7'],
      detailRows: entryToModule7Rows.map((row) => [
        createContactCell(row.nombre, row.ghlid),
        formatDays(row.value),
        row.payDate || '-',
        row.module7Date || '-'
      ])
    })
  ];

  const sections = [
    {
      title: 'Tiempo promedio en cada unidad',
      description: 'Resumen del promedio general de días entre hitos consecutivos del recorrido.',
      layout: 'half',
      infoKey: 'unit_average_time',
      columns: ['Métrica', 'Valor', 'Base'],
      rows: [
        [
          'Tiempo promedio en cada unidad',
          formatDays(averageUnit),
          `${formatInteger(unitStats.filter((row) => row.avgDays !== null).length)} unidades con base`
        ]
      ]
    },
    {
      title: 'Tiempo promedio desde ingreso a módulo 7',
      description: 'Tiempo promedio desde el ingreso hasta llegar al módulo 7 sobre clientes con ambas fechas cargadas.',
      layout: 'half',
      infoKey: 'entry_to_module_7',
      columns: ['Métrica', 'Valor', 'Base'],
      rows: [
        [
          'Ingreso a módulo 7',
          formatDays(average(entryToModule7)),
          `${formatInteger(entryToModule7.length)} clientes con ingreso y módulo 7`
        ]
      ]
    },
    {
      title: 'Detalle por Unidad',
      description: 'Promedio de días entre hitos consecutivos y cantidad de clientes que llegaron a cada unidad.',
      infoKey: 'unit_average_time',
      columns: ['Unidad', 'Promedio dias', 'Clientes', '% sobre total'],
      rows: unitStats.map((row) => [
        row.unit,
        formatDays(row.avgDays),
        formatInteger(row.completed),
        formatPercent(safeDiv(row.completed * 100, activeProgramRows.length))
      ])
    }
  ];

  return {
    metrics,
    kpiKeys: ['pay_to_onboarding', 'pay_to_diagnosis', 'diagnosis_under_7', 'diagnosis_over_7', 'pending_onboarding_diagnosis'],
    chart: {
      title: 'Tiempo Promedio por Unidad',
      description: 'Promedio de días entre el hito anterior y la unidad registrada.',
      infoKey: 'unit_average_time',
      labels: unitStats.map((row) => row.unit.replace('Unidad ', 'U')),
      datasets: [
        {
          label: 'Dias promedio',
          data: unitStats.map((row) => Number(row.avgDays || 0)),
          backgroundColor: 'rgba(20, 101, 192, 0.72)',
          borderColor: 'rgba(20, 101, 192, 1)',
          borderWidth: 1,
          borderRadius: 8
        }
      ]
    },
    sections
  };
}

function buildSituationPage(rows) {
  const today = new Date();
  const engagedRows = rows.filter((row) => {
    if (!row.isActive || !row.engagementDate) return false;
    const days = daysBetween(row.engagementDate, today);
    return days !== null && days >= 0 && days <= 30;
  });
  const abandonDiffs = collectDayDiffs(rows, (row) => row.programStartDate, (row) => row.abandonDate);
  const successRows = rows.filter((row) => row.successDate);
  const firstResultRows = rows.filter((row) => row.firstResultDate);
  const nightmareRows = rows.filter((row) => row.hasInsatisfaction || row.hasRefundRequest);
  const insatisfactionRows = rows.filter((row) => row.hasInsatisfaction);
  const refundRows = rows.filter((row) => row.hasRefundRequest);
  const refundCompletedRows = rows.filter((row) => row.hasRefundRequest && (!row.isActive || row.hasFarewell));
  const activeRows = rows.filter((row) => row.isActive);

  const npsUnitStats = Array.from({ length: 10 }, (_, index) => {
    const values = rows.map((row) => row.npsValues[index]).filter((value) => value !== null);
    return {
      unit: `Unidad ${index + 1}`,
      average: average(values),
      answers: values.length
    };
  });

  const allNpsValues = rows.flatMap((row) => row.npsValues.filter((value) => value !== null));
  const recommendationCount = allNpsValues.filter((value) => Number(value) >= 9).length;

  const modelBuckets = ['Reventa', 'Gastronomicos', 'Fabricantes', 'Servicios', 'Etc'].map((bucket) => {
    const subset = rows.filter((row) => row.modelBucket === bucket);
    const subsetSuccess = subset.filter((row) => row.successDate);
    const subsetAbandon = subset.filter((row) => row.abandonDate);
    const subsetInsatisfaction = subset.filter((row) => row.hasInsatisfaction);
    const subsetFirstResultDiffs = collectDayDiffs(subset, (row) => row.onboardingDate, (row) => row.firstResultDate);
    const subsetNpsValues = subset.flatMap((row) => row.npsValues.filter((value) => value !== null));
    const subsetRenewals = subset.filter((row) => row.renewalCompletedDate);

    return [
      bucket,
      formatInteger(subset.length),
      formatPercent(safeDiv(subsetAbandon.length * 100, subset.length)),
      formatInteger(subsetSuccess.length),
      formatPercent(safeDiv(subsetSuccess.length * 100, subset.length)),
      formatDays(average(subsetFirstResultDiffs)),
      formatInteger(subsetInsatisfaction.length),
      subsetNpsValues.length ? formatDecimal(average(subsetNpsValues), 1) : 'Sin base',
      formatInteger(subsetRenewals.length)
    ];
  });

  const metrics = [
    buildMetricRow({
      key: 'total_clients',
      label: 'Clientes totales que pasaron por el programa',
      value: formatInteger(rows.length),
      base: `${formatInteger(rows.length)} filas actuales en "csm"`,
      note: 'Incluye activos e inactivos.',
      dateLabel: 'Snapshot actual de "csm"',
      fieldsLabel: '"id", "nombre"',
      logic: 'Cuenta todas las filas vigentes de la tabla "csm" como universo del programa.'
    }),
    buildMetricRow({
      key: 'active_support',
      label: 'Cantidad de clientes activos con soporte',
      value: formatCountWithPercent(activeRows.length, rows.length),
      base: `${formatInteger(rows.length)} clientes totales`,
      note: 'Toma la foto actual de clientes marcados como activos.',
      dateLabel: 'Snapshot actual de "csm"',
      fieldsLabel: '"activos"',
      logic: 'Cuenta filas con "activos"=true.'
    }),
    buildMetricRow({
      key: 'abandonments',
      label: 'Cantidad de abandonos',
      value: formatCountWithPercent(rows.filter((row) => row.abandonDate).length, rows.length),
      base: `${formatInteger(rows.length)} clientes totales`,
      note: 'Solo entra quien tiene fecha de abandono cargada.',
      dateLabel: '"f_abandono"',
      fieldsLabel: '"f_abandono"',
      logic: 'Cuenta clientes con una fecha válida en "f_abandono".'
    }),
    buildMetricRow({
      key: 'avg_days_to_abandon',
      label: 'Dias promedio hasta abandono',
      value: formatDays(average(abandonDiffs)),
      base: `${formatInteger(abandonDiffs.length)} clientes con onboarding y abandono`,
      note: 'Usa solo onboarding y fecha de abandono cargados.',
      dateLabel: '"f_onboarding" -> "f_abandono"',
      fieldsLabel: '"f_onboarding", "f_abandono"',
      logic: 'Promedio de días entre "f_onboarding" y "f_abandono".'
    }),
    buildMetricRow({
      key: 'engagement',
      label: 'Clientes con engagement',
      value: formatCountWithPercent(engagedRows.length, activeRows.length),
      base: `${formatInteger(activeRows.length)} clientes activos`,
      note: 'Considero engagement si hubo avance o respuesta en los últimos 30 días.',
      dateLabel: 'Ultimos 30 dias sobre "ultima_fecha_de_avance" / "ultima_respuesta"',
      fieldsLabel: '"activos", "ultima_fecha_de_avance", "ultima_respuesta"',
      logic: 'Cuenta clientes activos con una fecha reciente de avance o respuesta dentro de los últimos 30 días.'
    }),
    buildMetricRow({
      key: 'success_cases',
      label: 'Casos de exito',
      value: formatCountWithPercent(successRows.length, rows.length),
      base: `${formatInteger(rows.length)} clientes totales`,
      note: 'Usa la fecha del caso de éxito cargada en la tabla.',
      dateLabel: '"caso_de_exito"',
      fieldsLabel: '"caso_de_exito"',
      logic: 'Cuenta clientes con fecha no nula en "caso_de_exito".'
    }),
    buildMetricRow({
      key: 'nightmare_clients',
      label: 'Clientes pesadilla',
      value: formatCountWithPercent(nightmareRows.length, rows.length),
      base: `${formatInteger(rows.length)} clientes totales`,
      note: 'Lo uso como proxy negativo mientras definimos una regla final.',
      dateLabel: 'Snapshot actual y marcas negativas',
      fieldsLabel: '"insatisfecho", "solicito_devolucion"',
      logic: 'Por ahora considero pesadilla a todo cliente con alguna marca negativa en "insatisfecho" o "solicito_devolucion".'
    }),
    buildMetricRow({
      key: 'first_result_clients',
      label: 'Clientes con primer resultado',
      value: formatCountWithPercent(firstResultRows.length, rows.length),
      base: `${formatInteger(rows.length)} clientes totales`,
      note: 'Usa solo la fecha explícita de primer resultado cargada.',
      dateLabel: '"f_primer_resultado"',
      fieldsLabel: '"f_primer_resultado"',
      logic: 'Cuenta clientes con fecha no nula en "f_primer_resultado".'
    }),
    buildMetricRow({
      key: 'insatisfied_clients',
      label: 'Clientes insatisfechos',
      value: formatCountWithPercent(insatisfactionRows.length, rows.length),
      base: `${formatInteger(rows.length)} clientes totales`,
      note: 'Usa la marca cargada hoy en la tabla.',
      dateLabel: 'Snapshot actual de "csm"',
      fieldsLabel: '"insatisfecho"',
      logic: 'Cuenta filas con contenido en "insatisfecho".'
    }),
    buildMetricRow({
      key: 'refund_requests',
      label: 'Solicitudes de devoluciones',
      value: formatCountWithPercent(refundRows.length, rows.length),
      base: `${formatInteger(rows.length)} clientes totales`,
      note: 'Se apoya en el marcador actual de solicitud.',
      dateLabel: 'Snapshot actual de "csm"',
      fieldsLabel: '"solicito_devolucion"',
      logic: 'Cuenta filas con contenido en "solicito_devolucion".'
    }),
    buildMetricRow({
      key: 'refunds_completed',
      label: 'Devoluciones efectuadas',
      value: formatCountWithPercent(refundCompletedRows.length, refundRows.length),
      base: `${formatInteger(refundRows.length)} solicitudes detectadas`,
      note: 'Uso un proxy: solicitud de devolución y cliente ya inactivo o con despedida.',
      dateLabel: 'Snapshot actual + cierre del caso',
      fieldsLabel: '"solicito_devolucion", "activos", "despedida"',
      logic: 'Hasta contar con un campo específico de devolución efectuada, tomo como proxy las solicitudes cuyo cliente ya no está activo o tiene "despedida".'
    }),
    buildMetricRow({
      key: 'nps_by_unit',
      label: 'NPS promedio de cada unidad',
      value: 'Ver detalle por unidad',
      base: `${formatInteger(allNpsValues.length)} respuestas NPS`,
      note: 'La tabla inferior muestra unidad por unidad.',
      dateLabel: '"nps_1" a "nps_10"',
      fieldsLabel: '"nps_1" a "nps_10"',
      logic: 'Promedio simple por cada columna NPS, usando solo respuestas no nulas.'
    }),
    buildMetricRow({
      key: 'recommendations_pct',
      label: '% recomendaciones',
      value: formatPercent(safeDiv(recommendationCount * 100, allNpsValues.length)),
      base: `${formatInteger(allNpsValues.length)} respuestas NPS`,
      note: 'Tomo recomendación como respuesta NPS mayor o igual a 9.',
      dateLabel: '"nps_1" a "nps_10"',
      fieldsLabel: '"nps_1" a "nps_10"',
      logic: 'Calcula el porcentaje de respuestas NPS con valor mayor o igual a 9 sobre el total de respuestas cargadas.'
    })
  ];

  const sections = [
    {
      title: 'NPS Promedio por Unidad',
      description: 'Promedio y cantidad de respuestas disponibles en cada unidad.',
      columns: ['Unidad', 'Promedio NPS', 'Respuestas'],
      rows: npsUnitStats.map((row) => [
        row.unit,
        row.average === null ? 'Sin base' : formatDecimal(row.average, 1),
        formatInteger(row.answers)
      ])
    },
    {
      title: 'Modelos de Negocio',
      description: 'Desglose por segmento normalizado a partir de "modelo_negocio".',
      columns: ['Modelo', 'Cantidad programa', '% abandonos', 'Cantidad exito', '% caso exito', 'Tiempo a primer resultado', 'Insatisfechos', 'NPS', 'Renovaciones'],
      rows: modelBuckets
    }
  ];

  return {
    metrics,
    kpiKeys: ['total_clients', 'active_support', 'engagement', 'success_cases'],
    chart: {
      title: 'Foto Actual del Programa',
      description: 'Conteos clave para leer salud, avance y alertas del programa.',
      labels: ['Activos', 'Engagement', 'Primer resultado', 'Exito', 'Abandonos', 'Pesadilla', 'Insatisfechos'],
      datasets: [
        {
          label: 'Clientes',
          data: [
            activeRows.length,
            engagedRows.length,
            firstResultRows.length,
            successRows.length,
            rows.filter((row) => row.abandonDate).length,
            nightmareRows.length,
            insatisfactionRows.length
          ],
          backgroundColor: [
            'rgba(29, 78, 216, 0.72)',
            'rgba(37, 99, 235, 0.72)',
            'rgba(14, 165, 233, 0.72)',
            'rgba(16, 185, 129, 0.72)',
            'rgba(245, 158, 11, 0.72)',
            'rgba(239, 68, 68, 0.72)',
            'rgba(190, 24, 93, 0.72)'
          ],
          borderRadius: 8
        }
      ]
    },
    sections
  };
}

function buildRenewalFinancialMetrics(comprobanteRows, filters = {}) {
  const renewalSales = (comprobanteRows || []).filter((row) => (
    normalizeText(row.tipo) === 'venta'
    && isRenewalProduct(row.producto_format)
  ));
  const renewalSaleGhlids = new Set(renewalSales.map((row) => String(row.ghlid || '').trim()).filter(Boolean));
  const renewalCashRows = (comprobanteRows || []).filter((row) => {
    const rowType = normalizeText(row.tipo);
    if (rowType === 'venta') {
      return isRenewalProduct(row.producto_format);
    }
    if (rowType !== 'cobranza') return false;
    const ghlid = String(row.ghlid || '').trim();
    return Boolean(ghlid) && renewalSaleGhlids.has(ghlid);
  });

  const facturacionRows = renewalSales.filter((row) => isDateInRange(row.f_venta, filters));
  const cashRows = renewalCashRows.filter((row) => isDateInRange(row.f_acreditacion, filters));
  const pendingRows = renewalSales.filter((row) => isDateInRange(row.f_venta, filters));
  const countRows = renewalSales.filter((row) => isDateInRange(row.f_venta, filters));

  const totals = {
    facturacion: facturacionRows.reduce((sum, row) => sum + Number(row.facturacion || 0), 0),
    cashCollected: cashRows.reduce((sum, row) => sum + Number(row.cash_collected || 0), 0),
    pendiente: pendingRows.reduce((sum, row) => {
      const facturacion = Number(row.facturacion || 0);
      const cashCollected = Number(row.cash_collected_total || row.cash_collected || 0);
      return sum + Math.max(facturacion - cashCollected, 0);
    }, 0),
    cantidad: countRows.length
  };

  const metrics = [
    buildMetricRow({
      key: 'renewal_facturacion',
      label: 'Facturacion de renovaciones',
      value: formatCurrency(totals.facturacion),
      base: `${formatInteger(facturacionRows.length)} comprobantes de venta con producto de renovacion dentro del rango`,
      note: 'Base comprobantes. Ubico la venta por fecha de venta.',
      dateLabel: '"f_venta"',
      fieldsLabel: '"tipo", "producto_format", "facturacion", "f_venta"',
      logic: 'Suma "facturacion" de comprobantes donde "tipo" = "Venta" y "producto_format" contiene "renovac". La métrica se interpreta con base de fecha de venta.'
    }),
    buildMetricRow({
      key: 'renewal_cash',
      label: 'Cash collected de renovaciones',
      value: formatCurrency(totals.cashCollected),
      base: `${formatInteger(cashRows.length)} acreditaciones de ventas de renovacion dentro del rango`,
      note: 'Base comprobantes. Sumo acreditaciones reales de ventas y cobranzas ligadas a renovaciones.',
      dateLabel: '"f_acreditacion"',
      fieldsLabel: '"tipo", "producto_format", "cash_collected_total", "cash_collected", "f_acreditacion"',
      logic: 'Suma "cash_collected" de comprobantes acreditados dentro del rango. Entra la venta de renovación y también cualquier cobranza vinculada por "ghlid" a una venta cuyo "producto_format" contiene "renovac".'
    }),
    buildMetricRow({
      key: 'renewal_pending',
      label: 'Lo pendiente de renovaciones',
      value: formatCurrency(totals.pendiente),
      base: `${formatInteger(pendingRows.length)} ventas de renovacion dentro del rango`,
      note: 'Lo calculo como facturacion menos cash total acumulado, nunca por debajo de cero, sobre ventas filtradas por fecha de venta.',
      dateLabel: '"f_venta" para ubicar la venta + saldo pendiente actual',
      fieldsLabel: '"facturacion", "cash_collected_total", "cash_collected", "f_venta"',
      logic: 'Calcula "lo pendiente" como max("facturacion" - cash total acumulado, 0) para cada venta de renovación y suma ese saldo sobre las ventas cuya "f_venta" cae dentro del rango.'
    }),
    buildMetricRow({
      key: 'renewal_count_money',
      label: 'Cantidad de renovaciones monetizadas',
      value: formatInteger(totals.cantidad),
      base: `${formatInteger(countRows.length)} ventas de renovacion dentro del rango`,
      note: 'Cuenta ventas de renovación detectadas por producto y filtradas por fecha de venta.',
      dateLabel: '"f_venta"',
      fieldsLabel: '"tipo", "producto_format", "f_venta"',
      logic: 'Cuenta comprobantes donde "tipo" = "Venta", "producto_format" contiene "renovac" y "f_venta" cae dentro del rango.'
    })
  ];

  return {
    metrics,
    totals
  };
}

function buildRenewalsPage(rows, context = {}) {
  const closerLookup = buildRenewalCloserLookup(rows, context);
  const today = new Date();
  const currentMonth = today.getUTCMonth();
  const currentYear = today.getUTCFullYear();
  const renewable30Rows = rows.filter((row) => {
    if (row.renewalCompletedDate) return false;
    const daysToRenewal = calendarDaysUntil(row.fecha_final);
    return daysToRenewal !== null && daysToRenewal >= 1 && daysToRenewal <= 30;
  });
  const renewable15Rows = rows.filter((row) => {
    if (row.renewalCompletedDate) return false;
    const daysToRenewal = calendarDaysUntil(row.fecha_final);
    return daysToRenewal !== null && daysToRenewal >= 1 && daysToRenewal <= 15;
  });
  const overdueUnrenewedRows = rows.filter((row) => {
    if (row.renewalCompletedDate) return false;
    const daysToRenewal = calendarDaysUntil(row.fecha_final);
    return daysToRenewal !== null && daysToRenewal <= 0;
  });
  const overdueCurrentMonthRows = overdueUnrenewedRows.filter((row) => (
    row.finalDate instanceof Date
    && row.finalDate.getUTCFullYear() === currentYear
    && row.finalDate.getUTCMonth() === currentMonth
  ));
  const renewedRows = rows.filter((row) => row.renewalCompletedDate);
  const renewable30Ids = new Set(renewable30Rows.map((row) => row.id));
  const renewable15Ids = new Set(renewable15Rows.map((row) => row.id));
  const renewalFinancials = buildRenewalFinancialMetrics(context.comprobanteRows || [], context.filters || {});

  const monthBuckets = new Map();
  rows.forEach((row) => {
    if (!row.finalDate) return;
    const monthKey = `${row.finalDate.getUTCFullYear()}-${String(row.finalDate.getUTCMonth() + 1).padStart(2, '0')}`;
    if (!monthBuckets.has(monthKey)) {
      monthBuckets.set(monthKey, {
        label: row.finalDate.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' }),
        renewable30: 0,
        renewable15: 0,
        renewed: 0
      });
    }
    const bucket = monthBuckets.get(monthKey);
    if (renewable30Ids.has(row.id)) bucket.renewable30 += 1;
    if (renewable15Ids.has(row.id)) bucket.renewable15 += 1;
    if (row.renewalCompletedDate) bucket.renewed += 1;
  });

  const sortedMonths = [...monthBuckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-8);

  const detailColumns = ['Cliente', 'Closer', 'Fecha final', 'Dias al cierre', 'GHL'];
  const toDetailRows = (detailRows) => detailRows
    .map((row) => {
      const daysToRenewal = calendarDaysUntil(row.fecha_final);
      const closer = resolveRenewalCloser(row, closerLookup);
      return [
        createContactCell(row.nombre || 'Sin nombre', row.ghlid || ''),
        closer,
        formatDate(row.fecha_final),
        daysToRenewal === null ? '-' : formatInteger(daysToRenewal),
        createGhlLinkCell(row.ghlid || '', 'Ir a GHL')
      ];
    })
    .sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'es') || String(a[2]).localeCompare(String(b[2])) || String(a[0]?.label || '').localeCompare(String(b[0]?.label || ''), 'es'));

  const renewedDetailColumns = ['Cliente', 'Closer', 'Fecha final', 'Fecha renovacion', 'GHL'];
  const renewedDetailRows = renewedRows
    .map((row) => {
      const closer = resolveRenewalCloser(row, closerLookup);
      return [
        createContactCell(row.nombre || 'Sin nombre', row.ghlid || ''),
        closer,
        formatDate(row.fecha_final),
        formatDate(row.fecha_final_renovacion),
        createGhlLinkCell(row.ghlid || '', 'Ir a GHL')
      ];
    })
    .sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'es') || String(a[3]).localeCompare(String(b[3])) || String(a[0]?.label || '').localeCompare(String(b[0]?.label || ''), 'es'));

  const operationalMetrics = [
    buildMetricRow({
      key: 'renewable_30d',
      label: 'Clientes proximos a entrar a etapa de renovacion 30 dias',
      value: formatInteger(renewable30Rows.length),
      base: `${formatInteger(rows.length)} clientes totales`,
      note: 'La ventana 30D se reconstruye por fecha final para no depender de flags desactualizados.',
      dateLabel: '"fecha_final" comparada contra hoy',
      fieldsLabel: '"fecha_final", "fecha_final_renovacion"',
      logic: 'Cuenta clientes no renovados cuya "fecha_final" cae entre mañana y los próximos 30 días inclusive.',
      detailColumns,
      detailRows: toDetailRows(renewable30Rows)
    }),
    buildMetricRow({
      key: 'renewable_15d',
      label: 'Clientes en etapa de renovacion 15 dias',
      value: formatInteger(renewable15Rows.length),
      base: `${formatInteger(rows.length)} clientes totales`,
      note: 'La ventana 15D se reconstruye por fecha final para seguir la misma base que Notion.',
      dateLabel: '"fecha_final" comparada contra hoy',
      fieldsLabel: '"fecha_final", "fecha_final_renovacion"',
      logic: 'Cuenta clientes no renovados cuya "fecha_final" cae entre mañana y los próximos 15 días inclusive.',
      detailColumns,
      detailRows: toDetailRows(renewable15Rows)
    }),
    buildMetricRow({
      key: 'renewals_completed',
      label: 'Cantidad de renovaciones',
      value: formatInteger(renewedRows.length),
      base: `${formatInteger(rows.length)} clientes totales`,
      note: 'Cuenta renovaciones cerradas con fecha registrada.',
      dateLabel: '"fecha_final_renovacion"',
      fieldsLabel: '"fecha_final_renovacion"',
      logic: 'Cuenta clientes con fecha válida en "fecha_final_renovacion".',
      detailColumns: renewedDetailColumns,
      detailRows: renewedDetailRows
    }),
    buildMetricRow({
      key: 'renewals_overdue',
      label: 'Clientes ya vencidos sin renovar',
      value: formatInteger(overdueUnrenewedRows.length),
      base: `${formatInteger(rows.length)} clientes totales`,
      note: 'Incluye también los que vencen hoy para que no queden mezclados en 15 y 30 días.',
      dateLabel: '"fecha_final" menor o igual a hoy',
      fieldsLabel: '"fecha_final", "fecha_final_renovacion"',
      logic: 'Cuenta clientes no renovados cuya "fecha_final" ya quedó atrás o vence hoy.',
      detailColumns,
      detailRows: toDetailRows(overdueUnrenewedRows)
    }),
    buildMetricRow({
      key: 'renewals_overdue_current_month',
      label: 'Vencidos este mes',
      value: formatInteger(overdueCurrentMonthRows.length),
      base: `${formatInteger(overdueUnrenewedRows.length)} clientes vencidos sin renovar`,
      note: 'Recorta solo los vencidos del mes calendario actual que todavía no renovaron.',
      dateLabel: '"fecha_final" en el mes actual y menor o igual a hoy',
      fieldsLabel: '"fecha_final", "fecha_final_renovacion"',
      logic: 'Cuenta clientes no renovados cuya "fecha_final" pertenece al mes actual y ya quedó atrás o vence hoy.',
      detailColumns,
      detailRows: toDetailRows(overdueCurrentMonthRows)
    })
  ];

  const definitionMetrics = renewalFinancials.metrics;

  const metrics = [...operationalMetrics, ...definitionMetrics];

  const sections = [
    {
      title: 'Indicadores Monetarios de Renovaciones',
      description: 'Base comprobantes para productos cuyo "producto_format" contiene "renovac".',
      columns: ['Indicador', 'Valor', 'Base actual', 'Lectura'],
      rows: definitionMetrics.map((metric) => [
        metric.label,
        metric.value,
        metric.base,
        metric.note
      ])
    }
  ];

  return {
    metrics,
    tableMetrics: operationalMetrics,
    kpiKeys: ['renewable_30d', 'renewable_15d', 'renewals_completed', 'renewals_overdue', 'renewals_overdue_current_month'],
    chart: {
      title: 'Embudo de Renovación',
      description: 'Lectura rápida de la base renovable, cierres, vencidos y el recorte del mes actual.',
      labels: ['30 dias', '15 dias', 'Renovadas', 'Vencidas', 'Vencidas este mes'],
      datasets: [
        {
          label: 'Clientes',
          data: [
            renewable30Rows.length,
            renewable15Rows.length,
            renewedRows.length,
            overdueUnrenewedRows.length,
            overdueCurrentMonthRows.length
          ],
          backgroundColor: [
            'rgba(37, 99, 235, 0.72)',
            'rgba(59, 130, 246, 0.72)',
            'rgba(16, 185, 129, 0.72)',
            'rgba(239, 68, 68, 0.72)',
            'rgba(245, 158, 11, 0.72)'
          ],
          borderRadius: 8
        }
      ]
    },
    sections
  };
}

const PAGE_BUILDERS = {
  tiempo: buildTimePage,
  situacion: buildSituationPage,
  renovaciones: buildRenewalsPage
};

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const existing = Array.from(document.scripts || []).find((script) => script.src === src);
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve();
        return;
      }

      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`No pude cargar ${src}`)), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve();
    }, { once: true });
    script.addEventListener('error', () => reject(new Error(`No pude cargar ${src}`)), { once: true });
    document.head.appendChild(script);
  });
}

async function ensureMetricasApi() {
  if (window.metricasApi?.fetchAllRows) return window.metricasApi;
  await loadScriptOnce('/js/api/http.js');
  await loadScriptOnce('/js/api/metricas.api.js');

  if (!window.metricasApi?.fetchAllRows) {
    throw new Error('No se pudo inicializar metricasApi para cargar CSM.');
  }

  return window.metricasApi;
}

async function initCsmPage() {
  const pageKey = document.body.dataset.csmPage;
  const builder = PAGE_BUILDERS[pageKey];
  const status = document.getElementById('status');

  if (!builder) return;

  if (pageKey === 'renovaciones') {
    setupRenewalFilters();
  }

  async function loadPage() {
    status.textContent = 'Cargando metricas de CSM...';

    try {
      const api = await ensureMetricasApi();
      const filters = pageKey === 'renovaciones' ? getRenewalFilters() : getCsmPeriodFilters();

      if (pageKey === 'renovaciones' && filters.from && filters.to && filters.from > filters.to) {
        status.textContent = 'La fecha desde no puede ser mayor a la fecha hasta.';
        return;
      }

      const [csmResponse, comprobantesResponse, leadsResponse] = await Promise.all([
        api.fetchAllRows('csm', { limit: 1000 }),
        pageKey === 'renovaciones'
          ? api.fetchAllRows('comprobantes', { limit: 1000 })
          : Promise.resolve([]),
        pageKey === 'renovaciones'
          ? api.fetchAllRows('leads_raw', { limit: 1000 })
          : Promise.resolve([])
      ]);
      const csmRows = Array.isArray(csmResponse) ? csmResponse : (csmResponse.rows || []);
      const comprobanteRows = Array.isArray(comprobantesResponse) ? comprobantesResponse : (comprobantesResponse.rows || []);
      const leadRows = Array.isArray(leadsResponse) ? leadsResponse : (leadsResponse.rows || []);
      const enrichedRows = enrichRows(csmRows);

      if (pageKey !== 'renovaciones' && !csmPeriodFiltersInitialized) {
        setupCsmPeriodFilters(enrichedRows);
      }

      const rows = pageKey === 'renovaciones'
        ? enrichedRows
        : filterRowsByPayAccessPeriod(enrichedRows, filters);

      const page = builder(rows, {
        comprobanteRows,
        leadRows,
        filters
      });
      const infoMap = Object.fromEntries(page.metrics.map((metric) => [metric.key, metric.info]));

      renderKpiCards(page.metrics, page.kpiKeys, infoMap);
      renderChart(page.chart, infoMap);
      renderMetricsTable(page.tableMetrics || page.metrics, infoMap);
      renderSections(page.sections, infoMap);

      if (pageKey === 'renovaciones') {
        const params = new URLSearchParams(window.location.search);
        params.set('desde', filters.from || '');
        params.set('hasta', filters.to || '');
        window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
        status.textContent = `Base actual: ${formatInteger(rows.length)} registros de "csm" | rango monetario ${filters.from || 'sin desde'} a ${filters.to || 'sin hasta'}. Facturacion, pendiente y cantidad usan fecha de venta; cash usa fecha de acreditacion.`;
      } else {
        const params = new URLSearchParams(window.location.search);
        params.set('anio', filters.year || '');
        params.set('mes', filters.month || '');
        window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
        status.textContent = `Base actual: ${formatInteger(rows.length)} registros de "csm" filtrados por "f_pago_con_acceso" en ${describeCsmPeriod(filters)}.`;
      }
    } catch (error) {
      document.getElementById('kpiContainer').innerHTML = '';
      document.getElementById('tableContainer').innerHTML = '<div class="table-wrap csm-table-wrap"><div class="report-empty">No se pudieron cargar las metricas de CSM.</div></div>';
      document.getElementById('detailContainer').innerHTML = '';
      status.textContent = error.message || 'No se pudieron cargar las metricas de CSM.';
    }
  }

  if (pageKey === 'renovaciones') {
    document.getElementById('reload')?.addEventListener('click', loadPage);
    document.getElementById('desde')?.addEventListener('change', loadPage);
    document.getElementById('hasta')?.addEventListener('change', loadPage);
  } else {
    document.getElementById('reload')?.addEventListener('click', loadPage);
    document.getElementById('csmYear')?.addEventListener('change', loadPage);
    document.getElementById('csmMonth')?.addEventListener('change', loadPage);
  }

  await loadPage();
}

initCsmPage();
