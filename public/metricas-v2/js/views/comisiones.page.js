(function initComisionesPage() {
  const state = {
    month: '',
    dashboard: null,
    selectedPerson: '',
    configMeta: null,
    rulesDraft: null
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

  function getCurrentMonthValue() {
    const now = new Date();
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

  function renderSummaryCards(summary) {
    const node = document.getElementById('commissionsSummaryCards');
    if (!summary) {
      node.innerHTML = '';
      return;
    }

    const cards = [
      { label: 'Comisión total ARS', value: formatCurrency(summary.totalCommission), note: 'Suma de todas las comisiones calculadas del mes.' },
      { label: 'Base comisionable ARS', value: formatCurrency(summary.totalBase), note: 'Monto total sobre el que se aplicaron porcentajes.' },
      { label: 'Personas con comisión', value: formatInteger(summary.peopleCount), note: 'Personas que tuvieron al menos una comisión en el mes.' },
      { label: 'Transacciones tomadas', value: formatInteger(summary.transactionCount), note: 'Ventas y cobranzas únicas usadas por el motor de comisiones.' },
      { label: 'Líneas de comisión', value: formatInteger(summary.commissionLineCount), note: 'Cada comprobante puede generar una línea de closer y otra de setter.' }
    ];

    node.innerHTML = cards.map((card) => `
      <article class="card comisiones-summary-card">
        <span>${escapeHtml(card.label)}</span>
        <strong>${escapeHtml(card.value)}</strong>
        <p>${escapeHtml(card.note)}</p>
      </article>
    `).join('');
  }

  function renderAreas(areas) {
    const node = document.getElementById('commissionsAreas');
    if (!areas?.length) {
      node.innerHTML = '<div class="card comisiones-empty">No encontré comisiones calculables para este mes.</div>';
      return;
    }

    node.innerHTML = areas.map((area) => `
      <section class="card comisiones-area-card">
        <div class="comisiones-area-head">
          <div>
            <h3>${escapeHtml(area.area)}</h3>
            <p>${formatInteger(area.peopleCount)} personas · ${formatInteger(area.transactionCount)} transacciones</p>
          </div>
          <strong>${formatCurrency(area.totalCommission)}</strong>
        </div>
        <div class="table-wrap">
          <table class="csm-table comisiones-table">
            <thead>
              <tr>
                <th>Persona</th>
                <th>Rol</th>
                <th>Comisión</th>
                <th>Base</th>
                <th>Transacciones</th>
                <th>Agendas</th>
                <th>Club</th>
              </tr>
            </thead>
            <tbody>
              ${area.people.map((person) => `
                <tr>
                  <td><button class="comisiones-inline-link" type="button" data-person="${escapeHtml(person.person)}">${escapeHtml(person.person)}</button></td>
                  <td>${escapeHtml(person.role)}</td>
                  <td>${formatCurrency(person.totalCommission)}</td>
                  <td>${formatCurrency(person.totalBase)}</td>
                  <td>${formatInteger(person.transactionCount)}</td>
                  <td>${formatInteger(person.agendas)}</td>
                  <td>${formatInteger(person.clubSalesSequential)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </section>
    `).join('');

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
    const options = ['<option value="">Seleccioná una persona</option>'];
    (people || []).forEach((person) => {
      options.push(`<option value="${escapeHtml(person.person)}">${escapeHtml(person.person)} · ${escapeHtml(person.area)}</option>`);
    });
    personSelect.innerHTML = options.join('');
    if (state.selectedPerson) personSelect.value = state.selectedPerson;
  }

  function renderPersonPanel() {
    const summaryNode = document.getElementById('commissionPersonSummary');
    const detailNode = document.getElementById('commissionPersonDetails');
    const person = state.dashboard?.people?.find((row) => row.person === state.selectedPerson) || null;
    const details = (state.dashboard?.details || []).filter((row) => row.person === state.selectedPerson);

    if (!state.selectedPerson || !person) {
      summaryNode.innerHTML = '<div class="card comisiones-empty">Seleccioná una persona para ver su detalle.</div>';
      detailNode.innerHTML = '';
      return;
    }

    summaryNode.innerHTML = `
      <div class="card comisiones-person-card">
        <h3>${escapeHtml(person.person)}</h3>
        <p>${escapeHtml(person.area)} · ${escapeHtml(person.role)}</p>
        <div class="comisiones-person-kpis">
          <span><strong>${formatCurrency(person.totalCommission)}</strong> comisión total</span>
          <span><strong>${formatCurrency(person.totalBase)}</strong> base tomada</span>
          <span><strong>${formatInteger(person.transactionCount)}</strong> transacciones</span>
          <span><strong>${formatInteger(person.agendas)}</strong> agendas del mes</span>
          <span><strong>${formatInteger(person.clubSalesSequential)}</strong> ventas Club</span>
        </div>
      </div>
    `;

    detailNode.innerHTML = `
      <table class="csm-table comisiones-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Tipo</th>
            <th>Producto</th>
            <th>Closer</th>
            <th>Setter</th>
            <th>Base</th>
            <th>%</th>
            <th>Comisión</th>
            <th>Regla aplicada</th>
          </tr>
        </thead>
        <tbody>
          ${details.length ? details.map((detail) => `
            <tr>
              <td>${escapeHtml(detail.date || '-')}</td>
              <td>${escapeHtml(detail.tipo || '-')}</td>
              <td>${escapeHtml(detail.product || '-')}</td>
              <td>${escapeHtml(detail.closer || '-')}</td>
              <td>${escapeHtml(detail.setter || '-')}</td>
              <td>${formatCurrency(detail.baseAmount)}</td>
              <td>${formatPercent(detail.commissionPct)}</td>
              <td>${formatCurrency(detail.commissionAmount)}</td>
              <td>
                <strong>${escapeHtml(detail.sourceRule || '-')}</strong>
                <div class="comisiones-rule-note">${escapeHtml(detail.sourceRuleNote || '')}</div>
              </td>
            </tr>
          `).join('') : '<tr><td colspan="9">No hay transacciones para esta persona.</td></tr>'}
        </tbody>
      </table>
    `;
  }

  function createScaleRowMarkup(type, index, row) {
    return `
      <div class="comisiones-scale-row" data-scale-type="${escapeHtml(type)}" data-index="${index}">
        <label>
          <span>Desde</span>
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

  function createCloserRuleRowMarkup(index, row) {
    return `
      <div class="comisiones-scale-row comisiones-rule-row" data-closer-rule-index="${index}">
        <label>
          <span>Closer</span>
          <input type="text" data-field="person" value="${escapeHtml(row.person || '')}" />
        </label>
        <label>
          <span>Producto</span>
          <input type="text" data-field="product" value="${escapeHtml(row.product || '')}" placeholder="Meg 2.1 / Club" />
        </label>
        <label>
          <span>Tipo</span>
          <input type="text" data-field="type" value="${escapeHtml(row.type || '')}" placeholder="Venta / Cobranza" />
        </label>
        <label>
          <span>Origen contiene</span>
          <input type="text" data-field="originIncludes" value="${escapeHtml(row.originIncludes || '')}" />
        </label>
        <label>
          <span>Calendario contiene</span>
          <input type="text" data-field="calendarIncludes" value="${escapeHtml(row.calendarIncludes || '')}" />
        </label>
        <label>
          <span>Porcentaje</span>
          <input type="number" data-field="pct" min="0" step="0.001" value="${escapeHtml(row.pct ?? '')}" />
        </label>
        <label class="comisiones-checkbox-inline">
          <input type="checkbox" data-field="enabled" ${row.enabled !== false ? 'checked' : ''} />
          <span>Activa</span>
        </label>
        <label class="comisiones-rule-note-input">
          <span>Nota</span>
          <input type="text" data-field="note" value="${escapeHtml(row.note || '')}" />
        </label>
        <button type="button" class="button-secondary" data-remove-closer-rule="${index}">Quitar</button>
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

    document.querySelectorAll('[data-remove-closer-rule]').forEach((button) => {
      button.addEventListener('click', () => {
        state.rulesDraft.closerRules.splice(Number(button.dataset.removeCloserRule), 1);
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
    document.getElementById('commissionNotes').value = (config.notes || []).join('\n');

    document.getElementById('commissionAgendaScaleRows').innerHTML = (config.agendaScale || [])
      .map((row, index) => createScaleRowMarkup('agendaScale', index, row)).join('');
    document.getElementById('commissionClubScaleRows').innerHTML = (config.clubScale || [])
      .map((row, index) => createScaleRowMarkup('clubScale', index, row)).join('');
    document.getElementById('commissionOverrideRows').innerHTML = (config.fixedOverrides || [])
      .map((row, index) => createOverrideRowMarkup(index, row)).join('');
    document.getElementById('commissionCloserRuleRows').innerHTML = (config.closerRules || [])
      .map((row, index) => createCloserRuleRowMarkup(index, row)).join('');
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

  function readCloserRuleRows() {
    return Array.from(document.querySelectorAll('#commissionCloserRuleRows .comisiones-scale-row')).map((row) => ({
      person: row.querySelector('[data-field="person"]').value.trim(),
      product: row.querySelector('[data-field="product"]').value.trim(),
      type: row.querySelector('[data-field="type"]').value.trim(),
      originIncludes: row.querySelector('[data-field="originIncludes"]').value.trim(),
      calendarIncludes: row.querySelector('[data-field="calendarIncludes"]').value.trim(),
      pct: Number(row.querySelector('[data-field="pct"]').value || 0),
      enabled: row.querySelector('[data-field="enabled"]').checked,
      note: row.querySelector('[data-field="note"]').value.trim()
    })).filter((row) => row.person || row.product || row.type || row.originIncludes || row.calendarIncludes);
  }

  function readAreaRows() {
    return Array.from(document.querySelectorAll('#commissionAreaRows .comisiones-scale-row')).map((row) => ({
      person: row.querySelector('[data-field="person"]').value.trim(),
      area: row.querySelector('[data-field="area"]').value
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
      clubScale: readScaleRows('commissionClubScaleRows'),
      fixedOverrides: readOverrideRows(),
      closerRules: readCloserRuleRows(),
      personAreas: readAreaRows(),
      notes: document.getElementById('commissionNotes').value
        .split('\n')
        .map((row) => row.trim())
        .filter(Boolean)
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
    renderSummaryCards(response.summary);
    renderAreas(response.areas);
    fillPersonSelect(response.people);
    if (!state.selectedPerson && response.people?.length) {
      state.selectedPerson = response.people[0].person;
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

  async function lockMonth() {
    try {
      await window.metricasApi.lockCommissionMonth({ month: state.month });
      setStatus(`El mes ${getMonthLabel(state.month)} quedó bloqueado.`);
      await loadPage();
    } catch (error) {
      console.error(error);
      setStatus(error.message || 'No pude bloquear el mes.');
    }
  }

  document.querySelectorAll('.comisiones-tab').forEach((button) => {
    button.addEventListener('click', () => setActiveTab(button.dataset.tab));
  });

  document.getElementById('reloadCommissions').addEventListener('click', loadPage);
  document.getElementById('saveCommissionRules').addEventListener('click', () => saveRules('month'));
  document.getElementById('saveCommissionDefaults').addEventListener('click', () => saveRules('default'));
  document.getElementById('lockCommissionMonth').addEventListener('click', lockMonth);
  document.getElementById('addAgendaScaleRow').addEventListener('click', () => {
    state.rulesDraft.agendaScale.push({ min: 0, pct: 0 });
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
  document.getElementById('addCommissionCloserRuleRow').addEventListener('click', () => {
    state.rulesDraft.closerRules.push({
      person: '',
      product: '',
      type: '',
      originIncludes: '',
      calendarIncludes: '',
      pct: 0,
      enabled: true,
      note: ''
    });
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
