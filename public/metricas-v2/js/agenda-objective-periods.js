(function exposeAgendaObjectivePeriods(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.agendaObjectivePeriods = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createAgendaObjectivePeriods() {
  const FORTNIGHTLY_CUTOVER = '2026-09';
  const DAY_MS = 86400000;

  function monthKey(year, month) {
    return `${Number(year)}-${String(Number(month)).padStart(2, '0')}`;
  }

  function isFortnightly(year, month) {
    return monthKey(year, month) >= FORTNIGHTLY_CUTOVER;
  }

  function toDateKey(value) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function rangeLabel(start, end, monthNames) {
    const names = monthNames || ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    if (start.getMonth() === end.getMonth()) return `${start.getDate()}–${end.getDate()} ${names[start.getMonth() + 1]}`;
    return `${start.getDate()} ${names[start.getMonth() + 1]}–${end.getDate()} ${names[end.getMonth() + 1]}`;
  }

  function buildPeriod(start, end, index, cadence, monthNames) {
    return {
      index,
      cadence,
      startDate: new Date(start),
      endDate: new Date(end),
      startKey: toDateKey(start),
      endKey: toDateKey(end),
      days: Math.round((end - start) / DAY_MS) + 1,
      label: rangeLabel(start, end, monthNames)
    };
  }

  function calcWeeks(year, month, monthNames) {
    const first = new Date(Number(year), Number(month) - 1, 1);
    const last = new Date(Number(year), Number(month), 0);
    const periods = [];
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
      periods.push(buildPeriod(start, end, periods.length, 'weekly', monthNames));
      current = new Date(sunday);
      current.setDate(sunday.getDate() + 1);
    }
    return periods;
  }

  function calcFortnights(year, month, monthNames) {
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    const firstStart = new Date(Number(year), Number(month) - 1, 1);
    const firstEnd = new Date(Number(year), Number(month) - 1, Math.min(15, lastDay));
    const periods = [buildPeriod(firstStart, firstEnd, 0, 'fortnightly', monthNames)];
    if (lastDay > 15) {
      periods.push(buildPeriod(
        new Date(Number(year), Number(month) - 1, 16),
        new Date(Number(year), Number(month) - 1, lastDay),
        1,
        'fortnightly',
        monthNames
      ));
    }
    return periods;
  }

  function calcPeriods(year, month, monthNames) {
    return isFortnightly(year, month)
      ? calcFortnights(year, month, monthNames)
      : calcWeeks(year, month, monthNames);
  }

  function defaultRules(year, month) {
    const may2026 = Number(year) === 2026 && Number(month) === 5;
    if (isFortnightly(year, month)) {
      return {
        floor: 22000,
        target: 30000,
        step: 10000,
        standardDays: 15
      };
    }
    const weeklyFloor = may2026 ? 12500 : 16500;
    const weeklyTarget = may2026 ? 16500 : 20000;
    return {
      floor: weeklyFloor,
      target: weeklyTarget,
      step: 5000,
      standardDays: 7
    };
  }

  function adjustRules(rules, days, year, month) {
    const defaults = defaultRules(year, month);
    const ratio = Math.max(0, Number(days || 0)) / defaults.standardDays;
    const round = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
    return {
      floor: round(Number(rules?.floor ?? defaults.floor) * ratio),
      target: round(Number(rules?.target ?? defaults.target) * ratio),
      step: round(Number(rules?.step ?? defaults.step) * ratio)
    };
  }

  return Object.freeze({
    FORTNIGHTLY_CUTOVER,
    monthKey,
    isFortnightly,
    calcWeeks,
    calcFortnights,
    calcPeriods,
    defaultRules,
    adjustRules
  });
}));
