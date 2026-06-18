const PAGE_OPTIONS = [
  { value: 'dashboard.html', label: 'Dashboard' },
  { value: 'index.html', label: 'Central de metricas' },
  { value: 'ranking.html', label: 'Ranking closers' },
  { value: 'agendas-totales.html', label: 'Agendas totales' },
  { value: 'agendas-ultimo-origen.html', label: 'Agendas por ultimo origen' },
  { value: 'agendas-detalle-closer.html', label: 'Agendas por closer' },
  { value: 'analisis-ventas.html', label: 'Analisis de ventas' },
  { value: 'kpi-closers.html', label: 'KPI closers' },
  { value: 'setting.html', label: 'Setting' },
  { value: 'reportes.html', label: 'Reportes' },
  { value: 'alertas-operativas.html', label: 'Alertas operativas' },
  { value: 'mag-sistema-agendas.html', label: 'Sistema de agendas' },
  { value: 'mag-reportes-personales.html', label: 'Reportes personales de closers' },
  { value: 'mag-reporte-closers-2026.html', label: 'Reporte closers' },
  { value: 'mag-manual-closers.html', label: 'Manual closers' },
  { value: 'leads-bdd.html', label: 'Informe por respuestas' },
  { value: 'marketing.html', label: 'Marketing' },
  { value: 'comisiones.html', label: 'Comisiones' },
  { value: 'comprobantes.html', label: 'Portada de comprobantes' },
  { value: 'carga-comprobantes.html', label: 'Carga de comprobantes' },
  { value: 'mis-comprobantes.html', label: 'Mis comprobantes' },
  { value: 'herramientas.html', label: 'Herramientas' },
  { value: 'generador-params.html', label: 'Generador de params' },
  { value: 'estado-contacto-comisiones.html', label: 'Estado de contacto comisiones' },
  { value: 'csm-tiempo.html', label: 'CSM por tiempo' },
  { value: 'csm-situacion.html', label: 'CSM por situacion' },
  { value: 'csm-renovaciones.html', label: 'Renovaciones' },
  { value: 'view.html', label: 'Vista interna' }
];

const RESOURCE_OPTIONS = [
  { value: 'ranking_closers_mensual', label: 'Datos de ranking closers' },
  { value: 'agenda_totales', label: 'Datos de agendas totales' },
  { value: 'agenda_totales_ultimo_origen', label: 'Datos de ultimo origen' },
  { value: 'agenda_detalle_por_origen_closer', label: 'Datos de agendas por closer' },
  { value: 'kpi_closers_mensual', label: 'Datos de KPI closers' },
  { value: 'setters', label: 'Datos de setters' },
  { value: 'setting', label: 'Datos de setting' },
  { value: 'agenda_detalle_diario_closer', label: 'Detalle diario de agendas' },
  { value: 'ventas_diario_closer', label: 'Detalle diario de ventas' },
  { value: 'cash_collected_diario_closer', label: 'Detalle diario de cash collected' },
  { value: 'comprobantes', label: 'Datos de comprobantes' },
  { value: 'leads_raw', label: 'Base de leads' },
  { value: 'csm', label: 'Base de CSM' },
  { value: 'kpi_marketing_diario', label: 'KPI marketing diario' },
  { value: 'kpi_marketing_inversiones', label: 'Inversiones de marketing' }
];

const SPECIAL_ACCESS_OPTIONS = [
  { key: 'marketingOnly', label: 'Solo marketing' },
  { key: 'restrictedCommercial', label: 'Comercial con restricciones' },
  { key: 'csmOnly', label: 'CSM con restricciones' },
  { key: 'canEditReportesPremio', label: 'Puede editar premio de reportes' },
  { key: 'canGenerateCloserAiReport', label: 'Puede generar reportes con GPT' },
  { key: 'canManageUsers', label: 'Puede administrar usuarios' }
];

const HOME_PATH_OPTIONS = [
  { value: '', label: 'Sin inicio forzado' },
  { value: '/index.html', label: 'Central' },
  { value: '/dashboard.html', label: 'Dashboard' },
  { value: '/views/marketing.html', label: 'Marketing' },
  { value: '/views/setting.html', label: 'Setting' },
  { value: '/views/admin-usuarios.html', label: 'Administracion' },
  { value: '/views/csm-tiempo.html', label: 'CSM por tiempo' }
];

const state = {
  users: [],
  sessionUser: null,
  activeTab: 'create',
  editingUserId: null
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setStatus(message, tone = '') {
  const node = document.getElementById('adminUsersStatus');
  node.textContent = message;
  node.dataset.tone = tone;
}

function setActiveTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.admin-users-tab').forEach((button) => {
    const active = button.dataset.tab === tab;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  document.querySelectorAll('.admin-users-panel').forEach((panel) => {
    panel.hidden = panel.dataset.panel !== tab;
  });
}

function normalizeUserAccessConfig(user = {}) {
  return {
    useCustomAccess: user.access_config?.useCustomAccess === true || Array.isArray(user.permissions?.allowedPages),
    homePath: user.access_config?.homePath || user.permissions?.homePath || '',
    allowedPages: user.access_config?.allowedPages || user.permissions?.allowedPages || [],
    allowedResources: user.access_config?.allowedResources || user.permissions?.allowedResources || [],
    marketingOnly: user.access_config?.marketingOnly === true || user.permissions?.accessFlags?.marketingOnly === true,
    restrictedCommercial: user.access_config?.restrictedCommercial === true || user.permissions?.accessFlags?.restrictedCommercial === true,
    csmOnly: user.access_config?.csmOnly === true || user.permissions?.accessFlags?.csmOnly === true,
    canEditReportesPremio: user.access_config?.canEditReportesPremio === true || user.permissions?.canEditReportesPremio === true,
    canGenerateCloserAiReport: user.access_config?.canGenerateCloserAiReport === true || user.permissions?.canGenerateCloserAiReport === true,
    canManageUsers: user.access_config?.canManageUsers === true || user.permissions?.canManageUsers === true
  };
}

function getLabel(options, value) {
  return options.find((item) => item.value === value)?.label || value;
}

function checkedValues(form, name) {
  return [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((input) => input.value);
}

function buildAccessConfig(form) {
  return {
    useCustomAccess: form.querySelector('[name="useCustomAccess"]')?.checked === true,
    homePath: form.querySelector('[name="homePath"]')?.value || null,
    allowedPages: checkedValues(form, 'allowedPages'),
    allowedResources: checkedValues(form, 'allowedResources'),
    marketingOnly: form.querySelector('[name="marketingOnly"]')?.checked === true,
    restrictedCommercial: form.querySelector('[name="restrictedCommercial"]')?.checked === true,
    csmOnly: form.querySelector('[name="csmOnly"]')?.checked === true,
    canEditReportesPremio: form.querySelector('[name="canEditReportesPremio"]')?.checked === true,
    canGenerateCloserAiReport: form.querySelector('[name="canGenerateCloserAiReport"]')?.checked === true,
    canManageUsers: form.querySelector('[name="canManageUsers"]')?.checked === true,
    allowedFeatures: {}
  };
}

function renderCheckboxGrid(name, options, selectedValues = []) {
  const selected = new Set(selectedValues);
  return options.map((option) => `
    <label class="admin-users-pill-check">
      <input type="checkbox" name="${name}" value="${escapeHtml(option.value)}" ${selected.has(option.value) ? 'checked' : ''} />
      <span>${escapeHtml(option.label)}</span>
    </label>
  `).join('');
}

function renderSpecialFlags(accessConfig = {}, disableManageUsers = false) {
  return SPECIAL_ACCESS_OPTIONS.map((option) => `
    <label class="admin-users-check">
      <input
        type="checkbox"
        name="${escapeHtml(option.key)}"
        ${accessConfig[option.key] ? 'checked' : ''}
        ${disableManageUsers && option.key === 'canManageUsers' ? 'disabled' : ''}
      />
      <span>${escapeHtml(option.label)}</span>
    </label>
  `).join('');
}

function renderHumanAccessFields(accessConfig = {}, options = {}) {
  return `
    <div class="admin-users-block">
      <h3>Accesos especiales</h3>
      <div class="admin-users-check-stack">
        ${renderSpecialFlags(accessConfig, options.disableManageUsers === true)}
      </div>
    </div>

    <div class="admin-users-block">
      <label class="admin-users-check admin-users-check--toggle">
        <input type="checkbox" name="useCustomAccess" ${accessConfig.useCustomAccess ? 'checked' : ''} />
        <span>Quiero elegir exactamente que puede ver esta cuenta</span>
      </label>

      <div class="admin-users-custom-fields" ${accessConfig.useCustomAccess ? '' : 'hidden'}>
        <label>
          Pantalla de inicio
          <select name="homePath">
            ${HOME_PATH_OPTIONS.map((item) => `<option value="${escapeHtml(item.value)}" ${item.value === (accessConfig.homePath || '') ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}
          </select>
        </label>

        <div class="admin-users-field-group">
          <span>Pantallas permitidas</span>
          <div class="admin-users-pill-grid">
            ${renderCheckboxGrid('allowedPages', PAGE_OPTIONS, accessConfig.allowedPages)}
          </div>
        </div>

        <div class="admin-users-field-group">
          <span>Datos permitidos</span>
          <div class="admin-users-pill-grid">
            ${renderCheckboxGrid('allowedResources', RESOURCE_OPTIONS, accessConfig.allowedResources)}
          </div>
        </div>
      </div>
    </div>
  `;
}

function createUserFormMarkup() {
  return `
    <div class="admin-users-form-grid">
      <label>
        Nombre
        <input name="nombre" type="text" placeholder="Nombre visible" required />
      </label>
      <label>
        Email
        <input name="email" type="email" placeholder="correo@dominio.com" required />
      </label>
    </div>

    <div class="admin-users-form-grid">
      <label>
        Rol principal
        <select name="role" required>
          <option value="total">Admin total</option>
          <option value="comercial">Comercial</option>
          <option value="csm">CSM</option>
        </select>
      </label>
      <label>
        Contraseña inicial
        <input name="password" type="password" placeholder="Contraseña inicial" required />
      </label>
    </div>

    ${renderHumanAccessFields({}, { disableManageUsers: false })}

    <div class="admin-users-form-actions">
      <button type="submit">Crear cuenta</button>
    </div>
  `;
}

function getSummaryChips(user) {
  const access = normalizeUserAccessConfig(user);
  const chips = [];
  if (access.marketingOnly) chips.push('Solo marketing');
  if (access.restrictedCommercial) chips.push('Comercial restringido');
  if (access.csmOnly) chips.push('CSM restringido');
  if (access.canGenerateCloserAiReport) chips.push('GPT');
  if (access.canManageUsers) chips.push('Admin usuarios');
  if (!chips.length) chips.push('Acceso normal');
  return chips;
}

function renderUsers() {
  const list = document.getElementById('usersList');
  if (!state.users.length) {
    list.innerHTML = '<div class="admin-users-empty">No hay cuentas cargadas.</div>';
    return;
  }

  list.innerHTML = state.users.map((user) => `
    <article class="admin-users-row">
      <div class="admin-users-row-main">
        <div class="admin-users-row-title">
          <h3>${escapeHtml(user.nombre || user.email)}</h3>
          <span class="admin-users-chip ${user.activo === false ? 'admin-users-chip-muted' : ''}">${user.activo === false ? 'Inactiva' : 'Activa'}</span>
        </div>
        <p>${escapeHtml(user.email)}</p>
        <div class="admin-users-chip-row">
          <span class="admin-users-chip admin-users-chip-soft">${escapeHtml(getLabel([{ value: 'total', label: 'Admin total' }, { value: 'comercial', label: 'Comercial' }, { value: 'csm', label: 'CSM' }], user.role))}</span>
          ${getSummaryChips(user).map((chip) => `<span class="admin-users-chip">${escapeHtml(chip)}</span>`).join('')}
        </div>
      </div>
      <div class="admin-users-row-actions">
        <button type="button" class="admin-users-secondary-btn" data-edit-user="${escapeHtml(user.id)}">Editar</button>
        <button type="button" class="admin-users-secondary-btn" data-password-user="${escapeHtml(user.id)}">Contraseña</button>
        <button type="button" class="admin-users-delete-btn" data-delete-user="${escapeHtml(user.id)}" ${user.email === state.sessionUser?.email ? 'disabled' : ''}>Borrar</button>
      </div>
    </article>
  `).join('');

  bindListActions();
}

function syncCustomSections(root = document) {
  root.querySelectorAll('input[name="useCustomAccess"]').forEach((input) => {
    const container = input.closest('.admin-users-block')?.querySelector('.admin-users-custom-fields');
    if (!container) return;
    container.hidden = !input.checked;
    if (input.dataset.boundCustomToggle === '1') return;
    input.addEventListener('change', () => {
      container.hidden = !input.checked;
    });
    input.dataset.boundCustomToggle = '1';
  });
}

function loadUsersStatusText(count) {
  return `Hay ${count} cuenta${count === 1 ? '' : 's'} cargada${count === 1 ? '' : 's'}.`;
}

async function loadUsers() {
  setStatus('Cargando usuarios...');
  const response = await window.metricasApi.fetchAuthUsers();
  state.users = response.users || [];
  renderUsers();
  setStatus(loadUsersStatusText(state.users.length), 'success');
}

async function handleCreateUser(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  submit.textContent = 'Creando...';

  try {
    await window.metricasApi.createAuthUser({
      nombre: form.nombre.value.trim(),
      email: form.email.value.trim(),
      role: form.role.value,
      password: form.password.value,
      activo: true,
      accessConfig: buildAccessConfig(form)
    });
    form.reset();
    form.innerHTML = createUserFormMarkup();
    syncCustomSections(form);
    form.addEventListener('submit', handleCreateUser);
    await loadUsers();
    setStatus('Cuenta creada correctamente.', 'success');
    setActiveTab('manage');
  } catch (error) {
    setStatus(error.message || 'No pude crear la cuenta.', 'error');
  } finally {
    submit.disabled = false;
    submit.textContent = 'Crear cuenta';
  }
}

function getUserById(userId) {
  return state.users.find((user) => String(user.id) === String(userId)) || null;
}

function openModal(userId, mode = 'edit') {
  const user = getUserById(userId);
  if (!user) return;

  state.editingUserId = userId;
  const modal = document.getElementById('adminUserModal');
  const title = document.getElementById('adminUserModalTitle');
  const subtitle = document.getElementById('adminUserModalSubtitle');
  const form = document.getElementById('editUserForm');
  const accessConfig = normalizeUserAccessConfig(user);
  const isSelf = user.email === state.sessionUser?.email;

  title.textContent = mode === 'password' ? 'Cambiar contraseña' : 'Editar accesos';
  subtitle.textContent = `${user.nombre || user.email} · ${user.email}`;

  if (mode === 'password') {
    form.innerHTML = `
      <input type="hidden" name="mode" value="password" />
      <label>
        Nueva contraseña
        <input name="password" type="password" placeholder="Escribí la nueva contraseña" required />
      </label>
      <div class="admin-users-form-actions">
        <button type="submit">Guardar contraseña</button>
      </div>
    `;
  } else {
    form.innerHTML = `
      <input type="hidden" name="mode" value="edit" />
      <div class="admin-users-form-grid">
        <label>
          Nombre
          <input name="nombre" type="text" value="${escapeHtml(user.nombre || '')}" required />
        </label>
        <label>
          Rol principal
          <select name="role" ${isSelf ? 'disabled' : ''}>
            <option value="total" ${user.role === 'total' ? 'selected' : ''}>Admin total</option>
            <option value="comercial" ${user.role === 'comercial' ? 'selected' : ''}>Comercial</option>
            <option value="csm" ${user.role === 'csm' ? 'selected' : ''}>CSM</option>
          </select>
        </label>
      </div>
      <label class="admin-users-check">
        <input name="activo" type="checkbox" ${user.activo !== false ? 'checked' : ''} ${isSelf ? 'disabled' : ''} />
        <span>Cuenta activa</span>
      </label>
      ${renderHumanAccessFields(accessConfig, { disableManageUsers: isSelf })}
      <div class="admin-users-form-actions">
        <button type="submit">Guardar cambios</button>
      </div>
    `;
  }

  syncCustomSections(form);
  modal.hidden = false;
  document.body.classList.add('admin-users-modal-open');
}

function closeModal() {
  document.getElementById('adminUserModal').hidden = true;
  document.getElementById('editUserForm').innerHTML = '';
  document.body.classList.remove('admin-users-modal-open');
  state.editingUserId = null;
}

async function handleEditModalSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const mode = form.querySelector('[name="mode"]')?.value;
  const userId = state.editingUserId;
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;

  try {
    if (mode === 'password') {
      await window.metricasApi.updateAuthUserPassword(userId, form.password.value);
      setStatus('Contraseña actualizada.', 'success');
    } else {
      await window.metricasApi.updateAuthUser(userId, {
        nombre: form.nombre.value.trim(),
        role: form.role ? form.role.value : getUserById(userId)?.role,
        activo: form.activo ? form.activo.checked : true,
        accessConfig: buildAccessConfig(form)
      });
      setStatus('Accesos actualizados.', 'success');
    }

    closeModal();
    await loadUsers();
  } catch (error) {
    setStatus(error.message || 'No pude guardar los cambios.', 'error');
  } finally {
    submit.disabled = false;
  }
}

async function handleDeleteUser(userId) {
  const user = getUserById(userId);
  if (!user) return;
  const confirmed = window.confirm(`Vas a borrar la cuenta de ${user.nombre || user.email}.`);
  if (!confirmed) return;

  try {
    await window.metricasApi.deleteAuthUser(userId);
    await loadUsers();
    setStatus('Cuenta borrada.', 'success');
  } catch (error) {
    setStatus(error.message || 'No pude borrar la cuenta.', 'error');
  }
}

function bindListActions() {
  document.querySelectorAll('[data-edit-user]').forEach((button) => {
    button.addEventListener('click', () => openModal(button.dataset.editUser, 'edit'));
  });

  document.querySelectorAll('[data-password-user]').forEach((button) => {
    button.addEventListener('click', () => openModal(button.dataset.passwordUser, 'password'));
  });

  document.querySelectorAll('[data-delete-user]').forEach((button) => {
    button.addEventListener('click', () => handleDeleteUser(button.dataset.deleteUser));
  });
}

function bindStaticUi() {
  document.querySelectorAll('.admin-users-tab').forEach((button) => {
    button.addEventListener('click', () => setActiveTab(button.dataset.tab));
  });

  document.getElementById('editUserForm').addEventListener('submit', handleEditModalSubmit);
  document.getElementById('closeAdminUserModal').addEventListener('click', closeModal);
  document.querySelectorAll('[data-close-modal="1"]').forEach((node) => {
    node.addEventListener('click', closeModal);
  });
}

async function init() {
  const session = await window.http.getJson('/api/metricas/auth/session');
  state.sessionUser = session.user || null;
  if (state.sessionUser?.permissions?.canManageUsers !== true) {
    setStatus('Esta cuenta no tiene permiso para administrar usuarios.', 'error');
    return;
  }

  bindStaticUi();
  const createForm = document.getElementById('createUserForm');
  createForm.innerHTML = createUserFormMarkup();
  createForm.addEventListener('submit', handleCreateUser);
  syncCustomSections(createForm);
  await loadUsers();
}

init().catch((error) => {
  setStatus(error.message || 'No pude cargar la administración de usuarios.', 'error');
});
