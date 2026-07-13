(function initHerramientasPage() {
  const STANDARD_PARAM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  const BUILTIN_GHL_FIELDS = [
    {
      key: 'phone',
      name: 'Teléfono del contacto',
      mergeTag: '{{contact.phone}}',
      fullKey: 'contact.phone',
      dataType: 'TEXT'
    }
  ];
  const state = {
    presets: [],
    presetMap: new Map(),
    ghlFields: [],
    ghlFieldMap: new Map()
  };

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizePresetKey(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function setStatus(message, tone = '') {
    const node = document.getElementById('utmStatus');
    if (!node) return;
    node.textContent = message;
    node.dataset.tone = tone;
  }

  function getCustomParamsContainer() {
    return document.getElementById('utmCustomParams');
  }

  function parseCsvLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const next = line[index + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
        continue;
      }

      current += char;
    }

    values.push(current);
    return values;
  }

  function normalizeSearchText(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  function normalizeGhlField(row = {}) {
    const key = String(row.clave_unica || '').trim();
    const name = String(row.nombre || '').trim();
    const mergeTag = String(row.merge_tag || '').trim();
    const fullKey = String(row.fieldKey_completo || '').trim();
    const dataType = String(row.dataType || '').trim();
    const id = String(row.id || '').trim();

    return {
      key,
      name,
      mergeTag,
      fullKey,
      dataType,
      id,
      searchText: normalizeSearchText([key, name, mergeTag, fullKey, dataType].join(' '))
    };
  }

  async function loadGhlFields() {
    try {
      const response = await fetch('/metricas-assets/ghl-custom-fields.csv', { credentials: 'same-origin' });
      if (!response.ok) {
        throw new Error(`No pude cargar el CSV de GHL (${response.status})`);
      }

      const text = await response.text();
      const lines = text.split(/\r?\n/).filter((line) => line.trim());
      const header = parseCsvLine(lines.shift() || '');
      const rows = lines.map((line) => {
        const cols = parseCsvLine(line);
        return Object.fromEntries(header.map((key, index) => [key, cols[index] ?? '']));
      });

      const csvFields = rows
        .map(normalizeGhlField)
        .filter((row) => row.key);
      const builtinFields = BUILTIN_GHL_FIELDS.map(normalizeGhlField);
      const mergedFields = [...builtinFields, ...csvFields];
      const uniqueFields = [];
      const seenKeys = new Set();

      mergedFields.forEach((field) => {
        if (!field.key || seenKeys.has(field.key)) return;
        seenKeys.add(field.key);
        uniqueFields.push(field);
      });

      state.ghlFields = uniqueFields;
      state.ghlFieldMap = new Map(state.ghlFields.map((field) => [field.key, field]));

      document.querySelectorAll('.tools-param-row').forEach((row) => syncCustomParamMeta(row));
    } catch (error) {
      setStatus(error.message || 'No pude cargar los campos custom de GHL.', 'error');
    }
  }

  function findMatchingGhlFields(query) {
    const search = normalizeSearchText(query);
    if (!search) return [];
    return state.ghlFields
      .filter((field) => field.searchText.includes(search))
      .slice(0, 8);
  }

  function hideSuggestions(row) {
    row.querySelector('.tools-param-suggestions')?.remove();
  }

  function syncCustomParamMeta(row) {
    const meta = row.querySelector('.tools-param-meta');
    const key = String(row.querySelector('.utm-custom-key')?.value || '').trim();
    if (!meta) return;

    const field = state.ghlFieldMap.get(key);
    if (!field) {
      meta.textContent = '';
      return;
    }

    meta.textContent = `${field.name || field.key}${field.dataType ? ` · ${field.dataType}` : ''}`;
  }

  function selectSuggestion(row, field) {
    row.querySelector('.utm-custom-key').value = field.key;
    syncCustomParamMeta(row);
    hideSuggestions(row);
  }

  function renderSuggestions(row, query) {
    hideSuggestions(row);
    const matches = findMatchingGhlFields(query);
    if (!matches.length) return;

    const host = row.querySelector('.tools-param-key');
    if (!host) return;

    const popup = document.createElement('div');
    popup.className = 'tools-param-suggestions';
    popup.innerHTML = matches.map((field) => `
      <button class="tools-param-suggestion" type="button" data-field-key="${escapeHtml(field.key)}">
        <strong>${escapeHtml(field.key)}</strong>
        <span>${escapeHtml(field.name || field.fullKey || field.mergeTag || '')}</span>
      </button>
    `).join('');

    host.appendChild(popup);
    popup.querySelectorAll('[data-field-key]').forEach((button) => {
      button.addEventListener('mousedown', (event) => {
        event.preventDefault();
        const field = state.ghlFieldMap.get(button.dataset.fieldKey);
        if (field) selectSuggestion(row, field);
      });
    });
  }

  function bindCustomParamRow(row) {
    const keyInput = row.querySelector('.utm-custom-key');
    if (!keyInput) return;

    keyInput.addEventListener('input', () => {
      syncCustomParamMeta(row);
      renderSuggestions(row, keyInput.value);
    });

    keyInput.addEventListener('focus', () => {
      if (keyInput.value.trim()) {
        renderSuggestions(row, keyInput.value);
      }
    });

    keyInput.addEventListener('blur', () => {
      window.setTimeout(() => {
        syncCustomParamMeta(row);
        hideSuggestions(row);
      }, 120);
    });
  }

  function createCustomParamRow(key = '', value = '') {
    const row = document.createElement('div');
    row.className = 'tools-param-row';
    row.innerHTML = `
      <div class="tools-param-key">
        <input type="text" class="utm-custom-key" placeholder="Buscar campo GHL" value="${escapeHtml(key)}" autocomplete="off" />
        <div class="tools-param-meta"></div>
      </div>
      <input type="text" class="utm-custom-value" placeholder="valor" value="${escapeHtml(value)}" autocomplete="off" />
      <button class="tools-button-ghost utm-remove-param" type="button">Quitar</button>
    `;
    row.querySelector('.utm-remove-param')?.addEventListener('click', () => {
      row.remove();
      ensureOneEmptyCustomRow();
    });
    bindCustomParamRow(row);
    syncCustomParamMeta(row);
    return row;
  }

  function ensureOneEmptyCustomRow() {
    const container = getCustomParamsContainer();
    if (!container) return;
    if (!container.children.length) {
      container.appendChild(createCustomParamRow());
    }
  }

  function resetCustomParamRows(rows = []) {
    const container = getCustomParamsContainer();
    if (!container) return;
    container.innerHTML = '';
    if (rows.length) {
      rows.forEach((row) => container.appendChild(createCustomParamRow(row.key, row.value)));
    }
    ensureOneEmptyCustomRow();
  }

  function collectCustomParams() {
    return [...document.querySelectorAll('.tools-param-row')]
      .map((row) => ({
        key: String(row.querySelector('.utm-custom-key')?.value || '').trim(),
        value: String(row.querySelector('.utm-custom-value')?.value || '').trim()
      }))
      .filter((row) => row.key && row.value);
  }

  function collectFormValues() {
    const customParams = collectCustomParams();
    const currentOrigin = String(document.getElementById('utmCurrentOrigin')?.value || '').trim();
    const presetName = String(document.getElementById('utmPresetName')?.value || '').trim();
    const params = {};
    const source = String(document.getElementById('utmSource')?.value || '').trim();
    const medium = String(document.getElementById('utmMedium')?.value || '').trim();
    const campaign = String(document.getElementById('utmCampaign')?.value || '').trim();
    const content = String(document.getElementById('utmContent')?.value || '').trim();
    const term = String(document.getElementById('utmTerm')?.value || '').trim();
    const includeContactId = document.getElementById('utmIncludeContactId')?.checked === true;

    if (!currentOrigin) {
      throw new Error('Completá origen_actual antes de generar o guardar el link.');
    }

    params.origen_actual = currentOrigin;
    if (source) params.utm_source = source;
    if (medium) params.utm_medium = medium;
    if (campaign) params.utm_campaign = campaign;
    if (content) params.utm_content = content;
    if (term) params.utm_term = term;
    if (includeContactId) params.Contact_id = '{{contact.id}}';

    customParams.forEach((row) => {
      if (normalizeSearchText(row.key) === 'origen_actual') return;
      if (normalizeSearchText(row.key) === 'contact_id' && includeContactId) return;
      params[row.key] = row.value;
    });

    return {
      baseUrl: String(document.getElementById('utmBaseUrl')?.value || '').trim(),
      presetName,
      origin: currentOrigin,
      includeContactId,
      params
    };
  }

  function applyPreset(preset) {
    if (!preset) return;
    const params = preset.params || {};
    document.getElementById('utmBaseUrl').value = preset.base_url || '';
    document.getElementById('utmPresetName').value = preset.name || '';
    document.getElementById('utmCurrentOrigin').value = String(params.origen_actual || '').trim();
    document.getElementById('utmSource').value = String(params.utm_source || '').trim();
    document.getElementById('utmMedium').value = String(params.utm_medium || '').trim();
    document.getElementById('utmCampaign').value = String(params.utm_campaign || '').trim();
    document.getElementById('utmContent').value = String(params.utm_content || '').trim();
    document.getElementById('utmTerm').value = String(params.utm_term || '').trim();
    document.getElementById('utmIncludeContactId').checked = String(params.Contact_id || '').trim() === '{{contact.id}}';

    const customRows = Object.entries(params)
      .filter(([key, value]) => !STANDARD_PARAM_KEYS.includes(key) && key !== 'origen_actual' && key !== 'Contact_id' && String(value || '').trim())
      .map(([key, value]) => ({ key, value: String(value || '').trim() }));

    resetCustomParamRows(customRows);
    document.getElementById('utmPresetSelect').value = preset.key || '';
    setStatus(`Preset cargado para ${preset.name}.`, 'ok');
  }

  function renderPresetOptions() {
    const select = document.getElementById('utmPresetSelect');
    if (!select) return;
    select.innerHTML = `
      <option value="">Elegir preset...</option>
      ${state.presets.map((preset) => `<option value="${escapeHtml(preset.key)}">${escapeHtml(preset.name)}</option>`).join('')}
    `;
  }

  function renderPresetList() {
    const container = document.getElementById('utmPresetList');
    if (!container) return;

    if (!state.presets.length) {
      container.innerHTML = '<div class="tools-empty">Todavía no hay presets guardados. El primero se guarda cuando generás o guardás un link con origen_actual.</div>';
      return;
    }

    container.innerHTML = state.presets.map((preset) => `
      <article class="tools-preset-card">
        <button type="button" data-preset-key="${escapeHtml(preset.key)}">
          <strong>${escapeHtml(preset.name)}</strong>
          <div class="tools-preset-meta">${escapeHtml(preset.base_url || 'Sin URL base guardada')}</div>
          <div class="tools-preset-meta">${escapeHtml(String(preset.params?.origen_actual || 'Sin origen_actual'))}</div>
          <div class="tools-preset-meta">${Object.keys(preset.params || {}).length} parámetros guardados</div>
        </button>
        <div class="tools-preset-card-actions">
          <button class="tools-preset-delete" type="button" data-delete-preset-key="${escapeHtml(preset.key)}">Borrar</button>
        </div>
      </article>
    `).join('');

    container.querySelectorAll('[data-preset-key]').forEach((button) => {
      button.addEventListener('click', () => {
        const preset = state.presetMap.get(button.dataset.presetKey);
        applyPreset(preset);
      });
    });
    container.querySelectorAll('[data-delete-preset-key]').forEach((button) => {
      button.addEventListener('click', async () => {
        const preset = state.presetMap.get(button.dataset.deletePresetKey);
        if (!preset) return;
        const confirmed = window.confirm(`¿Querés borrar el preset "${preset.name}"?`);
        if (!confirmed) return;
        await handleDeletePreset(preset);
      });
    });
  }

  async function loadPresets() {
    try {
      const response = await window.metricasApi.fetchUtmBuilderPresets();
      state.presets = Array.isArray(response?.presets) ? response.presets : [];
      state.presetMap = new Map(state.presets.map((preset) => [preset.key, preset]));
      renderPresetOptions();
      renderPresetList();
    } catch (error) {
      setStatus(error.message || 'No pude cargar los presets UTM guardados.', 'error');
    }
  }

  function buildGeneratedUrl() {
    const { baseUrl, params } = collectFormValues();

    if (!baseUrl) {
      throw new Error('Completá la URL base antes de generar el link.');
    }

    let url;
    try {
      url = new URL(baseUrl);
    } catch (error) {
      throw new Error('La URL base no es válida. Usá una URL completa, por ejemplo https://tusitio.com/landing');
    }

    const mergedParams = new Map();
    url.searchParams.forEach((value, key) => {
      if (!key || !String(value || '').trim()) return;
      mergedParams.set(key, String(value || '').trim());
    });

    Object.entries(params).forEach(([key, value]) => {
      if (!key || !String(value || '').trim()) return;
      mergedParams.set(key, String(value || '').trim());
    });
    if (!Object.prototype.hasOwnProperty.call(params, 'utm_source')) {
      mergedParams.delete('utm_source');
    }

    const queryString = [...mergedParams.entries()]
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');

    url.search = queryString ? `?${queryString}` : '';
    return url.toString();
  }

  async function persistCurrentPreset() {
    const { origin, baseUrl, params, presetName } = collectFormValues();
    const displayName = String(presetName || origin || '').trim();
    if (!displayName) {
      throw new Error('Para guardar el preset necesitás ponerle un nombre.');
    }

    const response = await window.metricasApi.saveUtmBuilderPreset({
      display_name: displayName,
      base_url: baseUrl,
      params
    });

    const preset = response?.preset || null;
    if (preset?.key) {
      state.presetMap.set(preset.key, preset);
      state.presets = [preset, ...state.presets.filter((item) => item.key !== preset.key)];
      renderPresetOptions();
      renderPresetList();
      document.getElementById('utmPresetSelect').value = preset.key;
    }
  }

  function clearForm() {
    document.getElementById('utmBaseUrl').value = '';
    document.getElementById('utmPresetName').value = '';
    document.getElementById('utmCurrentOrigin').value = '';
    document.getElementById('utmSource').value = '';
    document.getElementById('utmMedium').value = '';
    document.getElementById('utmCampaign').value = '';
    document.getElementById('utmContent').value = '';
    document.getElementById('utmTerm').value = '';
    document.getElementById('utmIncludeContactId').checked = false;
    document.getElementById('utmPresetSelect').value = '';
    document.getElementById('utmOutput').value = '';
    resetCustomParamRows();
    setStatus('Formulario limpio.', 'ok');
  }

  async function handleGenerate() {
    try {
      const generatedUrl = buildGeneratedUrl();
      document.getElementById('utmOutput').value = generatedUrl;
      const { origin } = collectFormValues();
      if (origin) {
        try {
          await persistCurrentPreset();
          setStatus(`Link generado y preset guardado para ${origin}.`, 'ok');
        } catch (saveError) {
          setStatus(`Link generado, pero no pude guardar el preset: ${saveError.message}`, 'error');
        }
      } else {
        setStatus('Link generado correctamente.', 'ok');
      }
    } catch (error) {
      setStatus(error.message || 'No pude generar el link.', 'error');
    }
  }

  async function handleSavePreset() {
    try {
      await persistCurrentPreset();
      setStatus('Preset guardado correctamente.', 'ok');
    } catch (error) {
      setStatus(error.message || 'No pude guardar el preset.', 'error');
    }
  }

  async function handleDeletePreset(preset) {
    try {
      await window.metricasApi.deleteUtmBuilderPreset({
        key: preset.key
      });
      state.presetMap.delete(preset.key);
      state.presets = state.presets.filter((item) => item.key !== preset.key);
      renderPresetOptions();
      renderPresetList();
      if (document.getElementById('utmPresetSelect').value === preset.key) {
        document.getElementById('utmPresetSelect').value = '';
      }
      setStatus(`Preset "${preset.name}" borrado correctamente.`, 'ok');
    } catch (error) {
      setStatus(error.message || 'No pude borrar el preset.', 'error');
    }
  }

  async function handleCopyLink() {
    const value = String(document.getElementById('utmOutput')?.value || '').trim();
    if (!value) {
      setStatus('Primero generá un link para poder copiarlo.', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setStatus('Link copiado al portapapeles.', 'ok');
    } catch (error) {
      setStatus('No pude copiar el link automáticamente.', 'error');
    }
  }

  function bindEvents() {
    document.addEventListener('click', (event) => {
      if (event.target.closest('.tools-param-key')) return;
      document.querySelectorAll('.tools-param-row').forEach((row) => hideSuggestions(row));
    });
    document.getElementById('addUtmParam')?.addEventListener('click', () => {
      getCustomParamsContainer()?.appendChild(createCustomParamRow());
    });
    document.getElementById('clearUtmForm')?.addEventListener('click', clearForm);
    document.getElementById('generateUtmLink')?.addEventListener('click', handleGenerate);
    document.getElementById('saveUtmPreset')?.addEventListener('click', handleSavePreset);
    document.getElementById('copyUtmLink')?.addEventListener('click', handleCopyLink);
    document.getElementById('utmPresetSelect')?.addEventListener('change', (event) => {
      const preset = state.presetMap.get(String(event.target.value || '').trim());
      if (preset) applyPreset(preset);
    });
  }

  resetCustomParamRows();
  bindEvents();
  loadGhlFields();
  loadPresets();
})();
