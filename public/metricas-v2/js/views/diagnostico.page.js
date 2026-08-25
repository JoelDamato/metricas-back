(() => {
  const core = window.DiagnosticCore;
  if (!core) throw new Error('No se pudo cargar la lógica de la Carta de Rumbo');

  let diagnostics = [];
  let clients = [];
  let current = null;
  let activeStage = 'inicial';
  let clientSearchTimer = null;
  let clientSearchRequestId = 0;
  const $ = (selector) => document.querySelector(selector);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  async function request(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'No se pudo completar la operación');
    return data;
  }

  function setStatus(text, type = '') {
    const element = $('#saveStatus');
    element.textContent = text;
    element.className = `status ${type}`;
  }

  function publicLink() {
    return `${location.origin}/diagnostico/?ghl_id=${encodeURIComponent(current?.clientGhlId || '')}`;
  }

  function scoreBadge(score, id = '') {
    const scoreBand = core.band(score);
    const text = score === null || score === undefined ? 'Sin datos aún' : `${score}/5 · ${core.bandLabel(scoreBand)}`;
    return `<span ${id ? `id="${id}"` : ''} class="score-badge ${scoreBand}">${text}</span>`;
  }

  function renderPicker() {
    const picker = $('#clientPicker');
    const search = $('#clientSearch');
    const suggestions = $('#clientSuggestions');
    const term = String(search?.value || '').trim().toLocaleLowerCase('es');
    const terms = term.split(/\s+/).filter(Boolean);
    const filtered = term
      ? clients.filter((client) => {
        const searchable = `${client.name} ${client.businessName}`.toLocaleLowerCase('es');
        return terms.every((searchTerm) => searchable.includes(searchTerm));
      }).slice(0, 8)
      : [];
    suggestions.innerHTML = term
      ? (filtered.length
        ? filtered.map((client) => `<button type="button" data-client="${escapeHtml(client.ghlId)}"><strong>${escapeHtml(client.name)}</strong>${client.businessName ? `<small>${escapeHtml(client.businessName)}</small>` : ''}</button>`).join('')
        : '<span class="small">No encontré coincidencias.</span>')
      : '';
    suggestions.querySelectorAll('[data-client]').forEach((button) => {
      button.onclick = () => {
        const selected = clients.find((client) => client.ghlId === button.dataset.client);
        if (!selected) return;
        picker.value = selected.ghlId;
        search.value = selected.name + (selected.businessName ? ` · ${selected.businessName}` : '');
        suggestions.innerHTML = '';
        showCreateSelection(selected);
      };
    });
  }

  function showCreateSelection(client) {
    const selection = $('#createSelection');
    selection.hidden = !client;
    $('#newClient').disabled = !client;
    $('#createConfirm').hidden = true;
    if (!client) return;
    $('#createSelectionName').textContent = client.name;
    $('#createSelectionMeta').textContent = `${client.businessName || 'Sin modelo de negocio'} · GHL ${client.ghlId}`;
  }

  function showWorkflow(mode) {
    $('#modeChooser').hidden = Boolean(mode);
    $('#createMode').hidden = mode !== 'create';
    $('#editMode').hidden = mode !== 'edit';
    $('#editor').hidden = true;
    if (mode !== 'editor') current = null;
    setStatus('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function mergeClients(nextClients = []) {
    const byGhlId = new Map(clients.map((client) => [client.ghlId, client]));
    nextClients.forEach((client) => {
      if (!client?.ghlId || !client?.name) return;
      byGhlId.set(client.ghlId, client);
    });
    clients = [...byGhlId.values()];
  }

  function searchClients() {
    $('#clientPicker').value = '';
    showCreateSelection(null);
    const term = String($('#clientSearch').value || '').trim();
    clearTimeout(clientSearchTimer);
    renderPicker();
    if (term.length < 2) return;

    const requestId = ++clientSearchRequestId;
    clientSearchTimer = setTimeout(async () => {
      try {
        const response = await request(`/api/metricas/diagnosticos/clientes-csm?q=${encodeURIComponent(term)}`);
        if (requestId !== clientSearchRequestId) return;
        mergeClients(response.clients || []);
        renderPicker();
      } catch (error) {
        if (requestId !== clientSearchRequestId) return;
        setStatus(error.message, 'error');
      }
    }, 250);
  }

  function renderList() {
    const list = $('#clientList');
    const terms = String($('#diagnosticSearch')?.value || '').trim().toLocaleLowerCase('es').split(/\s+/).filter(Boolean);
    const filtered = diagnostics.filter((item) => {
      const searchable = `${item.clientName} ${item.businessName} ${item.csmName}`.toLocaleLowerCase('es');
      return terms.every((term) => searchable.includes(term));
    });
    list.innerHTML = filtered.length
      ? filtered.map((item) => `<div class="client-row"><div class="client-row-details"><strong>${escapeHtml(item.clientName)}</strong><span class="small">${escapeHtml(item.businessName || 'Sin negocio')} · ${escapeHtml(item.csmName || 'Sin CSM')}</span></div><span class="small">Actualizada ${new Date(item.updatedAt || Date.now()).toLocaleDateString('es-AR')}</span><button class="btn alt" data-open="${escapeHtml(item.id)}" type="button">Editar esta Carta →</button></div>`).join('')
      : `<p class="muted">${diagnostics.length ? 'No encontré cartas con esa búsqueda.' : 'Todavía no hay diagnósticos creados.'}</p>`;
    list.querySelectorAll('[data-open]').forEach((button) => { button.onclick = () => openDiagnostic(button.dataset.open); });
  }

  function compareValue(item, field, type) {
    if (!item.compareStage) return null;
    const area = current.data.checkpoints[item.compareStage]?.areas?.[item.key];
    const raw = type === 'select' ? area?.selects?.[field.key] : area?.nums?.[field.key];
    return type === 'select' ? (raw || '—') : (core.formatField(field.key, raw) || '—');
  }

  function numberFields(item, area, stage) {
    const rows = item.numFields.map((field) => {
      const value = core.formatField(field.key, area.nums?.[field.key] || '');
      const input = `<div class="field ${field.derivedFrom ? 'derived' : ''}"><span>${escapeHtml(field.label)}${field.derivedFrom ? ' · automática' : ''}</span><input data-stage="${stage}" data-area="${item.key}" data-numfield="${field.key}" value="${escapeHtml(value)}" ${field.derivedFrom ? 'readonly' : ''}/></div>`;
      if (!item.compareStage) return input;
      return `<div class="compare-row"><span class="compare-label">${escapeHtml(field.label)}${field.derivedFrom ? ' · automática' : ''}</span><span class="previous">${escapeHtml(compareValue(item, field, 'number'))}</span><span class="arrow">→</span>${input}</div>`;
    }).join('');
    return item.compareStage ? `<div class="compare-grid">${rows}</div>` : `<div class="input-grid">${rows}</div>`;
  }

  function selectFields(item, area, stage) {
    const rows = item.selectFields.map((field) => {
      const value = area.selects?.[field.key] || '';
      const options = ['<option value="">— Elegir —</option>', ...field.options.map((option) => `<option value="${escapeHtml(option)}" ${value === option ? 'selected' : ''}>${escapeHtml(option)}</option>`)].join('');
      const input = `<div class="field"><span>${escapeHtml(field.label)}</span><select data-stage="${stage}" data-area="${item.key}" data-selectfield="${field.key}">${options}</select></div>`;
      if (!item.compareStage) return input;
      return `<div class="compare-row"><span class="compare-label">${escapeHtml(field.label)}</span><span class="previous">${escapeHtml(compareValue(item, field, 'select'))}</span><span class="arrow">→</span>${input}</div>`;
    }).join('');
    return item.compareStage ? `<div class="compare-grid">${rows}</div>` : `<div class="input-grid">${rows}</div>`;
  }

  function profitabilityBlock(stage) {
    const values = core.calculateStage(current.data.checkpoints[stage]);
    return `<div class="calcs">
      <div class="calc-block"><p class="calc-title">Margen de contribución neto</p><div class="calc-row"><span>Costo financiero efectivo</span><strong data-calc="financialCost">${core.formatPercent(values.financialCost)}</strong></div><div class="calc-row"><span>Impuesto variable efectivo</span><strong data-calc="taxCost">${core.formatPercent(values.taxCost)}</strong></div><div class="calc-row total"><span>Margen neto</span><strong data-calc="netMargin">${core.formatPercent(values.netMargin)}</strong></div></div>
      <div class="calc-block"><p class="calc-title">Rentabilidad calculada</p><div class="calc-row"><span>Ventas</span><strong data-calc="sales">${core.formatMoney(values.sales)}</strong></div><div class="calc-row"><span>Costos variables</span><strong data-calc="variableCosts">${core.formatMoney(values.variableCosts)}</strong></div><div class="calc-row"><span>Contribución marginal</span><strong data-calc="contribution">${core.formatMoney(values.contribution)}</strong></div><div class="calc-row"><span>Costos fijos</span><strong data-calc="fixedCosts">${core.formatMoney(values.fixedCosts)}</strong></div><div class="calc-row total"><span>Resultado del mes</span><strong data-calc="monthlyResult">${core.formatMoney(values.monthlyResult)}</strong></div><div class="calc-row"><span>Rentabilidad neta</span><strong data-calc="netProfitPercent">${core.formatPercent(values.netProfitPercent)}</strong></div><div class="calc-row"><span>Punto de equilibrio</span><strong data-calc="breakEven">${core.formatMoney(values.breakEven)}</strong></div></div>
    </div>`;
  }

  function financeBlock(stage) {
    const values = core.calculateStage(current.data.checkpoints[stage]).finance;
    return `<div class="calcs"><div class="calc-block"><p class="calc-title">Resultado financiero a 30 días</p><div class="calc-row"><span>Solo proveedores</span><strong data-finance="providersResult">${core.formatMoney(values?.providersResult)}</strong></div><div class="calc-row total"><span>Todas las deudas</span><strong data-finance="totalResult">${core.formatMoney(values?.totalResult)}</strong></div></div><div class="calc-block"><p class="calc-title">Cashflow proyectado a 30 días</p><div class="calc-row"><span>Ingresos proyectados</span><strong data-finance="projectedIncome">${core.formatMoney(values?.projectedIncome)}</strong></div><div class="calc-row"><span>Egresos proyectados</span><strong data-finance="projectedExpense">${core.formatMoney(values?.projectedExpense)}</strong></div><div class="calc-row total"><span>Resultado proyectado</span><strong data-finance="projectedResult">${core.formatMoney(values?.projectedResult)}</strong></div></div></div>`;
  }

  function areaHtml(item, checkpoint, stage) {
    const area = checkpoint.areas[item.key];
    return `<article class="area" data-area-card="${item.key}"><div class="area-head"><div><h3>${escapeHtml(item.label)}</h3><p class="question">${escapeHtml(item.question)}</p></div>${scoreBadge(area.score, `score-${stage}-${item.key}`)}</div>${numberFields(item, area, stage)}${selectFields(item, area, stage)}${item.key === 'resultados' ? profitabilityBlock(stage) : ''}${item.key === 'finanzas' ? financeBlock(stage) : ''}<div class="field" style="margin-top:11px"><span>Nota interna del CSM</span><textarea data-note data-stage="${stage}" data-area="${item.key}" placeholder="Nota breve opcional">${escapeHtml(area.note || '')}</textarea></div></article>`;
  }

  function summaryHtml(checkpoint, stage) {
    const summary = core.computeSummary(checkpoint, stage);
    const alertBand = core.band(summary.patternScore);
    return `<div class="summary-strip"><div class="summary-chip"><div class="label">Promedio automático</div><div class="value" id="summary-average"><span class="dot ${summary.band}"></span>${summary.average === null ? '—' : summary.average.toFixed(1)}</div></div><div class="summary-chip"><div class="label">Estado general</div><div class="value" id="summary-state"><span class="dot ${summary.band}"></span>${core.bandLabel(summary.band)}</div></div><div class="summary-chip"><div class="label">Nivel de alerta</div><div class="value" id="summary-alert"><span class="dot ${alertBand}"></span>${summary.patternScore}/5 · ${core.bandLabel(alertBand)}</div></div></div>`;
  }

  function patternsHtml(checkpoint, stage) {
    return `<div class="patterns"><span class="diag-label">Principales dificultades detectadas · interno</span><div class="patterns-grid">${core.PATTERNS.map((pattern) => { const checked = checkpoint.patterns.includes(pattern.key); return `<label class="pattern-chip ${checked ? 'checked' : ''}"><input type="checkbox" data-pattern="${pattern.key}" data-stage="${stage}" ${checked ? 'checked' : ''}/>${escapeHtml(pattern.label)}</label>`; }).join('')}</div>${checkpoint.patterns.includes('otro') ? `<div class="field" style="margin-top:9px"><span>Detalle de otro</span><input data-other data-stage="${stage}" value="${escapeHtml(checkpoint.otroDetalle || '')}"/></div>` : ''}</div>`;
  }

  function stageHtml(stage) {
    const checkpoint = current.data.checkpoints[stage];
    const labels = { inicial: 'Antes de empezar', medio: 'Unidades 2, 3 y 4', final: 'Unidades 6 y 7' };
    return `${summaryHtml(checkpoint, stage)}<div class="meta-row"><div class="field"><span>Fecha del checkpoint</span><input type="date" data-meta="date" data-stage="${stage}" value="${escapeHtml(checkpoint.date)}"/></div><div class="field"><span>CSM responsable en esta etapa</span><input data-meta="csm" data-stage="${stage}" value="${escapeHtml(checkpoint.csm || current.csmName || '')}"/></div><span class="stage-label">${labels[stage]}</span></div>${core.STAGE_ITEMS[stage].map((item) => areaHtml(item, checkpoint, stage)).join('')}${patternsHtml(checkpoint, stage)}<div class="save-bar"><span id="stageStatus" class="status"></span><button class="btn" type="button" data-save-stage="${stage}">Guardar checkpoint</button></div>`;
  }

  const ROUTE_METRICS = [
    { key: 'margenContribucion', label: 'Margen de Contribución', area: 'resultados', highlight: true },
    { key: 'margenMarcacion', label: 'Margen de Marcación', area: 'resultados' },
    { key: 'facturacionPromedio', label: 'Facturación promedio', area: 'resultados' },
    { key: 'costosFijos', label: 'Costos fijos', area: 'resultados' },
    { key: 'margenContribucionProducto', label: 'Margen del producto más vendido', area: 'costos' }
  ];

  function routeHtml() {
    const metricCards = ROUTE_METRICS.map((metric) => {
      const values = core.STAGES.map((stage) => core.formatField(metric.key, current.data.checkpoints[stage].areas[metric.area].nums[metric.key]) || '—');
      if (values.every((value) => value === '—')) return '';
      return `<article class="route-card ${metric.highlight ? 'highlight' : ''}"><h3>${escapeHtml(metric.label)}</h3><div class="route-values">${core.STAGES.map((stage, index) => `<div class="route-value"><span>${stage}</span><strong>${escapeHtml(values[index])}</strong></div>${index < 2 ? '<b>→</b>' : ''}`).join('')}</div></article>`;
    }).filter(Boolean).join('');
    const scoreCards = ['costos', 'resultados', 'finanzas'].map((areaKey) => {
      const item = core.STAGE_ITEMS.inicial.find((area) => area.key === areaKey);
      return `<article class="route-card route-score"><h3>${escapeHtml(item.label)}</h3><div class="route-values">${core.STAGES.map((stage, index) => { const score = current.data.checkpoints[stage].areas[areaKey].score; return `<div class="route-value"><span>${stage}</span>${scoreBadge(score)}</div>${index < 2 ? '<b>→</b>' : ''}`; }).join('')}</div></article>`;
    }).join('');
    return `<h2>Carta de Rumbo</h2><p class="muted">Comparación automática entre los tres checkpoints.</p>${metricCards ? `<div class="route-grid">${metricCards}</div>` : '<div class="empty">Todavía no hay indicadores económicos para comparar.</div>'}<div style="margin-top:12px">${scoreCards}</div>`;
  }

  function render() {
    if (!current) return;
    current.data = core.normalizeData(current.data, current.csmName);
    $('#editor').hidden = false;
    $('#editingClientName').textContent = current.clientName || 'Cliente sin nombre';
    $('#editingClientMeta').textContent = `${current.businessName || 'Sin modelo de negocio'} · GHL ${current.clientGhlId}`;
    $('#publicLink').textContent = publicLink();
    const tabLabels = { inicial: ['Inicial', 'Antes de empezar'], medio: ['Medio', 'Unidades 2, 3 y 4'], final: ['Final', 'Unidades 6 y 7'], rumbo: ['Carta de Rumbo', 'Comparativo'] };
    $('#tabs').innerHTML = [...core.STAGES, 'rumbo'].map((stage) => `<button class="btn tab ${activeStage === stage ? 'active' : ''}" data-tab="${stage}" type="button">${tabLabels[stage][0]}<small>${tabLabels[stage][1]}</small></button>`).join('');
    $('#tabs').querySelectorAll('[data-tab]').forEach((button) => { button.onclick = () => { activeStage = button.dataset.tab; render(); }; });
    $('#stageContent').innerHTML = activeStage === 'rumbo' ? routeHtml() : stageHtml(activeStage);
    if (activeStage !== 'rumbo') bindStageEvents(activeStage);
  }

  function refreshComputed(stage) {
    const checkpoint = current.data.checkpoints[stage];
    core.applyAutoScores(checkpoint);
    const summary = core.computeSummary(checkpoint, stage);
    const average = $('#summary-average');
    const state = $('#summary-state');
    const alert = $('#summary-alert');
    if (average) average.innerHTML = `<span class="dot ${summary.band}"></span>${summary.average === null ? '—' : summary.average.toFixed(1)}`;
    if (state) state.innerHTML = `<span class="dot ${summary.band}"></span>${core.bandLabel(summary.band)}`;
    if (alert) { const alertBand = core.band(summary.patternScore); alert.innerHTML = `<span class="dot ${alertBand}"></span>${summary.patternScore}/5 · ${core.bandLabel(alertBand)}`; }
    core.STAGE_ITEMS[stage].forEach((item) => {
      const score = checkpoint.areas[item.key].score;
      const badge = $(`#score-${stage}-${item.key}`);
      if (badge) { badge.className = `score-badge ${core.band(score)}`; badge.textContent = score == null ? 'Sin datos aún' : `${score}/5 · ${core.bandLabel(core.band(score))}`; }
    });
    const values = core.calculateStage(checkpoint);
    const calcFormat = { financialCost: core.formatPercent, taxCost: core.formatPercent, netMargin: core.formatPercent, sales: core.formatMoney, variableCosts: core.formatMoney, contribution: core.formatMoney, fixedCosts: core.formatMoney, monthlyResult: core.formatMoney, netProfitPercent: core.formatPercent, breakEven: core.formatMoney };
    Object.entries(calcFormat).forEach(([key, formatter]) => { const element = $(`[data-calc="${key}"]`); if (element) element.textContent = formatter(values[key]); });
    ['providersResult', 'totalResult', 'projectedIncome', 'projectedExpense', 'projectedResult'].forEach((key) => { const element = $(`[data-finance="${key}"]`); if (element) element.textContent = core.formatMoney(values.finance?.[key]); });
  }

  function bindStageEvents(stage) {
    const checkpoint = current.data.checkpoints[stage];
    $('#stageContent').querySelectorAll('[data-numfield]').forEach((input) => {
      input.oninput = () => {
        const key = input.dataset.numfield;
        const formatted = core.TEXT_FIELDS.has(key) ? input.value : core.PERCENT_FIELDS.has(key) ? core.formatPercentInput(input.value) : core.formatMoneyInput(input.value);
        input.value = formatted;
        checkpoint.areas[input.dataset.area].nums[key] = formatted;
        core.autofillDerivedMargins(checkpoint);
        const pairs = { margenMarcacion: 'margenContribucion', margenMarcacionProducto: 'margenContribucionProducto' };
        const target = pairs[key];
        if (target) {
          const targetInput = $(`[data-stage="${stage}"][data-area="${input.dataset.area}"][data-numfield="${target}"]`);
          if (targetInput) targetInput.value = checkpoint.areas[input.dataset.area].nums[target];
        }
        refreshComputed(stage);
      };
    });
    $('#stageContent').querySelectorAll('[data-selectfield]').forEach((select) => {
      select.onchange = () => {
        checkpoint.areas[select.dataset.area].selects[select.dataset.selectfield] = select.value;
        refreshComputed(stage);
      };
    });
    $('#stageContent').querySelectorAll('[data-note]').forEach((textarea) => { textarea.oninput = () => { checkpoint.areas[textarea.dataset.area].note = textarea.value; }; });
    $('#stageContent').querySelectorAll('[data-meta]').forEach((input) => { const sync = () => { checkpoint[input.dataset.meta] = input.value; }; input.oninput = sync; input.onchange = sync; });
    $('#stageContent').querySelectorAll('[data-pattern]').forEach((checkbox) => {
      checkbox.onchange = () => {
        checkpoint.patterns = checkbox.checked ? [...new Set([...checkpoint.patterns, checkbox.dataset.pattern])] : checkpoint.patterns.filter((key) => key !== checkbox.dataset.pattern);
        if (checkbox.dataset.pattern === 'otro' && !checkbox.checked) checkpoint.otroDetalle = '';
        render();
      };
    });
    const other = $('#stageContent').querySelector('[data-other]');
    if (other) other.oninput = () => { checkpoint.otroDetalle = other.value; };
    $('#stageContent').querySelector('[data-save-stage]').onclick = (event) => saveCurrent(`Checkpoint ${stage} guardado.`, event.currentTarget);
  }

  async function load() {
    setStatus('Cargando...');
    try {
      const [diagnosticResponse, csmResponse] = await Promise.all([
        request('/api/metricas/diagnosticos'),
        request('/api/metricas/diagnosticos/clientes-csm')
      ]);
      diagnostics = diagnosticResponse.diagnosticos || [];
      clients = csmResponse.clients || [];
      $('#clientSearch').addEventListener('input', searchClients);
      $('#diagnosticSearch').addEventListener('input', renderList);
      renderPicker();
      renderList();
      setStatus('');
    } catch (error) {
      setStatus(error.message, 'error');
    }
  }

  async function openDiagnostic(id) {
    current = diagnostics.find((item) => item.id === id);
    if (!current) return;
    current.data = core.normalizeData(current.data, current.csmName);
    $('#csmName').value = current.csmName || '';
    $('#modeChooser').hidden = true;
    $('#createMode').hidden = true;
    $('#editMode').hidden = true;
    activeStage = 'inicial';
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function saveCurrent(successMessage = 'Cambios guardados.', button) {
    if (!current) return;
    const originalText = button?.textContent;
    try {
      if (button) { button.disabled = true; button.textContent = 'Guardando...'; }
      setStatus('Guardando cambios...');
      current.data = core.normalizeData(current.data, $('#csmName').value);
      const selected = clients.find((client) => client.ghlId === current.clientGhlId);
      const response = await request(`/api/metricas/diagnosticos/${current.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          clientGhlId: current.clientGhlId,
          clientName: selected?.name || current.clientName,
          businessName: selected?.businessName || current.businessName,
          csmName: $('#csmName').value,
          data: current.data
        })
      });
      current = response.diagnostico;
      diagnostics = diagnostics.map((item) => item.id === current.id ? current : item);
      renderList();
      render();
      setStatus(successMessage, 'ok');
    } catch (error) {
      setStatus(error.message, 'error');
    } finally {
      if (button) { button.disabled = false; button.textContent = originalText; }
    }
  }

  $('#newClient').onclick = () => {
    const selected = clients.find((client) => client.ghlId === $('#clientPicker').value);
    if (!selected) return setStatus('Elegí un cliente de CSM o Leads.', 'error');
    $('#createConfirmTitle').textContent = `Vas a crear la Carta de ${selected.name}`;
    $('#createConfirm').hidden = false;
    $('#createConfirm').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  $('#cancelCreate').onclick = () => { $('#createConfirm').hidden = true; };
  $('#confirmCreate').onclick = async () => {
    const selected = clients.find((client) => client.ghlId === $('#clientPicker').value);
    if (!selected) return setStatus('Volvé a elegir el cliente.', 'error');
    try {
      $('#confirmCreate').disabled = true;
      $('#confirmCreate').textContent = 'Creando...';
      const csmName = $('#createCsmName').value;
      const response = await request('/api/metricas/diagnosticos', {
        method: 'POST',
        body: JSON.stringify({ clientGhlId: selected.ghlId, clientName: selected.name, businessName: selected.businessName, csmName, data: core.emptyData(csmName) })
      });
      diagnostics.unshift(response.diagnostico);
      renderList();
      await openDiagnostic(response.diagnostico.id);
      setStatus('Diagnóstico creado y vinculado al cliente.', 'ok');
    } catch (error) { setStatus(error.message, 'error'); }
    finally { $('#confirmCreate').disabled = false; $('#confirmCreate').textContent = 'Sí, crear esta Carta'; }
  };
  $('#saveAll').onclick = (event) => saveCurrent('Todos los cambios guardados.', event.currentTarget);
  $('#copyLink').onclick = async () => {
    try { await navigator.clipboard.writeText(publicLink()); setStatus('Link copiado.', 'ok'); }
    catch { setStatus('Copiá el link manualmente.', 'error'); }
  };
  $('#deleteClient').onclick = async () => {
    if (!current || !confirm(`¿Eliminar el diagnóstico de ${current.clientName}?`)) return;
    try {
      await request(`/api/metricas/diagnosticos/${current.id}`, { method: 'DELETE' });
      diagnostics = diagnostics.filter((item) => item.id !== current.id);
      current = null;
      $('#editor').hidden = true;
      renderList();
      showWorkflow('edit');
      setStatus('Diagnóstico eliminado.', 'ok');
    } catch (error) { setStatus(error.message, 'error'); }
  };

  document.querySelectorAll('[data-workflow]').forEach((button) => { button.onclick = () => showWorkflow(button.dataset.workflow); });
  document.querySelectorAll('[data-back-to-modes]').forEach((button) => { button.onclick = () => showWorkflow(null); });
  $('#backToEditList').onclick = () => showWorkflow('edit');

  window.diagnosticPageInternals = { publicLink, render, refreshComputed, showWorkflow };
  load();
})();
