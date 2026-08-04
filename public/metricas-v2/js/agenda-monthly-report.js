(function initAgendaMonthlyReport(root, factory) {
  const report = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = report;
  if (root) root.agendaMonthlyReport = report;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildAgendaMonthlyReport() {
  const TEAM = [
    'Carlos Tu',
    'Patricia Conti',
    'Claudio Nicolini',
    'Pablo Butera',
    'Walter Alegre',
    'Mauro Gaitan'
  ];

  const MONTHS = [
    '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const DEFAULT_KPI_RULES = Object.freeze({
    cierreLlamadaPct: 45,
    asistenciaLlamadaPct: 45,
    tasaAsistenciaPct: 45,
    tasaCierrePct: 45,
    cashCollectedMin: 100,
    cashCollected3mMin: 100,
    cierreLlamadaWeight: 20,
    asistenciaLlamadaWeight: 15,
    tasaAsistenciaWeight: 15,
    tasaCierreWeight: 20,
    cashCollectedWeight: 15,
    cashCollected3mWeight: 15,
    facturacionMin: 1
  });

  const REWARD_RULES = Object.freeze([
    { score: 10, text: '10% comisión en todas las ventas + Día de Spa', tone: 'reward' },
    { score: 9, text: '1% más comisión en todas las ventas', tone: 'reward' },
    { score: 8, text: '7 + 1% más comisión de ventas de escala 5 a 9 ventas. Pasa a 10%', tone: 'reward' },
    { score: 7, text: '1% más comisión de ventas de escala 1 a 4 ventas. Pasa a 9%', tone: 'reward' },
    { score: 6, text: '80 USD', tone: 'reward' },
    { score: 5, text: '$80.000', tone: 'reward' },
    { score: 4, text: '$45.000', tone: 'reward' },
    { score: 3, text: '$30.000', tone: 'reward' },
    { score: 2, text: '-', tone: 'neutral' },
    { score: 1, text: '-', tone: 'neutral' },
    { score: 0, text: '-', tone: 'neutral' },
    { score: -1, text: 'No cobra premios por cumplimientos de KPIs', tone: 'consequence' },
    { score: -2, text: 'No cobra premios por cumplimientos de KPIs ni premios por alcance de objetivos semanales y mensuales', tone: 'consequence' },
    { score: -3, text: '-1, -2 y 1% menos del porcentaje comisionable. Si comisionaba 8%, comisiona 7%', tone: 'severe' },
    { score: -4, text: '-1, -2 y 2% menos del porcentaje comisionable. Si comisionaba 8%, comisiona 6%', tone: 'severe' },
    { score: -5, text: '-1, -2, 2% menos del porcentaje comisionable y tomar solo agendas calidad D', tone: 'severe' }
  ]);

  const KPI_DEFINITIONS = Object.freeze([
    { key: 'cierreLlamadaOk', label: 'Cierre seg. llamada' },
    { key: 'asistenciaLlamadaOk', label: 'Asistencia seg. llamada' },
    { key: 'tasaAsistenciaOk', label: 'Tasa asistencia' },
    { key: 'tasaCierreOk', label: 'Tasa cierre' },
    { key: 'cashCollectedOk', label: 'Cash collected' },
    { key: 'cashCollected3mOk', label: 'CC 3m %' }
  ]);

  const ALIASES = Object.freeze({
    'carlos tu': 'Carlos Tu',
    'patricia conti': 'Patricia Conti',
    'claudio nicolini': 'Claudio Nicolini',
    'pablo butera': 'Pablo Butera',
    'pablo butera vie': 'Pablo Butera',
    'walter alegre': 'Walter Alegre',
    'mauro gaitan': 'Mauro Gaitan'
  });

  function normalizeText(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  function canonicalCloserName(value) {
    const text = String(value || '').trim();
    return ALIASES[normalizeText(text)] || text;
  }

  function toDateKey(value) {
    if (value instanceof Date) {
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const day = String(value.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    const match = String(value || '').trim().match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : '';
  }

  function monthKey(year, month) {
    return `${Number(year)}-${String(Number(month)).padStart(2, '0')}`;
  }

  function monthLabel(year, month) {
    return `${MONTHS[Number(month)] || month} ${Number(year)}`;
  }

  function roundMoney(value) {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }

  function safeDiv(numerator, denominator) {
    return Number(denominator || 0) > 0 ? Number(numerator || 0) / Number(denominator) : 0;
  }

  function calcWeeks(year, month) {
    const first = new Date(Number(year), Number(month) - 1, 1);
    const last = new Date(Number(year), Number(month), 0);
    const weeks = [];
    let current = new Date(first);

    while (current <= last) {
      const dayOfWeek = current.getDay();
      const toMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(current);
      monday.setDate(current.getDate() + toMonday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const start = monday < first ? new Date(first) : monday;
      const end = sunday > last ? new Date(last) : sunday;
      weeks.push({
        index: weeks.length,
        startKey: toDateKey(start),
        endKey: toDateKey(end),
        days: Math.round((end - start) / 86400000) + 1,
        label: `${start.getDate()}${start.getMonth() === end.getMonth() ? '' : ` ${MONTHS[start.getMonth() + 1].slice(0, 3)}`}–${end.getDate()} ${MONTHS[end.getMonth() + 1].slice(0, 3)}`
      });
      current = new Date(sunday);
      current.setDate(sunday.getDate() + 1);
    }

    return weeks;
  }

  function isWeekClosed(week, year, month, now = new Date()) {
    const selected = monthKey(year, month);
    const current = monthKey(now.getFullYear(), now.getMonth() + 1);
    if (selected < current) return true;
    if (selected > current) return false;
    return toDateKey(now) > week.endKey;
  }

  function parseKpiRules(raw = {}) {
    const source = raw.rules || raw;
    const mapped = {
      cierreLlamadaPct: source.cierre_llamada_pct ?? source.cierreLlamadaPct,
      asistenciaLlamadaPct: source.asistencia_llamada_pct ?? source.asistenciaLlamadaPct,
      tasaAsistenciaPct: source.tasa_asistencia_pct ?? source.tasaAsistenciaPct,
      tasaCierrePct: source.tasa_cierre_pct ?? source.tasaCierrePct,
      cashCollectedMin: source.cash_collected_min ?? source.cashCollectedMin,
      cashCollected3mMin: source.cash_collected_3m_min ?? source.cashCollected3mMin,
      cierreLlamadaWeight: source.cierre_llamada_weight ?? source.cierreLlamadaWeight,
      asistenciaLlamadaWeight: source.asistencia_llamada_weight ?? source.asistenciaLlamadaWeight,
      tasaAsistenciaWeight: source.tasa_asistencia_weight ?? source.tasaAsistenciaWeight,
      tasaCierreWeight: source.tasa_cierre_weight ?? source.tasaCierreWeight,
      cashCollectedWeight: source.cash_collected_weight ?? source.cashCollectedWeight,
      cashCollected3mWeight: source.cash_collected_3m_weight ?? source.cashCollected3mWeight,
      facturacionMin: source.facturacion_min ?? source.facturacionMin
    };
    const rules = { ...DEFAULT_KPI_RULES };
    Object.keys(rules).forEach((key) => {
      const number = Number(mapped[key]);
      if (Number.isFinite(number)) rules[key] = number;
    });
    if (rules.cashCollectedMin > 100 && rules.facturacionMin > 0) {
      rules.cashCollectedMin = (rules.cashCollectedMin / rules.facturacionMin) * 100;
    }
    return rules;
  }

  function normalizeKpiRows(rows = []) {
    const grouped = new Map();
    rows.forEach((row) => {
      const closer = canonicalCloserName(row.closer);
      const key = normalizeText(closer);
      if (!TEAM.some((name) => normalizeText(name) === key)) return;
      const current = grouped.get(key) || {
        closer,
        efectuadas: 0,
        aplica: 0,
        ventasLlamada: 0,
        efectuadasAgenda: 0,
        aplicaAgenda: 0,
        ventasAgenda: 0,
        cashCollected: 0,
        cashCollected3m: 0,
        facturacion: 0,
        facturacion3m: 0
      };
      current.efectuadas += Number(row.efectuadas || 0);
      current.aplica += Number(row.aplica || 0);
      current.ventasLlamada += Number(row.ventas_llamada || 0);
      current.efectuadasAgenda += Number(row.efectuadas_agenda || 0);
      current.aplicaAgenda += Number(row.aplica_agenda || 0);
      current.ventasAgenda += Number(row.tasa_cierre || 0) * Number(row.efectuadas_agenda || 0);
      current.cashCollected += Number(row.cash_collected || 0);
      current.cashCollected3m += Number(row.cash_collected_3m || 0);
      current.facturacion += Number(row.facturacion || 0);
      current.facturacion3m += Number(row.facturacion_3m || 0);
      grouped.set(key, current);
    });
    return grouped;
  }

  function computeKpiResult(row = {}, rules = DEFAULT_KPI_RULES) {
    const metrics = {
      cierreLlamadaPct: safeDiv(row.ventasLlamada, row.efectuadas) * 100,
      asistenciaLlamadaPct: safeDiv(row.efectuadas, row.aplica) * 100,
      tasaAsistenciaPct: safeDiv(row.efectuadasAgenda, row.aplicaAgenda) * 100,
      tasaCierrePct: safeDiv(row.ventasAgenda, row.efectuadasAgenda) * 100,
      cashCollected: Number(row.cashCollected || 0),
      facturacion: Number(row.facturacion || 0),
      cashCollected3m: Number(row.cashCollected3m || 0),
      facturacion3m: Number(row.facturacion3m || 0)
    };
    metrics.cashCollectedPct = safeDiv(metrics.cashCollected, metrics.facturacion) * 100;
    metrics.cashCollected3mPct = safeDiv(metrics.cashCollected3m, metrics.facturacion3m) * 100;
    metrics.cierreLlamadaOk = metrics.cierreLlamadaPct >= rules.cierreLlamadaPct;
    metrics.asistenciaLlamadaOk = metrics.asistenciaLlamadaPct >= rules.asistenciaLlamadaPct;
    metrics.tasaAsistenciaOk = metrics.tasaAsistenciaPct >= rules.tasaAsistenciaPct;
    metrics.tasaCierreOk = metrics.tasaCierrePct >= rules.tasaCierrePct;
    metrics.cashCollectedOk = metrics.cashCollectedPct >= rules.cashCollectedMin;
    metrics.cashCollected3mOk = metrics.cashCollected3mPct >= rules.cashCollected3mMin;
    metrics.ponderacionPct =
      (metrics.cierreLlamadaOk ? rules.cierreLlamadaWeight : 0)
      + (metrics.asistenciaLlamadaOk ? rules.asistenciaLlamadaWeight : 0)
      + (metrics.tasaAsistenciaOk ? rules.tasaAsistenciaWeight : 0)
      + (metrics.tasaCierreOk ? rules.tasaCierreWeight : 0)
      + (metrics.cashCollectedOk ? rules.cashCollectedWeight : 0)
      + (metrics.cashCollected3mOk ? rules.cashCollected3mWeight : 0);
    metrics.achieved = KPI_DEFINITIONS.filter((definition) => metrics[definition.key]).map((definition) => definition.label);
    return metrics;
  }

  function buildKpiRows(rows = [], rawRules = {}) {
    const grouped = normalizeKpiRows(rows);
    const rules = parseKpiRules(rawRules);
    return TEAM.map((name) => {
      const row = grouped.get(normalizeText(name)) || { closer: name };
      return { name, ...computeKpiResult(row, rules) };
    });
  }

  function pendingAwards(summaryRows = []) {
    const result = new Map(summaryRows.map((row) => [normalizeText(row.name), { checks: [], strikes: [] }]));
    const distinct = [...new Set(summaryRows.map((row) => Number(row.pending || 0)))].sort((a, b) => a - b);
    if (distinct.length < 2) return result;
    const minimum = distinct[0];
    const secondMinimum = distinct[1];
    const maximum = distinct[distinct.length - 1];
    const secondMaximum = distinct[distinct.length - 2];

    summaryRows.forEach((row) => {
      const award = result.get(normalizeText(row.name));
      if (row.pending === minimum) award.checks.push({ quantity: 1, detail: `Menor cantidad de pendientes (${row.pending}).`, automatic: true });
      else if (row.pending === secondMinimum) award.checks.push({ quantity: 1, detail: `Segundo lugar con menos pendientes (${row.pending}).`, automatic: true });

      if (row.pending === maximum) award.strikes.push({ quantity: 2, detail: `Mayor cantidad de pendientes (${row.pending}).`, automatic: true });
      else if (row.pending === secondMaximum) award.strikes.push({ quantity: 1, detail: `Segundo lugar con más pendientes (${row.pending}).`, automatic: true });
    });
    return result;
  }

  function getReward(score) {
    const clamped = Math.max(-5, Math.min(10, Math.trunc(Number(score || 0))));
    return REWARD_RULES.find((rule) => rule.score === clamped) || REWARD_RULES.find((rule) => rule.score === 0);
  }

  function buildScoreRows(entries = []) {
    const map = new Map(TEAM.map((name) => [normalizeText(name), {
      name,
      pending: 0,
      manualChecks: [],
      manualStrikes: [],
      pendingMovements: []
    }]));

    entries.forEach((entry) => {
      const name = canonicalCloserName(entry.closer_nombre);
      const row = map.get(normalizeText(name));
      if (!row) return;
      const quantity = Math.max(1, Math.min(50, Math.round(Number(entry.cantidad || 1) || 1)));
      const detail = String(entry.detalle || '').trim() || 'Sin detalle';
      if (entry.tipo === 'check') row.manualChecks.push({ quantity, detail, automatic: false });
      if (entry.tipo === 'strike') row.manualStrikes.push({ quantity, detail, automatic: false });
      if (entry.tipo === 'pendiente') {
        const delta = entry.operacion === 'restar' ? -quantity : quantity;
        row.pending += delta;
        row.pendingMovements.push({ quantity: delta, detail, automatic: false });
      }
    });

    const baseRows = [...map.values()].map((row) => ({ ...row, pending: Math.max(0, row.pending) }));
    const automatic = pendingAwards(baseRows);
    const rows = baseRows.map((row) => {
      const awards = automatic.get(normalizeText(row.name)) || { checks: [], strikes: [] };
      const checks = [...row.manualChecks, ...awards.checks];
      const strikes = [...row.manualStrikes, ...awards.strikes];
      const checkCount = checks.reduce((sum, item) => sum + item.quantity, 0);
      const strikeCount = strikes.reduce((sum, item) => sum + item.quantity, 0);
      const score = checkCount - strikeCount;
      return { ...row, checks, strikes, checkCount, strikeCount, score, reward: getReward(score) };
    });

    const sorted = rows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'es'));
    let previousScore = null;
    let currentRank = 0;
    return sorted.map((row, index) => {
      if (previousScore === null || row.score !== previousScore) {
        currentRank = index + 1;
        previousScore = row.score;
      }
      return { ...row, rank: currentRank };
    });
  }

  function cashAmount(row = {}) {
    const amount = Number(row.cash_collected_neto ?? row.cash_collected ?? 0);
    return Number.isFinite(amount) && amount > 0 ? amount : 0;
  }

  function eligibleCashRows(rows = [], year, month) {
    const prefix = `${monthKey(year, month)}-`;
    return rows.filter((row) => {
      if (!toDateKey(row.f_acreditacion).startsWith(prefix)) return false;
      if (normalizeText(row.estado) !== 'conciliado') return false;
      if (normalizeText(row.producto_format).includes('club')) return false;
      if (!TEAM.some((name) => normalizeText(name) === normalizeText(canonicalCloserName(row.responsable_venta || row.creado_por)))) return false;
      return cashAmount(row) > 0;
    });
  }

  function normalizeBonusRules(raw = {}, year, month) {
    const source = raw.rules || raw;
    const may2026 = Number(year) === 2026 && Number(month) === 5;
    return {
      floorWeekly: Number(source.monto_base_mensual ?? (may2026 ? 12500 : 16500)),
      targetWeekly: Number(source.objetivo_mensual ?? (may2026 ? 16500 : 20000)),
      stepWeekly: 5000
    };
  }

  function buildCashAndBonus(rows = [], rawBonusRules = {}, year, month, now = new Date()) {
    const weeks = calcWeeks(year, month);
    const validRows = eligibleCashRows(rows, year, month);
    const byCloser = new Map(TEAM.map((name) => [normalizeText(name), { name, total: 0, weeks: weeks.map(() => 0) }]));
    validRows.forEach((row) => {
      const closer = byCloser.get(normalizeText(canonicalCloserName(row.responsable_venta || row.creado_por)));
      const dateKey = toDateKey(row.f_acreditacion);
      const weekIndex = weeks.findIndex((week) => dateKey >= week.startKey && dateKey <= week.endKey);
      if (!closer || weekIndex < 0) return;
      const amount = cashAmount(row);
      closer.total += amount;
      closer.weeks[weekIndex] += amount;
    });

    const rules = normalizeBonusRules(rawBonusRules, year, month);
    const baseWeeks = weeks.map((week, index) => {
      const total = [...byCloser.values()].reduce((sum, closer) => sum + closer.weeks[index], 0);
      const ratio = week.days / 7;
      const floor = roundMoney(rules.floorWeekly * ratio);
      const target = roundMoney(rules.targetWeekly * ratio);
      const step = roundMoney(rules.stepWeekly * ratio);
      const pct = total >= target && step > 0 ? 0.01 + Math.floor((total - target) / step) * 0.005 : 0;
      const closed = isWeekClosed(week, year, month, now);
      return {
        ...week,
        total,
        floor,
        target,
        pct,
        generatedPool: total * pct,
        closed,
        baseMiss: closed && total < floor
      };
    });

    const weekRows = baseWeeks.map((week) => {
      const revoked = week.pct > 0 && baseWeeks.some((candidate) => candidate.index > week.index && candidate.baseMiss);
      const payablePool = week.pct > 0 && !revoked ? week.generatedPool : 0;
      let status = 'Pendiente';
      let tone = 'neutral';
      if (week.baseMiss) { status = 'Bajo base'; tone = 'strike'; }
      else if (week.pct > 0 && revoked) { status = 'Bonus revocado'; tone = 'strike'; }
      else if (week.pct > 0) { status = 'Bonus válido'; tone = 'bonus'; }
      else if (week.total >= week.floor) { status = 'Base alcanzada'; tone = 'neutral'; }
      else if (!week.closed) { status = 'En curso'; tone = 'neutral'; }
      return { ...week, revoked, payablePool, status, tone };
    });

    const distributions = new Map(TEAM.map((name) => [normalizeText(name), {
      name,
      weeklyBonus: 0,
      monthlyBonus: 0,
      bonus: 0
    }]));
    weekRows.forEach((week) => {
      if (week.payablePool <= 0 || week.total <= 0) return;
      byCloser.forEach((closer, key) => {
        const contribution = closer.weeks[week.index] || 0;
        if (contribution <= 0) return;
        distributions.get(key).weeklyBonus += (contribution / week.total) * week.payablePool;
      });
    });

    const teamTotal = [...byCloser.values()].reduce((sum, closer) => sum + closer.total, 0);
    byCloser.forEach((closer, key) => {
      const sharePct = safeDiv(closer.total, teamTotal) * 100;
      const monthlyBonus = teamTotal > 0 && sharePct >= 40 ? 40 : 0;
      const distribution = distributions.get(key);
      distribution.monthlyBonus = monthlyBonus;
      distribution.bonus = distribution.weeklyBonus + distribution.monthlyBonus;
      distribution.cash = closer.total;
      distribution.sharePct = sharePct;
    });

    return {
      weeks: weekRows,
      closers: [...byCloser.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'es')),
      distributions: [...distributions.values()].sort((a, b) => b.bonus - a.bonus || a.name.localeCompare(b.name, 'es')),
      teamTotal,
      weeklyBonusTotal: weekRows.reduce((sum, week) => sum + week.payablePool, 0),
      monthlyBonusTotal: [...distributions.values()].reduce((sum, row) => sum + row.monthlyBonus, 0),
      rules
    };
  }

  function buildExecutive(model) {
    const weeksWithCash = model.cash.weeks.filter((week) => week.total > 0);
    const bestWeek = [...weeksWithCash].sort((a, b) => b.total - a.total)[0] || null;
    const worstWeek = [...weeksWithCash].sort((a, b) => a.total - b.total)[0] || null;
    const topCloser = model.cash.closers[0] || null;
    const topKpi = [...model.kpis].sort((a, b) => b.achieved.length - a.achieved.length || a.name.localeCompare(b.name, 'es'))[0] || null;
    const topScore = model.scores[0] || null;
    const bonusWeeks = model.cash.weeks.filter((week) => week.payablePool > 0);
    const currency = (value) => `US$ ${Number(value || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const bullets = [];
    if (topCloser && model.cash.teamTotal > 0) bullets.push(`${topCloser.name} lideró el cash oficial del mes con ${currency(topCloser.total)}.`);
    if (bestWeek) bullets.push(`La mejor semana fue la S${bestWeek.index + 1} (${bestWeek.label}) con ${currency(bestWeek.total)}.`);
    if (worstWeek) bullets.push(`La semana con menor cash fue la S${worstWeek.index + 1} (${worstWeek.label}) con ${currency(worstWeek.total)}.`);
    bullets.push(bonusWeeks.length ? `${bonusWeeks.length} semana${bonusWeeks.length === 1 ? '' : 's'} generaron bonus pagable por ${currency(model.bonusTotal)} en total.` : 'El mes no registra bonus pagable con las reglas actuales.');
    if (topKpi) bullets.push(`${topKpi.name} encabezó los KPIs con ${topKpi.achieved.length} objetivo${topKpi.achieved.length === 1 ? '' : 's'} logrado${topKpi.achieved.length === 1 ? '' : 's'}.`);
    if (topScore) bullets.push(`${topScore.name} quedó primero en el ranking de puntos con ${topScore.score > 0 ? '+' : ''}${topScore.score}.`);
    return { bullets, bestWeek, worstWeek, topCloser, topKpi, topScore, bonusWeeks };
  }

  function buildRecommendations(model) {
    const recommendations = [];
    const baseMisses = model.cash.weeks.filter((week) => week.baseMiss);
    if (baseMisses.length) recommendations.push(`Trabajar la consistencia semanal: ${baseMisses.length} semana${baseMisses.length === 1 ? '' : 's'} cerraron debajo de la base.`);
    if (!model.cash.weeks.some((week) => week.payablePool > 0)) recommendations.push('Definir un plan semanal de avance para alcanzar el primer escalón de bonus antes del cierre del mes.');
    const maxPending = Math.max(...model.scores.map((row) => row.pending), 0);
    if (maxPending > 0) {
      const names = model.scores.filter((row) => row.pending === maxPending).map((row) => row.name).join(' y ');
      recommendations.push(`Priorizar la resolución de pendientes de ${names}: actualmente registra${names.includes(' y ') ? 'n' : ''} ${maxPending}.`);
    }
    const minKpis = Math.min(...model.kpis.map((row) => row.achieved.length));
    const lowerKpiNames = model.kpis.filter((row) => row.achieved.length === minKpis).map((row) => row.name);
    if (lowerKpiNames.length) recommendations.push(`Revisar los objetivos no cumplidos de ${lowerKpiNames.join(', ')} y acordar una acción concreta para el próximo mes.`);
    if (!recommendations.length) recommendations.push('Sostener el ritmo actual y revisar semanalmente cash, pendientes y KPIs para prevenir desvíos.');
    return recommendations;
  }

  function buildReportModel(input = {}) {
    const year = Number(input.year);
    const month = Number(input.month);
    const scores = buildScoreRows(input.checkpointEntries || []);
    const kpis = buildKpiRows(input.kpiRows || [], input.kpiRules || {});
    const cash = buildCashAndBonus(input.cashRows || [], input.bonusRules || {}, year, month, input.now || new Date());
    const bonusTotal = cash.weeklyBonusTotal + cash.monthlyBonusTotal;
    const isCurrent = monthKey(year, month) === monthKey((input.now || new Date()).getFullYear(), (input.now || new Date()).getMonth() + 1);
    const model = {
      year,
      month,
      monthKey: monthKey(year, month),
      monthLabel: monthLabel(year, month),
      status: isCurrent ? 'Parcial' : 'Final',
      scores,
      kpis,
      cash,
      bonusTotal,
      rewards: REWARD_RULES,
      hasData: cash.teamTotal > 0 || (input.checkpointEntries || []).length > 0 || (input.kpiRows || []).length > 0
    };
    model.executive = buildExecutive(model);
    model.recommendations = buildRecommendations(model);
    return model;
  }

  return Object.freeze({
    TEAM,
    MONTHS,
    DEFAULT_KPI_RULES,
    REWARD_RULES,
    KPI_DEFINITIONS,
    normalizeText,
    canonicalCloserName,
    calcWeeks,
    parseKpiRules,
    computeKpiResult,
    buildKpiRows,
    pendingAwards,
    buildScoreRows,
    eligibleCashRows,
    buildCashAndBonus,
    buildReportModel
  });
});
