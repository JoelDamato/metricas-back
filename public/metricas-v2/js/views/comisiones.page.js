(function initComisionesPage() {
  const ALL_PEOPLE_VALUE = '__ALL__';
  const PIN_NONE_VALUE = '';
  const state = {
    month: '',
    dashboard: null,
    agendaRows: [],
    selectedPerson: '',
    clientSearch: '',
    reconciliationFilter: '',
    clubFilter: '',
    typeFilter: '',
    pinnedPersonColumn: '',
    pinnedAgendaColumn: '',
    agendaFilters: {
      setter: '',
      from: '',
      to: '',
      lastOrigin: '',
      quality: [],
      aplica: '',
      calendar: ''
    },
    configMeta: null,
    rulesDraft: null,
    rolePeopleOptions: []
  };

  const statusNode = document.getElementById('commissionsStatus');
  const monthInput = document.getElementById('commissionsMonth');
  const personSelect = document.getElementById('commissionPersonSelect');
  const clientSearchInput = document.getElementById('commissionClientSearch');
  const pinnedPersonColumnSelect = document.getElementById('commissionPinnedColumnSelect');
  const reconciliationFilterSelect = document.getElementById('commissionReconciliationFilter');
  const clubFilterSelect = document.getElementById('commissionClubFilter');
  const typeFilterSelect = document.getElementById('commissionTypeFilter');
  const agendaDateFromInput = document.getElementById('commissionAgendaDateFrom');
  const agendaDateToInput = document.getElementById('commissionAgendaDateTo');
  const pinnedAgendaColumnSelect = document.getElementById('commissionAgendaPinnedColumnSelect');

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderGhlIdCell(ghlId) {
    const normalizedId = String(ghlId || '').trim();
    if (!normalizedId) return '-';
    if (window.metricasGhl?.buildContactUrl) {
      const url = window.metricasGhl.buildContactUrl(normalizedId);
      if (url) {
        return `<a class="comisiones-external-link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(normalizedId)}</a>`;
      }
    }
    return escapeHtml(normalizedId);
  }

  function normalizeText(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  function matchesApsetOrRt(value) {
    const normalized = normalizeText(value);
    if (!normalized) return false;
    return normalized.includes('apset') || /(^|[^a-z])rt([^a-z]|$)/.test(normalized);
  }

  function formatInteger(value) {
    return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(Number(value || 0));
  }

  function formatPercent(value) {
    return `${(Number(value || 0) * 100).toFixed(2).replace('.', ',')}%`;
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(value || 0));
  }

  function formatUsd(value) {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(value || 0));
  }

  function formatSheetInteger(value) {
    return Number(value || 0) === 0 ? '' : formatInteger(value);
  }

  function formatSheetCurrency(value) {
    return Number(value || 0) === 0 ? '' : formatCurrency(value);
  }

  function formatSheetPercent(value) {
    return Number(value || 0) === 0 ? '' : formatPercent(value);
  }

  function formatDetailDate(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const [year, month, day] = raw.slice(0, 10).split('-');
    if (!year || !month || !day) return raw;
    return `${day}/${month}/${year}`;
  }

  function formatDetailUsd(value) {
    return Number(value || 0) === 0 ? '' : formatUsd(value);
  }

  function formatDetailCurrency(value) {
    return Number(value || 0) === 0 ? '' : formatCurrency(value);
  }

  function formatDetailPercent(value) {
    return Number(value || 0) === 0 ? '' : formatPercent(value);
  }

  function formatDetailBoolean(value) {
    return value ? 'TRUE' : '';
  }

  function renderChequeBadge(value) {
    if (!value) return '';
    return '<span class="comisiones-cheque-badge" aria-label="Cheque" title="Cheque"><span aria-hidden="true">▭</span></span>';
  }

  function formatDetailText(value) {
    return String(value || '').trim();
  }

  function formatComprobanteProduct(detail) {
    if (normalizeText(detail?.tipo) === 'cobranza') return '-';
    return formatDetailText(detail?.product) || '-';
  }

  function renderComprobanteStatusBadge(value) {
    const status = normalizeText(value);
    if (status.includes('rebot')) {
      return '<span class="comisiones-status-badge is-rejected" aria-label="Rebotado" title="Rebotado"><span aria-hidden="true">●</span></span>';
    }
    if (status.includes('concili')) {
      return '<span class="comisiones-status-badge is-ok" aria-label="Conciliado" title="Conciliado"><span aria-hidden="true">✓</span></span>';
    }
    return '<span class="comisiones-status-badge is-pending" aria-label="Pendiente" title="Pendiente"><span aria-hidden="true">◷</span></span>';
  }

  function buildDisplayComprobanteRows(details, isAllView) {
    if (!isAllView) return details;

    const groups = new Map();
    details.forEach((detail) => {
      const key = String(detail.transactionId || detail.id || '').trim();
      if (!key) return;
      const current = groups.get(key) || { primary: null, setter: null };
      if (detail.role === 'Setter') {
        current.setter = detail;
      } else if (!current.primary || current.primary.role === 'Setter') {
        current.primary = detail;
      }
      if (!current.primary) current.primary = detail;
      groups.set(key, current);
    });

    return details.reduce((acc, detail) => {
      const key = String(detail.transactionId || detail.id || '').trim();
      if (!key) {
        acc.push(detail);
        return acc;
      }

      const group = groups.get(key);
      if (!group || group.primary !== detail) return acc;

      acc.push({
        ...detail,
        setter: group.setter?.person || detail.setter || '',
        setterPctDisplay: Number(group.setter?.commissionPct || 0),
        setterCommissionDisplay: Number(group.setter?.commissionAmount || 0)
      });
      return acc;
    }, []);
  }

  function buildNotionPageUrl(pageId) {
    const id = String(pageId || '').trim();
    if (!id) return '';
    return `https://www.notion.so/${id.replace(/-/g, '')}`;
  }

  function getCurrentMonthValue() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  function getMonthLabel(monthValue) {
    const [year, month] = String(monthValue || '').split('-').map(Number);
    if (!year || !month) return 'sin mes';
    return new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
  }

  function getMonthRange(monthValue) {
    const [year, month] = String(monthValue || '').split('-').map(Number);
    if (!year || !month) return { from: '', to: '' };
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0);
    const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
    return { from, to };
  }

  function setStatus(message, tone = '') {
    statusNode.textContent = message;
    statusNode.dataset.tone = tone;
  }

  function setActiveTab(tabKey) {
    document.querySelectorAll('.comisiones-tab').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.tab === tabKey);
    });
    document.querySelectorAll('.comisiones-panel').forEach((panel) => {
      panel.classList.toggle('is-active', panel.dataset.panel === tabKey);
    });
  }

  function fillPinnedColumnSelect(selectNode, options, selectedValue) {
    if (!selectNode) return;
    selectNode.innerHTML = (options || [])
      .map((option) => `<option value="${escapeHtml(option.value)}"${String(option.value) === String(selectedValue || '') ? ' selected' : ''}>${escapeHtml(option.label)}</option>`)
      .join('');
  }

  function buildPinnedOptionsFromTable(tableRoot) {
    const headers = Array.from(tableRoot?.querySelectorAll('thead th') || []);
    return [
      { value: PIN_NONE_VALUE, label: 'Ninguna' },
      ...headers.map((header, index) => ({
        value: String(index + 1),
        label: header.textContent.trim() || `Columna ${index + 1}`
      }))
    ];
  }

  function applyPinnedColumn(tableRoot, columnValue) {
    if (!tableRoot) return;
    const columnIndex = Number(columnValue || 0);
    tableRoot.querySelectorAll('.comisiones-pinned-cell').forEach((cell) => {
      cell.classList.remove('comisiones-pinned-cell', 'is-header');
    });
    if (!Number.isInteger(columnIndex) || columnIndex < 1) return;

    tableRoot.querySelectorAll(`tr > *:nth-child(${columnIndex})`).forEach((cell) => {
      cell.classList.add('comisiones-pinned-cell');
      if (cell.tagName === 'TH') cell.classList.add('is-header');
    });
  }

  function bindPinnedColumnHeaders(tableRoot, selectNode, stateKey) {
    if (!tableRoot) return;
    tableRoot.querySelectorAll('thead th').forEach((header, index) => {
      const columnValue = String(index + 1);
      header.classList.add('comisiones-pin-header');
      header.title = 'Click para inmovilizar esta columna';
      header.addEventListener('click', () => {
        state[stateKey] = state[stateKey] === columnValue ? PIN_NONE_VALUE : columnValue;
        fillPinnedColumnSelect(selectNode, buildPinnedOptionsFromTable(tableRoot), state[stateKey]);
        applyPinnedColumn(tableRoot, state[stateKey]);
      });
    });
  }

  function cloneConfig(config) {
    return JSON.parse(JSON.stringify(config || {}));
  }

  function collectRolePeopleOptions() {
    const names = new Set();
    (state.dashboard?.details || []).forEach((detail) => {
      [detail.person, detail.closer, detail.setter].forEach((name) => {
        const trimmed = String(name || '').trim();
        if (trimmed) names.add(trimmed);
      });
    });
    (state.rulesDraft?.personRoles || []).forEach((row) => {
      const trimmed = String(row?.person || '').trim();
      if (trimmed) names.add(trimmed);
    });
    return [...names].sort((a, b) => a.localeCompare(b, 'es'));
  }

  function ensureRoleRows(config) {
    const names = collectRolePeopleOptions();
    state.rolePeopleOptions = names;
    const current = Array.isArray(config.personRoles) ? config.personRoles : [];
    const byPerson = new Map(current.map((row) => [String(row.person || '').trim().toLowerCase(), row]));
    config.personRoles = names.map((person) => byPerson.get(person.toLowerCase()) || { person, role: 'Closer' });
  }

  function getMonthParts(monthValue) {
    const [year, month] = String(monthValue || '').split('-').map(Number);
    return {
      year: Number.isFinite(year) ? year : '',
      month: Number.isFinite(month) ? month : ''
    };
  }

  function formatRoleLabel(role) {
    const normalized = String(role || '').trim().toLowerCase();
    if (normalized === 'closer') return 'Closers';
    if (normalized === 'setter') return 'Setters';
    return role || '-';
  }

  function buildAgendaCountButton(person, count) {
    const safeCount = Number(count || 0);
    if (safeCount <= 0) return formatSheetInteger(safeCount);
    return `<button class="comisiones-inline-link comisiones-agenda-link" type="button" data-agenda-person="${escapeHtml(person)}">${formatInteger(safeCount)}</button>`;
  }

  function getAgendaRowsCountForPerson(person) {
    const normalizedPerson = normalizeText(person);
    if (!normalizedPerson) return 0;
    return state.agendaRows.filter((row) => normalizeText(row.setter) === normalizedPerson).length;
  }

  function isNahuelSetter(value) {
    const normalized = normalizeText(value);
    return normalized === 'nahuel iasci' || normalized === 'nahue' || normalized === 'nahuel';
  }

  function fillSimpleSelect(selectNode, values, selectedValue = '') {
    if (!selectNode) return;
    const options = ['<option value="">Todos</option>'];
    (values || []).forEach((value) => {
      const text = String(value || '').trim();
      if (!text) return;
      options.push(`<option value="${escapeHtml(text)}">${escapeHtml(text)}</option>`);
    });
    selectNode.innerHTML = options.join('');
    selectNode.value = selectedValue || '';
  }

  function renderAgendaQualityChecks() {
    const container = document.getElementById('commissionAgendaQualityChecks');
    if (!container) return;
    const values = uniqueSortedValues(state.agendaRows, 'quality');
    if (!values.length) {
      container.innerHTML = '<span class="comisiones-checkgroup-empty">Sin calidades</span>';
      return;
    }

    const selected = new Set((state.agendaFilters.quality || []).map((value) => normalizeText(value)));
    container.innerHTML = values.map((value) => `
      <label class="comisiones-checkpill">
        <input type="checkbox" value="${escapeHtml(value)}" ${selected.has(normalizeText(value)) ? 'checked' : ''} />
        <span>${escapeHtml(value)}</span>
      </label>
    `).join('');

    container.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      input.addEventListener('change', () => {
        state.agendaFilters.quality = [...container.querySelectorAll('input[type="checkbox"]:checked')].map((node) => node.value || '');
        renderAgendaPanel();
      });
    });
  }

  function isConciliatedDetail(detail) {
    const statusValues = [
      detail?.conciliado,
      detail?.status
    ].map((value) => normalizeText(value)).filter(Boolean);

    if (statusValues.some((value) => value.includes('sin conciliar'))) return false;
    return statusValues.some((value) => value.includes('concili'));
  }

  function getFilteredCommissionDetails() {
    const details = state.dashboard?.details || [];
    const reconciliationFiltered = state.reconciliationFilter === 'conciliated'
      ? details.filter(isConciliatedDetail)
      : state.reconciliationFilter === 'not_conciliated'
        ? details.filter((detail) => !isConciliatedDetail(detail))
        : details;
    const clubFiltered = state.clubFilter === 'only'
      ? reconciliationFiltered.filter((detail) => normalizeText(detail.category) === 'club')
      : state.clubFilter === 'exclude'
        ? reconciliationFiltered.filter((detail) => normalizeText(detail.category) !== 'club')
        : reconciliationFiltered;
    const typeFiltered = state.typeFilter
      ? clubFiltered.filter((detail) => normalizeText(detail.tipo) === state.typeFilter)
      : clubFiltered;

    const search = normalizeText(state.clientSearch);
    if (!search) return typeFiltered;
    return typeFiltered.filter((detail) => normalizeText(detail.clientName).includes(search));
  }

  function buildPeopleFromDetails(details) {
    const peopleMap = new Map();

    (details || []).forEach((detail) => {
      const key = `${normalizeText(detail.area)}|${normalizeText(detail.person)}|${normalizeText(detail.role)}`;
      const current = peopleMap.get(key) || {
        area: detail.area,
        person: detail.person,
        role: detail.role,
        totalCommission: 0,
        totalBase: 0,
        transactionCount: 0,
        agendas: 0,
        clubSalesSequential: 0
      };

      current.totalCommission += Number(detail.commissionAmount || 0);
      current.totalBase += Number(detail.baseAmount || 0);
      current.transactionCount += 1;
      current.agendas = Math.max(current.agendas, Number(detail.counters?.agendas || 0));
      if (detail.role === 'Setter') {
        current.agendas = Math.max(current.agendas, getAgendaRowsCountForPerson(detail.person));
      }
      current.clubSalesSequential = Math.max(current.clubSalesSequential, Number(detail.counters?.clubSalesSequential || 0));
      peopleMap.set(key, current);
    });

    return [...peopleMap.values()].sort((a, b) => b.totalCommission - a.totalCommission || a.person.localeCompare(b.person, 'es'));
  }

  function getReconciliationFilterLabel() {
    if (state.reconciliationFilter === 'conciliated') return 'conciliados';
    if (state.reconciliationFilter === 'not_conciliated') return 'no conciliados';
    return 'todos';
  }

  function getClubFilterLabel() {
    if (state.clubFilter === 'only') return 'solo club';
    if (state.clubFilter === 'exclude') return 'sin club';
    return 'todo';
  }

  function getTypeFilterLabel() {
    if (state.typeFilter === 'venta') return 'venta';
    if (state.typeFilter === 'cobranza') return 'cobranza';
    return 'todo';
  }

  function updateCommissionsStatus() {
    const filteredDetails = getFilteredCommissionDetails();
    setStatus(`Comisiones cargadas para ${getMonthLabel(state.month)}. ${formatInteger(new Set(filteredDetails.map((detail) => detail.transactionId).filter(Boolean)).size)} transacciones y ${formatInteger(filteredDetails.length)} líneas de comisión. Conciliación: ${getReconciliationFilterLabel()} | Club: ${getClubFilterLabel()} | Tipo: ${getTypeFilterLabel()}${state.clientSearch ? ` | Cliente: ${state.clientSearch}` : ''}.`);
  }

  function uniqueSortedValues(rows, field) {
    return [...new Set(
      (rows || [])
        .map((row) => String(row?.[field] || '').trim())
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, 'es'));
  }

  function normalizeAgendaRows(rows) {
    return (rows || [])
      .map((row) => ({
        id: String(row.id || '').trim(),
        clientName: String(row.nombre || '').trim() || 'Sin nombre',
        ghlid: String(row.ghlid || '').trim(),
        setter: String(row.setter || '').trim(),
        closer: String(row.closer || '').trim(),
        agendaDate: String(row.fecha_agenda || '').trim().slice(0, 10),
        callDate: String(row.fecha_llamada || '').trim().slice(0, 10),
        origin: String(row.origen || row.primer_origen || '').trim(),
        firstOrigin: String(row.primer_origen || '').trim(),
        lastOrigin: String(row.ultimo_origen || '').trim(),
        calendar: String(row.calendario_agendado || '').trim(),
        quality: String(row.calidad_lead || '').trim(),
        strategy: String(row.estrategia_a || '').trim(),
        agendo: String(row.agendo || '').trim(),
        aplica: String(row.aplica || '').trim(),
        llamada: String(row.llamada_meg || '').trim(),
        productInterest: String(row.producto_de_interes || '').trim(),
        productSold: String(row.producto_adq || '').trim(),
        megStage: String(row.embudo_meg || '').trim(),
        clubStage: String(row.embudo_club || '').trim(),
        settingFollowup: String(row.seguimiento_setting || '').trim(),
        mail: String(row.mail || '').trim(),
        phone: String(row.telefono || row.whatsapp || '').trim()
      }))
      .filter((row) => matchesApsetOrRt(row.lastOrigin) || matchesApsetOrRt(row.calendar))
      .filter((row) => row.setter && row.agendaDate && normalizeText(row.agendo) === 'agendo')
      .sort((a, b) => String(b.agendaDate || '').localeCompare(String(a.agendaDate || '')) || a.clientName.localeCompare(b.clientName, 'es'));
  }

  function filterAgendaRows(rows, filters) {
    return (rows || []).filter((row) => {
      if (filters.setter && normalizeText(row.setter) !== normalizeText(filters.setter)) return false;
      if (filters.from && row.agendaDate && row.agendaDate < filters.from) return false;
      if (filters.to && row.agendaDate && row.agendaDate > filters.to) return false;
      if (filters.lastOrigin && normalizeText(row.lastOrigin) !== normalizeText(filters.lastOrigin)) return false;
      if (Array.isArray(filters.quality) && filters.quality.length) {
        const allowedQualities = filters.quality.map((value) => normalizeText(value));
        if (!allowedQualities.includes(normalizeText(row.quality))) return false;
      }
      if (filters.aplica && normalizeText(row.aplica) !== normalizeText(filters.aplica)) return false;
      if (filters.calendar && normalizeText(row.calendar) !== normalizeText(filters.calendar)) return false;
      return true;
    });
  }

  function groupPeopleByRole(people) {
    const groups = new Map();
    (people || []).forEach((person) => {
      const key = formatRoleLabel(person.role);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(person);
    });

    return [...groups.entries()].map(([role, rows]) => ({ role, rows }));
  }

  function buildSheetRows(details) {
    const rowsMap = new Map();

    (details || []).forEach((detail) => {
      const role = formatRoleLabel(detail.role);
      const key = `${role}|${detail.person}`;
      const current = rowsMap.get(key) || {
        type: role.toLowerCase(),
        role,
        person: detail.person || '-',
        ventasMeg: 0,
        ventasClub: 0,
        ventasSetting: 0,
        agendas: 0,
        settingPct: null,
        facturacion: 0,
        cc: 0,
        comisionMegUsd: 0,
        comisionMegArs: 0,
        comisionClubArs: 0,
        comisionSetting: 0,
        total: 0
      };

      const type = String(detail.tipo || '').trim().toLowerCase();
      const isSale = type === 'venta';

      if (detail.role === 'Closer' && detail.category === 'MEG' && isSale) current.ventasMeg += 1;
      if (detail.role === 'Closer' && detail.category === 'Club' && isSale) current.ventasClub += 1;
      if (detail.role === 'Setter' && detail.category === 'Club' && isSale) current.ventasClub += 1;
      if (detail.role === 'Setter' && detail.category === 'MEG' && isSale) current.ventasSetting += 1;

      if (detail.role === 'Closer' && detail.category === 'MEG') {
        if (isSale) current.facturacion += Number(detail.facturacionArs || 0);
        current.cc += Number(detail.cashArs || 0);
        current.comisionMegArs += Number(detail.commissionAmount || 0);
      }

      if (detail.role === 'Setter' && detail.category === 'MEG') {
        if (isSale) current.facturacion += Number(detail.facturacionArs || 0);
        current.cc += Number(detail.cashArs || 0);
        current.comisionSetting += Number(detail.commissionAmount || 0);
        if (current.settingPct === null && Number(detail.commissionPct || 0) > 0) {
          current.settingPct = Number(detail.commissionPct || 0);
        }
      }

      if (detail.category === 'Club') {
        if (detail.role === 'Setter') {
          if (isSale) current.facturacion += Number(detail.facturacionArs || 0);
          current.cc += Number(detail.cashArs || 0);
        }
        if (detail.role === 'Closer') {
          if (isSale) current.facturacion += Number(detail.facturacionArs || 0);
          current.cc += Number(detail.cashArs || 0);
        }
        current.comisionClubArs += Number(detail.commissionAmount || 0);
      }

      if (detail.role === 'Setter') {
        current.agendas = Math.max(current.agendas, getAgendaRowsCountForPerson(detail.person));
      }

      current.total += Number(detail.commissionAmount || 0);
      rowsMap.set(key, current);
    });

    const roleOrder = { Closers: 0, Setters: 1 };
    return [...rowsMap.values()].sort((a, b) => {
      const roleDiff = (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99);
      if (roleDiff) return roleDiff;
      return a.person.localeCompare(b.person, 'es');
    });
  }

  function buildAreaCommercialSummary(details) {
    const rows = details || [];
    const isMeg = (detail) => detail.category === 'MEG';
    const isSale = (detail) => String(detail.tipo || '').trim().toLowerCase() === 'venta';
    const hasVsl = (detail) => String(detail.origin || '').toUpperCase().includes('VSL');
    const hasRt = (detail) => String(detail.calendar || '').toUpperCase().includes('RT');
    const sumBy = (arr, getter) => arr.reduce((sum, item) => sum + Number(getter(item) || 0), 0);

    const closerMegSales = rows.filter((detail) => detail.role === 'Closer' && isMeg(detail) && isSale(detail));
    const setterMegRows = rows.filter((detail) => detail.role === 'Setter' && isMeg(detail));

    const vslCloserSales = closerMegSales.filter(hasVsl);
    const rtSetterRows = setterMegRows.filter(hasRt);

    const totalCloserFacturacion = sumBy(closerMegSales, (detail) => detail.baseAmount);
    const totalSetterCc = sumBy(setterMegRows, (detail) => detail.baseAmount);
    const totalCommercialGain = totalSetterCc * 0.04;

    const vslCc = sumBy(setterMegRows.filter(hasVsl), (detail) => detail.baseAmount);
    const rtCc = sumBy(rtSetterRows, (detail) => detail.baseAmount);
    const vslGain = vslCc * 0.1;
    const rtGain = rtCc * 0.05;

    return [
      {
        label: 'VSL',
        ventasMeg: vslCloserSales.length,
        facturacion: sumBy(vslCloserSales, (detail) => detail.baseAmount),
        cc: vslCc,
        percentage: 0.1,
        gain: vslGain,
        gainFinal: vslGain,
        total: vslGain + rtGain
      },
      {
        label: 'VSL + RT',
        ventasMeg: '',
        facturacion: '',
        cc: rtCc,
        percentage: 0.05,
        gain: rtGain,
        gainFinal: rtGain,
        total: ''
      },
      {
        label: 'Comercial',
        ventasMeg: closerMegSales.length,
        facturacion: totalCloserFacturacion,
        cc: totalSetterCc,
        percentage: 0.04,
        gain: totalCommercialGain,
        gainFinal: totalCommercialGain,
        total: ''
      },
      {
        label: 'CSM',
        ventasMeg: closerMegSales.length,
        facturacion: totalCloserFacturacion,
        cc: totalSetterCc,
        percentage: 0.04,
        gain: totalCommercialGain,
        gainFinal: totalCommercialGain,
        total: ''
      }
    ];
  }

  function renderSheetOverview(dashboard) {
    const node = document.getElementById('commissionsSheetOverview');
    const filteredDetails = getFilteredCommissionDetails();
    const rows = buildSheetRows(filteredDetails);
    const commercialSummaryRows = buildAreaCommercialSummary(filteredDetails);
    const summary = {
      transactionCount: new Set(filteredDetails.map((detail) => detail.transactionId).filter(Boolean)).size,
      commissionLineCount: filteredDetails.length
    };
    if (!rows.length) {
      node.innerHTML = '<div class="card comisiones-empty">No encontré comisiones calculables para este mes.</div>';
      return;
    }

    const { year, month } = getMonthParts(state.month);
    const totalClubCommission = rows.reduce((sum, row) => sum + Number(row.comisionClubArs || 0), 0);
    const totalMegCommission = rows.reduce((sum, row) => sum + Number(row.comisionMegArs || 0) + Number(row.comisionSetting || 0), 0);
    const totalCommission = rows.reduce((sum, row) => sum + Number(row.total || 0), 0);
    const nahuelAgendaCount = state.agendaRows.filter((row) => isNahuelSetter(row.setter)).length;

    node.innerHTML = `
      <section class="card comisiones-sheet-card">
        <div class="comisiones-sheet-grid" aria-hidden="true"></div>
        <div class="comisiones-sheet-layout">
          <div class="comisiones-sheet-main">
            <section class="comisiones-overview-hero">
              <div class="comisiones-overview-hero-icon" aria-hidden="true">$</div>
              <div class="comisiones-overview-hero-copy">
                <h3>Resumen de ${escapeHtml(getMonthLabel(state.month))}</h3>
              </div>
              <div class="comisiones-overview-kpis">
                <article class="comisiones-overview-kpi is-club">
                  <span>Comisiones Club</span>
                  <strong>${formatCurrency(totalClubCommission)}</strong>
                  <p>Total club del mes</p>
                </article>
                <article class="comisiones-overview-kpi is-meg">
                  <span>Comisiones MEG</span>
                  <strong>${formatCurrency(totalMegCommission)}</strong>
                  <p>MEG + setting del mes</p>
                </article>
                <article class="comisiones-overview-kpi is-total">
                  <span>Total</span>
                  <strong>${formatCurrency(totalCommission)}</strong>
                  <p>Total a cobrar</p>
                </article>
                <article class="comisiones-overview-kpi is-agendas">
                  <span>Agendas Nahuel</span>
                  <strong>${formatInteger(nahuelAgendaCount)}</strong>
                  <p>Total del mes por fecha de agendamiento</p>
                </article>
              </div>
            </section>

            <div class="comisiones-sheet-meta">
              <table class="comisiones-sheet-mini">
                <tbody>
                  <tr>
                    <th>Periodo</th>
                    <th>Año</th>
                  </tr>
                  <tr>
                    <td>${escapeHtml(month)}</td>
                    <td>${escapeHtml(year)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="comisiones-sheet-table-wrap">
              <table class="comisiones-sheet-table">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Integrante</th>
                    <th>Ventas MEG</th>
                    <th>Ventas CLUB</th>
                    <th>Ventas setting</th>
                    <th>Agendas</th>
                    <th>% Setting</th>
                    <th>Facturacion</th>
                    <th>CC</th>
                    <th>Comision MEG US</th>
                    <th>Comision MEG ARS</th>
                    <th>Comision CLUB ARS</th>
                    <th>Comision Setting</th>
                    <th>Total a cobrar</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows.map((row, index) => `
                    <tr>
                      <td>${index === 0 || rows[index - 1].role !== row.role ? `<span class="comisiones-sheet-role">${escapeHtml(row.type)}</span>` : ''}</td>
                      <td><button class="comisiones-inline-link comisiones-sheet-link" type="button" data-person="${escapeHtml(row.person)}">${escapeHtml(row.person)}</button></td>
                      <td>${formatSheetInteger(row.ventasMeg)}</td>
                      <td>${formatSheetInteger(row.ventasClub)}</td>
                      <td>${formatSheetInteger(row.ventasSetting)}</td>
                      <td>${buildAgendaCountButton(row.person, row.agendas)}</td>
                      <td>${row.settingPct !== null ? formatSheetPercent(row.settingPct) : ''}</td>
                      <td>${formatSheetCurrency(row.facturacion)}</td>
                      <td>${formatSheetCurrency(row.cc)}</td>
                      <td>${formatSheetCurrency(row.comisionMegUsd)}</td>
                      <td>${formatSheetCurrency(row.comisionMegArs)}</td>
                      <td>${formatSheetCurrency(row.comisionClubArs)}</td>
                      <td>${formatSheetCurrency(row.comisionSetting)}</td>
                      <td>${formatSheetCurrency(row.total)}</td>
                    </tr>
                  `).join('')}
                  <tr class="comisiones-sheet-total-row">
                    <td colspan="2">Totales</td>
                    <td>${formatInteger(rows.reduce((sum, row) => sum + row.ventasMeg, 0))}</td>
                    <td>${formatInteger(rows.reduce((sum, row) => sum + row.ventasClub, 0))}</td>
                    <td>${formatInteger(rows.reduce((sum, row) => sum + row.ventasSetting, 0))}</td>
                    <td>${formatInteger(rows.reduce((sum, row) => sum + row.agendas, 0))}</td>
                    <td></td>
                    <td>${formatCurrency(rows.reduce((sum, row) => sum + row.facturacion, 0))}</td>
                    <td>${formatCurrency(rows.reduce((sum, row) => sum + row.cc, 0))}</td>
                    <td>${formatCurrency(rows.reduce((sum, row) => sum + row.comisionMegUsd, 0))}</td>
                    <td>${formatCurrency(rows.reduce((sum, row) => sum + row.comisionMegArs, 0))}</td>
                    <td>${formatCurrency(rows.reduce((sum, row) => sum + row.comisionClubArs, 0))}</td>
                    <td>${formatCurrency(rows.reduce((sum, row) => sum + row.comisionSetting, 0))}</td>
                    <td>${formatCurrency(rows.reduce((sum, row) => sum + row.total, 0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="comisiones-sheet-bottom">
              <table class="comisiones-sheet-summary comisiones-sheet-summary-commercial">
                <thead>
                  <tr>
                    <th>Area</th>
                    <th>Ventas MEG</th>
                    <th>Facturacion</th>
                    <th>CC</th>
                    <th>Porcentaje</th>
                    <th>Ganancia</th>
                    <th>Ganancia Final</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${commercialSummaryRows.map((row) => `
                    <tr>
                      <td>${escapeHtml(row.label)}</td>
                      <td>${row.ventasMeg === '' ? '' : formatSheetInteger(row.ventasMeg)}</td>
                      <td>${row.facturacion === '' ? '' : formatSheetCurrency(row.facturacion)}</td>
                      <td>${row.cc === '' ? '' : formatSheetCurrency(row.cc)}</td>
                      <td>${row.percentage ? formatSheetPercent(row.percentage) : ''}</td>
                      <td>${row.gain === '' ? '' : formatSheetCurrency(row.gain)}</td>
                      <td>${row.gainFinal === '' ? '' : formatSheetCurrency(row.gainFinal)}</td>
                      <td>${row.total === '' ? '' : formatSheetCurrency(row.total)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>

            </div>
          </div>
        </div>
      </section>
    `;

    node.querySelectorAll('[data-person]').forEach((button) => {
      button.addEventListener('click', () => {
        state.selectedPerson = button.dataset.person;
        personSelect.value = state.selectedPerson;
        setActiveTab('person');
        renderPersonPanel();
      });
    });

    node.querySelectorAll('[data-agenda-person]').forEach((button) => {
      button.addEventListener('click', () => openAgendaPanel(button.dataset.agendaPerson));
    });
  }

  function fillPersonSelect(people) {
    const options = [
      `<option value="${ALL_PEOPLE_VALUE}">Total comprobantes</option>`,
      '<option value="">Seleccioná una persona</option>'
    ];
    (people || []).forEach((person) => {
      options.push(`<option value="${escapeHtml(person.person)}">${escapeHtml(person.person)} · ${escapeHtml(person.area)}</option>`);
    });
    personSelect.innerHTML = options.join('');
    if (state.selectedPerson) personSelect.value = state.selectedPerson;
  }

  function renderPersonPanel() {
    const summaryNode = document.getElementById('commissionPersonSummary');
    const detailNode = document.getElementById('commissionPersonDetails');
    const allDetails = getFilteredCommissionDetails();
    const filteredPeople = buildPeopleFromDetails(allDetails);
    const isAllView = state.selectedPerson === ALL_PEOPLE_VALUE;
    const person = filteredPeople.find((row) => row.person === state.selectedPerson) || null;
    const details = isAllView
      ? allDetails
      : allDetails.filter((row) => row.person === state.selectedPerson);
    const displayDetails = buildDisplayComprobanteRows(details, isAllView);

    if (isAllView) {
      const uniqueTransactions = new Set(details.map((detail) => detail.transactionId).filter(Boolean));
      summaryNode.innerHTML = `
        <div class="card comisiones-person-card">
          <h3>Total comprobantes</h3>
          <p>Vista consolidada de todas las líneas del mes</p>
          <div class="comisiones-person-kpis">
            <span><strong>${formatCurrency(details.reduce((sum, detail) => sum + Number(detail.commissionAmount || 0), 0))}</strong> comisión total</span>
            <span><strong>${formatCurrency(details.reduce((sum, detail) => sum + Number(detail.baseAmount || 0), 0))}</strong> CC tomado</span>
            <span><strong>${formatInteger(uniqueTransactions.size)}</strong> comprobantes únicos</span>
            <span><strong>${formatInteger(displayDetails.length)}</strong> filas visibles</span>
            <span><strong>${formatInteger(filteredPeople.length)}</strong> personas con comisión</span>
          </div>
        </div>
      `;
    } else if (!state.selectedPerson || !person) {
      summaryNode.innerHTML = '<div class="card comisiones-empty">Seleccioná una persona para ver su detalle.</div>';
      detailNode.innerHTML = '';
      return;
    } else {
      const agendaCountMarkup = person.agendas > 0
        ? `<button class="comisiones-inline-link comisiones-agenda-kpi-link" type="button" data-agenda-person="${escapeHtml(person.person)}"><strong>${formatInteger(person.agendas)}</strong> agendas del mes</button>`
        : `<span><strong>${formatInteger(person.agendas)}</strong> agendas del mes</span>`;
      summaryNode.innerHTML = `
        <div class="card comisiones-person-card">
          <h3>${escapeHtml(person.person)}</h3>
          <p>${escapeHtml(person.area)} · ${escapeHtml(person.role)}</p>
          <div class="comisiones-person-kpis">
            <span><strong>${formatCurrency(person.totalCommission)}</strong> comisión total</span>
            <span><strong>${formatCurrency(person.totalBase)}</strong> CC tomado</span>
            <span><strong>${formatInteger(person.transactionCount)}</strong> transacciones</span>
            ${agendaCountMarkup}
            <span><strong>${formatInteger(person.clubSalesSequential)}</strong> ventas Club</span>
          </div>
        </div>
      `;
    }

    detailNode.innerHTML = `
        <table class="csm-table comisiones-table">
          <thead>
            <tr>
              <th>Estado</th>
              <th>Fecha de venta</th>
              <th>Tipo</th>
              <th>Cheque</th>
              <th>F.acreditación</th>
              <th>Producto</th>
              <th>Nombre cliente</th>
              <th>Responsable venta</th>
              <th>Cash collected ARS</th>
              <th>Fact</th>
              <th>Porcentaje</th>
              <th>TC</th>
              <th>Origen</th>
              <th>Calendario</th>
              <th>Cash USD</th>
              <th>IVA</th>
              <th>Comisiones</th>
              <th>Total neto</th>
              <th>Comisión final ARS</th>
              <th>Setter</th>
              <th>% Setter</th>
              <th>Comisión Setter</th>
              <th>ID</th>
            </tr>
          </thead>
          <tbody>
            ${displayDetails.length ? displayDetails.map((detail) => {
              const notionUrl = buildNotionPageUrl(detail.transactionId);
              const isSetter = detail.role === 'Setter';
              const setterPct = isSetter
                ? Number(detail.commissionPct || 0)
                : Number(detail.setterPctDisplay || 0);
              const setterCommission = isSetter
                ? Number(detail.commissionAmount || 0)
                : Number(detail.setterCommissionDisplay || 0);
              return `
                <tr>
                  <td>${renderComprobanteStatusBadge(detail.status)}</td>
                  <td>${escapeHtml(formatDetailDate(detail.date))}</td>
                  <td>${escapeHtml(formatDetailText(detail.tipo))}</td>
                  <td>${renderChequeBadge(detail.cheque)}</td>
                  <td>${escapeHtml(formatDetailDate(detail.acreditacionDate))}</td>
                  <td>${escapeHtml(formatComprobanteProduct(detail))}</td>
                  <td>${escapeHtml(formatDetailText(detail.clientName))}</td>
                  <td>${escapeHtml(formatDetailText(detail.closer))}</td>
                  <td>${formatDetailCurrency(detail.cashArs)}</td>
                  <td>${formatDetailUsd(detail.facturacionUsd)}</td>
                  <td>${formatDetailPercent(detail.commissionPct)}</td>
                  <td>${formatDetailCurrency(detail.tc)}</td>
                  <td>${escapeHtml(formatDetailText(detail.origin))}</td>
                  <td>${escapeHtml(formatDetailText(detail.calendar))}</td>
                  <td>${formatDetailUsd(detail.cashUsd)}</td>
                  <td>${formatDetailCurrency(detail.ivaArs)}</td>
                  <td>${formatDetailCurrency(detail.externalCommissionsArs)}</td>
                  <td>${formatDetailCurrency(detail.netTotalArs)}</td>
                  <td>${formatDetailCurrency(detail.commissionAmount)}</td>
                  <td>${escapeHtml(formatDetailText(detail.setter))}</td>
                  <td>${formatDetailPercent(setterPct)}</td>
                  <td>${formatDetailCurrency(setterCommission)}</td>
                  <td>${notionUrl ? `<a class="comisiones-external-link" href="${escapeHtml(notionUrl)}" target="_blank" rel="noreferrer">${escapeHtml(detail.transactionId || '')}</a>` : ''}</td>
                </tr>
              `;
            }).join('') : `<tr><td colspan="22">${isAllView ? 'No hay comprobantes para este mes.' : 'No hay transacciones para esta persona.'}</td></tr>`}
          </tbody>
        </table>
    `;

    const personTable = detailNode.querySelector('table');
    fillPinnedColumnSelect(pinnedPersonColumnSelect, buildPinnedOptionsFromTable(personTable), state.pinnedPersonColumn);
    applyPinnedColumn(personTable, state.pinnedPersonColumn);
    bindPinnedColumnHeaders(personTable, pinnedPersonColumnSelect, 'pinnedPersonColumn');

    summaryNode.querySelectorAll('[data-agenda-person]').forEach((button) => {
      button.addEventListener('click', () => openAgendaPanel(button.dataset.agendaPerson));
    });
  }

  function renderAgendaPanel() {
    const summaryNode = document.getElementById('commissionAgendaSummary');
    const detailNode = document.getElementById('commissionAgendaDetails');
    const filteredRows = filterAgendaRows(state.agendaRows, state.agendaFilters);
    const setterLabel = state.agendaFilters.setter || 'Todos los setters';
    const uniqueOrigins = new Set(filteredRows.map((row) => row.lastOrigin).filter(Boolean));
    const uniqueQualities = new Set(filteredRows.map((row) => row.quality).filter(Boolean));
    const uniqueCalendars = new Set(filteredRows.map((row) => row.calendar).filter(Boolean));
    const nahuelRows = filteredRows.filter((row) => isNahuelSetter(row.setter));
    const topOriginEntry = [...filteredRows.reduce((map, row) => {
      const key = row.lastOrigin || 'Sin último origen';
      map.set(key, Number(map.get(key) || 0) + 1);
      return map;
    }, new Map()).entries()].sort((a, b) => b[1] - a[1])[0] || null;

    summaryNode.innerHTML = `
      <div class="card comisiones-person-card comisiones-agendas-card">
        <div class="comisiones-agendas-head">
          <div>
            <h3>${escapeHtml(setterLabel)}</h3>
            <p>Base de agendas del mes por <strong>fecha_agenda</strong>, tomando solo filas con <strong>último origen</strong> o <strong>calendario agendado</strong> en APSET / RT.</p>
          </div>
          <div class="comisiones-agendas-period">
            <span>${escapeHtml(state.agendaFilters.from || '-')}</span>
            <span>${escapeHtml(state.agendaFilters.to || '-')}</span>
          </div>
        </div>
        <div class="comisiones-agendas-kpis">
          <article class="comisiones-summary-card">
            <span>Agendas filtradas</span>
            <strong>${formatInteger(filteredRows.length)}</strong>
            <p>Total del recorte actual.</p>
          </article>
          <article class="comisiones-summary-card">
            <span>Agendas Nahuel</span>
            <strong>${formatInteger(nahuelRows.length)}</strong>
            <p>Dentro del filtro activo.</p>
          </article>
          <article class="comisiones-summary-card">
            <span>Últimos orígenes</span>
            <strong>${formatInteger(uniqueOrigins.size)}</strong>
            <p>${topOriginEntry ? `Principal: ${escapeHtml(topOriginEntry[0])}` : 'Sin origen dominante.'}</p>
          </article>
          <article class="comisiones-summary-card">
            <span>Calidades / calendarios</span>
            <strong>${formatInteger(uniqueQualities.size)} / ${formatInteger(uniqueCalendars.size)}</strong>
            <p>Dimensiones activas en el filtro.</p>
          </article>
        </div>
      </div>
    `;

    detailNode.innerHTML = `
      <div class="comisiones-table-wrap">
        <table class="csm-table comisiones-table">
          <thead>
            <tr>
              <th>Fecha agenda</th>
              <th>Cliente</th>
              <th>Setter</th>
              <th>Closer</th>
              <th>Último origen</th>
              <th>Calendario agendado</th>
              <th>Calidad</th>
              <th>Aplica</th>
              <th>Interés</th>
              <th>Embudo MEG</th>
              <th>Embudo Club</th>
              <th>Fecha llamada</th>
              <th>Venta</th>
              <th>GHL ID</th>
            </tr>
          </thead>
          <tbody>
            ${filteredRows.length ? filteredRows.map((row) => `
              <tr>
                <td>${escapeHtml(formatDetailDate(row.agendaDate))}</td>
                <td>${escapeHtml(row.clientName)}</td>
                <td>${escapeHtml(row.setter || '-')}</td>
                <td>${escapeHtml(row.closer || '-')}</td>
                <td>${escapeHtml(row.lastOrigin || '-')}</td>
                <td>${escapeHtml(row.calendar || '-')}</td>
                <td>${escapeHtml(row.quality || '-')}</td>
                <td>${escapeHtml(row.aplica || '-')}</td>
                <td>${escapeHtml(row.productInterest || '-')}</td>
                <td>${escapeHtml(row.megStage || '-')}</td>
                <td>${escapeHtml(row.clubStage || '-')}</td>
                <td>${escapeHtml(formatDetailDate(row.callDate))}</td>
                <td>${escapeHtml(row.productSold || '-')}</td>
                <td>${renderGhlIdCell(row.ghlid)}</td>
              </tr>
            `).join('') : '<tr><td colspan="14">No hay agendas para los filtros seleccionados.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;

    const agendaTable = detailNode.querySelector('table');
    fillPinnedColumnSelect(pinnedAgendaColumnSelect, buildPinnedOptionsFromTable(agendaTable), state.pinnedAgendaColumn);
    applyPinnedColumn(agendaTable, state.pinnedAgendaColumn);
    bindPinnedColumnHeaders(agendaTable, pinnedAgendaColumnSelect, 'pinnedAgendaColumn');
  }

  function syncAgendaFilterControls() {
    const setterSelect = document.getElementById('commissionAgendaSetterSelect');
    const lastOriginSelect = document.getElementById('commissionAgendaLastOriginSelect');
    const calendarSelect = document.getElementById('commissionAgendaCalendarSelect');
    const aplicaSelect = document.getElementById('commissionAgendaAplicaSelect');

    fillSimpleSelect(setterSelect, uniqueSortedValues(state.agendaRows, 'setter'), state.agendaFilters.setter);
    fillSimpleSelect(lastOriginSelect, uniqueSortedValues(state.agendaRows, 'lastOrigin'), state.agendaFilters.lastOrigin);
    renderAgendaQualityChecks();
    fillSimpleSelect(calendarSelect, uniqueSortedValues(state.agendaRows, 'calendar'), state.agendaFilters.calendar);
    fillSimpleSelect(aplicaSelect, uniqueSortedValues(state.agendaRows, 'aplica'), state.agendaFilters.aplica);
    if (agendaDateFromInput) agendaDateFromInput.value = state.agendaFilters.from || '';
    if (agendaDateToInput) agendaDateToInput.value = state.agendaFilters.to || '';
  }

  function openAgendaPanel(person = '') {
    state.agendaFilters.setter = person || '';
    syncAgendaFilterControls();
    renderAgendaPanel();
    setActiveTab('agendas');
  }

  function createScaleRowMarkup(type, index, row) {
    return `
      <div class="comisiones-scale-row" data-scale-type="${escapeHtml(type)}" data-index="${index}">
        <label>
          <span>${type === 'agendaScale' ? 'Desde agendas' : type === 'setterSalesScale' ? 'Desde ventas' : 'Desde'}</span>
          <input type="number" data-field="min" min="0" step="1" value="${escapeHtml(row.min)}" />
        </label>
        <label>
          <span>Porcentaje</span>
          <input type="number" data-field="pct" min="0" step="0.001" value="${escapeHtml(row.pct)}" />
        </label>
        <button type="button" class="button-secondary" data-remove-scale="${escapeHtml(type)}" data-index="${index}">Quitar</button>
      </div>
    `;
  }

  function createOverrideRowMarkup(index, row) {
    return `
      <div class="comisiones-scale-row" data-override-index="${index}">
        <label>
          <span>Persona</span>
          <input type="text" data-field="person" value="${escapeHtml(row.person || '')}" />
        </label>
        <label>
          <span>Porcentaje</span>
          <input type="number" data-field="pct" min="0" step="0.001" value="${escapeHtml(row.pct ?? '')}" />
        </label>
        <label class="comisiones-checkbox-inline">
          <input type="checkbox" data-field="enabled" ${row.enabled !== false ? 'checked' : ''} />
          <span>Activo</span>
        </label>
        <button type="button" class="button-secondary" data-remove-override="${index}">Quitar</button>
      </div>
    `;
  }

  function createAreaRowMarkup(index, row) {
    return `
      <div class="comisiones-scale-row" data-area-index="${index}">
        <label>
          <span>Persona</span>
          <input type="text" data-field="person" value="${escapeHtml(row.person || '')}" />
        </label>
        <label>
          <span>Área</span>
          <select data-field="area">
            <option value="Comercial" ${row.area === 'Comercial' ? 'selected' : ''}>Comercial</option>
            <option value="CSM" ${row.area === 'CSM' ? 'selected' : ''}>CSM</option>
            <option value="Administración" ${row.area === 'Administración' ? 'selected' : ''}>Administración</option>
          </select>
        </label>
        <button type="button" class="button-secondary" data-remove-area="${index}">Quitar</button>
      </div>
    `;
  }

  function createRoleRowMarkup(index, row) {
    const options = state.rolePeopleOptions.map((person) => `
      <option value="${escapeHtml(person)}" ${row.person === person ? 'selected' : ''}>${escapeHtml(person)}</option>
    `).join('');
    return `
      <div class="comisiones-scale-row comisiones-role-row" data-role-index="${index}">
        <label>
          <span>Persona</span>
          <select data-field="person">
            ${options}
          </select>
        </label>
        <label>
          <span>Rol</span>
          <select data-field="role">
            <option value="Closer" ${row.role === 'Closer' ? 'selected' : ''}>Closer</option>
            <option value="Setter" ${row.role === 'Setter' ? 'selected' : ''}>Setter</option>
            <option value="Ambos" ${row.role === 'Ambos' ? 'selected' : ''}>Ambos</option>
          </select>
        </label>
      </div>
    `;
  }

  function attachRulesHandlers() {
    document.querySelectorAll('[data-remove-scale]').forEach((button) => {
      button.addEventListener('click', () => {
        const type = button.dataset.removeScale;
        const index = Number(button.dataset.index);
        state.rulesDraft[type].splice(index, 1);
        renderRulesEditor();
      });
    });

    document.querySelectorAll('[data-remove-override]').forEach((button) => {
      button.addEventListener('click', () => {
        state.rulesDraft.fixedOverrides.splice(Number(button.dataset.removeOverride), 1);
        renderRulesEditor();
      });
    });

    document.querySelectorAll('[data-remove-area]').forEach((button) => {
      button.addEventListener('click', () => {
        state.rulesDraft.personAreas.splice(Number(button.dataset.removeArea), 1);
        renderRulesEditor();
      });
    });

  }

  function renderRulesEditor() {
    const config = state.rulesDraft;
    if (!config) return;

    document.getElementById('commissionMinimumSetterPct').value = config.global.minimumSetterPct ?? '';
    document.getElementById('commissionClubTransferPct').value = config.global.clubTransferPct ?? '';
    document.getElementById('commissionDefaultCloserPct').value = config.global.defaultCloserPct ?? '';
    document.getElementById('commissionPersonalizedCloserPct').value = config.global.personalizedCloserPct ?? '';
    document.getElementById('commissionOnlyVerified').checked = config.global.includeOnlyVerified !== false;
    ensureRoleRows(config);

    document.getElementById('commissionAgendaScaleRows').innerHTML = (config.agendaScale || [])
      .map((row, index) => createScaleRowMarkup('agendaScale', index, row)).join('');
    document.getElementById('commissionSetterSalesScaleRows').innerHTML = (config.setterSalesScale || [])
      .map((row, index) => createScaleRowMarkup('setterSalesScale', index, row)).join('');
    document.getElementById('commissionClubScaleRows').innerHTML = (config.clubScale || [])
      .map((row, index) => createScaleRowMarkup('clubScale', index, row)).join('');
    document.getElementById('commissionOverrideRows').innerHTML = (config.fixedOverrides || [])
      .map((row, index) => createOverrideRowMarkup(index, row)).join('');
    document.getElementById('commissionRoleRows').innerHTML = (config.personRoles || [])
      .map((row, index) => createRoleRowMarkup(index, row)).join('');
    document.getElementById('commissionAreaRows').innerHTML = (config.personAreas || [])
      .map((row, index) => createAreaRowMarkup(index, row)).join('');

    const lockNode = document.getElementById('commissionRulesLockState');
    lockNode.textContent = state.configMeta?.locked
      ? `Mes bloqueado: ${getMonthLabel(state.month)}. Las reglas ya no se pueden editar desde el panel.`
      : `Mes editable: ${getMonthLabel(state.month)}. Si lo bloqueás, queda protegido para no mover históricos.`;

    attachRulesHandlers();
  }

  function readScaleRows(containerId) {
    return Array.from(document.querySelectorAll(`#${containerId} .comisiones-scale-row`)).map((row) => ({
      min: Number(row.querySelector('[data-field="min"]').value || 0),
      pct: Number(row.querySelector('[data-field="pct"]').value || 0)
    })).filter((row) => Number.isFinite(row.min) && Number.isFinite(row.pct));
  }

  function readOverrideRows() {
    return Array.from(document.querySelectorAll('#commissionOverrideRows .comisiones-scale-row')).map((row) => ({
      person: row.querySelector('[data-field="person"]').value.trim(),
      pct: Number(row.querySelector('[data-field="pct"]').value || 0),
      enabled: row.querySelector('[data-field="enabled"]').checked
    })).filter((row) => row.person);
  }

  function readAreaRows() {
    return Array.from(document.querySelectorAll('#commissionAreaRows .comisiones-scale-row')).map((row) => ({
      person: row.querySelector('[data-field="person"]').value.trim(),
      area: row.querySelector('[data-field="area"]').value
    })).filter((row) => row.person);
  }

  function readRoleRows() {
    return Array.from(document.querySelectorAll('#commissionRoleRows .comisiones-scale-row')).map((row) => ({
      person: row.querySelector('[data-field="person"]').value.trim(),
      role: row.querySelector('[data-field="role"]').value
    })).filter((row) => row.person);
  }

  function collectRulesPayload() {
    return {
      global: {
        minimumSetterPct: Number(document.getElementById('commissionMinimumSetterPct').value || 0),
        clubTransferPct: Number(document.getElementById('commissionClubTransferPct').value || 0),
        defaultCloserPct: Number(document.getElementById('commissionDefaultCloserPct').value || 0),
        personalizedCloserPct: Number(document.getElementById('commissionPersonalizedCloserPct').value || 0),
        includeOnlyVerified: document.getElementById('commissionOnlyVerified').checked
      },
      agendaScale: readScaleRows('commissionAgendaScaleRows'),
      setterSalesScale: readScaleRows('commissionSetterSalesScaleRows'),
      clubScale: readScaleRows('commissionClubScaleRows'),
      fixedOverrides: readOverrideRows(),
      closerRules: Array.isArray(state.rulesDraft?.closerRules) ? state.rulesDraft.closerRules : [],
      personRoles: readRoleRows(),
      personAreas: readAreaRows(),
      notes: Array.isArray(state.rulesDraft?.notes) ? state.rulesDraft.notes : []
    };
  }

  async function loadRulesConfig() {
    const response = await window.metricasApi.fetchCommissionConfig(state.month);
    state.configMeta = response;
    state.rulesDraft = JSON.parse(JSON.stringify(response.config || {}));
    renderRulesEditor();
  }

  async function loadAgendaRows() {
    const { from, to } = getMonthRange(state.month);
    const response = await window.metricasApi.fetchAllRows('leads_raw', {
      select: 'id,nombre,ghlid,setter,closer,fecha_agenda,fecha_llamada,origen,primer_origen,ultimo_origen,calendario_agendado,calidad_lead,estrategia_a,agendo,aplica,llamada_meg,producto_de_interes,producto_adq,embudo_meg,embudo_club,seguimiento_setting,mail,telefono,whatsapp',
      from,
      to,
      dateField: 'fecha_agenda',
      orderBy: 'fecha_agenda',
      orderDir: 'desc'
    });
    state.agendaRows = normalizeAgendaRows(response.rows || []);
    state.agendaFilters.from = from;
    state.agendaFilters.to = to;
    syncAgendaFilterControls();
    renderAgendaPanel();
  }

  function refreshCommissionViews() {
    const filteredPeople = buildPeopleFromDetails(getFilteredCommissionDetails());
    renderSheetOverview(state.dashboard);
    fillPersonSelect(filteredPeople);
    if (
      state.selectedPerson
      && state.selectedPerson !== ALL_PEOPLE_VALUE
      && !filteredPeople.some((person) => person.person === state.selectedPerson)
    ) {
      state.selectedPerson = ALL_PEOPLE_VALUE;
      personSelect.value = state.selectedPerson;
    }
    if (!state.selectedPerson) {
      state.selectedPerson = filteredPeople.length ? ALL_PEOPLE_VALUE : '';
      if (state.selectedPerson) personSelect.value = state.selectedPerson;
    }
    renderPersonPanel();
  }

  async function loadDashboard() {
    setStatus(`Cargando comisiones de ${getMonthLabel(state.month)}...`);
    const response = await window.metricasApi.fetchCommissionsDashboard(state.month);
    state.dashboard = response;
    refreshCommissionViews();
    if (state.rulesDraft) renderRulesEditor();
    updateCommissionsStatus();
  }

  async function loadPage() {
    try {
      await Promise.all([loadDashboard(), loadRulesConfig(), loadAgendaRows()]);
    } catch (error) {
      console.error(error);
      setStatus(error.message || 'No pude cargar las comisiones.');
    }
  }

  async function saveRules(mode) {
    try {
      const config = collectRulesPayload();
      if (mode === 'default') {
        await window.metricasApi.saveDefaultCommissionConfig({ config });
        setStatus('La base futura de comisiones quedó guardada.');
      } else {
        await window.metricasApi.saveCommissionConfig({ month: state.month, config });
        setStatus(`Las reglas de ${getMonthLabel(state.month)} quedaron guardadas.`);
      }
      await loadPage();
    } catch (error) {
      console.error(error);
      setStatus(error.message || 'No pude guardar las reglas.');
    }
  }

  document.querySelectorAll('.comisiones-tab').forEach((button) => {
    button.addEventListener('click', () => setActiveTab(button.dataset.tab));
  });

  document.getElementById('reloadCommissions').addEventListener('click', loadPage);
  document.getElementById('saveCommissionRules').addEventListener('click', () => saveRules('month'));
  document.getElementById('addAgendaScaleRow').addEventListener('click', () => {
    state.rulesDraft.agendaScale.push({ min: 0, pct: 0 });
    renderRulesEditor();
  });
  document.getElementById('commissionSetterSalesScaleRows')?.addEventListener('change', () => {
    state.rulesDraft.setterSalesScale = readScaleRows('commissionSetterSalesScaleRows');
  });
  document.getElementById('addClubScaleRow').addEventListener('click', () => {
    state.rulesDraft.clubScale.push({ min: 0, pct: 0 });
    renderRulesEditor();
  });
  document.getElementById('addCommissionOverrideRow').addEventListener('click', () => {
    state.rulesDraft.fixedOverrides.push({ person: '', pct: 0, enabled: true });
    renderRulesEditor();
  });
  document.getElementById('addCommissionAreaRow').addEventListener('click', () => {
    state.rulesDraft.personAreas.push({ person: '', area: 'Comercial' });
    renderRulesEditor();
  });

  personSelect.addEventListener('change', () => {
    state.selectedPerson = personSelect.value;
    renderPersonPanel();
  });

  clientSearchInput?.addEventListener('input', () => {
    state.clientSearch = clientSearchInput.value || '';
    refreshCommissionViews();
    updateCommissionsStatus();
  });

  pinnedPersonColumnSelect?.addEventListener('change', () => {
    state.pinnedPersonColumn = pinnedPersonColumnSelect.value || PIN_NONE_VALUE;
    renderPersonPanel();
  });

  reconciliationFilterSelect?.addEventListener('change', () => {
    state.reconciliationFilter = reconciliationFilterSelect.value || '';
    refreshCommissionViews();
    updateCommissionsStatus();
  });

  clubFilterSelect?.addEventListener('change', () => {
    state.clubFilter = clubFilterSelect.value || '';
    refreshCommissionViews();
    updateCommissionsStatus();
  });

  typeFilterSelect?.addEventListener('change', () => {
    state.typeFilter = typeFilterSelect.value || '';
    refreshCommissionViews();
    updateCommissionsStatus();
  });

  [
    ['commissionAgendaSetterSelect', 'setter'],
    ['commissionAgendaDateFrom', 'from'],
    ['commissionAgendaDateTo', 'to'],
    ['commissionAgendaLastOriginSelect', 'lastOrigin'],
    ['commissionAgendaCalendarSelect', 'calendar'],
    ['commissionAgendaAplicaSelect', 'aplica']
  ].forEach(([id, key]) => {
    document.getElementById(id)?.addEventListener('change', (event) => {
      state.agendaFilters[key] = event.target.value || '';
      renderAgendaPanel();
    });
  });

  pinnedAgendaColumnSelect?.addEventListener('change', () => {
    state.pinnedAgendaColumn = pinnedAgendaColumnSelect.value || PIN_NONE_VALUE;
    renderAgendaPanel();
  });

  monthInput.value = getCurrentMonthValue();
  state.month = monthInput.value;
  monthInput.addEventListener('change', () => {
    state.month = monthInput.value;
    loadPage();
  });

  loadPage();
})();
