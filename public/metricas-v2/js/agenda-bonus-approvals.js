/* Server-calculated bonuses; approving writes to the existing settlement ledger. */
window.loadAgendaBonusApprovals = async function (host, month) {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const endpoint = '/api/metricas/settlements';
  host.innerHTML = '<h2>Bonos · aprobación de Leo</h2><p>Cargando bonos…</p>';
  try {
    const data = await window.http.getJson(`${endpoint}/agenda-bonuses?month=${encodeURIComponent(month)}`);
    if (!host.isConnected) return;
    host.innerHTML = `<h2>Bonos · aprobación de Leo</h2><p>Los bonos pendientes no suman a Liquidaciones. Al aprobar, se registra el importe y el TC para que Nadia pueda pagarlos.</p><p>Nuevo bono: asistencia y cierre en objetivo, cero strikes y al menos 50% del cash collected del equipo. Premio: 1% del cash propio. Cash neto conciliado, sin Club.</p><p data-bonus-status role="status"></p><div class="table-wrap"><table><thead><tr><th>Persona</th><th>Bono</th><th>Importe</th><th>TC a pesos</th><th>Estado</th></tr></thead><tbody>${data.candidates.map((c,i)=>`<tr><td>${esc(c.person_name)}</td><td>${esc(c.concept)}</td><td>${esc(c.currency)} ${Number(c.amount).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2})}</td><td>${!c.movement&&data.canApprove&&!data.locked&&c.currency==='USD'?`<input type="number" data-bonus-tc="${i}" min="0.000001" step="any" aria-label="TC de ${esc(c.person_name)} para ${esc(c.concept)}" style="width:110px">`:c.movement?esc(c.movement.exchange_rate):'—'}</td><td>${c.movement?esc(c.movement.status==='void'?'Anulado (ver historial en Liquidaciones)':'Aprobado · en Liquidaciones'):data.locked?'Mes bloqueado':data.canApprove?`<button class="btn primary" data-bonus-approve="${i}" type="button">Aprobar bono</button>`:'Pendiente de Leo'}</td></tr>`).join('')||'<tr><td colspan="5">No hay bonos calculables para esta persona y mes.</td></tr>'}</tbody></table></div>`;
    host.querySelectorAll('[data-bonus-approve]').forEach(button => {
      const requestKey = crypto.randomUUID();
      button.onclick = async () => {
        if (button.disabled) return;
        const c = data.candidates[Number(button.dataset.bonusApprove)];
        const tc = c.currency === 'ARS' ? 1 : Number(host.querySelector(`[data-bonus-tc="${button.dataset.bonusApprove}"]`).value);
        const status = host.querySelector('[data-bonus-status]');
        if (!Number.isFinite(tc) || tc <= 0) { status.textContent = 'Ingresá un TC válido para aprobar.'; return; }
        button.disabled = true;
        status.textContent = 'Guardando aprobación…';
        try {
          await window.http.postJson(endpoint+'/approve',{month,email:c.person_email,sourceKey:c.source_key,expectedAmount:c.amount,exchangeRate:tc,requestKey});
          await window.loadAgendaBonusApprovals(host,month);
          host.querySelector('[data-bonus-status]').textContent = 'Bono aprobado y agregado a Liquidaciones.';
        } catch (error) { status.textContent = error.message; button.disabled = false; }
      };
    });
  } catch (error) {
    host.innerHTML = `<h2>Bonos · aprobación de Leo</h2><p role="alert">No se pudieron cargar los bonos: ${esc(error.message)}</p>`;
  }
};
