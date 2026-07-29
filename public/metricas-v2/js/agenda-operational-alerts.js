(function exposeAgendaOperationalAlerts(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.agendaOperationalAlerts = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createAgendaOperationalAlerts() {
  const CLOSER_ALIASES = {
    'pablo butera vie': 'Pablo Butera',
    'pablo butera': 'Pablo Butera',
    'patricia conti': 'Patricia Conti',
    'carlos tu': 'Carlos Tu',
    'claudio nicolini': 'Claudio Nicolini',
    'mauro gaitan': 'Mauro Gaitan',
    'walter alegre': 'Walter Alegre'
  };

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  function canonicalCloser(value) {
    const raw = String(value || '').trim();
    return CLOSER_ALIASES[normalizeText(raw)] || raw || 'Sin closer';
  }

  function safeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function dateKey(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    }
    const match = String(value || '').match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : '';
  }

  function dateFromKey(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  function monthKey(year, month) {
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  function shiftedMonthKey(year, month, delta) {
    const date = new Date(year, month - 1 + delta, 1);
    return monthKey(date.getFullYear(), date.getMonth() + 1);
  }

  function initials(name) {
    return String(name || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('');
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function percent(value) {
    return `${Math.round(safeNumber(value) * 100)}%`;
  }

  function money(value) {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(safeNumber(value));
  }

  function getEvaluationPeriod(year, month, todayValue) {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    const today = dateFromKey(dateKey(todayValue)) || new Date();
    const evaluationDate = today < monthStart ? monthStart : today > monthEnd ? monthEnd : today;
    const weekStart = new Date(evaluationDate);
    const day = weekStart.getDay();
    weekStart.setDate(weekStart.getDate() + (day === 0 ? -6 : 1 - day));
    if (weekStart < monthStart) weekStart.setTime(monthStart.getTime());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    if (weekEnd > monthEnd) weekEnd.setTime(monthEnd.getTime());

    return {
      monthStart,
      monthEnd,
      evaluationDate,
      weekStart,
      weekEnd,
      monthStartKey: dateKey(monthStart),
      monthEndKey: dateKey(monthEnd),
      evaluationKey: dateKey(evaluationDate),
      weekStartKey: dateKey(weekStart),
      weekEndKey: dateKey(weekEnd)
    };
  }

  function targetToDate(period, weeklyTarget) {
    const target = safeNumber(weeklyTarget);
    if (target <= 0) return 0;
    const start = new Date(period.monthStart);
    let total = 0;

    while (start <= period.evaluationDate) {
      const day = start.getDay();
      const monday = new Date(start);
      monday.setDate(monday.getDate() + (day === 0 ? -6 : 1 - day));
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      const segmentStart = monday < period.monthStart ? period.monthStart : monday;
      const segmentEnd = sunday > period.evaluationDate ? period.evaluationDate : sunday;
      const activeDays = Math.floor((segmentEnd - segmentStart) / 86400000) + 1;
      total += target * (activeDays / 7);
      start.setTime(sunday.getTime());
      start.setDate(start.getDate() + 1);
    }

    return total;
  }

  function emptyCloser(name) {
    return {
      name,
      initials: initials(name),
      agendados: 0,
      aplica: 0,
      noAsistidas: 0,
      pendientes: 0,
      efectuadas: 0,
      ventas: 0,
      weekCash: 0,
      monthCash: 0,
      historyCash: new Map()
    };
  }

  function build(options = {}) {
    const year = Number(options.year);
    const month = Number(options.month);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new Error('Período inválido para las alertas operativas');
    }

    const period = getEvaluationPeriod(year, month, options.today || new Date());
    const selectedMonthKey = monthKey(year, month);
    const historyKeys = [-3, -2, -1].map((offset) => shiftedMonthKey(year, month, offset));
    const closerMap = new Map();
    const ensureCloser = (value) => {
      const name = canonicalCloser(value);
      const key = normalizeText(name);
      if (!closerMap.has(key)) closerMap.set(key, emptyCloser(name));
      return closerMap.get(key);
    };

    (options.closerNames || []).forEach(ensureCloser);

    (options.agendaRows || []).forEach((row) => {
      const closer = ensureCloser(row?.closer);
      closer.agendados += safeNumber(row?.total_agendados);
      closer.aplica += safeNumber(row?.total_aplica);
      closer.noAsistidas += safeNumber(row?.total_no_asistidas);
      closer.pendientes += safeNumber(row?.total_pendientes);
      closer.efectuadas += safeNumber(row?.total_efectuadas);
      closer.ventas += safeNumber(row?.total_ventas);
    });

    (options.cashRows || []).forEach((row) => {
      if (normalizeText(row?.producto_format).includes('club')) return;
      const cash = safeNumber(row?.cash_collected);
      const acreditacion = dateKey(row?.f_acreditacion);
      if (cash <= 0 || !acreditacion) return;
      const closer = ensureCloser(row?.responsable_venta || row?.creado_por || row?.closer);
      const cashMonthKey = acreditacion.slice(0, 7);
      if (cashMonthKey === selectedMonthKey && acreditacion <= period.evaluationKey) {
        closer.monthCash += cash;
        if (acreditacion >= period.weekStartKey && acreditacion <= period.weekEndKey) {
          closer.weekCash += cash;
        }
      }
      if (historyKeys.includes(cashMonthKey)) {
        closer.historyCash.set(cashMonthKey, (closer.historyCash.get(cashMonthKey) || 0) + cash);
      }
    });

    const teamWeekCash = [...closerMap.values()].reduce((sum, closer) => sum + closer.weekCash, 0);
    const teamTargetToDate = targetToDate(period, options.weeklyTarget);
    const individualTargetToDate = teamTargetToDate * 0.10;
    const elapsedDays = Math.floor((period.evaluationDate - period.monthStart) / 86400000) + 1;
    const daysInMonth = period.monthEnd.getDate();

    const closers = [...closerMap.values()].map((closer) => {
      const active = closer.agendados > 0 || closer.efectuadas > 0 || closer.monthCash > 0;
      const noAplica = closer.agendados > 0
        ? Math.max(closer.agendados - closer.aplica, 0) / closer.agendados
        : null;
      const noShow = closer.aplica > 0 ? closer.noAsistidas / closer.aplica : null;
      const closeRate = closer.efectuadas > 0 ? closer.ventas / closer.efectuadas : null;
      const weekShare = teamWeekCash > 0 ? closer.weekCash / teamWeekCash : null;
      const monthTargetRatio = individualTargetToDate > 0 ? closer.monthCash / individualTargetToDate : null;
      const historyValues = historyKeys.map((key) => closer.historyCash.get(key) || 0);
      const historyMonthsWithCash = historyValues.filter((value) => value > 0).length;
      const historyAverage = historyValues.reduce((sum, value) => sum + value, 0) / historyValues.length;
      const projectedMonthCash = elapsedDays > 0 ? closer.monthCash * (daysInMonth / elapsedDays) : 0;
      const trimRatio = historyAverage > 0 ? projectedMonthCash / historyAverage : null;

      return {
        ...closer,
        active,
        noAplica,
        noShow,
        closeRate,
        weekShare,
        monthTargetRatio,
        historyMonthsWithCash,
        historyAverage,
        projectedMonthCash,
        trimRatio
      };
    });

    const definitions = [
      {
        id: 'no-aplica',
        title: '% No Aplica alto en agendas',
        icon: '📵',
        severity: 'high',
        threshold: '> 40%',
        reading: 'La calidad de los leads que recibe o la calificación previa está fallando.',
        check: (closer) => closer.noAplica !== null && closer.noAplica > 0.40,
        value: (closer) => percent(closer.noAplica),
        detail: (closer) => `${Math.max(closer.agendados - closer.aplica, 0)} de ${closer.agendados} agendas`,
        bar: (closer) => clamp(closer.noAplica / 0.80, 0, 1)
      },
      {
        id: 'no-show',
        title: '% No Show alto',
        icon: '🚫',
        severity: 'high',
        threshold: '> 25%',
        reading: 'Problema de seguimiento previo a la llamada o leads poco comprometidos.',
        check: (closer) => closer.noShow !== null && closer.noShow > 0.25,
        value: (closer) => percent(closer.noShow),
        detail: (closer) => `${closer.noAsistidas} de ${closer.aplica} aplicables`,
        bar: (closer) => clamp(closer.noShow / 0.60, 0, 1)
      },
      {
        id: 'tasa-cierre',
        title: 'Tasa de cierre crítica',
        icon: '📉',
        severity: 'high',
        threshold: '< 20%',
        reading: 'Closer tomando agendas efectuadas pero sin convertir. Requiere revisar técnica y calidad de leads.',
        check: (closer) => closer.closeRate !== null && closer.closeRate < 0.20,
        value: (closer) => percent(closer.closeRate),
        detail: (closer) => `${closer.ventas} ventas de ${closer.efectuadas} efectuadas`,
        bar: (closer) => clamp(closer.closeRate / 0.20, 0, 1)
      },
      {
        id: 'cash-semana',
        title: 'Cash semanal bajo',
        icon: '💸',
        severity: 'medium',
        threshold: '< 10% del total del equipo',
        reading: 'Activa riesgo de pérdida de categoría de agenda la semana siguiente.',
        check: (closer) => closer.active && closer.weekShare !== null && closer.weekShare < 0.10,
        value: (closer) => percent(closer.weekShare),
        detail: (closer) => `${money(closer.weekCash)} de ${money(teamWeekCash)}`,
        bar: (closer) => clamp(closer.weekShare / 0.10, 0, 1)
      },
      {
        id: 'pendientes',
        title: 'Pendientes acumulados',
        icon: '⏳',
        severity: 'medium',
        threshold: '> 3 pendientes',
        reading: 'Leads calientes que se están enfriando. Impacto directo en cierre futuro.',
        check: (closer) => closer.pendientes > 3,
        value: (closer) => `${closer.pendientes} pend.`,
        detail: () => 'Pendientes del mes seleccionado',
        bar: (closer) => clamp(closer.pendientes / 10, 0, 1)
      },
      {
        id: 'cash-mes',
        title: 'Cash collected mensual bajo',
        icon: '📅',
        severity: 'medium',
        threshold: '< 70% del objetivo individual acumulado',
        reading: 'Compara el cash del closer contra el 10% del objetivo del equipo, prorrateado hasta la fecha de corte.',
        check: (closer) => closer.active && closer.monthTargetRatio !== null && closer.monthTargetRatio < 0.70,
        value: (closer) => percent(closer.monthTargetRatio),
        detail: (closer) => `${money(closer.monthCash)} de ${money(individualTargetToDate)}`,
        bar: (closer) => clamp(closer.monthTargetRatio / 0.70, 0, 1)
      },
      {
        id: 'cash-trim',
        title: 'Cash collected últimos 3 meses bajo',
        icon: '📊',
        severity: 'medium',
        threshold: '< 70% del promedio trimestral',
        reading: 'Compara la proyección del mes actual contra el promedio de los tres meses completos anteriores.',
        check: (closer) => closer.active
          && closer.historyMonthsWithCash >= 2
          && closer.trimRatio !== null
          && closer.trimRatio < 0.70,
        value: (closer) => percent(closer.trimRatio),
        detail: (closer) => `Proyección ${money(closer.projectedMonthCash)} · promedio ${money(closer.historyAverage)}`,
        bar: (closer) => clamp(closer.trimRatio / 0.70, 0, 1)
      }
    ];

    const alerts = definitions.map((definition) => ({
      id: definition.id,
      title: definition.title,
      icon: definition.icon,
      severity: definition.severity,
      threshold: definition.threshold,
      reading: definition.reading,
      affected: closers
        .filter(definition.check)
        .sort((left, right) => normalizeText(left.name).localeCompare(normalizeText(right.name)))
        .map((closer) => ({
          name: closer.name,
          initials: closer.initials,
          value: definition.value(closer),
          detail: definition.detail(closer),
          barPercent: Math.round(definition.bar(closer) * 100)
        }))
    })).filter((alert) => alert.affected.length > 0);

    return {
      alerts,
      closers,
      summary: {
        high: alerts.filter((alert) => alert.severity === 'high').length,
        medium: alerts.filter((alert) => alert.severity === 'medium').length,
        affectedPeople: new Set(alerts.flatMap((alert) => alert.affected.map((row) => normalizeText(row.name)))).size
      },
      totals: {
        teamWeekCash,
        teamTargetToDate,
        individualTargetToDate
      },
      period: {
        year,
        month,
        monthStart: period.monthStartKey,
        monthEnd: period.monthEndKey,
        evaluationDate: period.evaluationKey,
        weekStart: period.weekStartKey,
        weekEnd: period.weekEndKey,
        historyMonths: historyKeys
      }
    };
  }

  return {
    build,
    canonicalCloser,
    dateKey,
    normalizeText,
    targetToDate
  };
}));
