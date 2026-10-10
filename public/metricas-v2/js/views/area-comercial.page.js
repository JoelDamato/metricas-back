(function initCommercialArea() {
  const monthInput = document.getElementById('commercialAreaMonth');
  const status = document.getElementById('commercialAreaStatus');
  const summary = document.getElementById('commercialAreaSummary');
  const table = document.getElementById('commercialAreaTable');
  if (!monthInput || !status || !summary || !table) return;

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  const formatUsd = (value) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
  const formatArs = (value) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(value || 0));
  const formatPercent = (value) => `${new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value || 0) * 100)}%`;
  const formatDate = (value) => {
    const date = String(value || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '—';
    return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
  };
  const defaultMonth = new Date().toISOString().slice(0, 7);
  monthInput.value = new URLSearchParams(window.location.search).get('mes') || defaultMonth;

  function renderSummary(data) {
    const items = [
      [data.commissionBreakdown ? 'Comisión total · Marketing + Closer' : data.commissionArea ? `Comisión del área ${data.commissionArea}` : 'Comisión total calculada', formatArs(data.summary?.totalCommission)],
      ['Comprobantes comisionables', String(data.summary?.transactionCount || 0)],
      ['Cash neto USD', formatUsd(data.summary?.cashUsd)],
      ['Cash neto ARS', formatArs(data.summary?.cashArs)],
      ['Descuentos aplicados', formatArs(data.summary?.totalDeductionsArs)],
      ['Facturación neta', formatUsd(data.summary?.facturacionUsd)],
      ['Base total comisionable', formatArs(data.summary?.totalBase)],
      ['Agendas', String(data.summary?.agendas || 0)]
    ];
    if (data.commissionBreakdown) items.splice(1, 0, ['Comisión como closer', formatArs(data.commissionBreakdown.closer)], ['Comisión de Marketing', formatArs(data.commissionBreakdown.marketing)]);
    summary.innerHTML = items.map(([label, value]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`).join('');
  }

  function renderDeductions(row) {
    const iva = Number(row.ivaArs || 0);
    const iibb = Number(row.iibbArs || 0);
    const paymentFees = Number(row.paymentFeesArs ?? row.externalCommissionsArs ?? 0);
    const total = Number(row.totalDeductionsArs ?? (iva + iibb + paymentFees));
    const paymentLabel = row.paymentMethod ? `Comisión ${row.paymentMethod}` : 'Comisión del medio';
    return `<strong>${escapeHtml(formatArs(total))}</strong>
      <small>IVA: ${escapeHtml(formatArs(iva))}</small>
      ${iibb > 0 ? `<small>IIBB: ${escapeHtml(formatArs(iibb))}</small>` : ''}
      <small>${escapeHtml(paymentLabel)}: ${escapeHtml(formatArs(paymentFees))}</small>`;
  }

  function renderTable(details, summaryData = {}) {
    const totalCash = Number(summaryData.cashUsd || 0);
    const totalCashArs = Number(summaryData.cashArs || 0);
    const totalDeductions = Number(summaryData.totalDeductionsArs || 0);
    const totalBase = Number(summaryData.totalBase || 0);
    const totalCommission = Number(summaryData.totalCommission || 0);
    table.innerHTML = `
      <table class="csm-table commercial-area-table">
        <thead><tr><th>Acreditación</th><th>Cliente</th><th>Tipo / producto</th><th>Origen</th><th>Medio de pago</th><th>Cash neto USD</th><th>Cash neto ARS</th><th>Descuentos aplicados</th><th>Base neta ARS</th><th>%</th><th>Comisión ARS</th></tr></thead>
        <tbody>${details.length ? details.map((row) => `
          <tr>
            <td>${escapeHtml(formatDate(row.acreditacionDate || row.acreditacionDateTime || row.date))}</td>
            <td><strong>${escapeHtml(row.clientName || (row.isBonus ? 'Bono del período' : '—'))}</strong><small>${escapeHtml(row.ghlid || '')}</small></td>
            <td><strong>${escapeHtml(row.tipo || (row.isBonus ? 'Bono' : '—'))}</strong><small>${escapeHtml(row.product || row.category || '')}</small></td>
            <td>${escapeHtml(row.origin || row.firstOrigin || '—')}<small>${escapeHtml(row.sourceRule || '')}</small></td>
            <td>${escapeHtml(row.paymentMethod || '—')}</td>
            <td>${escapeHtml(formatUsd(row.cashUsd))}</td>
            <td>${escapeHtml(formatArs(row.cashArs))}</td>
            <td class="commercial-area-deductions">${renderDeductions(row)}</td>
            <td>${escapeHtml(formatArs(row.baseAmount))}</td>
            <td>${escapeHtml(formatPercent(row.commissionPct))}</td>
            <td>${escapeHtml(formatArs(row.commissionAmount))}</td>
          </tr>`).join('') : '<tr><td colspan="11">No hay comisiones calculadas para tu usuario en este mes.</td></tr>'}</tbody>
        ${details.length ? `<tfoot><tr>
          <td colspan="5"><strong>Total de ${escapeHtml(String(summaryData.transactionCount || 0))} comprobantes comisionables</strong></td>
          <td>${escapeHtml(formatUsd(totalCash))}</td>
          <td>${escapeHtml(formatArs(totalCashArs))}</td>
          <td>${escapeHtml(formatArs(totalDeductions))}</td>
          <td>${escapeHtml(formatArs(totalBase))}</td>
          <td>—</td>
          <td>${escapeHtml(formatArs(totalCommission))}</td>
        </tr></tfoot>` : ''}
      </table>
      <div class="commercial-mobile-list">
        ${details.length ? details.map((row) => `
          <article class="commercial-mobile-card">
            <div class="commercial-mobile-card-head">
              <div><small>${escapeHtml(formatDate(row.acreditacionDate || row.acreditacionDateTime || row.date))}</small>
                <h3>${escapeHtml(row.clientName || (row.isBonus ? 'Bono del período' : 'Sin nombre'))}</h3>
                <p>${escapeHtml(row.tipo || (row.isBonus ? 'Bono' : '—'))} · ${escapeHtml(row.product || row.category || '—')}</p>
              </div>
            </div>
            <div class="commercial-mobile-amount"><span>Tu comisión · ${escapeHtml(formatPercent(row.commissionPct))}</span><strong>${escapeHtml(formatArs(row.commissionAmount))}</strong></div>
            <details><summary>Ver cálculo y comprobante</summary>
              <dl>
                <div><dt>Cash neto USD</dt><dd>${escapeHtml(formatUsd(row.cashUsd))}</dd></div>
                <div><dt>Cash neto ARS</dt><dd>${escapeHtml(formatArs(row.cashArs))}</dd></div>
                <div><dt>Cash bruto ARS</dt><dd>${escapeHtml(formatArs(row.grossCashArs))}</dd></div>
                <div><dt>Medio de pago</dt><dd>${escapeHtml(row.paymentMethod || '—')}</dd></div>
                <div><dt>Descuentos</dt><dd>${renderDeductions(row)}</dd></div>
                <div><dt>Base neta ARS</dt><dd>${escapeHtml(formatArs(row.baseAmount))}</dd></div>
                <div><dt>Origen</dt><dd>${escapeHtml(row.origin || row.firstOrigin || '—')}<small>${escapeHtml(row.sourceRule || '')}</small></dd></div>
                ${row.ghlid ? `<div><dt>ID del cliente</dt><dd>${escapeHtml(row.ghlid)}</dd></div>` : ''}
              </dl>
            </details>
          </article>`).join('') : '<p class="commercial-mobile-empty">No hay comisiones calculadas para tu usuario en este mes.</p>'}
      </div>`;
  }

  async function load() {
    status.textContent = 'Cargando tu información comercial…';
    try {
      const data = await window.metricasApi.fetchMyCommercialArea(monthInput.value);
      document.getElementById('commercialAreaIdentity').textContent = `${data.person || 'Usuario'} · información personal de ${data.month}.`;
      renderSummary(data);
      renderTable(Array.isArray(data.details) ? data.details : [], data.summary || {});
      const params = new URLSearchParams(window.location.search);
      params.set('mes', monthInput.value);
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
      status.textContent = `${data.summary?.transactionCount || 0} comprobantes comisionables y ${data.details?.length || 0} líneas de comisión. La información se muestra solo para tu identidad.`;
    } catch (error) {
      summary.innerHTML = '';
      table.innerHTML = '<div class="report-empty">No se pudo cargar tu área comercial.</div>';
      status.textContent = error.message || 'No se pudo cargar tu área comercial.';
    }
  }

  document.getElementById('commercialAreaReload')?.addEventListener('click', load);
  monthInput.addEventListener('change', load);
  window.addEventListener('settlement-updated', load);
  load();
})();
