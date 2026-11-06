(function () {
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const SECTIONS = [
    {key: 'deudores', title: 'Deudores', help: 'Estado de pago: Deudor. No responder sin saberlo.', fin: false},
    {key: 'morosos', title: 'Morosos', help: 'Estado de pago: Apurar.', fin: false},
    {key: 'negociacion', title: 'En negociación', help: 'Ya cursaron MEG, sin renovar, con fecha final entre hace 15 y dentro de 30 días.', fin: true}
  ];
  const date = v => v ? v.split('-').reverse().join('/') : '—';
  const fin = r => r.fecha_final ? `${date(r.fecha_final)} (${r.dias_para_fin < 0 ? `venció hace ${-r.dias_para_fin} d` : r.dias_para_fin === 0 ? 'hoy' : `en ${r.dias_para_fin} d`})` : '—';
  function table(section, rows) {
    if (!rows.length) return '<p>Sin clientes en esta lista.</p>';
    return `<div class="table-wrap"><table><thead><tr><th>Cliente</th><th>Teléfono</th><th>Closer</th><th>Producto</th><th>Fecha final</th><th>Próx. contacto CSM</th><th>Detalle</th></tr></thead><tbody>${
      rows.map(r => `<tr><td>${esc(r.nombre)}</td><td>${esc(r.telefono || '—')}</td><td>${esc(r.closer || '—')}</td><td>${esc(r.producto || '—')}</td><td>${esc(fin(r))}</td><td>${esc(date(r.proximo_contacto_csm))}</td><td>${r.ghlid ? `<a href="/contacto-estado/?ghlId=${encodeURIComponent(r.ghlid)}" target="_blank" rel="noopener" aria-label="Ver estado de ${esc(r.nombre || 'contacto')} (abre en otra pestaña)">Ver estado del contacto ↗</a>` : 'Sin ID de GHL'}</td></tr>`).join('')
    }</tbody></table></div>`;
  }
  async function load() {
    const status = document.getElementById('status');
    status.textContent = 'Cargando…';
    try {
      const data = await window.http.getJson('/api/metricas/csm-deudores');
      document.getElementById('kpiContainer').innerHTML = SECTIONS.map(s => `<article class="card"><h3>${s.title}</h3><p style="font-size:2rem;font-weight:700">${data[s.key].length}</p></article>`).join('');
      document.getElementById('lists').innerHTML = SECTIONS.map(s => `<section class="chart-panel"><h3>${s.title} (${data[s.key].length})</h3><p>${s.help}</p>${table(s, data[s.key])}</section>`).join('');
      status.textContent = `Actualizado ${new Date(data.generado).toLocaleString('es-AR')}`;
    } catch (error) { status.textContent = 'No se pudo cargar el listado. Probá actualizar.'; }
  }
  document.getElementById('reload').addEventListener('click', load);
  load();
})();
