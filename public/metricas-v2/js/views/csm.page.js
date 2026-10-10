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
const CSM_EVENT_DATE_FIELDS = [
  'f_pago_con_acceso',
  'f_acceso',
  'f_onboarding',
  'f_diagnostico',
  'f_costos_1',
  'f_costos_2',
  'f_eerr_economico',
  'f_eerr_financiero',
  'f_cashflow'
];
const CSM_SESSION_DEFINITIONS = [
  { key: 'diagnosis', label: 'Diagnóstico', field: 'f_diagnostico' },
  { key: 'costs_1', label: 'Costos 1', field: 'f_costos_1' },
  { key: 'economic', label: 'Económica', field: 'f_eerr_economico' },
  { key: 'financial', label: 'Financiera', field: 'f_eerr_financiero' },
  { key: 'cashflow', label: 'Cashflow', field: 'f_cashflow' }
];
const CSM_MODULE_TRAFFIC_DEFINITIONS = [
  { key: 'm1', tab: 'M1', label: 'Planificación y gestión del tiempo', field: 'modulo_1', yellowDays: 7, redDays: 14 },
  { key: 'm2', tab: 'M2', label: 'Estructura de costos y precios', field: 'modulo_2', yellowDays: 14, redDays: 21 },
  { key: 'm3', tab: 'M3', label: 'Estado de Resultados Económicos', field: 'modulo_3', yellowDays: 14, redDays: 21 },
  { key: 'm4', tab: 'M4', label: 'EERR – Análisis', field: 'modulo_4', yellowDays: 7, redDays: 14 },
  { key: 'm5', tab: 'M5', label: 'Presupuesto Económico', field: 'modulo_5', yellowDays: null, redDays: null },
  { key: 'm6', tab: 'M6', label: 'Estado de Resultados Financieros', field: 'modulo_6', yellowDays: 14, redDays: 21 },
  { key: 'm7', tab: 'M7', label: 'A puro Cashflow', field: 'modulo_7', yellowDays: 14, redDays: 21 },
  { key: 'p1', tab: 'P1', label: 'Material libre · PRIMA', field: 'modulo_8', yellowDays: null, redDays: null },
  { key: 'p2', tab: 'P2', label: 'Material libre · Grabaciones', field: 'modulo_9', yellowDays: null, redDays: null },
  { key: 'p3', tab: 'P3', label: 'Material libre · Pilares del Negocio', field: 'modulo_10', yellowDays: null, redDays: null }
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

function calendarDaySpan(start, end) {
  const startDay = parseDateAsLocalDay(start);
  const endDay = parseDateAsLocalDay(end);
  if (!startDay || !endDay) return null;
  const days = Math.round((endDay.getTime() - startDay.getTime()) / 86400000);
  return days >= 0 ? days + 1 : null;
}

function getCurrentModuleField(row) {
  return [...CSM_MODULE_TRAFFIC_DEFINITIONS]
    .reverse()
    .find((definition) => Boolean(row?.[definition.field]))?.field || '';
}

function buildModuleTraffic(rows, today = new Date()) {
  const todayDay = startOfLocalDay(today) || new Date();
  return CSM_MODULE_TRAFFIC_DEFINITIONS.map((definition) => {
    const hasTrafficLight = Number.isFinite(definition.yellowDays) && Number.isFinite(definition.redDays);
    const clients = dedupeClientRows(rows)
      .map((row) => {
        if (getCurrentModuleField(row) !== definition.field) return null;
        const startValue = row?.[definition.field] || '';
        if (!startValue) return null;

        const days = calendarDaySpan(startValue, todayDay);
        if (days === null) return null;

        let status = 'excluded';
        if (hasTrafficLight) {
          if (days >= definition.redDays) status = 'red';
          else if (days >= definition.yellowDays) status = 'yellow';
          else status = 'on-track';
        }

        return {
          nombre: row?.nombre || 'Sin nombre',
          ghlid: row?.ghlid || '',
          startDate: toDateOnly(startValue),
          days,
          status,
          completed: false
        };
      })
      .filter(Boolean)
      .sort((left, right) => right.days - left.days || left.nombre.localeCompare(right.nombre, 'es'));

    return {
      ...definition,
      sourceRows: rows,
      hasTrafficLight,
      clients,
      yellow: clients.filter((client) => client.status === 'yellow'),
      red: clients.filter((client) => client.status === 'red'),
      onTrack: clients.filter((client) => client.status === 'on-track'),
      completed: clients.filter((client) => client.completed)
    };
  });
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
    CSM_EVENT_DATE_FIELDS.forEach((field) => {
      const period = getYearMonthFromValue(row[field]);
      if (period?.year) yearSet.add(period.year);
    });
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
  const params = new URLSearchParams(window.location.search);
  const defaults = getDefaultCsmPeriod();
  return {
    year: document.getElementById('csmYear')?.value || params.get('anio') || defaults.year,
    month: document.getElementById('csmMonth')?.value || params.get('mes') || defaults.month
  };
}

function filterRowsByPayAccessPeriod(rows, filters = {}) {
  return filterRowsByDatePeriod(rows, 'f_pago_con_acceso', filters);
}

function filterRowsByDatePeriod(rows, field, filters = {}) {
  const year = String(filters.year || '').trim();
  const month = String(filters.month || '').trim();

  return (rows || []).filter((row) => {
    const period = getYearMonthFromValue(row?.[field]);
    if (!period?.year) return false;
    if (year && period.year !== year) return false;
    if (month && month !== 'all' && period.month !== String(Number(month))) return false;
    return true;
  });
}

function getClientIdentity(row, index = 0) {
  const ghlid = String(row?.ghlid || '').trim().toLowerCase();
  if (ghlid) return `ghl:${ghlid}`;

  const id = String(row?.id || '').trim().toLowerCase();
  if (id) return `id:${id}`;

  const mail = String(row?.mail || '').trim().toLowerCase();
  if (mail) return `mail:${mail}`;

  const phone = String(row?.telefono || '').replace(/\D/g, '');
  if (phone) return `phone:${phone}`;

  return `row:${index}`;
}

function dedupeClientRows(rows) {
  const byIdentity = new Map();

  (rows || []).forEach((row, index) => {
    const identity = getClientIdentity(row, index);
    const existing = byIdentity.get(identity);
    if (!existing) {
      byIdentity.set(identity, row);
      return;
    }

    const existingUpdated = parseDate(existing.updated_at || existing.last_edited_time || existing.created_at);
    const candidateUpdated = parseDate(row.updated_at || row.last_edited_time || row.created_at);
    if (candidateUpdated && (!existingUpdated || candidateUpdated.getTime() >= existingUpdated.getTime())) {
      byIdentity.set(identity, row);
    }
  });

  return [...byIdentity.values()];
}

function getSupportStatus(row) {
  const access = normalizeText(row?.acceso);
  if (access === 'acceso') return 'active';
  if (access === 'sin acceso') return 'inactive';
  return 'unknown';
}

function getMonthLabel(monthNumber) {
  return MONTH_FILTER_OPTIONS.find((option) => option.value === String(Number(monthNumber)))?.label || `Mes ${monthNumber}`;
}

function buildMonthlyEntryStats(rows, year) {
  return Array.from({ length: 12 }, (_, index) => {
    const month = String(index + 1);
    const monthRows = filterRowsByDatePeriod(rows, 'f_pago_con_acceso', { year, month });
    const uniqueRows = dedupeClientRows(monthRows);
    const previousMonthRows = index === 0
      ? filterRowsByDatePeriod(rows, 'f_pago_con_acceso', { year: String(Number(year) - 1), month: '12' })
      : filterRowsByDatePeriod(rows, 'f_pago_con_acceso', { year, month: String(index) });
    const previousCount = dedupeClientRows(previousMonthRows).length;
    const variation = previousCount
      ? ((uniqueRows.length - previousCount) / previousCount) * 100
      : null;

    return {
      month,
      label: getMonthLabel(month),
      count: uniqueRows.length,
      registrations: monthRows.length,
      active: uniqueRows.filter((row) => row.isActive).length,
      inactive: uniqueRows.filter((row) => row.supportStatus === 'inactive').length,
      unknown: uniqueRows.filter((row) => row.supportStatus === 'unknown').length,
      variation
    };
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

function isPausedActivity(row) {
  return normalizeText(row?.pausa) === 'en pausa';
}

function isInCurrentModuleCircuit(row) {
  return Boolean(row?.isActive) && !isPausedActivity(row) && !isAbandonmentActivity(row);
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
  const rawLabel = getRawModelLabel(value);
  const text = String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (rawLabel === 'Sin rubro') return 'Sin rubro';
  if (text.includes('reventa')) return 'Reventa';
  if (text.includes('gastro')) return 'Gastronomicos';
  if (text.includes('fabric')) return 'Fabricantes';
  if (text.includes('serv')) return 'Servicios';
  if (text.includes('otro')) return 'Otros';
  return 'Otros / Sin clasificar';
}

function getRawModelLabel(value) {
  const label = String(value || '').trim();
  return label || 'Sin rubro';
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

function getProgramEntryDateValue(row) {
  return row?.f_pago_con_acceso || row?.f_acceso || row?.f_onboarding || row?.created_at || '';
}

function getProgramEntryYear(row) {
  const date = toDateOnly(getProgramEntryDateValue(row));
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(0, 4) : 'Sin fecha';
}

function hasExplicitEngagement(row) {
  return Object.prototype.hasOwnProperty.call(row || {}, 'engagement')
    && row.engagement !== null
    && row.engagement !== undefined
    && String(row.engagement).trim() !== '';
}

function getEngagementState(row, today = new Date()) {
  if (hasExplicitEngagement(row)) {
    return {
      engaged: asTruthy(row.engagement),
      source: 'engagement',
      date: '',
      rawValue: row.engagement
    };
  }

  if (!row.engagementDate) {
    return {
      engaged: false,
      source: 'sin engagement',
      date: '',
      rawValue: ''
    };
  }

  const elapsedDays = daysBetween(row.engagementDate, today);
  const engaged = elapsedDays !== null && elapsedDays >= 0 && elapsedDays <= 30;
  return {
    engaged,
    source: 'ultima_fecha_de_avance / ultima_respuesta',
    date: toDateOnly(row.engagementDate),
    rawValue: engaged ? 'reciente' : 'fuera de 30 dias'
  };
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
    const diagnosisDateRaw = parseDate(row.f_diagnostico);
    const sessionDates = CSM_SESSION_DEFINITIONS.map((session) => parseDate(row[session.field]));
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
      modelRaw: getRawModelLabel(row.modelo_negocio),
      accessDate,
      payAccessDate,
      payReferenceDate,
      unitStartDate: accessDate || payAccessDate || onboardingDate,
      onboardingDate,
      payToOnboardingMetric,
      payToOnboardingSource: 'pago_a_onbo',
      payToDiagnosisMetric,
      diagnosisUnder7Flag,
      diagnosisDate,
      sessionDates,
      successDate,
      abandonDate,
      finalDate,
      renewalCompletedDate,
      advanceDate,
      responseDate,
      firstResultDate,
      moduleDates,
      npsValues,
      supportStatus: getSupportStatus(row),
      isActive: getSupportStatus(row) === 'active',
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
  if (!wrap) return;
  const selected = metrics.filter((metric) => kpiKeys.includes(metric.key));

  wrap.hidden = false;
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
  if (!container) return;
  container.hidden = false;
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
  if (!container) return;
  container.hidden = false;
  container.classList.remove('csm-section-directory');
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
            <tr>${row.map((cell) => `<td>${renderDetailCell(cell)}</td>`).join('')}</tr>
          `).join('') : '<tr><td colspan="' + section.columns.length + '">Sin base suficiente.</td></tr>'}
        </tbody>
        ${Array.isArray(section.totalRow) ? `
          <tfoot><tr>${section.totalRow.map((cell, index) => `<th${index === 0 ? ' scope="row"' : ''}>${renderDetailCell(cell)}</th>`).join('')}</tr></tfoot>
        ` : ''}
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

function sectionKey(section, index = 0) {
  if (section?.key) return section.key;
  return normalizeText(section?.title)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || `cuadro-${index + 1}`;
}

function resetCsmResultContainers() {
  const kpiContainer = document.getElementById('kpiContainer');
  const tableContainer = document.getElementById('tableContainer');
  const detailContainer = document.getElementById('detailContainer');
  const chartPanel = document.getElementById('csmChart')?.closest('.chart-panel');

  if (kpiContainer) {
    kpiContainer.hidden = true;
    kpiContainer.innerHTML = '';
  }
  if (tableContainer) {
    tableContainer.hidden = true;
    tableContainer.innerHTML = '';
  }
  if (detailContainer) {
    detailContainer.hidden = true;
    detailContainer.innerHTML = '';
    detailContainer.classList.remove('csm-section-directory');
  }
  if (chartPanel) chartPanel.hidden = true;
  if (csmChart) {
    csmChart.destroy();
    csmChart = null;
  }
}

function setCsmPageLoading(isLoading, message = '', options = {}) {
  const loading = document.getElementById('csmPageLoading');
  const loadingMessage = document.getElementById('csmPageLoadingMessage');
  const filterBar = document.getElementById('csmFilterBar');
  const status = document.getElementById('status');
  if (!loading) return;

  loading.hidden = !isLoading;
  loading.setAttribute('aria-busy', isLoading ? 'true' : 'false');
  if (loadingMessage && message) loadingMessage.textContent = message;
  if (filterBar) filterBar.hidden = isLoading || Boolean(options.hideFilters);
  if (status) status.hidden = isLoading || Boolean(options.hideStatus);
}

const CSM_DIRECTORY_GROUPS = {
  tiempo: [
    {
      key: 'diagnosticos',
      title: 'Diagnósticos',
      description: 'Realizados, tiempos de llegada, clasificación hasta o después de 7 días y pendientes.',
      metricKeys: ['diagnosis_total', 'diagnosis_under_7', 'diagnosis_over_7', 'pending_diagnosis', 'pay_to_diagnosis'],
      chart: {
        source: 'metrics',
        title: 'Diagnósticos del período',
        description: 'Realizados según plazo, casos sin clasificación e ingresos todavía pendientes.',
        keys: ['diagnosis_under_7', 'diagnosis_over_7', 'pending_diagnosis']
      }
    },
    {
      key: 'sesiones',
      title: 'Sesiones realizadas',
      description: 'Diagnóstico, Costos, Económica, Financiera y Cashflow según la fecha real de cada sesión.',
      metricPrefixes: ['session_'],
      sectionKeys: ['sesiones-realizadas'],
      chart: { source: 'page' }
    },
    {
      key: 'modulos',
      title: 'Módulos',
      description: 'Seguimiento de ingresos desde 2026. Excluye renovaciones, personalizados, sin acceso, pausas y abandonos.'
    },
    {
      key: 'tiempos-recorrido',
      title: 'Tiempos del recorrido',
      description: 'Tiempo hasta onboarding y días transcurridos entre las distintas sesiones.',
      metricKeys: ['pay_to_onboarding'],
      sectionKeys: ['dias-entre-sesiones'],
      chart: {
        source: 'section',
        sectionKey: 'dias-entre-sesiones',
        title: 'Días promedio entre sesiones',
        description: 'Promedio de días transcurridos entre cada etapa consecutiva.',
        labelIndex: 0,
        valueIndex: 1
      }
    },
    {
      key: 'personas',
      title: 'Desglose por persona',
      description: 'Detalle individual de las sesiones realizadas durante el período elegido.',
      sectionKeys: ['desglose-persona'],
      chart: {
        source: 'section',
        sectionKey: 'desglose-persona',
        title: 'Sesiones por persona',
        description: 'Personas con mayor cantidad de sesiones registradas durante el período.',
        labelIndex: 0,
        valueIndex: -1,
        limit: 12
      }
    },
    {
      key: 'cobertura-avance',
      title: 'Cobertura y avance',
      description: 'Calidad de carga de fechas y avance de los clientes por los módulos.',
      sectionKeys: ['cobertura-fechas', 'avance-modulos'],
      chart: {
        source: 'section',
        sectionKey: 'cobertura-fechas',
        title: 'Cobertura de fechas',
        description: 'Porcentaje de clientes con la fecha de cada hito correctamente cargada.',
        labelIndex: 0,
        valueIndex: 3
      }
    }
  ],
  situacion: [
    {
      key: 'estado-actual',
      title: 'Estado actual de clientes',
      description: 'Clientes únicos, activos, sin acceso, sin información y registros a revisar.',
      metricKeys: ['total_clients', 'active_support', 'inactive_support', 'unknown_support', 'identity_quality'],
      sectionKeys: ['desglose-persona'],
      chart: {
        source: 'metrics',
        title: 'Estado actual de acceso',
        description: 'Distribución actual entre clientes activos, sin acceso y con acceso sin informar.',
        keys: ['active_support', 'inactive_support', 'unknown_support']
      }
    },
    {
      key: 'ingresos',
      title: 'Ingresos de clientes',
      description: 'Nuevos ingresos, evolución mensual y distribución por año de ingreso.',
      metricKeys: ['new_entries'],
      sectionKeys: ['nuevos-ingresos-mes', 'clientes-anio-ingreso'],
      chart: { source: 'page' }
    },
    {
      key: 'salud-resultados',
      title: 'Salud y resultados',
      description: 'Engagement, abandonos, casos de éxito, primeros resultados, alertas y devoluciones.',
      metricKeys: ['abandonments', 'avg_days_to_abandon', 'engagement', 'success_cases', 'nightmare_clients', 'first_result_clients', 'insatisfied_clients', 'refund_requests', 'refunds_completed'],
      chart: {
        source: 'metrics',
        title: 'Salud y resultados del programa',
        description: 'Volumen de clientes por indicador de salud, avance y alertas.',
        keys: ['engagement', 'success_cases', 'first_result_clients', 'abandonments', 'nightmare_clients', 'insatisfied_clients', 'refund_requests', 'refunds_completed']
      }
    },
    {
      key: 'nps',
      title: 'NPS y recomendaciones',
      description: 'NPS promedio por unidad y porcentaje de clientes que recomiendan el programa.',
      metricKeys: ['nps_by_unit', 'recommendations_pct'],
      sectionTitles: ['NPS Promedio por Unidad'],
      chart: {
        source: 'section',
        sectionTitle: 'NPS Promedio por Unidad',
        title: 'NPS promedio por unidad',
        description: 'Evolución del promedio NPS disponible en cada unidad.',
        labelIndex: 0,
        valueIndex: 1
      }
    },
    {
      key: 'segmentacion',
      title: 'Segmentación por rubro',
      description: 'Distribución de clientes y resultados según rubro o modelo de negocio.',
      sectionKeys: ['clientes-rubro'],
      sectionTitles: ['Modelos de Negocio'],
      chart: {
        source: 'section',
        sectionKey: 'clientes-rubro',
        title: 'Clientes por rubro',
        description: 'Cantidad de clientes únicos por rubro o modelo de negocio.',
        labelIndex: 0,
        valueIndex: 1,
        limit: 12
      }
    },
    {
      key: 'sesiones',
      title: 'Sesiones del período',
      description: 'Sesiones mensuales, acumulado anual y total histórico por tipo de sesión.',
      sectionKeys: ['sesiones-periodo'],
      chart: {
        source: 'section',
        sectionKey: 'sesiones-periodo',
        title: 'Sesiones realizadas en el período',
        description: 'Cantidad mensual registrada por cada tipo de sesión.',
        labelIndex: 0,
        valueIndex: 1
      }
    }
  ]
};

function getCsmDirectoryGroups(pageKey) {
  return CSM_DIRECTORY_GROUPS[pageKey] || [];
}

function getGroupMetrics(page, group) {
  const metrics = page.tableMetrics || page.metrics || [];
  const exactKeys = new Set(group.metricKeys || []);
  return metrics.filter((metric) => (
    exactKeys.has(metric.key)
    || (group.metricPrefixes || []).some((prefix) => metric.key.startsWith(prefix))
  ));
}

function getGroupSections(page, group) {
  const exactKeys = new Set(group.sectionKeys || []);
  const exactTitles = new Set(group.sectionTitles || []);
  return (page.sections || []).filter((section, index) => (
    exactKeys.has(sectionKey(section, index)) || exactTitles.has(section.title)
  ));
}

function parseCsmChartNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = String(value ?? '').trim();
  const match = text.match(/-?\d[\d.]*(?:,\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0].replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function csmChartLabel(value) {
  if (value && typeof value === 'object') return String(value.label || value.value || 'Sin nombre');
  return String(value ?? 'Sin nombre');
}

function buildCsmGroupChart(page, group, selectedMetrics = []) {
  const chart = group?.chart;
  if (!chart) return null;
  if (chart.source === 'page') return page.chart || null;

  const palette = [
    'rgba(37, 99, 235, 0.76)',
    'rgba(14, 165, 233, 0.76)',
    'rgba(16, 185, 129, 0.76)',
    'rgba(139, 92, 246, 0.76)',
    'rgba(245, 158, 11, 0.76)',
    'rgba(239, 68, 68, 0.76)',
    'rgba(236, 72, 153, 0.76)',
    'rgba(6, 182, 212, 0.76)'
  ];
  let points = [];

  if (chart.source === 'metrics') {
    const sourceMetrics = selectedMetrics.length ? selectedMetrics : (page.metrics || []);
    const keys = new Set(chart.keys || []);
    points = sourceMetrics
      .filter((metric) => !keys.size || keys.has(metric.key))
      .map((metric) => ({ label: metric.label, value: parseCsmChartNumber(metric.value) }))
      .filter((point) => point.value !== null);
  } else if (chart.source === 'section') {
    const section = (page.sections || []).find((candidate, index) => (
      (chart.sectionKey && sectionKey(candidate, index) === chart.sectionKey)
      || (chart.sectionTitle && candidate.title === chart.sectionTitle)
    ));
    points = (section?.rows || [])
      .map((row) => {
        const valueIndex = chart.valueIndex < 0 ? row.length + chart.valueIndex : chart.valueIndex;
        return {
          label: csmChartLabel(row[chart.labelIndex || 0]),
          value: parseCsmChartNumber(row[valueIndex])
        };
      })
      .filter((point) => point.value !== null);
    if (chart.limit && points.length > chart.limit) {
      points = points.sort((a, b) => b.value - a.value).slice(0, chart.limit);
    }
  }

  if (!points.length) points = [{ label: 'Sin datos', value: 0 }];
  return {
    title: chart.title || group.title,
    description: chart.description || group.description,
    labels: points.map((point) => point.label),
    datasets: [{
      label: chart.datasetLabel || 'Valor',
      data: points.map((point) => point.value),
      backgroundColor: points.map((_, index) => palette[index % palette.length]),
      borderColor: points.map((_, index) => palette[index % palette.length].replace('0.76', '1')),
      borderWidth: 1,
      borderRadius: 8
    }],
    showLegend: false
  };
}

function renderCsmDirectory(pageKey, filters) {
  const container = document.getElementById('detailContainer');
  if (!container) return;
  const baseParams = {
    panel: pageKey,
    anio: filters.year || '',
    mes: filters.month || ''
  };
  const cards = getCsmDirectoryGroups(pageKey).map((group, index) => {
    const params = new URLSearchParams({
      ...baseParams,
      vista: 'grupo',
      grupo: group.key
    });
    return `
      <a class="csm-section-card" href="/views/csm-cuadro.html?${params.toString()}">
        <span class="csm-section-card-kicker">Área ${index + 1}</span>
        <h3>${escapeHtml(group.title)}</h3>
        <p>${escapeHtml(group.description)}</p>
        <strong>Ver métricas <span aria-hidden="true">→</span></strong>
      </a>
    `;
  });

  container.hidden = false;
  container.classList.add('csm-section-directory');
  container.innerHTML = cards.join('');
}

function renderModuleTrafficClient(client, tone) {
  const contactUrl = window.metricasGhl?.buildContactUrl?.(client.ghlid || '');
  const ghlLink = contactUrl
    ? `<a class="csm-module-ghl-link" href="${escapeHtml(contactUrl)}" target="_blank" rel="noopener noreferrer">Abrir en GHL <span aria-hidden="true">↗</span></a>`
    : '<span class="csm-module-ghl-link is-disabled">Sin vínculo GHL</span>';
  return `
    <article class="csm-module-client csm-module-client-${escapeHtml(tone)}">
      <div class="csm-module-client-main">
        <strong>${renderDetailCell(createContactCell(client.nombre, client.ghlid))}</strong>
        <span>En curso</span>
        ${ghlLink}
      </div>
      <div class="csm-module-client-days">${formatInteger(client.days)} <small>días</small></div>
      <div class="csm-module-client-dates">
        <span>Inicio <b>${escapeHtml(formatDate(client.startDate))}</b></span>
        <span>Hasta hoy <b>—</b></span>
      </div>
    </article>
  `;
}

function renderModuleTrafficPanel(module) {
  if (!module) return '<div class="report-empty">No hay información de módulos disponible.</div>';

  const thresholdMarkup = module.hasTrafficLight
    ? `
      <div class="csm-module-thresholds">
        <span class="is-on-track">En término: <b>${formatInteger(module.onTrack.length)}</b></span>
        <span class="is-yellow">Amarillo desde <b>${formatInteger(module.yellowDays)} días</b></span>
        <span class="is-red">Rojo desde <b>${formatInteger(module.redDays)} días</b></span>
      </div>
    `
    : '<div class="csm-module-outside-badge">Fuera del semáforo · acceso libre / no obligatorio</div>';

  if (!module.hasTrafficLight) {
    return `
      <div class="csm-module-panel-head">
        <div><span>${escapeHtml(module.tab)}</span><h3>${escapeHtml(module.label)}</h3></div>
        ${thresholdMarkup}
      </div>
      <div class="csm-module-neutral-list">
        ${module.clients.length
          ? module.clients.map((client) => renderModuleTrafficClient(client, 'neutral')).join('')
          : '<div class="report-empty">No hay clientes con inicio registrado para este módulo.</div>'}
      </div>
    `;
  }

  const alertColumn = (tone, title, rows) => `
    <section class="csm-module-alert-column is-${tone}">
      <header><span class="csm-module-alert-dot" aria-hidden="true"></span><h4>${title}</h4><b>${formatInteger(rows.length)}</b></header>
      <div class="csm-module-alert-list">
        ${rows.length
          ? rows.map((client) => renderModuleTrafficClient(client, tone)).join('')
          : `<div class="csm-module-alert-empty">Sin clientes en ${title.toLowerCase()}.</div>`}
      </div>
    </section>
  `;

  return `
    <div class="csm-module-panel-head">
      <div><span>${escapeHtml(module.tab)}</span><h3>${escapeHtml(module.label)}</h3></div>
      ${thresholdMarkup}
    </div>
    <div class="csm-module-alert-grid">
      ${alertColumn('yellow', 'Amarillo', module.yellow)}
      ${alertColumn('red', 'Rojo', module.red)}
    </div>
  `;
}

function renderModuleTraffic(modules) {
  const container = document.getElementById('detailContainer');
  if (!container) return;
  if (window.csmModuleDurations && modules?.[0]?.sourceRows) {
    container.hidden = false;
    container.classList.add('csm-module-durations');
    container.classList.remove('csm-section-directory');
    return window.csmModuleDurations.render(container, modules[0].sourceRows);
  }
  const availableModules = Array.isArray(modules) ? modules : [];
  const initialKey = availableModules.find((module) => module.red.length || module.yellow.length)?.key
    || availableModules[0]?.key
    || '';

  container.hidden = false;
  container.classList.remove('csm-section-directory');
  container.innerHTML = `
    <section class="csm-module-traffic">
      <div class="csm-module-traffic-head">
        <div>
          <span>Seguimiento operativo</span>
          <h3>Foto actual por módulo</h3>
          <p>Muestra el módulo actual según el último campo de módulo cargado. Los días se cuentan desde esa misma fecha; al cargar el módulo siguiente, el cliente pasa automáticamente a la pestaña siguiente. Sin acceso y En Pausa no se contabilizan.</p>
        </div>
        <div class="csm-module-traffic-legend" aria-label="Referencias del semáforo">
          <span class="is-yellow"><i></i> Amarillo</span>
          <span class="is-red"><i></i> Rojo</span>
        </div>
      </div>
      <div class="csm-module-tabs" role="tablist" aria-label="Módulos del programa">
        ${availableModules.map((module) => `
          <button
            type="button"
            role="tab"
            aria-selected="${module.key === initialKey ? 'true' : 'false'}"
            class="csm-module-tab${module.key === initialKey ? ' is-active' : ''}${module.hasTrafficLight ? '' : ' is-outside'}"
            data-csm-module-tab="${escapeHtml(module.key)}"
          >
            <b>${escapeHtml(module.tab)}</b>
            ${module.hasTrafficLight ? `<span>${formatInteger(module.yellow.length + module.red.length)} alertas</span>` : '<span>Libre</span>'}
          </button>
        `).join('')}
      </div>
      <div id="csmModuleTrafficPanel" class="csm-module-panel" role="tabpanel">
        ${renderModuleTrafficPanel(availableModules.find((module) => module.key === initialKey))}
      </div>
    </section>
  `;

  container.querySelectorAll('[data-csm-module-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      const selected = availableModules.find((module) => module.key === button.dataset.csmModuleTab);
      container.querySelectorAll('[data-csm-module-tab]').forEach((candidate) => {
        const active = candidate === button;
        candidate.classList.toggle('is-active', active);
        candidate.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      const panel = document.getElementById('csmModuleTrafficPanel');
      if (panel) panel.innerHTML = renderModuleTrafficPanel(selected);
    });
  });
}

function renderPeopleFollowup(source) {
 const target=document.getElementById('detailContainer');target.hidden=false;target.classList.add('csm-module-durations');
 const rows=dedupeClientRows(source);let query='',session='',status='all';
 target.innerHTML=`<div class="csm-duration-head"><div><h2>Sesiones por cliente</h2><p>Historial completo de sesiones. Buscá una persona o filtrá por una sesión realizada o pendiente.</p></div></div><div class="csm-followup-tools"><label>Cliente<input type="search" data-person-query placeholder="Nombre del cliente"></label><label>Sesión<select data-person-session><option value="">Todas</option>${CSM_SESSION_DEFINITIONS.map(s=>`<option value="${s.field}">${escapeHtml(s.label)}</option>`).join('')}</select></label><label>Estado<select data-person-status><option value="all">Todos</option><option value="done">Realizada</option><option value="pending">Pendiente</option></select></label></div><div data-person-table></div>`;
 function update(){const selected=session?[CSM_SESSION_DEFINITIONS.find(s=>s.field===session)]:CSM_SESSION_DEFINITIONS;const filtered=rows.filter(r=>String(r.nombre||'').toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es'))).filter(r=>status==='all'||(status==='done'?selected.every(s=>parseDate(r[s.field])):selected.some(s=>!parseDate(r[s.field])))).sort((a,b)=>String(a.nombre).localeCompare(String(b.nombre),'es'));target.querySelector('[data-person-table]').innerHTML=`<p>${filtered.length} clientes</p><div class="csm-duration-scroll"><table><thead><tr><th>Cliente</th>${CSM_SESSION_DEFINITIONS.map(s=>`<th>${escapeHtml(s.label)}</th>`).join('')}</tr></thead><tbody>${filtered.map(r=>`<tr><td>${r.ghlid?`<a target="_blank" rel="noopener noreferrer" href="https://app.gohighlevel.com/v2/location/WU2z8kl23Dr3IyBW1hv5/contacts/detail/${encodeURIComponent(r.ghlid)}">${escapeHtml(r.nombre||'Sin nombre')} ↗</a>`:escapeHtml(r.nombre||'Sin nombre')}</td>${CSM_SESSION_DEFINITIONS.map(s=>`<td><span class="csm-duration-tone ${parseDate(r[s.field])?'green':'yellow'}">${parseDate(r[s.field])?formatDate(r[s.field]):'Pendiente'}</span></td>`).join('')}</tr>`).join('')||'<tr><td colspan="6">Sin clientes con esos filtros</td></tr>'}</tbody></table></div>`;}
 target.querySelector('[data-person-query]').oninput=e=>{query=e.target.value;update();};target.querySelector('[data-person-session]').onchange=e=>{session=e.target.value;update();};target.querySelector('[data-person-status]').onchange=e=>{status=e.target.value;update();};update();
}
async function renderBusinessSegments(source) {
 const target=document.getElementById('detailContainer');target.hidden=false;target.classList.add('csm-module-durations');target.innerHTML='<p>Cargando segmentos…</p>';
 try{const response=await fetch('/api/metricas/csm-followup');if(!response.ok)throw Error('No se pudieron cargar los rubros');const {profiles}=await response.json(),byId=new Map(profiles.map(p=>[p.ghlid,p]));const rows=dedupeClientRows(source).map(r=>({...r,rubro:byId.get(r.ghlid)?.rubro||'Sin rubro informado',modelo:r.modelo_negocio||'Sin modelo informado'}));let dimension='modelo',selected='',query='';target.innerHTML='<h2>Clientes por modelo de negocio y rubro</h2><div class="csm-followup-tools"><label>Agrupar por<select data-segment-dimension><option value="modelo">Modelo de negocio</option><option value="rubro">Rubro</option></select></label><label>Buscar cliente<input data-segment-search type="search" placeholder="Nombre del cliente"></label></div><div class="csm-followup-stages" data-segments></div><div data-segment-clients></div>';
 function update(){const counts=new Map();rows.forEach(r=>counts.set(r[dimension],(counts.get(r[dimension])||0)+1));target.querySelector('[data-segments]').innerHTML=[...counts].sort((a,b)=>b[1]-a[1]).map(([label,count])=>`<button type="button" data-segment="${escapeHtml(label)}" aria-pressed="${selected===label}"><strong>${escapeHtml(label)}</strong><small>${count} clientes</small></button>`).join('');target.querySelectorAll('[data-segment]').forEach(b=>b.onclick=()=>{selected=selected===b.dataset.segment?'':b.dataset.segment;update();});const filtered=rows.filter(r=>(!selected||r[dimension]===selected)&&String(r.nombre||'').toLowerCase().includes(query.toLowerCase()));target.querySelector('[data-segment-clients]').innerHTML=`<p>${filtered.length} clientes · ${escapeHtml(selected||'Todos los segmentos')}</p><div class="csm-duration-scroll"><table><thead><tr><th>Cliente</th><th>Modelo de negocio</th><th>Rubro</th></tr></thead><tbody>${filtered.map(r=>`<tr><td><a href="https://app.gohighlevel.com/v2/location/WU2z8kl23Dr3IyBW1hv5/contacts/detail/${encodeURIComponent(r.ghlid||'')}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.nombre||'Sin nombre')}</a></td><td>${escapeHtml(r.modelo)}</td><td>${escapeHtml(r.rubro)}</td></tr>`).join('')}</tbody></table></div>`;}
 target.querySelector('[data-segment-dimension]').onchange=e=>{dimension=e.target.value;selected='';update();};target.querySelector('[data-segment-search]').oninput=e=>{query=e.target.value;update();};update();
 }catch(e){target.textContent=e.message;}
}

function renderChart(config, infoMap = {}) {
  const canvas = document.getElementById('csmChart');
  const panel = canvas?.closest('.chart-panel');
  if (!canvas || typeof Chart === 'undefined' || !config) return;

  if (panel) panel.hidden = false;

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
      scales: config.scales || {
        y: {
          beginAtZero: true
        }
      },
      plugins: {
        legend: {
          display: config.showLegend ?? config.datasets.length > 1
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
      if (!row.payReferenceDate || !row.diagnosisDate) return null;

      const elapsedDays = daysBetween(row.payReferenceDate, row.diagnosisDate);
      const normalizedElapsed = elapsedDays !== null && Number.isFinite(elapsedDays) ? elapsedDays : null;
      if (normalizedElapsed === null || normalizedElapsed < 0 || normalizedElapsed > 7) return null;

      return {
        nombre: row.nombre || 'Sin nombre',
        ghlid: row.ghlid || '',
        elapsedDays: normalizedElapsed,
        diagnosisDate: toDateOnly(row.diagnosisDate),
        payDate: toDateOnly(row.f_pago_con_acceso || row.f_acceso || ''),
        diagnosisUnder7Flag: row.diagnostico_7dias
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
          ? (row.unitStartDate || row.payReferenceDate || row.onboardingDate)
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
          ? (row.unitStartDate || row.payReferenceDate || row.onboardingDate)
          : row.moduleDates[index - 1];
        const value = daysBetween(previous, current);
        return value !== null && Number.isFinite(value) && value >= 0 ? formatDays(value) : '-';
      });
      return [createContactCell(row.nombre || 'Sin nombre', row.ghlid || ''), ...unitValues];
    })
    .sort((a, b) => String(a[0]?.label || '').localeCompare(String(b[0]?.label || ''), 'es'));

  const diagnosticUnder7 = diagnosisUnder7Rows.length;
  const diagnosticDateBase = activeProgramRows.filter((row) => row.payReferenceDate && row.diagnosisDate).length;
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
      base: `${formatInteger(diagnosticDateBase)} clientes con fecha de ingreso y "f_diagnostico" sin "abandono" en CSM`,
      fieldsLabel: '"f_pago_con_acceso" o "f_acceso", "f_diagnostico"',
      logic: 'Cantidad de clientes con fecha real de diagnóstico cargada que hicieron la sesión dentro de los primeros 7 días desde su ingreso. No usa "modulo_1" como reemplazo.',
      detailColumns: ['Cliente', 'Tiempo desde pago', 'Pago con acceso', 'Sesión diagnóstico', 'Diagnóstico 7 días'],
      detailRows: diagnosisUnder7Rows.map((row) => [
        createContactCell(row.nombre, row.ghlid),
        formatDays(row.elapsedDays),
        row.payDate || '-',
        row.diagnosisDate || '-',
        row.diagnosisUnder7Flag || '-'
      ])
    }),
    buildMetricRow({
      key: 'diagnosis_over_7',
      label: 'Cantidad de sesiones diagnóstico mayor a 7 días',
      value: formatInteger(diagnosticOver7),
      base: `${formatInteger(diagnosticUnder7Base)} clientes con fecha de ingreso y sin "abandono" en CSM`,
      fieldsLabel: '"f_pago_con_acceso" o "f_acceso", "f_diagnostico"',
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
      fieldsLabel: '"f_acceso" o "f_pago_con_acceso", "modulo_1" a "modulo_10"',
      logic: 'Promedio de días por unidad. Para Unidad 1 mide desde "f_acceso" cuando existe; si no, cae a "f_pago_con_acceso" u onboarding.',
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

function buildTimePageByEvent(cohortRows, context = {}) {
  const allRows = Array.isArray(context.allRows) ? context.allRows : cohortRows;
  const filters = context.filters || getDefaultCsmPeriod();
  const periodLabel = describeCsmPeriod(filters);
  const activeCohortRows = dedupeClientRows(cohortRows)
    .filter((row) => row.isActive && !isAbandonmentActivity(row));
  const currentModuleRows = dedupeClientRows(allRows).filter(isInCurrentModuleCircuit);
  const moduleTraffic = buildModuleTraffic(currentModuleRows);
  if (moduleTraffic[0]) moduleTraffic[0].sourceRows = allRows;
  const diagnosisEventRows = filterRowsByDatePeriod(allRows, 'f_diagnostico', filters);
  const diagnosisDetails = diagnosisEventRows.map((row) => {
    const elapsedDays = daysBetween(row.onboardingDate, row.diagnosisDate);
    let bucket = 'Sin fecha de onboarding';
    if (elapsedDays !== null && Number.isFinite(elapsedDays)) {
      if (elapsedDays < 0) bucket = 'Fecha inconsistente';
      else bucket = elapsedDays <= 7 ? 'Hasta 7 días' : 'Más de 7 días';
    }
    return { row, elapsedDays, bucket };
  });
  const diagnosisUnder7Rows = diagnosisDetails.filter((item) => item.bucket === 'Hasta 7 días');
  const diagnosisOver7Rows = diagnosisDetails.filter((item) => item.bucket === 'Más de 7 días');
  const diagnosisUnclassifiedRows = diagnosisDetails.filter((item) => !['Hasta 7 días', 'Más de 7 días'].includes(item.bucket));
  const pendingDiagnosisRows = dedupeClientRows(filterRowsByDatePeriod(allRows, 'f_onboarding', filters)).filter(row => row.isActive && !isAbandonmentActivity(row))
    .filter((row) => !row.diagnosisDate)
    .map((row) => ({ row, elapsedDays: daysBetween(row.onboardingDate, new Date()) }))
    .sort((a, b) => Number(b.elapsedDays || 0) - Number(a.elapsedDays || 0));

  const onboardingEventRows = filterRowsByDatePeriod(allRows, 'f_onboarding', filters);
  const payToOnboardingRows = onboardingEventRows
    .map((row) => ({ row, value: daysBetween(row.payReferenceDate, row.onboardingDate) }))
    .filter((item) => item.value !== null && Number.isFinite(item.value) && item.value >= 0);
  const payToDiagnosisRows = diagnosisDetails
    .filter((item) => item.elapsedDays !== null && Number.isFinite(item.elapsedDays) && item.elapsedDays >= 0);

  const yearlyFilters = { year: filters.year, month: 'all' };
  const sessionStats = CSM_SESSION_DEFINITIONS.map((session) => ({
    ...session,
    periodRows: filterRowsByDatePeriod(allRows, session.field, filters),
    yearRows: filterRowsByDatePeriod(allRows, session.field, yearlyFilters),
    totalRows: allRows.filter((row) => parseDate(row[session.field]))
  }));
  const intervalStats = CSM_SESSION_DEFINITIONS.slice(1).map((session, index) => {
    const previous = CSM_SESSION_DEFINITIONS[index];
    const endRows = filterRowsByDatePeriod(allRows, session.field, filters);
    const details = endRows
      .map((row) => ({ row, value: daysBetween(parseDate(row[previous.field]), parseDate(row[session.field])) }))
      .filter((item) => item.value !== null && Number.isFinite(item.value) && item.value >= 0);
    return {
      label: `${previous.label} → ${session.label}`,
      completed: endRows.length,
      details,
      average: average(details.map((item) => item.value))
    };
  });
  const unitStats = Array.from({ length: 10 }, (_, index) => {
    const diffs = activeCohortRows
      .map((row) => {
        const current = row.moduleDates[index];
        const previous = index === 0
          ? (row.unitStartDate || row.payReferenceDate || row.onboardingDate)
          : row.moduleDates[index - 1];
        return daysBetween(previous, current);
      })
      .filter((value) => value !== null && Number.isFinite(value) && value >= 0);
    return {
      unit: `Unidad ${index + 1}`,
      avgDays: average(diffs),
      completed: activeCohortRows.filter((row) => row.moduleDates[index]).length
    };
  });

  const diagnosisDetailRows = (items) => items.map((item) => [
    createContactCell(item.row.nombre || 'Sin nombre', item.row.ghlid || ''),
    item.bucket,
    item.elapsedDays !== null && Number.isFinite(item.elapsedDays) ? formatDays(item.elapsedDays) : '-',
    formatDate(item.row.f_onboarding),
    formatDate(item.row.f_diagnostico)
  ]);
  const sessionMetrics = sessionStats.map((session) => buildMetricRow({
    key: `session_${session.key}`,
    label: `${session.label} realizadas`,
    value: formatInteger(session.periodRows.length),
    base: `${formatInteger(session.yearRows.length)} en ${filters.year} · ${formatInteger(session.totalRows.length)} históricas`,
    fieldsLabel: `"${session.field}"`,
    logic: `Cuenta la sesión por su fecha real "${session.field}" dentro de ${periodLabel}; no por la fecha de ingreso del cliente.`,
    detailColumns: ['Cliente', 'Fecha', 'Estado soporte', 'GHL'],
    detailRows: session.periodRows.map((row) => [
      createContactCell(row.nombre || 'Sin nombre', row.ghlid || ''),
      formatDate(row[session.field]),
      row.isActive ? 'Activo' : row.supportStatus === 'inactive' ? 'Sin acceso' : 'Acceso sin informar',
      createGhlLinkCell(row.ghlid || '')
    ])
  }));

  const metrics = [
    buildMetricRow({
      key: 'diagnosis_total',
      label: 'Diagnósticos realizados en el período',
      value: formatInteger(diagnosisEventRows.length),
      base: `${formatInteger(diagnosisEventRows.length)} fechas "f_diagnostico" en ${periodLabel}`,
      fieldsLabel: '"f_diagnostico"',
      logic: 'Cuenta diagnósticos por la fecha real de la sesión. Esta base debe coincidir con el total mensual.',
      detailColumns: ['Cliente', 'Clasificación', 'Tiempo desde onboarding', 'Onboarding', 'Diagnóstico'],
      detailRows: diagnosisDetailRows(diagnosisDetails)
    }),
    buildMetricRow({
      key: 'diagnosis_under_7',
      label: 'Diagnósticos realizados hasta 7 días',
      value: formatInteger(diagnosisUnder7Rows.length),
      base: `${formatInteger(diagnosisEventRows.length)} diagnósticos realizados en ${periodLabel}`,
      fieldsLabel: '"f_onboarding" → "f_diagnostico"',
      logic: 'Cuenta sesiones realizadas en el período cuya diferencia desde el video de onboarding es de 0 a 7 días inclusive.',
      detailColumns: ['Cliente', 'Clasificación', 'Tiempo desde onboarding', 'Onboarding', 'Diagnóstico'],
      detailRows: diagnosisDetailRows(diagnosisUnder7Rows)
    }),
    buildMetricRow({
      key: 'diagnosis_over_7',
      label: 'Diagnósticos realizados después de 7 días',
      value: formatInteger(diagnosisOver7Rows.length),
      base: `${formatInteger(diagnosisEventRows.length)} diagnósticos realizados en ${periodLabel}`,
      fieldsLabel: '"f_onboarding" → "f_diagnostico"',
      logic: 'Cuenta solo sesiones efectivamente realizadas en el período que demoraron más de 7 días.',
      detailColumns: ['Cliente', 'Clasificación', 'Tiempo desde onboarding', 'Onboarding', 'Diagnóstico'],
      detailRows: diagnosisDetailRows(diagnosisOver7Rows)
    }),
    buildMetricRow({
      key: 'diagnosis_unclassified',
      label: 'Diagnósticos sin clasificación',
      value: formatInteger(diagnosisUnclassifiedRows.length),
      base: `${formatInteger(diagnosisEventRows.length)} diagnósticos realizados en ${periodLabel}`,
      fieldsLabel: '"f_pago_con_acceso", "f_acceso", "f_diagnostico"',
      logic: 'Expone diagnósticos que no se pueden clasificar por falta de ingreso o por fechas inconsistentes.',
      detailColumns: ['Cliente', 'Motivo', 'Tiempo desde onboarding', 'Onboarding', 'Diagnóstico'],
      detailRows: diagnosisDetailRows(diagnosisUnclassifiedRows)
    }),
    buildMetricRow({
      key: 'pending_diagnosis',
      label: 'Vieron onboarding en el período y faltan diagnóstico',
      value: formatInteger(pendingDiagnosisRows.length),
      base: `${formatInteger(dedupeClientRows(filterRowsByDatePeriod(allRows, 'f_onboarding', filters)).filter(row => row.isActive && !isAbandonmentActivity(row)).length)} clientes activos con onboarding en ${periodLabel}`,
      fieldsLabel: '"acceso"="Acceso", "f_onboarding", "f_diagnostico"',
      logic: 'Métrica de cohorte: clientes activos que vieron onboarding en el período seleccionado que aún no tienen fecha de diagnóstico.',
      detailColumns: ['Cliente', 'Onboarding', 'Días transcurridos', 'GHL'],
      detailRows: pendingDiagnosisRows.map((item) => [
        createContactCell(item.row.nombre || 'Sin nombre', item.row.ghlid || ''),
        formatDate(item.row.f_onboarding),
        item.elapsedDays !== null && Number.isFinite(item.elapsedDays) ? formatDays(item.elapsedDays) : '-',
        createGhlLinkCell(item.row.ghlid || '')
      ])
    }),
    buildMetricRow({
      key: 'pay_to_onboarding',
      label: 'Tiempo promedio de ingreso a onboarding',
      value: formatDays(average(payToOnboardingRows.map((item) => item.value))),
      base: `${formatInteger(payToOnboardingRows.length)} onboardings de ${periodLabel} con ingreso válido`,
      fieldsLabel: '"f_pago_con_acceso" o "f_acceso" → "f_onboarding"',
      logic: 'Promedio con fechas reales, ubicando el evento por "f_onboarding".',
      detailColumns: ['Cliente', 'Días', 'Ingreso', 'Onboarding'],
      detailRows: payToOnboardingRows.map((item) => [
        createContactCell(item.row.nombre || 'Sin nombre', item.row.ghlid || ''),
        formatDays(item.value),
        formatDate(item.row.f_pago_con_acceso || item.row.f_acceso),
        formatDate(item.row.f_onboarding)
      ])
    }),
    buildMetricRow({
      key: 'pay_to_diagnosis',
      label: 'Tiempo promedio de onboarding a diagnóstico',
      value: formatDays(average(payToDiagnosisRows.map((item) => item.elapsedDays))),
      base: `${formatInteger(payToDiagnosisRows.length)} diagnósticos de ${periodLabel} con onboarding válido`,
      fieldsLabel: '"f_onboarding" → "f_diagnostico"',
      logic: 'Promedio con fechas reales, ubicando el evento por "f_diagnostico".'
    }),
    ...sessionMetrics
  ];

  const uniqueTotal = dedupeClientRows(allRows).length;
  const peopleBreakdown = dedupeClientRows(allRows)
    .map((row) => {
      const counts = CSM_SESSION_DEFINITIONS.map((session) => (
        filterRowsByDatePeriod([row], session.field, filters).length
      ));
      return { row, counts, total: counts.reduce((sum, count) => sum + count, 0) };
    })
    .filter((item) => item.total > 0 || filterRowsByDatePeriod([item.row], 'f_pago_con_acceso', filters).length > 0)
    .sort((a, b) => b.total - a.total || String(a.row.nombre || '').localeCompare(String(b.row.nombre || ''), 'es'));
  const sections = [
    {
      key: 'desglose-persona',
      title: 'Desglose por persona',
      description: `Sesiones de cada cliente ubicadas por la fecha real de cada hito en ${periodLabel}.`,
      columns: ['Persona', 'Estado', ...CSM_SESSION_DEFINITIONS.map((session) => session.label), 'Total sesiones'],
      rows: peopleBreakdown.map((item) => [
        createContactCell(item.row.nombre || 'Sin nombre', item.row.ghlid || ''),
        item.row.isActive ? 'Activo' : item.row.supportStatus === 'inactive' ? 'Sin acceso' : 'Acceso sin informar',
        ...item.counts.map(formatInteger),
        formatInteger(item.total)
      ]),
      totalRow: [
        `TOTAL · ${formatInteger(peopleBreakdown.length)} personas`,
        '',
        ...CSM_SESSION_DEFINITIONS.map((_, index) => formatInteger(peopleBreakdown.reduce((sum, item) => sum + item.counts[index], 0))),
        formatInteger(peopleBreakdown.reduce((sum, item) => sum + item.total, 0))
      ]
    },
    {
      key: 'sesiones-realizadas',
      title: 'Sesiones realizadas',
      description: `Cada sesión se cuenta por su propia fecha. Período seleccionado: ${periodLabel}.`,
      columns: ['Sesión', 'Período', `Año ${filters.year}`, 'Histórico'],
      rows: sessionStats.map((session) => [
        session.label,
        formatInteger(session.periodRows.length),
        formatInteger(session.yearRows.length),
        formatInteger(session.totalRows.length)
      ]),
      totalRow: [
        'TOTAL',
        formatInteger(sessionStats.reduce((sum, session) => sum + session.periodRows.length, 0)),
        formatInteger(sessionStats.reduce((sum, session) => sum + session.yearRows.length, 0)),
        formatInteger(sessionStats.reduce((sum, session) => sum + session.totalRows.length, 0)),
        ''
      ]
    },
    {
      key: 'dias-entre-sesiones',
      title: 'Días entre sesiones',
      description: 'La sesión final del tramo cae en el período seleccionado y ambas fechas deben estar cargadas en orden válido.',
      columns: ['Tramo', 'Promedio', 'Base válida', 'Sesiones finales', 'Cobertura'],
      rows: intervalStats.map((interval) => [
        interval.label,
        formatDays(interval.average),
        formatInteger(interval.details.length),
        formatInteger(interval.completed),
        formatPercent(safeDiv(interval.details.length * 100, interval.completed))
      ]),
      totalRow: [
        'TOTAL',
        formatDays(average(intervalStats.flatMap((interval) => interval.details.map((item) => item.value)))),
        formatInteger(intervalStats.reduce((sum, interval) => sum + interval.details.length, 0)),
        formatInteger(intervalStats.reduce((sum, interval) => sum + interval.completed, 0)),
        formatPercent(safeDiv(
          intervalStats.reduce((sum, interval) => sum + interval.details.length, 0) * 100,
          intervalStats.reduce((sum, interval) => sum + interval.completed, 0)
        ))
      ]
    },
    {
      key: 'cobertura-fechas',
      title: 'Cobertura de fechas',
      description: 'Distingue un cero real de una métrica incompleta por falta de carga.',
      columns: ['Hito', 'Clientes con fecha', 'Clientes únicos', 'Cobertura'],
      rows: CSM_SESSION_DEFINITIONS.map((session) => {
        const uniqueWithDate = dedupeClientRows(allRows.filter((row) => parseDate(row[session.field]))).length;
        return [session.label, formatInteger(uniqueWithDate), formatInteger(uniqueTotal), formatPercent(safeDiv(uniqueWithDate * 100, uniqueTotal))];
      }),
      totalRow: [
        'TOTAL FECHAS',
        formatInteger(CSM_SESSION_DEFINITIONS.reduce((sum, session) => sum + dedupeClientRows(allRows.filter((row) => parseDate(row[session.field]))).length, 0)),
        formatInteger(uniqueTotal),
        formatPercent(safeDiv(
          CSM_SESSION_DEFINITIONS.reduce((sum, session) => sum + dedupeClientRows(allRows.filter((row) => parseDate(row[session.field]))).length, 0) * 100,
          uniqueTotal * CSM_SESSION_DEFINITIONS.length
        ))
      ]
    },
    {
      key: 'avance-modulos',
      title: 'Avance por módulos de los ingresos seleccionados',
      description: 'Lectura de cohorte separada de las sesiones realizadas en el mismo período.',
      columns: ['Unidad', 'Promedio días', 'Clientes', '% cohorte activa'],
      rows: unitStats.map((row) => [
        row.unit,
        formatDays(row.avgDays),
        formatInteger(row.completed),
        formatPercent(safeDiv(row.completed * 100, activeCohortRows.length))
      ]),
      totalRow: [
        'TOTAL UNIDADES',
        '',
        formatInteger(unitStats.reduce((sum, row) => sum + row.completed, 0)),
        formatPercent(safeDiv(unitStats.reduce((sum, row) => sum + row.completed, 0) * 100, activeCohortRows.length * unitStats.length))
      ]
    }
  ];

  return {
    metrics,
    moduleTraffic,
    moduleTrafficBaseCount: currentModuleRows.length,
    kpiKeys: ['diagnosis_total', 'diagnosis_under_7', 'diagnosis_over_7', 'pending_diagnosis'],
    chart: {
      type: 'line',
      title: 'Evolución mensual de sesiones',
      description: `Conteo por fecha real de cada sesión en ${periodLabel}.`,
      labels: MONTH_FILTER_OPTIONS.slice(1).map(m=>m.label),
      datasets: sessionStats.map((session,i)=>({label:session.label,data:MONTH_FILTER_OPTIONS.slice(1).map(m=>filterRowsByDatePeriod(allRows,session.field,{year:filters.year,month:m.value}).length),borderColor:['#249df2','#1eb99a','#ab83e8','#e5a535','#ef6f91'][i],backgroundColor:'transparent',tension:.25,pointRadius:4}))
    },
    sections
  };
}

function buildSituationPage(rows, context = {}) {
  const today = new Date();
  const allProgramRows = Array.isArray(context.allRows) && context.allRows.length ? context.allRows : rows;
  const abandonDiffs = collectDayDiffs(rows, (row) => row.programStartDate, (row) => row.abandonDate);
  const successRows = rows.filter((row) => row.successDate);
  const firstResultRows = rows.filter((row) => row.firstResultDate);
  const nightmareRows = rows.filter((row) => row.hasInsatisfaction || row.hasRefundRequest);
  const insatisfactionRows = rows.filter((row) => row.hasInsatisfaction);
  const refundRows = rows.filter((row) => row.hasRefundRequest);
  const refundCompletedRows = rows.filter((row) => row.hasRefundRequest && (!row.isActive || row.hasFarewell));
  const activeRows = rows.filter((row) => row.isActive);
  const engagementRows = activeRows.map((row) => ({
    row,
    state: getEngagementState(row, today)
  }));
  const engagedRows = engagementRows
    .filter((item) => item.state.engaged)
    .map((item) => item.row);
  const explicitEngagementRows = activeRows.filter((row) => hasExplicitEngagement(row));

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

  const modelBucketNames = [...new Set(rows.map((row) => row.modelBucket || 'Sin rubro'))]
    .sort((a, b) => a.localeCompare(b, 'es'));
  const modelBuckets = modelBucketNames.map((bucket) => {
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
  const yearBuckets = [...allProgramRows.reduce((map, row) => {
    const year = getProgramEntryYear(row);
    map.set(year, (map.get(year) || 0) + 1);
    return map;
  }, new Map()).entries()]
    .sort((a, b) => {
      if (a[0] === 'Sin fecha') return 1;
      if (b[0] === 'Sin fecha') return -1;
      return Number(b[0]) - Number(a[0]);
    });
  const rawModelBuckets = [...allProgramRows.reduce((map, row) => {
    const model = row.modelRaw || getRawModelLabel(row.modelo_negocio);
    map.set(model, (map.get(model) || 0) + 1);
    return map;
  }, new Map()).entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'));
  const allProgramClientRows = allProgramRows
    .map((row) => [
      createContactCell(row.nombre || 'Sin nombre', row.ghlid || ''),
      getProgramEntryYear(row),
      formatDate(getProgramEntryDateValue(row)),
      row.modelRaw || getRawModelLabel(row.modelo_negocio),
      row.isActive ? 'Activo' : 'No activo',
      row.abandonDate ? 'Abandono' : '-',
      createGhlLinkCell(row.ghlid || '')
    ])
    .sort((a, b) => String(b[1]).localeCompare(String(a[1]), 'es') || String(a[0]?.label || '').localeCompare(String(b[0]?.label || ''), 'es'));

  const metrics = [
    buildMetricRow({
      key: 'total_clients',
      label: 'Clientes totales que pasaron por el programa',
      value: formatInteger(allProgramRows.length),
      base: `${formatInteger(allProgramRows.length)} filas actuales en "csm" sin filtro mensual`,
      note: 'Incluye activos e inactivos.',
      dateLabel: 'Snapshot actual de "csm"',
      fieldsLabel: '"id", "nombre", "f_acceso", "f_pago_con_acceso", "modelo_negocio"',
      logic: 'Cuenta todas las filas vigentes de la tabla "csm" como universo histórico del programa, sin limitarse al mes seleccionado.',
      detailColumns: ['Cliente', 'Año', 'Ingreso', 'Rubro', 'Estado', 'Abandono', 'GHL'],
      detailRows: allProgramClientRows
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
      note: explicitEngagementRows.length
        ? 'Usa el campo "engagement" cuando está cargado; si no, cae a actividad reciente.'
        : 'Todavía no hay campo "engagement" cargado; infiero por avance o respuesta en los últimos 30 días.',
      dateLabel: '"engagement" o últimos 30 días sobre actividad',
      fieldsLabel: '"acceso", "engagement", "ultima_fecha_de_avance", "ultima_respuesta"',
      logic: 'Cuenta clientes con "acceso"="Acceso" y engagement marcado. Cuando engagement está vacío, usa una fecha reciente de avance o respuesta dentro de los últimos 30 días.',
      detailColumns: ['Cliente', 'Engagement', 'Fuente', 'Fecha actividad', 'Valor GHL'],
      detailRows: engagementRows
        .map((item) => [
          createContactCell(item.row.nombre || 'Sin nombre', item.row.ghlid || ''),
          item.state.engaged ? 'Si' : 'No',
          item.state.source,
          item.state.date || '-',
          item.state.rawValue || '-'
        ])
        .sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'es') || String(a[0]?.label || '').localeCompare(String(b[0]?.label || ''), 'es'))
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
      fieldsLabel: '"solicito_devolucion", "acceso", "despedida"',
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
      title: 'Clientes por Año',
      description: 'Conteo historico de clientes que pasaron por el programa, sin filtro mensual.',
      columns: ['Año', 'Clientes'],
      rows: yearBuckets.map(([year, count]) => [
        year,
        formatInteger(count)
      ])
    },
    {
      title: 'Clientes por Rubro',
      description: 'Conteo historico usando el valor original de "modelo_negocio".',
      columns: ['Rubro', 'Clientes', '% total'],
      rows: rawModelBuckets.map(([model, count]) => [
        model,
        formatInteger(count),
        formatPercent(safeDiv(count * 100, allProgramRows.length))
      ])
    },
    {
      title: 'NPS Promedio por Unidad',
      description: 'Promedio y cantidad de respuestas disponibles en cada unidad.',
      columns: ['Unidad', 'Promedio NPS', 'Respuestas'],
      rows: npsUnitStats.map((row) => [
        row.unit,
        row.average === null ? 'Sin base' : formatDecimal(row.average, 1),
        formatInteger(row.answers)
      ]),
      totalRow: [
        'TOTAL',
        allNpsValues.length ? formatDecimal(average(allNpsValues), 1) : 'Sin base',
        formatInteger(allNpsValues.length)
      ]
    },
    {
      title: 'Modelos de Negocio',
      description: 'Desglose del periodo seleccionado por segmento normalizado a partir de "modelo_negocio".',
      columns: ['Modelo', 'Cantidad programa', '% abandonos', 'Cantidad exito', '% caso exito', 'Tiempo a primer resultado', 'Insatisfechos', 'NPS', 'Renovaciones'],
      rows: modelBuckets,
      totalRow: [
        'TOTAL',
        formatInteger(rows.length),
        formatPercent(safeDiv(rows.filter((row) => row.abandonDate).length * 100, rows.length)),
        formatInteger(successRows.length),
        formatPercent(safeDiv(successRows.length * 100, rows.length)),
        formatDays(average(collectDayDiffs(rows, (row) => row.onboardingDate, (row) => row.firstResultDate))),
        formatInteger(insatisfactionRows.length),
        allNpsValues.length ? formatDecimal(average(allNpsValues), 1) : 'Sin base',
        formatInteger(rows.filter((row) => row.renewalCompletedDate).length)
      ]
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

function buildSituationPageAudited(cohortRows, context = {}) {
  const basePage = buildSituationPage(cohortRows, context);
  const allRows = Array.isArray(context.allRows) ? context.allRows : cohortRows;
  const filters = context.filters || getDefaultCsmPeriod();
  const periodLabel = describeCsmPeriod(filters);
  const uniqueRows = dedupeClientRows(allRows);
  const uniqueCohortRows = dedupeClientRows(cohortRows);
  const activeRows = uniqueRows.filter((row) => row.isActive);
  const inactiveRows = uniqueRows.filter((row) => row.supportStatus === 'inactive');
  const unknownRows = uniqueRows.filter((row) => row.supportStatus === 'unknown');
  const duplicateRows = Math.max(allRows.length - uniqueRows.length, 0);
  const missingGhlRows = allRows.filter((row) => !String(row.ghlid || '').trim());
  const monthlyEntries = buildMonthlyEntryStats(allRows, filters.year);
  const selectedMonthStat = filters.month === 'all'
    ? null
    : monthlyEntries.find((item) => item.month === String(Number(filters.month)));

  const supportDetailRows = uniqueRows
    .map((row) => [
      createContactCell(row.nombre || 'Sin nombre', row.ghlid || ''),
      row.isActive ? 'Activo' : row.supportStatus === 'inactive' ? 'Sin acceso' : 'Acceso sin informar',
      row.acceso || '-',
      formatDate(row.f_pago_con_acceso),
      row.modelRaw || getRawModelLabel(row.modelo_negocio),
      createGhlLinkCell(row.ghlid || '')
    ])
    .sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'es') || String(a[0]?.label || '').localeCompare(String(b[0]?.label || ''), 'es'));

  const yearMap = new Map();
  uniqueRows.forEach((row) => {
    const year = getProgramEntryYear(row);
    if (!yearMap.has(year)) yearMap.set(year, { clients: 0, active: 0, inactive: 0, unknown: 0 });
    const bucket = yearMap.get(year);
    bucket.clients += 1;
    if (row.isActive) bucket.active += 1;
    else if (row.supportStatus === 'inactive') bucket.inactive += 1;
    else bucket.unknown += 1;
  });
  const registrationsByYear = allRows.reduce((map, row) => {
    const year = getProgramEntryYear(row);
    map.set(year, (map.get(year) || 0) + 1);
    return map;
  }, new Map());
  const yearRows = [...yearMap.entries()]
    .sort((a, b) => {
      if (a[0] === 'Sin fecha') return 1;
      if (b[0] === 'Sin fecha') return -1;
      return Number(b[0]) - Number(a[0]);
    })
    .map(([year, bucket]) => [
      year,
      formatInteger(bucket.clients),
      formatInteger(registrationsByYear.get(year) || 0),
      formatInteger(bucket.active),
      formatInteger(bucket.inactive),
      formatInteger(bucket.unknown)
    ]);

  const rubroMap = new Map();
  uniqueRows.forEach((row) => {
    const rubro = row.modelRaw || getRawModelLabel(row.modelo_negocio);
    if (!rubroMap.has(rubro)) rubroMap.set(rubro, { clients: 0, active: 0, inactive: 0, unknown: 0 });
    const bucket = rubroMap.get(rubro);
    bucket.clients += 1;
    if (row.isActive) bucket.active += 1;
    else if (row.supportStatus === 'inactive') bucket.inactive += 1;
    else bucket.unknown += 1;
  });
  const rubroRows = [...rubroMap.entries()]
    .sort((a, b) => b[1].clients - a[1].clients || a[0].localeCompare(b[0], 'es'))
    .map(([rubro, bucket]) => [
      rubro,
      formatInteger(bucket.clients),
      formatInteger(bucket.active),
      formatInteger(bucket.inactive),
      formatInteger(bucket.unknown),
      formatPercent(safeDiv(bucket.active * 100, bucket.clients))
    ]);

  const sessionStats = CSM_SESSION_DEFINITIONS.map((session) => ({
    ...session,
    periodCount: filterRowsByDatePeriod(allRows, session.field, filters).length,
    annualCount: filterRowsByDatePeriod(allRows, session.field, { year: filters.year, month: 'all' }).length,
    totalCount: allRows.filter((row) => parseDate(row[session.field])).length
  }));

  const auditedMetrics = [
    buildMetricRow({
      key: 'total_clients',
      label: 'Clientes únicos registrados',
      value: formatInteger(uniqueRows.length),
      base: `${formatInteger(allRows.length)} filas en "csm" · ${formatInteger(duplicateRows)} duplicadas por identidad`,
      fieldsLabel: '"ghlid"; respaldo: "id", "mail" o "telefono"',
      logic: 'Deduplica primero por GHL. Las filas sin GHL conservan identidad por id, email o teléfono. No presenta 623 filas como si fueran necesariamente 623 personas.',
      detailColumns: ['Cliente', 'Estado', 'Valor acceso', 'Ingreso', 'Rubro', 'GHL'],
      detailRows: supportDetailRows
    }),
    buildMetricRow({
      key: 'active_support',
      label: 'Clientes activos actuales',
      value: formatCountWithPercent(activeRows.length, uniqueRows.length),
      base: `${formatInteger(uniqueRows.length)} clientes únicos actuales`,
      fieldsLabel: '"acceso"',
      logic: 'Cuenta como activo únicamente cuando "acceso" es exactamente "Acceso" (sin distinguir mayúsculas/minúsculas). Es una foto actual, no un histórico.',
      detailColumns: ['Cliente', 'Estado', 'Valor acceso', 'Ingreso', 'Rubro', 'GHL'],
      detailRows: supportDetailRows.filter((row) => row[1] === 'Activo')
    }),
    buildMetricRow({
      key: 'inactive_support',
      label: 'Clientes sin acceso actuales',
      value: formatCountWithPercent(inactiveRows.length, uniqueRows.length),
      base: `${formatInteger(uniqueRows.length)} clientes únicos actuales`,
      fieldsLabel: '"acceso"',
      logic: 'Cuenta clientes cuyo campo "acceso" vale "Sin acceso". No mezcla los registros vacíos.',
      detailColumns: ['Cliente', 'Estado', 'Valor acceso', 'Ingreso', 'Rubro', 'GHL'],
      detailRows: supportDetailRows.filter((row) => row[1] === 'Sin acceso')
    }),
    buildMetricRow({
      key: 'unknown_support',
      label: 'Clientes con acceso sin informar',
      value: formatCountWithPercent(unknownRows.length, uniqueRows.length),
      base: `${formatInteger(uniqueRows.length)} clientes únicos actuales`,
      fieldsLabel: '"acceso"',
      logic: 'Separa los valores vacíos o distintos de "Acceso" y "Sin acceso" para no convertir falta de datos en inactividad.',
      detailColumns: ['Cliente', 'Estado', 'Valor acceso', 'Ingreso', 'Rubro', 'GHL'],
      detailRows: supportDetailRows.filter((row) => row[1] === 'Acceso sin informar')
    }),
    buildMetricRow({
      key: 'new_entries',
      label: filters.month === 'all' ? `Nuevos ingresos ${filters.year}` : `Nuevos ingresos en ${periodLabel}`,
      value: formatInteger(uniqueCohortRows.length),
      base: `${formatInteger(cohortRows.length)} filas con "f_pago_con_acceso" en ${periodLabel}`,
      fieldsLabel: '"f_pago_con_acceso"',
      logic: filters.month === 'all'
        ? 'Cuenta clientes únicos ingresados durante el año seleccionado.'
        : `Cuenta clientes únicos ingresados en el mes. Variación contra el mes anterior: ${formatPercent(selectedMonthStat?.variation)}.`
    }),
    buildMetricRow({
      key: 'identity_quality',
      label: 'Registros a revisar',
      value: formatInteger(duplicateRows + missingGhlRows.length),
      base: `${formatInteger(duplicateRows)} filas duplicadas · ${formatInteger(missingGhlRows.length)} filas sin GHL`,
      fieldsLabel: '"ghlid", "id"',
      logic: 'Control de calidad para explicar por qué el total de filas puede diferir del total de clientes únicos.'
    })
  ];
  const replacedKeys = new Set(auditedMetrics.map((metric) => metric.key));
  const metrics = [...auditedMetrics, ...basePage.metrics.filter((metric) => !replacedKeys.has(metric.key))];
  const preservedSections = basePage.sections.filter((section) => !['Clientes por Año', 'Clientes por Rubro'].includes(section.title));
  const sections = [
    {
      key: 'desglose-persona',
      title: 'Desglose por persona',
      description: `Estado actual y sesiones reales de cada cliente en ${periodLabel}.`,
      columns: ['Persona', 'Estado de acceso', 'Ingreso', 'Rubro', 'Sesiones del período'],
      rows: uniqueRows.map((row) => {
        const sessionCount = CSM_SESSION_DEFINITIONS.reduce((sum, session) => (
          sum + filterRowsByDatePeriod([row], session.field, filters).length
        ), 0);
        return [
          createContactCell(row.nombre || 'Sin nombre', row.ghlid || ''),
          row.isActive ? 'Activo' : row.supportStatus === 'inactive' ? 'Sin acceso' : 'Acceso sin informar',
          formatDate(row.f_pago_con_acceso),
          row.modelRaw || getRawModelLabel(row.modelo_negocio),
          formatInteger(sessionCount)
        ];
      }),
      totalRow: [
        `TOTAL · ${formatInteger(uniqueRows.length)} personas`,
        `${formatInteger(activeRows.length)} activos · ${formatInteger(inactiveRows.length)} sin acceso · ${formatInteger(unknownRows.length)} sin informar`,
        '',
        '',
        formatInteger(sessionStats.reduce((sum, session) => sum + session.periodCount, 0))
      ]
    },
    {
      key: 'nuevos-ingresos-mes',
      title: 'Nuevos ingresos por mes',
      description: `Clientes únicos por "f_pago_con_acceso" durante ${filters.year}. El estado es la foto actual de "acceso".`,
      columns: ['Mes', 'Clientes únicos', 'Filas', 'Variación mensual', 'Activos hoy', 'Sin acceso hoy', 'Acceso sin informar'],
      rows: monthlyEntries.map((month) => [
        month.label,
        formatInteger(month.count),
        formatInteger(month.registrations),
        formatPercent(month.variation),
        formatInteger(month.active),
        formatInteger(month.inactive),
        formatInteger(month.unknown)
      ]),
      totalRow: [
        `TOTAL ${filters.year}`,
        formatInteger(monthlyEntries.reduce((sum, month) => sum + month.count, 0)),
        formatInteger(monthlyEntries.reduce((sum, month) => sum + month.registrations, 0)),
        '',
        formatInteger(monthlyEntries.reduce((sum, month) => sum + month.active, 0)),
        formatInteger(monthlyEntries.reduce((sum, month) => sum + month.inactive, 0)),
        formatInteger(monthlyEntries.reduce((sum, month) => sum + month.unknown, 0))
      ]
    },
    {
      key: 'clientes-anio-ingreso',
      title: 'Clientes por año de ingreso',
      description: 'Clientes únicos por fecha de pago con acceso. Activos e inactivos reflejan el estado actual, no el que tenían en ese año.',
      columns: ['Año', 'Clientes únicos', 'Filas', 'Activos hoy', 'Sin acceso hoy', 'Acceso sin informar'],
      rows: yearRows,
      totalRow: [
        'TOTAL',
        formatInteger(uniqueRows.length),
        formatInteger(allRows.length),
        formatInteger(activeRows.length),
        formatInteger(inactiveRows.length),
        formatInteger(unknownRows.length)
      ]
    },
    {
      key: 'clientes-rubro',
      title: 'Clientes por rubro',
      description: 'Foto actual de clientes únicos usando el valor original de "modelo_negocio".',
      columns: ['Rubro', 'Clientes', 'Activos', 'Sin acceso', 'Acceso sin informar', '% activos'],
      rows: rubroRows,
      totalRow: [
        'TOTAL',
        formatInteger(uniqueRows.length),
        formatInteger(activeRows.length),
        formatInteger(inactiveRows.length),
        formatInteger(unknownRows.length),
        formatPercent(safeDiv(activeRows.length * 100, uniqueRows.length))
      ]
    },
    {
      key: 'sesiones-periodo',
      title: 'Sesiones mensuales y acumulado anual',
      description: `Cada sesión se cuenta por su propia fecha en ${periodLabel}; el acumulado usa todo ${filters.year}.`,
      columns: ['Sesión', 'Período', `Año ${filters.year}`, 'Histórico'],
      rows: sessionStats.map((session) => [
        session.label,
        formatInteger(session.periodCount),
        formatInteger(session.annualCount),
        formatInteger(session.totalCount),
        session.field
      ]),
      totalRow: [
        'TOTAL',
        formatInteger(sessionStats.reduce((sum, session) => sum + session.periodCount, 0)),
        formatInteger(sessionStats.reduce((sum, session) => sum + session.annualCount, 0)),
        formatInteger(sessionStats.reduce((sum, session) => sum + session.totalCount, 0)),
        ''
      ]
    },
    ...preservedSections
  ];

  return {
    ...basePage,
    metrics,
    kpiKeys: ['total_clients', 'active_support', 'inactive_support', 'unknown_support', 'new_entries'],
    chart: {
      title: `Nuevos ingresos por mes · ${filters.year}`,
      description: 'Barras: clientes únicos ingresados. Línea: variación porcentual contra el mes anterior.',
      labels: monthlyEntries.map((month) => month.label.slice(0, 3)),
      datasets: [
        {
          label: 'Nuevos ingresos',
          data: monthlyEntries.map((month) => month.count),
          backgroundColor: 'rgba(29, 78, 216, 0.72)',
          borderRadius: 8,
          yAxisID: 'y'
        },
        {
          type: 'line',
          label: 'Variación mensual %',
          data: monthlyEntries.map((month) => month.variation),
          borderColor: 'rgba(16, 185, 129, 1)',
          backgroundColor: 'rgba(16, 185, 129, 0.18)',
          tension: 0.3,
          yAxisID: 'y1'
        }
      ],
      scales: {
        y: { beginAtZero: true, position: 'left' },
        y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false } }
      },
      showLegend: true
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
  const cashRows = renewalCashRows.filter((row) => isDateInRange(row.f_acreditacion, filters) && normalizeText(row.estado) === 'conciliado' && !['true','1'].includes(String(row.rebotar_pago).toLowerCase()));
  const pendingRows = renewalSales.filter((row) => isDateInRange(row.f_venta, filters));
  const countRows = renewalSales.filter((row) => isDateInRange(row.f_venta, filters));

  const totals = {
    facturacion: facturacionRows.reduce((sum, row) => sum + Number(row.facturacion || 0), 0),
    cashCollected: cashRows.reduce(
      (sum, row) => sum + Number(row.cash_collected_neto ?? row.cash_collected ?? 0),
      0
    ),
    pendiente: pendingRows.reduce((sum, row) => {
      const facturacion = Number(row.facturacion || 0);
      const netTotal = Number(row.cash_collected_neto_total ?? row.cash_collected_total ?? 0);
      const cashCollected = netTotal > 0
        ? netTotal
        : (normalizeText(row.estado) === 'conciliado' && !['true','1'].includes(String(row.rebotar_pago).toLowerCase()) ? Number(row.cash_collected_neto ?? row.cash_collected ?? 0) : 0);
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
      note: 'Sumo sólo pagos conciliados, sin rebotes, de ventas y cobranzas ligadas a renovaciones.',
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
  tiempo: buildTimePageByEvent,
  situacion: buildSituationPageAudited,
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
  const renderedPageKey = document.body.dataset.csmPage;
  const routeParams = new URLSearchParams(window.location.search);
  const pageKey = renderedPageKey === 'cuadro' ? routeParams.get('panel') : renderedPageKey;
  const builder = PAGE_BUILDERS[pageKey];

  if (!builder) return;
  const status = document.getElementById('status');

  if (renderedPageKey !== 'cuadro' && pageKey !== 'renovaciones') {
    const filters = getCsmPeriodFilters();
    resetCsmResultContainers();
    renderCsmDirectory(pageKey, filters);
    if (status) status.textContent = '';
    return;
  }

  if (pageKey === 'renovaciones') {
    setupRenewalFilters();
  }

  let requestedGroup = null;
  if (renderedPageKey === 'cuadro' && routeParams.get('vista') === 'grupo') {
    requestedGroup = getCsmDirectoryGroups(pageKey).find((group) => group.key === routeParams.get('grupo')) || null;
    const title = document.getElementById('csmPageTitle');
    const description = document.getElementById('csmPageDescription');
    if (requestedGroup && title) title.textContent = requestedGroup.title;
    if (requestedGroup && description) description.textContent = requestedGroup.description;
  }
  const isModuleSnapshotView = renderedPageKey === 'cuadro' && requestedGroup?.key === 'modulos';

  async function loadPage() {
    status.textContent = 'Cargando metricas de CSM...';
    if (renderedPageKey === 'cuadro') {
      resetCsmResultContainers();
      setCsmPageLoading(
        true,
        requestedGroup
          ? (isModuleSnapshotView
            ? 'Cargando la foto actual de clientes por módulo.'
            : `Cargando ${requestedGroup.title.toLowerCase()} y sus desgloses del período.`)
          : 'Cargando métricas, gráficos y desgloses del período.',
        {
          hideFilters: isModuleSnapshotView,
          hideStatus: isModuleSnapshotView
        }
      );
    }

    try {
      const api = await ensureMetricasApi();
      let filters = pageKey === 'renovaciones' ? getRenewalFilters() : null;

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

      if (pageKey !== 'renovaciones') {
        filters = getCsmPeriodFilters();
      }

      const rows = pageKey === 'renovaciones'
        ? enrichedRows
        : filterRowsByPayAccessPeriod(enrichedRows, filters);

      const page = builder(rows, {
        allRows: enrichedRows,
        comprobanteRows,
        leadRows,
        filters
      });
      const infoMap = Object.fromEntries(page.metrics.map((metric) => [metric.key, metric.info]));
      resetCsmResultContainers();

      if (renderedPageKey === 'cuadro') {
        const viewType = routeParams.get('vista') || (routeParams.has('cuadro') ? 'cuadro' : 'metrica');
        const title = document.getElementById('csmPageTitle');
        const description = document.getElementById('csmPageDescription');
        const backLink = document.getElementById('csmSectionBack');
        if (backLink) backLink.href = `/views/csm-${pageKey}.html?anio=${encodeURIComponent(filters.year || '')}&mes=${encodeURIComponent(filters.month || '')}`;

        if (viewType === 'grupo') {
          const selectedKey = routeParams.get('grupo');
          const selectedGroup = getCsmDirectoryGroups(pageKey).find((group) => group.key === selectedKey);
          if (!selectedGroup) throw new Error('El grupo solicitado no existe. Volvé al panel de CSM y elegilo nuevamente.');
          const selectedMetrics = getGroupMetrics(page, selectedGroup);
          const selectedSections = getGroupSections(page, selectedGroup);
          if (title) title.textContent = selectedGroup.title;
          if (description) description.textContent = selectedGroup.description;
          if (selectedMetrics.length && selectedGroup.key !== 'tiempos-recorrido') {
            renderKpiCards(selectedMetrics, selectedMetrics.map((metric) => metric.key), infoMap);
            if (!['diagnosticos','sesiones','tiempos-recorrido'].includes(selectedGroup.key)) renderMetricsTable(selectedMetrics, infoMap);
          }
          const groupChart = ['tiempos-recorrido','personas','diagnosticos','segmentacion'].includes(selectedGroup.key) ? null : buildCsmGroupChart(page, selectedGroup, selectedMetrics);
          if (groupChart) renderChart(groupChart, infoMap);
          if (selectedGroup.key === 'diagnosticos') {
            const target=document.getElementById('detailContainer');target.hidden=false;target.classList.add('csm-module-durations');
            const value=key=>parseCsmChartNumber(page.metrics.find(m=>m.key===key)?.value)||0;
            const total=value('diagnosis_total'),under=value('diagnosis_under_7'),over=value('diagnosis_over_7'),missing=value('diagnosis_unclassified');
            target.innerHTML=`<h2>Del onboarding al diagnóstico</h2><p>Sesiones realizadas en el período. Hasta 7 días incluye el día 7.</p><div class="csm-diagnosis-progress" aria-label="${under} hasta 7 días, ${over} después de 7 días"><span style="flex:${under||0.001}">${under} hasta 7 días</span><span style="flex:${over||0.001}">${over} después de 7 días</span></div><p>${total} diagnósticos en total.${missing?' '+missing+' no se pueden medir porque falta onboarding o las fechas son inconsistentes.':''} Abrí una tarjeta para ver el detalle de clientes.</p>`;
          } else if (selectedGroup.key === 'modulos') {
            renderModuleTraffic(page.moduleTraffic);
          } else if (selectedGroup.key === 'tiempos-recorrido') {
            const target=document.getElementById('detailContainer');target.hidden=false;target.classList.add('csm-module-durations');window.csmModuleDurations.render(target,enrichedRows,{mode:'sessions'});
          } else if (selectedGroup.key === 'personas') {
            renderPeopleFollowup(enrichedRows);
          } else if (selectedGroup.key === 'segmentacion') {
            renderBusinessSegments(enrichedRows);
          } else if (selectedSections.length) {
            renderSections(selectedSections, infoMap);
          }
        } else if (viewType === 'metrica') {
          const metrics = page.tableMetrics || page.metrics || [];
          const selectedKey = routeParams.get('metrica') || metrics[0]?.key;
          const selectedMetric = metrics.find((metric) => metric.key === selectedKey);
          if (!selectedMetric) throw new Error('La métrica solicitada no existe. Volvé al panel de CSM y elegila nuevamente.');
          if (title) title.textContent = selectedMetric.label;
          if (description) description.textContent = selectedMetric.note || selectedMetric.base || '';
          renderKpiCards([selectedMetric], [selectedMetric.key], infoMap);
          renderMetricsTable([selectedMetric], infoMap);
          if (selectedMetric.info?.detailColumns?.length) {
            renderSections([{
              title: `Desglose · ${selectedMetric.label}`,
              description: selectedMetric.info.base || '',
              columns: selectedMetric.info.detailColumns,
              rows: selectedMetric.info.detailRows || []
            }], infoMap);
          }
        } else if (viewType === 'grafico') {
          if (!page.chart) throw new Error('El gráfico solicitado no existe. Volvé al panel de CSM y elegilo nuevamente.');
          if (title) title.textContent = page.chart.title;
          if (description) description.textContent = page.chart.description || '';
          renderChart(page.chart, infoMap);
        } else {
          const selectedKey = routeParams.get('cuadro') || sectionKey(page.sections?.[0], 0);
          const selectedSection = (page.sections || []).find((section, index) => sectionKey(section, index) === selectedKey);
          if (!selectedSection) throw new Error('El cuadro solicitado no existe. Volvé al panel de CSM y elegilo nuevamente.');
          if (title) title.textContent = selectedSection.title;
          if (description) description.textContent = selectedSection.description || '';
          renderSections([selectedSection], infoMap);
        }
      } else {
        if (pageKey === 'renovaciones') {
          renderKpiCards(page.metrics, page.kpiKeys, infoMap);
          renderChart(page.chart, infoMap);
          renderMetricsTable(page.tableMetrics || page.metrics, infoMap);
          renderSections(page.sections, infoMap);
        } else {
          renderCsmDirectory(pageKey, filters);
        }
      }

      if (pageKey === 'renovaciones') {
        const params = new URLSearchParams(window.location.search);
        params.set('desde', filters.from || '');
        params.set('hasta', filters.to || '');
        if (renderedPageKey === 'cuadro') {
          params.set('panel', pageKey);
          params.set('cuadro', routeParams.get('cuadro') || sectionKey(page.sections?.[0], 0));
        }
        window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
        status.textContent = `Base actual: ${formatInteger(rows.length)} registros de "csm" | rango monetario ${filters.from || 'sin desde'} a ${filters.to || 'sin hasta'}. Facturacion, pendiente y cantidad usan fecha de venta; cash usa fecha de acreditacion.`;
      } else {
        const params = new URLSearchParams(window.location.search);
        if (isModuleSnapshotView) {
          params.delete('anio');
          params.delete('mes');
        } else {
          params.set('anio', filters.year || '');
          params.set('mes', filters.month || '');
        }
        window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
        status.textContent = isModuleSnapshotView
          ? ''
          : (renderedPageKey === 'cuadro'
            ? `Período: ${describeCsmPeriod(filters)}. La vista usa la fecha real de cada hito sobre ${formatInteger(enrichedRows.length)} filas de "csm".`
            : `Elegí una métrica, un gráfico o una tabla para consultar ${describeCsmPeriod(filters)}.`);
      }
      if (renderedPageKey === 'cuadro') {
        setCsmPageLoading(false, '', {
          hideFilters: isModuleSnapshotView,
          hideStatus: isModuleSnapshotView
        });
      }
    } catch (error) {
      document.getElementById('kpiContainer').innerHTML = '';
      document.getElementById('tableContainer').innerHTML = '<div class="table-wrap csm-table-wrap"><div class="report-empty">No se pudieron cargar las metricas de CSM.</div></div>';
      document.getElementById('detailContainer').innerHTML = '';
      status.textContent = error.message || 'No se pudieron cargar las metricas de CSM.';
      if (renderedPageKey === 'cuadro') setCsmPageLoading(false);
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

if (typeof window !== 'undefined') {
  window.csmPageInternals = {
    enrichRows,
    filterRowsByDatePeriod,
    dedupeClientRows,
    getSupportStatus,
    isInCurrentModuleCircuit,
    buildMonthlyEntryStats,
    buildModuleTraffic,
    buildTimePageByEvent,
    buildSituationPageAudited,
    getCsmDirectoryGroups,
    buildCsmGroupChart
  };
}

initCsmPage();
