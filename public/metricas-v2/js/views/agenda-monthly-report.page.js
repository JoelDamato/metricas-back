(function initAgendaMonthlyReportPage() {
  const report = window.agendaMonthlyReport;
  const root = document.getElementById('monthlyReportRoot');
  const status = document.getElementById('monthlyReportStatus');
  let currentModel = null;

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatCurrency(value) {
    return `US$ ${Number(value || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function formatPercent(value) {
    return `${Number(value || 0).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  }

  function formatScore(value) {
    const score = Number(value || 0);
    return score > 0 ? `+${score}` : String(score);
  }

  function scoreTone(score) {
    return score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral';
  }

  function parseMonth(value) {
    const [year, month] = String(value || '').split('-').map(Number);
    return { year, month };
  }

  function currentMonthValue() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  function monthRange(year, month) {
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const end = new Date(year, month, 0);
    const finalDate = `${year}-${String(month).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
    const now = new Date();
    const current = year === now.getFullYear() && month === now.getMonth() + 1;
    return { from, to: current ? reportDateKey(now) : finalDate };
  }

  function reportDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  async function fetchKpiRules(year, month) {
    try {
      return await window.http.getJson(`/api/metricas/kpi-closers/rules?anio=${year}&mes=${month}`);
    } catch (error) {
      console.warn('Se usarán las reglas KPI predeterminadas.', error);
      return {};
    }
  }

  async function fetchReportData(year, month) {
    const range = monthRange(year, month);
    const optional = (promise, fallback, label) => promise.catch((error) => {
      console.warn(`No se pudo cargar ${label}; el reporte continuará sin ese bloque.`, error);
      return fallback;
    });
    const [cashResponse, kpiResponse, checkpointResponse, bonusResponse, kpiRules] = await Promise.all([
      window.metricasApi.fetchAllRows('comprobantes', {
        from: range.from,
        to: range.to,
        dateField: 'f_acreditacion',
        orderBy: 'f_acreditacion',
        orderDir: 'asc',
        limit: 1000,
        select: 'responsable_venta,creado_por,producto_format,f_acreditacion,cash_collected_neto,cash_collected,estado'
      }),
      optional(window.metricasApi.fetchAllRows('kpi_closers_mensual', {
        eq_anio: year,
        eq_mes: month,
        orderBy: 'closer',
        orderDir: 'asc',
        limit: 500
      }), { rows: [] }, 'la tabla de KPIs'),
      optional(window.metricasApi.fetchAgendaCheckpoints({ anio: year, mes: month }), { entries: [] }, 'checks, strikes y pendientes'),
      optional(window.metricasApi.fetchAgendaBonusRules({ anio: year, mes: month }), { rules: {} }, 'las reglas de bonus'),
      fetchKpiRules(year, month)
    ]);

    return report.buildReportModel({
      year,
      month,
      cashRows: cashResponse.rows || [],
      kpiRows: kpiResponse.rows || [],
      checkpointEntries: checkpointResponse.entries || [],
      bonusRules: bonusResponse.rules || {},
      kpiRules
    });
  }

  function buildReasonList(items, emptyLabel) {
    if (!items.length) return `<ul class="reason-list empty"><li>${escapeHtml(emptyLabel)}</li></ul>`;
    return `<ul class="reason-list">${items.map((item) => `
      <li><span>${item.automatic ? '<span class="auto-badge">Automático</span> ' : ''}${escapeHtml(item.detail)}</span><strong>${item.quantity > 1 ? `×${item.quantity}` : ''}</strong></li>
    `).join('')}</ul>`;
  }

  function buildScoreCards(model) {
    return model.scores.map((row) => `
      <article class="closer-card">
        <div class="closer-top">
          <div><span class="rank-badge">#${row.rank}</span><h3>${escapeHtml(row.name)}</h3></div>
          <span class="score-pill ${scoreTone(row.score)}">${formatScore(row.score)}</span>
        </div>
        <div class="closer-counts">
          <span class="chip check">${row.checkCount} checks</span>
          <span class="chip strike">${row.strikeCount} strikes</span>
          <span class="chip pending">${row.pending} pendientes</span>
        </div>
        <div class="reason-block"><h4>Checks</h4>${buildReasonList(row.checks, 'Sin checks')}</div>
        <div class="reason-block"><h4>Strikes</h4>${buildReasonList(row.strikes, 'Sin strikes')}</div>
        <div class="result-box ${escapeHtml(row.reward.tone)}">${escapeHtml(row.reward.text === '-' ? 'Sin premio asignado' : row.reward.text)}</div>
      </article>
    `).join('');
  }

  function buildRankingTable(model) {
    return `<div class="table-wrap"><table><thead><tr><th>Puesto</th><th>Closer</th><th class="right">Checks</th><th class="right">Strikes</th><th class="right">Pendientes</th><th class="right">Puntaje</th><th>Premio / consecuencia</th></tr></thead><tbody>
      ${model.scores.map((row) => `<tr>
        <td><span class="rank-badge">#${row.rank}</span></td><td><strong>${escapeHtml(row.name)}</strong></td>
        <td class="right positive-text">${row.checkCount}</td><td class="right negative-text">${row.strikeCount}</td><td class="right">${row.pending}</td>
        <td class="right"><strong>${formatScore(row.score)}</strong></td><td><span class="result-tag ${escapeHtml(row.reward.tone)}">${escapeHtml(row.reward.text === '-' ? 'Sin premio asignado' : row.reward.text)}</span></td>
      </tr>`).join('')}
    </tbody></table></div>`;
  }

  function buildKpiTable(model) {
    return `<div class="table-wrap"><table><thead><tr><th>Closer</th><th>KPIs logrados</th><th class="right">Cantidad</th></tr></thead><tbody>
      ${model.kpis.map((row) => `<tr><td><strong>${escapeHtml(row.name)}</strong></td><td>${row.achieved.length ? row.achieved.map((name) => `<span class="chip check">${escapeHtml(name)}</span>`).join(' ') : '<span class="muted">Ninguno</span>'}</td><td class="right"><strong>${row.achieved.length}</strong></td></tr>`).join('')}
    </tbody></table></div>`;
  }

  function buildWeeksTable(model) {
    return `<div class="table-wrap"><table><thead><tr><th>Semana</th><th>Fechas</th><th class="right">Cash equipo</th><th>Estado</th><th class="right">Bonus pagable</th></tr></thead><tbody>
      ${model.cash.weeks.map((week) => `<tr><td><strong>S${week.index + 1}</strong></td><td>${escapeHtml(week.label)}</td><td class="right">${formatCurrency(week.total)}</td><td><span class="chip ${escapeHtml(week.tone)}">${escapeHtml(week.status)}</span></td><td class="right bonus-text">${formatCurrency(week.payablePool)}</td></tr>`).join('')}
    </tbody></table></div>`;
  }

  function buildCashRanking(model) {
    const max = Math.max(...model.cash.closers.map((row) => row.total), 1);
    return `<div class="bar-list">${model.cash.closers.map((row) => `
      <div class="bar-row"><div class="bar-head"><strong>${escapeHtml(row.name)}</strong><span>${formatCurrency(row.total)}</span></div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(0, (row.total / max) * 100)}%"></div></div></div>
    `).join('')}</div>`;
  }

  function buildBonusTable(model) {
    const roundedSum = model.cash.distributions.reduce((sum, row) => sum + Number(row.bonus.toFixed(2)), 0);
    const roundingDiff = Math.abs(Number(model.bonusTotal.toFixed(2)) - Number(roundedSum.toFixed(2)));
    return `
      <div class="bonus-callouts">
        <div class="callout"><span>Bonus semanal</span><strong>${formatCurrency(model.cash.weeklyBonusTotal)}</strong></div>
        <div class="callout"><span>Bonus mensual 40%</span><strong>${formatCurrency(model.cash.monthlyBonusTotal)}</strong></div>
        <div class="callout gold"><span>Total oficial</span><strong>${formatCurrency(model.bonusTotal)}</strong></div>
      </div>
      <div class="table-wrap"><table><thead><tr><th>Closer</th><th class="right">Cash oficial</th><th class="right">Participación</th><th class="right">Bonus semanal</th><th class="right">Bonus mensual</th><th class="right">Total</th></tr></thead><tbody>
        ${model.cash.distributions.map((row) => `<tr><td><strong>${escapeHtml(row.name)}</strong></td><td class="right">${formatCurrency(row.cash)}</td><td class="right">${formatPercent(row.sharePct)}</td><td class="right">${formatCurrency(row.weeklyBonus)}</td><td class="right">${formatCurrency(row.monthlyBonus)}</td><td class="right bonus-text"><strong>${formatCurrency(row.bonus)}</strong></td></tr>`).join('')}
      </tbody></table></div>
      <p class="footnote">La distribución semanal se hace por aporte real al cash de cada semana. El mínimo individual del 10% no excluye a una persona del bonus.${roundingDiff >= 0.009 ? ` La diferencia de ${formatCurrency(roundingDiff)} surge del redondeo individual; se respeta el total oficial del sistema.` : ''}</p>
    `;
  }

  function buildKpiComplement(model) {
    return `<div class="table-wrap"><table><thead><tr><th>Closer</th><th class="right">Cash Collected KPI</th><th class="right">Facturación KPI</th><th class="right">CC / Fact.</th><th class="right">Ponderación</th></tr></thead><tbody>
      ${model.kpis.map((row) => `<tr><td><strong>${escapeHtml(row.name)}</strong></td><td class="right">${formatCurrency(row.cashCollected)}</td><td class="right">${formatCurrency(row.facturacion)}</td><td class="right">${formatPercent(row.cashCollectedPct)}</td><td class="right"><strong>${formatPercent(row.ponderacionPct)}</strong></td></tr>`).join('')}
    </tbody></table></div><p class="footnote">Estos valores son complementarios y provienen de la tabla de KPIs. El total oficial del mes es el ranking de cash neto conciliado por fecha de acreditación.</p>`;
  }

  function buildRewardsTable(model) {
    return `<div class="table-wrap"><table><thead><tr><th class="right">Puntaje</th><th>Premio / consecuencia</th></tr></thead><tbody>
      ${model.rewards.map((rule) => `<tr><td class="right"><strong>${formatScore(rule.score)}</strong></td><td><span class="result-tag ${escapeHtml(rule.tone)}">${escapeHtml(rule.text)}</span></td></tr>`).join('')}
    </tbody></table></div>`;
  }

  function renderEmpty(model) {
    return `<section class="empty-state"><h2>Sin datos para ${escapeHtml(model.monthLabel)}</h2><p>No hay cash conciliado, movimientos de checks/strikes/pendientes ni filas KPI para este período. El reporte no completa valores estimados.</p></section>`;
  }

  function renderReport(model) {
    const executive = model.executive;
    const bonusWeekCount = executive.bonusWeeks.length;
    root.innerHTML = `
      <section class="hero">
        <div class="hero-top">
          <div><div class="eyebrow">Reporte mensual ${escapeHtml(model.status)}</div><h1>Reporte Mensual Final — ${escapeHtml(model.monthLabel)}</h1><p>Checkpoints, strikes, pendientes, KPIs, cash oficial y bonus del equipo de closers.</p></div>
          <div class="report-controls" data-download-ignore>
            <label>Mes del reporte<input id="reportMonth" type="month" value="${escapeHtml(model.monthKey)}"></label>
            <div class="action-row"><button id="reloadReport" class="btn" type="button">Actualizar</button><button id="downloadReport" class="btn primary" type="button">Descargar HTML</button><button class="btn" type="button" onclick="window.print()">Imprimir</button></div>
          </div>
        </div>
        <div class="summary-grid">
          <article class="stat"><span>Cash oficial del mes</span><strong>${formatCurrency(model.cash.teamTotal)}</strong></article>
          <article class="stat"><span>Bonus total pagable</span><strong>${formatCurrency(model.bonusTotal)}</strong></article>
          <article class="stat"><span>Mejor semana</span><strong>${executive.bestWeek ? `S${executive.bestWeek.index + 1}` : '—'}</strong></article>
          <article class="stat"><span>Semana menor</span><strong>${executive.worstWeek ? `S${executive.worstWeek.index + 1}` : '—'}</strong></article>
          <article class="stat"><span>Semanas con bonus</span><strong>${bonusWeekCount}</strong></article>
        </div>
      </section>

      ${model.hasData ? `
        <section class="section two-col"><article class="panel"><div class="section-head"><div><h2>Resumen ejecutivo</h2><p>Lectura automática basada únicamente en datos del sistema.</p></div></div><ul class="exec-list">${executive.bullets.map((item) => `<li><span class="dot"></span><span>${escapeHtml(item)}</span></li>`).join('')}</ul></article><article class="panel"><div class="section-head"><div><h2>Reglas de puntaje</h2><p>Incluye la asignación automática por pendientes.</p></div></div><div class="chips"><span class="chip check">Check = +1</span><span class="chip strike">Strike = -1</span><span class="chip pending">Pendientes ordenan premios y strikes</span><span class="chip bonus">Bonus económico</span></div><p class="footnote">Puntaje final = checks manuales + checks por pendientes − strikes manuales − strikes por pendientes.</p></article></section>

        <section class="section"><div class="section-head"><div><h2>Checkpoints, strikes y motivos</h2><p>Detalle individual, incluyendo los movimientos automáticos derivados del ranking de pendientes.</p></div></div><div class="closers-grid">${buildScoreCards(model)}</div></section>
        <section class="section"><div class="section-head"><div><h2>Ranking final de puntos</h2><p>Checks, strikes, pendientes acumulados y consecuencia correspondiente.</p></div></div>${buildRankingTable(model)}</section>
        <section class="section"><div class="section-head"><div><h2>KPIs logrados por closer</h2><p>Solo se cuentan los indicadores que están cumplidos según los objetivos del mes.</p></div></div>${buildKpiTable(model)}</section>
        <section class="section"><div class="section-head"><div><h2>Resultados semanales</h2><p>Cash neto conciliado, estado y bonus oficial por semana.</p></div></div>${buildWeeksTable(model)}</section>
        <section class="section two-col"><article class="panel"><div class="section-head"><div><h2>Total mensual por closer</h2><p>Cash oficial usado por el Sistema de Agendas.</p></div></div>${buildCashRanking(model)}</article><article class="panel"><div class="section-head"><div><h2>Bonus generado y distribución</h2><p>Semanal más premio mensual por concentración de cash.</p></div></div>${buildBonusTable(model)}</article></section>
        <section class="section"><div class="section-head"><div><h2>Cash collected y facturación de KPIs</h2><p>Dato complementario; no reemplaza el cash oficial del ranking mensual.</p></div></div>${buildKpiComplement(model)}</section>
        <section class="section"><div class="section-head"><div><h2>Tabla de premios y consecuencias</h2><p>Referencia completa aplicada al puntaje final.</p></div></div>${buildRewardsTable(model)}</section>
        <section class="section two-col"><article class="panel"><div class="section-head"><div><h2>Conclusiones</h2><p>Principales resultados observados.</p></div></div><ul class="exec-list">${executive.bullets.map((item) => `<li><span class="dot gold"></span><span>${escapeHtml(item)}</span></li>`).join('')}</ul></article><article class="panel"><div class="section-head"><div><h2>Recomendaciones</h2><p>Próximas acciones derivadas de los datos.</p></div></div><ul class="exec-list">${model.recommendations.map((item) => `<li><span class="dot"></span><span>${escapeHtml(item)}</span></li>`).join('')}</ul></article></section>
      ` : renderEmpty(model)}
    `;

    document.getElementById('reportMonth')?.addEventListener('change', (event) => loadMonth(event.target.value));
    document.getElementById('reloadReport')?.addEventListener('click', () => loadMonth(model.monthKey));
    document.getElementById('downloadReport')?.addEventListener('click', downloadCurrentReport);
  }

  function downloadCurrentReport() {
    if (!currentModel) return;
    const content = root.cloneNode(true);
    content.querySelectorAll('[data-download-ignore]').forEach((node) => node.remove());
    content.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
    const styles = document.getElementById('monthlyReportStyles')?.textContent || '';
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reporte Mensual Final — ${escapeHtml(currentModel.monthLabel)}</title><style>${styles}</style></head><body><main class="page">${content.innerHTML}</main></body></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reporte_${report.MONTHS[currentModel.month].toLowerCase()}_${currentModel.year}_final.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function loadMonth(value) {
    const selected = value || currentMonthValue();
    const { year, month } = parseMonth(selected);
    if (!year || month < 1 || month > 12) return;
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('month', selected);
    window.history.replaceState({}, '', nextUrl);
    status.textContent = `Cargando ${report.MONTHS[month]} ${year}…`;
    root.setAttribute('aria-busy', 'true');
    try {
      currentModel = await fetchReportData(year, month);
      renderReport(currentModel);
      status.textContent = `Reporte ${currentModel.status.toLowerCase()} actualizado con datos reales.`;
    } catch (error) {
      console.error(error);
      status.textContent = error?.message || 'No se pudo cargar el reporte mensual.';
      root.innerHTML = '<section class="empty-state"><h2>No se pudo cargar el reporte</h2><p>Reintentá en unos segundos. No se mostraron datos parciales para evitar inconsistencias.</p></section>';
    } finally {
      root.removeAttribute('aria-busy');
    }
  }

  if (new URLSearchParams(window.location.search).get('embed') === '1') document.body.classList.add('embedded');
  loadMonth(new URLSearchParams(window.location.search).get('month') || currentMonthValue());
})();
