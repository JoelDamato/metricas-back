(function () {
  const dialog = document.createElement('dialog');
  dialog.className = 'commission-sale-dialog';
  dialog.setAttribute('aria-labelledby', 'commissionSaleTitle');
  document.body.appendChild(dialog);
  let receiptId = null;
  let revision = 0;
  let busy = false;
  let requestId = 0;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const percent = value => value == null ? '' : Math.round(Number(value) * 1000000) / 10000;
  async function request(id, data) {
    const response = await fetch(`/api/metricas/commission-sale-overrides/${encodeURIComponent(id)}`, {
      method: data ? 'PATCH' : 'GET', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }, ...(data ? { body: JSON.stringify(data) } : {})
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || result.error || 'No se pudo guardar la comisión.');
    return result.data;
  }
  async function open(id) {
    if (busy) return;
    const current = ++requestId;
    receiptId = id;
    dialog.innerHTML = '<h2 id="commissionSaleTitle">Comisión especial</h2><p role="status">Buscando la venta vinculada…</p><button type="button" data-commission-close>Cerrar</button>';
    if (!dialog.open) dialog.showModal();
    try {
      const item = await request(id);
      if (current !== requestId || !dialog.open) return;
      revision = item.revision;
      dialog.innerHTML = `
        <div class="commission-sale-heading"><div><span>EXCEPCIÓN POR VENTA</span><h2 id="commissionSaleTitle">Comisión especial</h2></div><button type="button" data-commission-close aria-label="Cerrar">×</button></div>
        <p><strong>${escape(item.client_name)}</strong> · ${escape(item.product || 'Venta')}</p>
        <p class="commission-sale-notice">El cambio se guarda en la venta y se aplica a todas sus cobranzas actuales y futuras. Cada porcentaje reemplaza la escalera sólo para el rol indicado.</p>
        <form>
          <div class="commission-sale-fields">
            <label>Closer · ${escape(item.closer || 'Sin asignar')}<span><input name="closer_pct" type="number" min="0" max="100" step="0.01" value="${percent(item.closer_pct)}" placeholder="Escalera" /> %</span></label>
            <label>Setter · ${escape(item.setter || 'Sin asignar')}<span><input name="setter_pct" type="number" min="0" max="100" step="0.01" value="${percent(item.setter_pct)}" placeholder="Escalera" /> %</span></label>
          </div>
          <p>Dejá vacío un porcentaje para usar la regla habitual de ese rol. El 0% significa que no cobra comisión.</p>
          ${item.reason ? `<p>Último motivo: ${escape(item.reason)}</p>` : ''}
          <label>Motivo del cambio<textarea name="reason" required minlength="3" maxlength="500" rows="3" placeholder="Por qué se acordó este porcentaje"></textarea></label>
          <p data-commission-status role="status"></p>
          <div class="commission-sale-actions"><button type="button" data-commission-reset>Volver ambos a la escalera</button><button type="submit" class="metricas-primary-button">Guardar para la venta y sus cobranzas</button></div>
        </form>`;
    } catch (error) {
      if (current === requestId && dialog.open) dialog.querySelector('[role="status"]').textContent = error.message;
    }
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-sale-commission]');
    if (button) open(button.dataset.saleCommission);
  });
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  dialog.addEventListener('click', event => {
    if (event.target.closest('[data-commission-close]') && !busy) dialog.close();
    if (event.target.closest('[data-commission-reset]') && !busy) {
      dialog.querySelectorAll('input').forEach(input => { input.value = ''; });
      dialog.querySelector('[data-commission-status]').textContent = 'Indicá un motivo y guardá para volver a las reglas habituales.';
    }
  });
  dialog.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    const form = event.target;
    const status = dialog.querySelector('[data-commission-status]');
    const values = new FormData(form);
    const pct = key => values.get(key).trim() === '' ? null : Number(values.get(key)) / 100;
    const data = { closer_pct: pct('closer_pct'), setter_pct: pct('setter_pct'), reason: values.get('reason').trim(), revision };
    busy = true;
    dialog.querySelectorAll('button, input, textarea').forEach(node => { node.disabled = true; });
    status.textContent = 'Guardando porcentajes…';
    try {
      const item = await request(receiptId, data);
      revision = item.revision;
      status.textContent = 'Guardado. La venta y todas sus cobranzas usan estos porcentajes. Recargá Liquidaciones o Comisiones para ver los importes actualizados.';
    } catch (error) { status.textContent = error.message; }
    finally {
      busy = false;
      dialog.querySelectorAll('button, input, textarea').forEach(node => { node.disabled = false; });
    }
  });
})();
