(function initAlertasOperativasPage() {
  const statusNode = document.getElementById('status');
  const summaryNode = document.getElementById('alertasSummary');
  const sectionsNode = document.getElementById('alertasSections');
  const cutoffNode = document.getElementById('alertasFechaCorte');
  const updatedNode = document.getElementById('alertasLastUpdate');
  const reloadButton = document.getElementById('reloadAlertas');
  const loadingNode = document.getElementById('alertasLoading');

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeText(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  function toDateOnly(value) {
    if (!value) return '';
    return String(value).slice(0, 10);
  }

  function parseDateAsLocalDay(value) {
    const date = toDateOnly(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  function startOfToday() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function todayDateOnly() {
    const now = startOfToday();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  function daysBetween(start, end) {
    if (!(start instanceof Date) || !(end instanceof Date)) return null;
    return Math.round((end.getTime() - start.getTime()) / 86400000);
  }

  function formatInteger(value) {
    return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(Number(value || 0));
  }

  function formatDate(value) {
    const date = parseDateAsLocalDay(value);
    if (!date) return '-';
    return new Intl.DateTimeFormat('es-AR', { dateStyle: 'short' }).format(date);
  }

  function formatDateTime(value) {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) return '-';
    return new Intl.DateTimeFormat('es-AR', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(value);
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(value || 0));
  }

  function formatDays(value) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return '-';
    return `${formatInteger(value)} d`;
  }

  function setLoading(isLoading) {
    if (loadingNode) loadingNode.hidden = !isLoading;
    if (reloadButton) reloadButton.disabled = isLoading;
    summaryNode.toggleAttribute('hidden', isLoading);
    sectionsNode.toggleAttribute('hidden', isLoading);
    statusNode.classList.toggle('is-loading', isLoading);
  }

  function safeNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  function getAlertIcon(alert) {
    const iconByKey = {
      sin_onboarding: '👥',
      sin_diagnostico_7: '🩺',
      agendas_pendientes: '📅',
      cash_raro: '$',
      leads_duplicados: '👥',
      comprobantes_sin_conciliar: '📋',
      comprobantes_rebotados: '🧾'
    };

    return iconByKey[alert.key] || '!';
  }

  function normalizeDigits(value) {
    return String(value || '').replace(/\D+/g, '');
  }

  function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
  }

  function isAbandonmentActivity(row) {
    return normalizeText(row?.abandono).includes('abandono');
  }

  function createContactCell(label, ghlid) {
    return {
      type: 'ghl-contact',
      label: label || 'Sin nombre',
      ghlid: ghlid || ''
    };
  }

  function renderPopupCell(cell) {
    if (cell && typeof cell === 'object' && cell.type === 'ghl-contact') {
      return window.metricasGhl?.renderContactCell(cell.label, cell.ghlid) || escapeHtml(cell.label);
    }
    return escapeHtml(cell);
  }

  function buildPopup(alert) {
    const existing = document.getElementById('alertasOperativasPopup');
    if (existing) existing.remove();

    const detailTable = alert.rows.length
      ? `
        <div class="metric-info-detail">
          <p><strong>Detalle:</strong></p>
          <input id="alertasOperativasSearch" class="metric-info-search" type="search" placeholder="Buscar..." autocomplete="off" />
          <div class="table-wrap csm-table-wrap">
            <table class="csm-table csm-detail-table">
              <thead>
                <tr>${alert.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr>
              </thead>
              <tbody>
                ${alert.rows.map((row) => `
                  <tr>${row.map((cell) => `<td>${renderPopupCell(cell)}</td>`).join('')}</tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `
      : `<p class="alertas-empty-inline">${escapeHtml(alert.emptyText || 'Sin casos abiertos.')}</p>`;

    const popup = document.createElement('div');
    popup.id = 'alertasOperativasPopup';
    popup.className = 'kpi-popup metric-info-popup';
    popup.innerHTML = `
      <div class="kpi-popup-card metric-info-card${alert.columns.length >= 6 ? ' metric-info-card-wide' : ''}">
        <h3>${escapeHtml(alert.title)}</h3>
        <p><strong>Base que contabiliza:</strong> ${escapeHtml(alert.base)}</p>
        <p><strong>Campo que toma:</strong> ${escapeHtml(alert.fieldsLabel)}</p>
        <p><strong>Muestra:</strong> ${escapeHtml(alert.logic)}</p>
        ${detailTable}
        <div class="metric-info-actions">
          <button id="closeAlertasOperativasPopup" type="button">Cerrar</button>
        </div>
      </div>
    `;

    document.body.appendChild(popup);

    const close = () => popup.remove();
    popup.addEventListener('click', (event) => {
      if (event.target === popup) close();
    });
    document.getElementById('closeAlertasOperativasPopup')?.addEventListener('click', close);

    const searchInput = document.getElementById('alertasOperativasSearch');
    if (searchInput) {
      const rows = Array.from(popup.querySelectorAll('.csm-detail-table tbody tr'));
      searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim().toLowerCase();
        rows.forEach((row) => {
          row.style.display = !query || row.textContent.toLowerCase().includes(query) ? '' : 'none';
        });
      });
      searchInput.focus();
    }
  }

  function attachPopupTriggers(root, alertMap) {
    root.querySelectorAll('[data-alert-key]').forEach((node) => {
      const open = () => buildPopup(alertMap.get(node.dataset.alertKey));
      node.addEventListener('click', open);
      node.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      });
    });
  }

  function normalizeCsmRows(rows) {
    return (rows || []).map((row) => {
      const payDate = parseDateAsLocalDay(row.f_pago_con_acceso || row.f_acceso);
      const onboardingDateRaw = parseDateAsLocalDay(row.f_onboarding);
      const diagnosisDateRaw = parseDateAsLocalDay(row.f_diagnostico || row.modulo_1);

      const onboardingDate = (payDate && onboardingDateRaw && onboardingDateRaw < payDate) ? null : onboardingDateRaw;
      const diagnosisDate = (payDate && diagnosisDateRaw && diagnosisDateRaw < payDate) ? null : diagnosisDateRaw;

      return {
        ...row,
        payDate,
        onboardingDate,
        diagnosisDate
      };
    });
  }

  function buildAlerts({ csmRows, comprobantesRows, leadsRows }) {
    const today = startOfToday();
    const currentYear = today.getFullYear();

    const csmNormalized = normalizeCsmRows(csmRows).filter((row) => row.payDate && !isAbandonmentActivity(row));

    const agendaPendingRows = (leadsRows || [])
      .map((row) => {
        const agendaDate = parseDateAsLocalDay(row.fecha_agenda);
        if (!agendaDate || agendaDate.getFullYear() !== currentYear) return null;
        if (normalizeText(row.agendo) !== 'agendo') return null;
        if (normalizeText(row.aplica) !== 'aplica') return null;

        const llamadaMeg = normalizeText(row.llamada_meg);
        if (llamadaMeg && llamadaMeg !== 'pendiente') return null;

        return {
          closer: row.closer || 'Sin closer',
          cliente: row.nombre || 'Sin nombre',
          ghlid: row.ghlid || '-',
          fechaAgenda: toDateOnly(row.fecha_agenda || ''),
          fechaLlamada: toDateOnly(row.fecha_llamada || ''),
          setter: row.setter || '-',
          origen: row.origen || '-',
          estrategia: row.estrategia_a || '-',
          estadoPendiente: llamadaMeg === 'pendiente' ? 'Pendiente' : 'Vacío'
        };
      })
      .filter(Boolean)
      .sort((a, b) =>
        a.closer.localeCompare(b.closer, 'es') ||
        String(a.fechaAgenda || '').localeCompare(String(b.fechaAgenda || '')) ||
        a.cliente.localeCompare(b.cliente, 'es')
      );

    const noOnboardingRows = csmNormalized
      .filter((row) => !row.onboardingDate)
      .map((row) => ({
        nombre: row.nombre || 'Sin nombre',
        ghlid: row.ghlid || '',
        payDate: toDateOnly(row.f_pago_con_acceso || row.f_acceso || ''),
        elapsedDays: daysBetween(row.payDate, today),
        modelo: row.modelo_negocio || '-'
      }))
      .sort((a, b) => (b.elapsedDays ?? -1) - (a.elapsedDays ?? -1) || a.nombre.localeCompare(b.nombre));

    const diagnosisOver7Rows = csmNormalized
      .filter((row) => !row.diagnosisDate)
      .map((row) => ({
        nombre: row.nombre || 'Sin nombre',
        ghlid: row.ghlid || '',
        payDate: toDateOnly(row.f_pago_con_acceso || row.f_acceso || ''),
        elapsedDays: daysBetween(row.payDate, today),
        onboardingDate: toDateOnly(row.f_onboarding || '')
      }))
      .filter((row) => row.elapsedDays !== null && row.elapsedDays > 7)
      .sort((a, b) => b.elapsedDays - a.elapsedDays || a.nombre.localeCompare(b.nombre));

    const weirdCashRows = (comprobantesRows || [])
      .filter((row) => normalizeText(row.tipo) === 'venta')
      .filter((row) => !normalizeText(row.producto_format).includes('club'))
      .map((row) => {
        const facturacion = safeNumber(row.facturacion);
        const cash = safeNumber(row.cash_collected_total || row.cash_collected);
        const issues = [];

        if (cash < 0) issues.push('Cash negativo');
        if (facturacion <= 0) issues.push('Facturación no positiva');
        if (facturacion > 0 && cash > facturacion * 1.05) issues.push('Cash mayor a facturación');
        if (cash > 0 && !toDateOnly(row.f_acreditacion)) issues.push('Cash sin fecha de acreditación');

        if (!issues.length) return null;

        return {
          closer: row.creado_por || 'Sin closer',
          ghlid: row.ghlid || row.ghl_id || '-',
          producto: row.producto_format || '-',
          venta: toDateOnly(row.f_venta || ''),
          acreditacion: toDateOnly(row.f_acreditacion || ''),
          facturacion,
          cash,
          motivo: issues.join(' · ')
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.cash - a.cash || a.closer.localeCompare(b.closer));

    const duplicateLeadGroups = [];
    const duplicateLeadMap = new Map();

    (leadsRows || []).forEach((row) => {
      const whatsapp = normalizeDigits(row.whatsapp);
      const telefono = normalizeDigits(row.telefono);
      const mail = normalizeEmail(row.mail);

      let identityType = '';
      let identityValue = '';

      if (whatsapp.length >= 8) {
        identityType = 'WhatsApp';
        identityValue = whatsapp;
      } else if (telefono.length >= 8) {
        identityType = 'Teléfono';
        identityValue = telefono;
      } else if (mail) {
        identityType = 'Mail';
        identityValue = mail;
      } else {
        return;
      }

      const identityKey = `${identityType}:${identityValue}`;
      const current = duplicateLeadMap.get(identityKey) || {
        identityType,
        identityValue,
        rows: []
      };

      current.rows.push({
        nombre: row.nombre || 'Sin nombre',
        ghlid: row.ghlid || '-',
        fechaCreada: toDateOnly(row.fecha_creada || row.created_time || ''),
        origen: row.origen || row.primer_origen || '-',
        setter: row.setter || '-',
        closer: row.closer || '-'
      });

      duplicateLeadMap.set(identityKey, current);
    });

    duplicateLeadMap.forEach((group) => {
      if ((group.rows || []).length < 2) return;
      const orderedRows = [...group.rows].sort((a, b) => String(a.fechaCreada || '').localeCompare(String(b.fechaCreada || '')));
      duplicateLeadGroups.push({
        identityType: group.identityType,
        identityValue: group.identityValue,
        count: orderedRows.length,
        names: [...new Set(orderedRows.map((row) => row.nombre))].join(' | '),
        rows: orderedRows
      });
    });

    duplicateLeadGroups.sort((a, b) => b.count - a.count || a.names.localeCompare(b.names));

    const unconciledRows = (comprobantesRows || [])
      .map((row) => {
        const estado = normalizeText(row.estado);
        if (!estado.includes('sin conciliar')) return null;

        return {
          closer: row.creado_por || 'Sin closer',
          estado: row.estado || 'Sin estado',
          tipo: row.tipo || '-',
          producto: row.producto_format || '-',
          venta: toDateOnly(row.f_venta || ''),
          acreditacion: toDateOnly(row.f_acreditacion || ''),
          facturacion: safeNumber(row.facturacion),
          cash: safeNumber(row.cash_collected_total || row.cash_collected)
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.facturacion - a.facturacion || a.closer.localeCompare(b.closer));

    const bouncedRows = (comprobantesRows || [])
      .map((row) => {
        const estado = normalizeText(row.estado);
        if (!estado.includes('rebot')) return null;

        return {
          closer: row.creado_por || 'Sin closer',
          estado: row.estado || 'Sin estado',
          tipo: row.tipo || '-',
          producto: row.producto_format || '-',
          venta: toDateOnly(row.f_venta || ''),
          acreditacion: toDateOnly(row.f_acreditacion || ''),
          facturacion: safeNumber(row.facturacion),
          cash: safeNumber(row.cash_collected_total || row.cash_collected)
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.facturacion - a.facturacion || a.closer.localeCompare(b.closer));

    return [
      {
        key: 'agendas_pendientes',
        title: 'Agendas pendientes',
        severity: 'high',
        count: agendaPendingRows.length,
        description: `Agendas ${currentYear} con aplica, agendo y llamada MEG en pendiente o vacía.`,
        base: `${formatInteger(agendaPendingRows.length)} agendas del año ${currentYear} con "llamada_meg" pendiente o vacía`,
        fieldsLabel: '"fecha_agenda", "agendo", "aplica", "llamada_meg"',
        logic: 'Usa la misma regla de Agendas: agendo = Agendo, aplica = Aplica y llamada_meg = Pendiente o vacío. Ordena por closer y fecha de agenda.',
        columns: ['Closer', 'Cliente', 'GHL ID', 'F. agenda', 'F. llamada', 'Setter', 'Origen', 'Estrategia', 'Estado'],
        rows: agendaPendingRows.map((row) => [
          row.closer,
          createContactCell(row.cliente, row.ghlid),
          row.ghlid,
          formatDate(row.fechaAgenda),
          formatDate(row.fechaLlamada),
          row.setter,
          row.origen,
          row.estrategia,
          row.estadoPendiente
        ]),
        emptyText: 'No hay agendas pendientes con la lógica actual.'
      },
      {
        key: 'sin_onboarding',
        title: 'Clientes sin onboarding',
        severity: 'high',
        count: noOnboardingRows.length,
        description: 'Clientes con pago con acceso cargado que todavía no tienen onboarding.',
        base: `${formatInteger(noOnboardingRows.length)} clientes activos sin onboarding`,
        fieldsLabel: '"f_pago_con_acceso", "f_acceso", "f_onboarding"',
        logic: 'Entra todo cliente activo con fecha de ingreso y sin fecha de onboarding. Ordena por días transcurridos desde el ingreso.',
        columns: ['Cliente', 'Pago con acceso', 'Días desde ingreso', 'Modelo'],
        rows: noOnboardingRows.map((row) => [createContactCell(row.nombre, row.ghlid), formatDate(row.payDate), formatDays(row.elapsedDays), row.modelo]),
        emptyText: 'No hay clientes pendientes de onboarding.'
      },
      {
        key: 'sin_diagnostico_7',
        title: 'Sin diagnóstico > 7 días',
        severity: 'high',
        count: diagnosisOver7Rows.length,
        description: 'Clientes sin sesión diagnóstico después de 7 días desde el ingreso.',
        base: `${formatInteger(diagnosisOver7Rows.length)} clientes sin diagnóstico y con más de 7 días desde ingreso`,
        fieldsLabel: '"f_pago_con_acceso", "f_acceso", "modulo_1"',
        logic: 'Cuenta clientes activos que todavía no hicieron la sesión diagnóstico y ya superaron 7 días desde su ingreso.',
        columns: ['Cliente', 'Pago con acceso', 'Días desde ingreso', 'Onboarding'],
        rows: diagnosisOver7Rows.map((row) => [createContactCell(row.nombre, row.ghlid), formatDate(row.payDate), formatDays(row.elapsedDays), formatDate(row.onboardingDate)]),
        emptyText: 'No hay clientes atrasados en diagnóstico.'
      },
      {
        key: 'cash_raro',
        title: 'Ventas con cash raro',
        severity: 'medium',
        count: weirdCashRows.length,
        description: 'Ventas con cash incoherente, negativo o sin acreditación cargada.',
        base: `${formatInteger(weirdCashRows.length)} comprobantes de venta con inconsistencias de cash`,
        fieldsLabel: '"tipo", "facturacion", "cash_collected_total", "cash_collected", "f_acreditacion"',
        logic: 'Marca ventas no Club cuando el cash es negativo, la facturación no es positiva, el cash supera la facturación o hay cash cargado sin fecha de acreditación.',
        columns: ['Closer', 'GHL ID', 'Producto', 'F. venta', 'F. acreditación', 'Facturación', 'Cash', 'Motivo'],
        rows: weirdCashRows.map((row) => [
          row.closer,
          row.ghlid,
          row.producto,
          formatDate(row.venta),
          formatDate(row.acreditacion),
          formatCurrency(row.facturacion),
          formatCurrency(row.cash),
          row.motivo
        ]),
        emptyText: 'No hay ventas con cash extraño.'
      },
      {
        key: 'leads_duplicados',
        title: 'Clientes duplicados en leads',
        severity: 'medium',
        count: duplicateLeadGroups.length,
        description: 'Agrupa leads repetidos por WhatsApp, teléfono o mail dentro de la base.',
        base: `${formatInteger(duplicateLeadGroups.length)} grupos duplicados detectados en leads_raw`,
        fieldsLabel: '"whatsapp", "telefono", "mail", "nombre", "ghlid"',
        logic: 'Busca duplicados en leads_raw usando primero WhatsApp, si falta teléfono, y si falta mail. Solo marca grupos con 2 o más filas.',
        columns: ['Identidad', 'Valor', 'Cantidad', 'GHL ID', 'Nombres', 'Fechas', 'Setters', 'Closers'],
        rows: duplicateLeadGroups.map((group) => [
          group.identityType,
          group.identityValue,
          formatInteger(group.count),
          [...new Set(group.rows.map((row) => row.ghlid).filter(Boolean))].join(' | ') || '-',
          group.names,
          group.rows.map((row) => formatDate(row.fechaCreada)).join(' | '),
          [...new Set(group.rows.map((row) => row.setter).filter(Boolean))].join(' | ') || '-',
          [...new Set(group.rows.map((row) => row.closer).filter(Boolean))].join(' | ') || '-'
        ]),
        emptyText: 'No hay clientes duplicados detectados con la lógica actual.'
      },
      {
        key: 'comprobantes_sin_conciliar',
        title: 'Comprobantes sin conciliar',
        severity: 'medium',
        count: unconciledRows.length,
        description: 'Cantidad en vivo de comprobantes que siguen marcados como sin conciliar.',
        base: `${formatInteger(unconciledRows.length)} comprobantes con estado sin conciliar`,
        fieldsLabel: '"estado", "tipo", "f_venta", "f_acreditacion"',
        logic: 'Cuenta comprobantes cuyo estado contiene "sin conciliar". La lectura es en vivo sobre la tabla de comprobantes.',
        columns: ['Closer', 'Estado', 'Tipo', 'Producto', 'F. venta', 'F. acreditación', 'Facturación', 'Cash'],
        rows: unconciledRows.map((row) => [
          row.closer,
          row.estado,
          row.tipo,
          row.producto,
          formatDate(row.venta),
          formatDate(row.acreditacion),
          formatCurrency(row.facturacion),
          formatCurrency(row.cash)
        ]),
        emptyText: 'No hay comprobantes sin conciliar.'
      },
      {
        key: 'comprobantes_rebotados',
        title: 'Comprobantes rebotados',
        severity: 'high',
        count: bouncedRows.length,
        description: 'Cantidad en vivo de comprobantes rebotados para revisar al instante.',
        base: `${formatInteger(bouncedRows.length)} comprobantes con estado rebotado`,
        fieldsLabel: '"estado", "tipo", "f_venta", "f_acreditacion"',
        logic: 'Cuenta comprobantes cuyo estado contiene "rebot". La lectura es en vivo sobre la tabla de comprobantes.',
        columns: ['Closer', 'Estado', 'Tipo', 'Producto', 'F. venta', 'F. acreditación', 'Facturación', 'Cash'],
        rows: bouncedRows.map((row) => [
          row.closer,
          row.estado,
          row.tipo,
          row.producto,
          formatDate(row.venta),
          formatDate(row.acreditacion),
          formatCurrency(row.facturacion),
          formatCurrency(row.cash)
        ]),
        emptyText: 'No hay comprobantes rebotados.'
      },
    ];
  }

  function renderSummary(alerts) {
    const alertMap = new Map(alerts.map((alert) => [alert.key, alert]));
    summaryNode.innerHTML = alerts.map((alert) => `
      <article
        class="card alertas-summary-card alertas-summary-card-${escapeHtml(alert.severity)}"
        data-alert-key="${escapeHtml(alert.key)}"
        role="button"
        tabindex="0"
      >
        <span class="alertas-summary-chip">${escapeHtml(alert.severity === 'high' ? 'Prioridad alta' : 'Prioridad media')}</span>
        <span class="alertas-summary-icon" aria-hidden="true">${escapeHtml(getAlertIcon(alert))}</span>
        <h3>${escapeHtml(alert.title)}</h3>
        <strong>${formatInteger(alert.count)}</strong>
        <p>${escapeHtml(alert.description)}</p>
      </article>
    `).join('');

    attachPopupTriggers(summaryNode, alertMap);
  }

  function renderSections(alerts) {
    const alertMap = new Map(alerts.map((alert) => [alert.key, alert]));
    sectionsNode.innerHTML = alerts.map((alert) => `
      <section class="table-wrap alertas-section">
        <div class="alertas-section-head">
          <div>
            <h3>
              <button
                type="button"
                class="metric-info-trigger metric-label alertas-section-trigger"
                data-alert-key="${escapeHtml(alert.key)}"
              >${escapeHtml(alert.title)}</button>
            </h3>
            <p>${escapeHtml(alert.description)}</p>
          </div>
          <span class="alertas-section-total">${formatInteger(alert.count)}</span>
        </div>
        <div class="alertas-section-meta">
          <span><strong>Base:</strong> ${escapeHtml(alert.base)}</span>
        </div>
        <div class="table-wrap csm-table-wrap">
          <table class="csm-table csm-detail-table">
            <thead>
              <tr>${alert.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${alert.rows.length
                ? alert.rows.slice(0, 8).map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')
                : `<tr><td colspan="${alert.columns.length}">${escapeHtml(alert.emptyText || 'Sin casos abiertos.')}</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    `).join('');

    attachPopupTriggers(sectionsNode, alertMap);
  }

  async function loadAlertas() {
    setLoading(true);
    statusNode.textContent = 'Cargando alertas operativas...';
    summaryNode.innerHTML = '';
    sectionsNode.innerHTML = '';

    try {
      const [csmData, comprobantesData, leadsData] = await Promise.all([
        window.metricasApi.fetchAllRows('csm', {
          select: 'nombre,ghlid,abandono,f_pago_con_acceso,f_acceso,f_onboarding,f_diagnostico,modulo_1,modelo_negocio'
        }),
        window.metricasApi.fetchAllRows('comprobantes', {
          select: 'creado_por,estado,tipo,producto_format,f_venta,f_acreditacion,facturacion,cash_collected_total,cash_collected,ghlid'
        }),
        window.metricasApi.fetchAllRows('leads_raw', {
          select: 'nombre,mail,telefono,whatsapp,ghlid,fecha_creada,created_time,origen,primer_origen,setter,closer,fecha_agenda,fecha_llamada,agendo,aplica,llamada_meg,estrategia_a'
        })
      ]);

      const alerts = buildAlerts({
        csmRows: csmData.rows || [],
        comprobantesRows: comprobantesData.rows || [],
        leadsRows: leadsData.rows || []
      });

      renderSummary(alerts);
      renderSections(alerts);

      const totalAlerts = alerts.reduce((sum, alert) => sum + Number(alert.count || 0), 0);
      statusNode.textContent = totalAlerts
        ? `${formatInteger(totalAlerts)} casos requieren atención entre las alertas activas.`
        : 'No hay alertas activas con las reglas actuales.';

      cutoffNode.textContent = `Corte: ${formatDate(todayDateOnly())}`;
      updatedNode.textContent = `Actualizado: ${formatDateTime(new Date())}`;
    } catch (error) {
      console.error(error);
      statusNode.textContent = 'No pude cargar las alertas operativas.';
    } finally {
      setLoading(false);
    }
  }

  reloadButton?.addEventListener('click', loadAlertas);
  loadAlertas();
})();
