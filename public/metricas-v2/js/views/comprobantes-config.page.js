(function initComprobantesConfigPage() {
  const EXPECTED_AUDITED_PAYMENT_METHODS = 51;
  const state = { config: null };
  const refs = {
    safety: document.getElementById('comprobantesLabSafety'),
    rules: document.getElementById('comprobantesLabRules'),
    products: document.getElementById('comprobantesLabProducts'),
    payments: document.getElementById('comprobantesLabPayments'),
    responsible: document.getElementById('comprobantesLabResponsible'),
    paymentSearch: document.getElementById('comprobantesLabPaymentSearch'),
    paymentStatus: document.getElementById('comprobantesLabPaymentStatus'),
    productsCount: document.getElementById('comprobantesLabProductsCount'),
    paymentsCount: document.getElementById('comprobantesLabPaymentsCount'),
    responsibleCount: document.getElementById('comprobantesLabResponsibleCount'),
    addProduct: document.getElementById('comprobantesLabAddProduct'),
    addPayment: document.getElementById('comprobantesLabAddPayment'),
    addResponsible: document.getElementById('comprobantesLabAddResponsible'),
    exportConfig: document.getElementById('comprobantesLabExportConfig'),
    importConfig: document.getElementById('comprobantesLabImportConfig'),
    save: document.getElementById('comprobantesLabSave'),
    saveHint: document.getElementById('comprobantesLabSaveHint'),
  };

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function percent(value) {
    return `${(Number(value || 0) * 100).toLocaleString('es-AR', { maximumFractionDigits: 4 })}%`;
  }

  function slugify(value, fallback) {
    return String(value || fallback || 'item')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'item';
  }

  function uniqueCode(items, base) {
    const root = slugify(base, 'item');
    const codes = new Set(items.map((item) => item.code));
    let code = root;
    let suffix = 2;
    while (codes.has(code)) code = `${root}-${suffix++}`;
    return code;
  }

  function uniquePriceKey(prices, base) {
    const root = slugify(base, 'precio');
    const keys = new Set(prices.map((price) => price.key));
    let key = root;
    let suffix = 2;
    while (keys.has(key)) key = `${root}-${suffix++}`;
    return key;
  }

  function nextName(items, base) {
    const names = new Set(items.map((item) => String(item.name || '').toLowerCase()));
    let name = base;
    let suffix = 2;
    while (names.has(name.toLowerCase())) name = `${base} ${suffix++}`;
    return name;
  }

  function persisted(item) {
    return Boolean(item.id || item.legacyNotionId);
  }

  function actionButton(item, kind, index) {
    const action = persisted(item) ? 'toggle-active' : 'remove-new';
    const label = persisted(item) ? (item.active ? 'Desactivar' : 'Reactivar') : 'Quitar';
    return `<button type="button" class="comprobantes-lab-row-action" data-action="${action}" data-kind="${kind}" data-index="${index}">${label}</button>`;
  }

  function renderSafety(config) {
    const locked = config.safety?.dryRunOnly !== false || !config.migrationReady;
    refs.safety.className = 'comprobantes-lab-safety is-safe';
    refs.safety.textContent = locked ? 'Configuración disponible en modo lectura.' : 'Los cambios se aplican a las próximas cargas al guardar.';
    refs.save.disabled = locked;
    refs.saveHint.textContent = locked ? 'El guardado no está habilitado en este entorno.' : 'Guardá los cambios antes de salir.';
  }

  function renderRules() {
    refs.rules.textContent = 'Base de comisión = importe cobrado − IVA − costo del medio de pago. Sobre ese neto se aplica el porcentaje del vendedor.';
  }

  function renderClubPrices(item, productIndex) {
    const prices = item.clubPrices || [];
    return `
      <div class="comprobantes-lab-price-list">
        ${prices.map((price, priceIndex) => `
          <div class="comprobantes-lab-price" data-price-index="${priceIndex}">
            <input data-price-field="key" aria-label="Código del precio" value="${escapeHtml(price.key)}" />
            <input data-price-field="label" aria-label="Nombre del precio" value="${escapeHtml(price.label)}" />
            <input data-price-field="amountArs" aria-label="Importe ARS" type="number" min="0.01" step="0.01" value="${Number(price.amountArs || 0)}" />
            <button type="button" class="comprobantes-lab-mini-action" data-action="remove-price" data-index="${productIndex}" data-price-index="${priceIndex}" aria-label="Quitar precio">×</button>
          </div>
        `).join('')}
        <button type="button" class="comprobantes-lab-mini-action is-add" data-action="add-price" data-index="${productIndex}">+ Precio</button>
      </div>
    `;
  }

  function renderProducts() {
    const products = state.config.products || [];
    refs.productsCount.textContent = `${products.filter((item) => item.active).length} activos`;
    refs.products.innerHTML = products.map((item, index) => `
      <tr data-product-index="${index}" class="${item.active ? '' : 'is-inactive'}">
        <td><input data-field="active" type="checkbox" ${item.active ? 'checked' : ''} /></td>
        <td><input data-field="name" value="${escapeHtml(item.name)}" /></td>
        <td>${renderClubPrices(item, index)}</td>
        <td><code>${escapeHtml(item.code)}</code></td>
        <td>${actionButton(item, 'product', index)}</td>
      </tr>
    `).join('');
  }

  function renderPayments() {
    const payments = state.config.paymentMethods || [];
    const unnamedCount = payments.filter((item) => String(item.code || '').startsWith('sin-nombre-historico-')).length;
    refs.paymentsCount.textContent = `${payments.length}/${EXPECTED_AUDITED_PAYMENT_METHODS} cargados · ${payments.filter((item) => item.active).length} activos · ${unnamedCount} sin nombre original`;
    refs.paymentsCount.classList.toggle('is-warning', payments.length < EXPECTED_AUDITED_PAYMENT_METHODS);
    refs.payments.innerHTML = payments.map((item, index) => `
      <tr data-payment-index="${index}" data-payment-active="${item.active ? 'true' : 'false'}" data-payment-unnamed="${String(item.code || '').startsWith('sin-nombre-historico-') ? 'true' : 'false'}" data-payment-search="${escapeHtml([item.name, item.type, item.account, item.code].join(' ').toLowerCase())}" class="${item.active ? '' : 'is-inactive'}">
        <td><input data-field="active" type="checkbox" ${item.active ? 'checked' : ''} /></td>
        <td><input data-field="name" value="${escapeHtml(item.name)}" /></td>
        <td><input data-field="type" value="${escapeHtml(item.type)}" /></td>
        <td><input data-field="ivaRate" type="number" min="0" max="1" step="0.0001" value="${Number(item.ivaRate || 0)}" /></td>
        <td><input data-field="commissionRate" type="number" min="0" max="1" step="0.0001" value="${Number(item.commissionRate || 0)}" /></td>
        <td><input data-field="initialBalance" type="number" step="0.01" value="${Number(item.initialBalance || 0)}" /></td>
        <td><input data-field="account" value="${escapeHtml(item.account)}" /></td>
        <td>${actionButton(item, 'payment', index)}</td>
      </tr>
    `).join('');
    filterPaymentRows();
  }

  function filterPaymentRows() {
    const query = String(refs.paymentSearch?.value || '').trim().toLowerCase();
    const status = refs.paymentStatus?.value || 'all';
    refs.payments?.querySelectorAll('[data-payment-index]').forEach((row) => {
      const matchesQuery = !query || String(row.dataset.paymentSearch || '').includes(query);
      const matchesStatus = status === 'all'
        || (status === 'active' && row.dataset.paymentActive === 'true')
        || (status === 'inactive' && row.dataset.paymentActive === 'false')
        || (status === 'unnamed' && row.dataset.paymentUnnamed === 'true');
      row.hidden = !(matchesQuery && matchesStatus);
    });
  }

  function renderResponsible() {
    const people = state.config.responsiblePeople || [];
    refs.responsibleCount.textContent = `${people.filter((item) => item.active).length} activos`;
    refs.responsible.innerHTML = people.map((item, index) => `
      <tr data-responsible-index="${index}" class="${item.active ? '' : 'is-inactive'}">
        <td><input data-field="active" type="checkbox" ${item.active ? 'checked' : ''} /></td>
        <td><input data-field="name" value="${escapeHtml(item.name)}" /></td>
        <td><input data-field="email" type="email" value="${escapeHtml(item.email)}" /></td>
        <td><select data-field="role">
          ${['Closer', 'Setter', 'Ambos'].map((role) => `<option ${item.role === role ? 'selected' : ''}>${role}</option>`).join('')}
        </select></td>
        <td><code>${escapeHtml(item.code)}</code></td>
        <td>${actionButton(item, 'responsible', index)}</td>
      </tr>
    `).join('');
  }

  function collectConfig(stripMetadata = true) {
    const config = JSON.parse(JSON.stringify(state.config));
    refs.rules.querySelectorAll('[data-rule]').forEach((input) => {
      config.rules[input.dataset.rule] = Number(input.value || 0);
    });
    config.rules.cutoverChecklist = config.rules.cutoverChecklist || {};
    refs.rules.querySelectorAll('[data-cutover-status]').forEach((input) => {
      config.rules.cutoverChecklist[input.dataset.cutoverStatus] = input.value;
    });
    refs.rules.querySelectorAll('[data-cutover-check]').forEach((input) => {
      config.rules.cutoverChecklist[input.dataset.cutoverCheck] = input.checked;
    });
    refs.products.querySelectorAll('[data-product-index]').forEach((row) => {
      const item = config.products[Number(row.dataset.productIndex)];
      item.active = row.querySelector('[data-field="active"]').checked;
      item.name = row.querySelector('[data-field="name"]').value.trim();
      item.clubPrices = [...row.querySelectorAll('.comprobantes-lab-price[data-price-index]')].map((priceRow) => ({
        key: priceRow.querySelector('[data-price-field="key"]').value.trim(),
        label: priceRow.querySelector('[data-price-field="label"]').value.trim(),
        amountArs: Number(priceRow.querySelector('[data-price-field="amountArs"]').value || 0)
      }));
    });
    refs.payments.querySelectorAll('[data-payment-index]').forEach((row) => {
      const item = config.paymentMethods[Number(row.dataset.paymentIndex)];
      item.active = row.querySelector('[data-field="active"]').checked;
      ['name', 'type', 'account'].forEach((field) => {
        item[field] = row.querySelector(`[data-field="${field}"]`).value.trim();
      });
      ['ivaRate', 'commissionRate', 'initialBalance'].forEach((field) => {
        item[field] = Number(row.querySelector(`[data-field="${field}"]`).value || 0);
      });
    });
    refs.responsible.querySelectorAll('[data-responsible-index]').forEach((row) => {
      const item = config.responsiblePeople[Number(row.dataset.responsibleIndex)];
      item.active = row.querySelector('[data-field="active"]').checked;
      ['name', 'email', 'role'].forEach((field) => {
        item[field] = row.querySelector(`[data-field="${field}"]`).value.trim();
      });
    });
    delete config.rules.productPaymentMethods;
    if (stripMetadata) {
      delete config.safety;
      delete config.migrationReady;
      delete config.source;
      delete config.warning;
      delete config.readiness;
    }
    return config;
  }

  function addCatalogItem(kind) {
    state.config = collectConfig(false);
    if (kind === 'product') {
      const name = nextName(state.config.products, 'Nuevo producto');
      state.config.products.push({ code: uniqueCode(state.config.products, name), name, active: true, clubPrices: [] });
      renderProducts();
      return;
    }
    if (kind === 'payment') {
      const name = nextName(state.config.paymentMethods, 'Nuevo medio de pago');
      state.config.paymentMethods.push({ code: uniqueCode(state.config.paymentMethods, name), name, active: true, type: 'Propia', account: '', ivaRate: 0, commissionRate: 0, initialBalance: 0 });
      renderPayments();
      return;
    }
    const name = nextName(state.config.responsiblePeople, 'Nuevo responsable');
    state.config.responsiblePeople.push({ code: uniqueCode(state.config.responsiblePeople, name), name, email: '', role: 'Closer', active: true });
    renderResponsible();
  }

  function exportConfig() {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      config: collectConfig()
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `configuracion-comprobantes-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    refs.saveHint.textContent = 'Respaldo JSON generado sin modificar la configuración.';
  }

  async function importConfig(event) {
    const [file] = event.target.files || [];
    event.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const incoming = parsed?.config || parsed;
      if (!incoming || typeof incoming !== 'object') throw new Error('El archivo no contiene una configuración válida.');
      const current = collectConfig(false);
      const next = {
        ...current,
        products: Array.isArray(incoming.products) ? incoming.products : current.products,
        paymentMethods: Array.isArray(incoming.paymentMethods) ? incoming.paymentMethods : current.paymentMethods,
        responsiblePeople: Array.isArray(incoming.responsiblePeople) ? incoming.responsiblePeople : current.responsiblePeople,
        rules: incoming.rules && typeof incoming.rules === 'object'
          ? { ...current.rules, ...incoming.rules }
          : current.rules
      };
      if (!next.products.length || !next.paymentMethods.length || !next.responsiblePeople.length) {
        throw new Error('Productos, medios de pago y responsables no pueden quedar vacíos.');
      }
      state.config = next;
      renderRules();
      renderProducts();
      renderPayments();
      renderResponsible();
      refs.saveHint.textContent = `Respaldo preparado: ${next.paymentMethods.length} medios de pago. Revisá los datos y presioná Guardar para persistirlos.`;
    } catch (error) {
      refs.saveHint.textContent = `No se pudo importar: ${error.message}`;
    }
  }

  function handleCatalogAction(event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    state.config = collectConfig(false);
    const index = Number(button.dataset.index);
    if (button.dataset.action === 'add-price') {
      const prices = state.config.products[index].clubPrices;
      const number = prices.length + 1;
      prices.push({ key: uniquePriceKey(prices, `club${number}`), label: `Precio Club ${number}`, amountArs: 0 });
      renderProducts();
      return;
    }
    if (button.dataset.action === 'remove-price') {
      state.config.products[index].clubPrices.splice(Number(button.dataset.priceIndex), 1);
      renderProducts();
      return;
    }
    const collections = {
      product: state.config.products,
      payment: state.config.paymentMethods,
      responsible: state.config.responsiblePeople
    };
    const collection = collections[button.dataset.kind];
    const item = collection?.[index];
    if (!item) return;
    if (button.dataset.action === 'remove-new') collection.splice(index, 1);
    else item.active = !item.active;
    renderProducts();
    renderPayments();
    renderResponsible();
  }

  async function saveConfig() {
    refs.save.disabled = true;
    refs.save.textContent = 'Guardando…';
    try {
      const response = await fetch('/api/metricas/comprobantes-direct/config', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(collectConfig())
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || `Error HTTP ${response.status}`);
      refs.saveHint.textContent = 'Configuración guardada en Supabase. Actualizando catálogos…';
      await load();
      refs.saveHint.textContent = 'Configuración guardada en Supabase.';
    } catch (error) {
      refs.saveHint.textContent = error.message;
    } finally {
      refs.save.disabled = state.config.safety?.dryRunOnly !== false || !state.config.migrationReady;
      refs.save.textContent = 'Guardar configuración';
    }
  }

  async function load() {
    try {
      const response = await window.http.getJson('/api/metricas/comprobantes-direct/config');
      state.config = response.config;
      renderSafety(state.config);
      renderRules();
      renderProducts();
      renderPayments();
      renderResponsible();
    } catch (error) {
      refs.safety.className = 'comprobantes-lab-safety is-error';
      refs.safety.innerHTML = `<strong>No pude abrir la configuración</strong><span>${escapeHtml(error.message)}</span>`;
    }
  }

  refs.save?.addEventListener('click', saveConfig);
  refs.addProduct?.addEventListener('click', () => addCatalogItem('product'));
  refs.addPayment?.addEventListener('click', () => addCatalogItem('payment'));
  refs.addResponsible?.addEventListener('click', () => addCatalogItem('responsible'));
  refs.exportConfig?.addEventListener('click', exportConfig);
  refs.importConfig?.addEventListener('change', importConfig);
  refs.paymentSearch?.addEventListener('input', filterPaymentRows);
  refs.paymentStatus?.addEventListener('change', filterPaymentRows);
  refs.products?.addEventListener('click', handleCatalogAction);
  refs.payments?.addEventListener('click', handleCatalogAction);
  refs.responsible?.addEventListener('click', handleCatalogAction);
  load();
})();
