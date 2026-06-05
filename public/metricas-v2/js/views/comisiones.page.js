(function initComisionesPage() {
  const ALL_PEOPLE_VALUE = '__ALL__';
  const state = {
    month: '',
    dashboard: null,
    selectedPerson: '',
    configMeta: null,
    rulesDraft: null,
    rolePeopleOptions: []
  };

  const statusNode = document.getElementById('commissionsStatus');
  const monthInput = document.getElementById('commissionsMonth');
  const personSelect = document.getElementById('commissionPersonSelect');

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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

  function formatDetailText(value) {
    return String(value || '').trim();
  }

  function buildNotionPageUrl(pageId) {
    const id = String(pageId || '').trim();
    if (!id) return '';
    return `https://www.notion.so/${id.replace(/-/g, '')}`;
  }

  function getCurrentMonthValue() {
    const now = new Date();
    now.setMonth(now.getMonth() - 1);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  function getMonthLabel(monthValue) {
    const [year, month] = String(monthValue || '').split('-').map(Number);
    if (!year || !month) return 'sin mes';
    return new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
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
      if (detail.role === 'Setter' && detail.category === 'MEG' && isSale) current.ventasSetting += 1;

      if (detail.role === 'Setter' && detail.category === 'MEG') {
        current.agendas += 1;
      }

      if (detail.role === 'Closer' && detail.category === 'MEG') {
        if (isSale) current.facturacion += Number(detail.facturacionUsd || 0);
        current.cc += Number(detail.cashUsd || 0);
        current.comisionMegArs += Number(detail.commissionAmount || 0);
      }

      if (detail.role === 'Setter' && detail.category === 'MEG') {
        if (isSale) current.facturacion += Number(detail.facturacionUsd || 0);
        current.cc += Number(detail.cashUsd || 0);
        current.comisionSetting += Number(detail.commissionAmount || 0);
        if (current.settingPct === null && Number(detail.commissionPct || 0) > 0) {
          current.settingPct = Number(detail.commissionPct || 0);
        }
      }

      if (detail.category === 'Club') {
        current.comisionClubArs += Number(detail.commissionAmount || 0);
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
    const rows = buildSheetRows(dashboard?.details || []);
    const commercialSummaryRows = buildAreaCommercialSummary(dashboard?.details || []);
    const summary = dashboard?.summary || null;
    if (!summary || !rows.length) {
      node.innerHTML = '<div class="card comisiones-empty">No encontré comisiones calculables para este mes.</div>';
      return;
    }

    const { year, month } = getMonthParts(state.month);
    const totalClubCommission = rows.reduce((sum, row) => sum + Number(row.comisionClubArs || 0), 0);
    const totalMegCommission = rows.reduce((sum, row) => sum + Number(row.comisionMegArs || 0) + Number(row.comisionSetting || 0), 0);
    const totalCommission = rows.reduce((sum, row) => sum + Number(row.total || 0), 0);

    node.innerHTML = `
      <section class="card comisiones-sheet-card">
        <div class="comisiones-sheet-grid" aria-hidden="true"></div>
        <div class="comisiones-sheet-layout">
          <div class="comisiones-sheet-main">
            <section class="comisiones-overview-hero">
              <div class="comisiones-overview-hero-icon" aria-hidden="true">$</div>
              <div class="comisiones-overview-hero-copy">
                <h3>Resumen de ${escapeHtml(getMonthLabel(state.month))}</h3>
                <div class="comisiones-overview-hero-stats">
                  <span>${formatInteger(summary.transactionCount)} transacciones</span>
                  <span>${formatInteger(summary.commissionLineCount)} líneas de comisión</span>
                </div>
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
                      <td>${formatSheetInteger(row.agendas)}</td>
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
    const allDetails = state.dashboard?.details || [];
    const isAllView = state.selectedPerson === ALL_PEOPLE_VALUE;
    const person = state.dashboard?.people?.find((row) => row.person === state.selectedPerson) || null;
    const details = isAllView
      ? allDetails
      : allDetails.filter((row) => row.person === state.selectedPerson);

    if (isAllView) {
      const uniqueTransactions = new Set(details.map((detail) => detail.transactionId).filter(Boolean));
      summaryNode.innerHTML = `
        <div class="card comisiones-person-card">
          <h3>Total comprobantes</h3>
          <p>Vista consolidada de todas las líneas del mes</p>
          <div class="comisiones-person-kpis">
            <span><strong>${formatCurrency(state.dashboard?.summary?.totalCommission)}</strong> comisión total</span>
            <span><strong>${formatCurrency(state.dashboard?.summary?.totalBase)}</strong> CC tomado</span>
            <span><strong>${formatInteger(uniqueTransactions.size)}</strong> comprobantes únicos</span>
            <span><strong>${formatInteger(details.length)}</strong> líneas de comisión</span>
            <span><strong>${formatInteger(state.dashboard?.summary?.peopleCount)}</strong> personas con comisión</span>
          </div>
        </div>
      `;
    } else if (!state.selectedPerson || !person) {
      summaryNode.innerHTML = '<div class="card comisiones-empty">Seleccioná una persona para ver su detalle.</div>';
      detailNode.innerHTML = '';
      return;
    } else {
      summaryNode.innerHTML = `
        <div class="card comisiones-person-card">
          <h3>${escapeHtml(person.person)}</h3>
          <p>${escapeHtml(person.area)} · ${escapeHtml(person.role)}</p>
          <div class="comisiones-person-kpis">
            <span><strong>${formatCurrency(person.totalCommission)}</strong> comisión total</span>
            <span><strong>${formatCurrency(person.totalBase)}</strong> CC tomado</span>
            <span><strong>${formatInteger(person.transactionCount)}</strong> transacciones</span>
            <span><strong>${formatInteger(person.agendas)}</strong> agendas del mes</span>
            <span><strong>${formatInteger(person.clubSalesSequential)}</strong> ventas Club</span>
          </div>
        </div>
      `;
    }

    detailNode.innerHTML = `
      <div class="comisiones-table-wrap">
        <table class="csm-table comisiones-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Conciliado</th>
              <th>Cheque</th>
              <th>F.acreditación</th>
              <th>Producto</th>
              <th>Nombre cliente</th>
              <th>Monto CC</th>
              <th>Fact</th>
              <th>Porcentaje</th>
              <th>TC</th>
              <th>Origen</th>
              <th>Calendario</th>
              <th>CC Pesos</th>
              <th>Comisión MEG US</th>
              <th>Comisión CLUB US</th>
              <th>Comisión final ARS</th>
              <th>Setter</th>
              <th>% Setter</th>
              <th>Comisión Setter</th>
              <th>Estado comprobante</th>
              <th>ID</th>
            </tr>
          </thead>
          <tbody>
            ${details.length ? details.map((detail) => {
              const notionUrl = buildNotionPageUrl(detail.transactionId);
              const isSetter = detail.role === 'Setter';
              const isCloserMeg = detail.role === 'Closer' && detail.category === 'MEG';
              const isCloserClub = detail.role === 'Closer' && detail.category === 'Club';
              const commissionMegUsd = isCloserMeg ? Number(detail.cashUsd || 0) * Number(detail.commissionPct || 0) : 0;
              const commissionClubUsd = isCloserClub ? Number(detail.commissionAmount || 0) : 0;
              const setterPct = isSetter ? Number(detail.commissionPct || 0) : 0;
              const setterCommission = isSetter ? Number(detail.commissionAmount || 0) : 0;
              return `
                <tr>
                  <td>${escapeHtml(formatDetailDate(detail.date))}</td>
                  <td>${escapeHtml(formatDetailText(detail.tipo))}</td>
                  <td>${escapeHtml(formatDetailText(detail.conciliado))}</td>
                  <td>${escapeHtml(formatDetailBoolean(detail.cheque))}</td>
                  <td>${escapeHtml(formatDetailDate(detail.acreditacionDate))}</td>
                  <td>${escapeHtml(formatDetailText(detail.product))}</td>
                  <td>${escapeHtml(formatDetailText(detail.clientName))}</td>
                  <td>${formatDetailUsd(detail.cashUsd)}</td>
                  <td>${formatDetailUsd(detail.facturacionUsd)}</td>
                  <td>${formatDetailPercent(detail.commissionPct)}</td>
                  <td>${formatDetailCurrency(detail.tc)}</td>
                  <td>${escapeHtml(formatDetailText(detail.origin))}</td>
                  <td>${escapeHtml(formatDetailText(detail.calendar))}</td>
                  <td>${formatDetailCurrency(detail.cashArs)}</td>
                  <td>${formatDetailUsd(commissionMegUsd)}</td>
                  <td>${formatDetailUsd(commissionClubUsd)}</td>
                  <td>${formatDetailCurrency(detail.commissionAmount)}</td>
                  <td>${escapeHtml(formatDetailText(detail.setter))}</td>
                  <td>${formatDetailPercent(setterPct)}</td>
                  <td>${formatDetailCurrency(setterCommission)}</td>
                  <td>${escapeHtml(formatDetailText(detail.status))}</td>
                  <td>${notionUrl ? `<a class="comisiones-external-link" href="${escapeHtml(notionUrl)}" target="_blank" rel="noreferrer">${escapeHtml(detail.transactionId || '')}</a>` : ''}</td>
                </tr>
              `;
            }).join('') : `<tr><td colspan="22">${isAllView ? 'No hay comprobantes para este mes.' : 'No hay transacciones para esta persona.'}</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  function createScaleRowMarkup(type, index, row) {
    return `
      <div class="comisiones-scale-row" data-scale-type="${escapeHtml(type)}" data-index="${index}">
        <label>
          <span>${type === 'setterSalesScale' ? 'Desde ventas' : 'Desde'}</span>
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

  async function loadDashboard() {
    setStatus(`Cargando comisiones de ${getMonthLabel(state.month)}...`);
    const response = await window.metricasApi.fetchCommissionsDashboard(state.month);
    state.dashboard = response;
    renderSheetOverview(response);
    if (state.rulesDraft) renderRulesEditor();
    fillPersonSelect(response.people);
    if (!state.selectedPerson && response.people?.length) {
      state.selectedPerson = ALL_PEOPLE_VALUE;
      personSelect.value = state.selectedPerson;
    }
    renderPersonPanel();
    setStatus(`Comisiones cargadas para ${getMonthLabel(state.month)}. ${formatInteger(response.summary.transactionCount)} transacciones y ${formatInteger(response.summary.commissionLineCount)} líneas de comisión.`);
  }

  async function loadPage() {
    try {
      await Promise.all([loadDashboard(), loadRulesConfig()]);
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
  document.getElementById('addSetterSalesScaleRow').addEventListener('click', () => {
    state.rulesDraft.setterSalesScale.push({ min: 0, pct: 0 });
    renderRulesEditor();
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

  monthInput.value = getCurrentMonthValue();
  state.month = monthInput.value;
  monthInput.addEventListener('change', () => {
    state.month = monthInput.value;
    loadPage();
  });

  loadPage();
})();
