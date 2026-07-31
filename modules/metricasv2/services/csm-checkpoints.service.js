const CSM_MEMBERS = Object.freeze([
  'Valeria Calmet',
  'Sofía Gallardo',
  'Gabriela Costarelli'
]);

const CSM_CATEGORIES = Object.freeze({
  strike: Object.freeze([
    'Ausencia, llegada tarde o falta de preparación (reunión con cliente o interna del equipo)',
    'Incumplimiento de plazo o tarea recurrente no realizada',
    'Registro no realizado (CRM / ficha del cliente)',
    'Traspaso de tarea fallido entre compañeras',
    'Error en la ejecución (entregable con error significativo)',
    'Falta de detección o supervisión oportuna',
    'Trato y conducta',
    'Imagen profesional',
    'Compromiso indebido con el cliente',
    'Confidencialidad',
    'Uso indebido de recursos o herramientas internas',
    'Contacto con cliente fuera de horario sin justificar',
    'Inconsistencia de información entre profesionales',
    'Otro'
  ]),
  check: Object.freeze([
    'Propuesta implementada (mejora, documento o proceso ya hecho)',
    'Resolución proactiva de un problema, con evidencia',
    'Otro'
  ])
});

const CSM_BASE_SALARY_USD = 850;

const CSM_BONUS_RULES = Object.freeze([
  Object.freeze({ minScore: 8, label: '+8 o más', bonusUsd: 350 }),
  Object.freeze({ minScore: 7, label: '+7', bonusUsd: 325 }),
  Object.freeze({ minScore: 6, label: '+6', bonusUsd: 300 }),
  Object.freeze({ minScore: 5, label: '+5', bonusUsd: 275 }),
  Object.freeze({ minScore: 4, label: '+4', bonusUsd: 250 }),
  Object.freeze({ minScore: 3, label: '+3', bonusUsd: 175 }),
  Object.freeze({ minScore: 2, label: '+2', bonusUsd: 150 }),
  Object.freeze({ minScore: 1, label: '+1', bonusUsd: 125 }),
  Object.freeze({ minScore: 0, label: '0', bonusUsd: 100 }),
  Object.freeze({ minScore: Number.NEGATIVE_INFINITY, label: 'Negativo', bonusUsd: 0 })
]);

function normalizeKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

const CSM_MEMBER_ALIASES = new Map([
  ['valeria calmet', 'Valeria Calmet'],
  ['sofia gallardo', 'Sofía Gallardo'],
  ['gabriela costarelli', 'Gabriela Costarelli'],
  ['gabriela costa', 'Gabriela Costarelli']
]);

function normalizeCsmMember(value) {
  return CSM_MEMBER_ALIASES.get(normalizeKey(value)) || null;
}

function parseIsoDate(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }

  return { raw, year, month, day };
}

function getLastBusinessDay(year, month) {
  const date = new Date(Date.UTC(year, month, 0));
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) {
    date.setUTCDate(date.getUTCDate() - 1);
  }
  return date.getUTCDate();
}

function getCsmAccountingPeriod(value) {
  const parsed = parseIsoDate(value);
  if (!parsed) {
    const error = new Error('La fecha debe ser válida y usar el formato AAAA-MM-DD');
    error.statusCode = 400;
    throw error;
  }

  const lastBusinessDay = getLastBusinessDay(parsed.year, parsed.month);
  if (parsed.day <= lastBusinessDay) {
    return {
      anio: parsed.year,
      mes: parsed.month,
      lastBusinessDay
    };
  }

  const nextMonth = new Date(Date.UTC(parsed.year, parsed.month, 1));
  return {
    anio: nextMonth.getUTCFullYear(),
    mes: nextMonth.getUTCMonth() + 1,
    lastBusinessDay
  };
}

function normalizeCsmCategory(tipo, value) {
  const normalizedType = String(tipo || '').trim().toLowerCase();
  const categories = CSM_CATEGORIES[normalizedType] || [];
  const key = normalizeKey(value);
  return categories.find((category) => normalizeKey(category) === key) || null;
}

function validateCsmEntryInput(payload = {}) {
  const closerNombre = normalizeCsmMember(payload.closer_nombre);
  const tipo = String(payload.tipo || '').trim().toLowerCase();
  const categoria = normalizeCsmCategory(tipo, payload.categoria);
  const fecha = parseIsoDate(payload.fecha)?.raw || null;
  const detalle = String(payload.detalle || '').trim();

  if (!closerNombre) {
    const error = new Error('La persona debe ser Valeria Calmet, Sofía Gallardo o Gabriela Costarelli');
    error.statusCode = 400;
    throw error;
  }

  if (!['check', 'strike'].includes(tipo)) {
    const error = new Error('En CSM el tipo debe ser check o strike');
    error.statusCode = 400;
    throw error;
  }

  if (!fecha) {
    const error = new Error('La fecha es obligatoria y debe usar el formato AAAA-MM-DD');
    error.statusCode = 400;
    throw error;
  }

  if (!categoria) {
    const error = new Error(`La categoría no corresponde al tipo ${tipo}`);
    error.statusCode = 400;
    throw error;
  }

  if (!detalle) {
    const error = new Error('El detalle de la situación es obligatorio');
    error.statusCode = 400;
    throw error;
  }

  return {
    closer_nombre: closerNombre,
    fecha,
    tipo,
    categoria,
    detalle: detalle.slice(0, 1200),
    cantidad: 1,
    period: getCsmAccountingPeriod(fecha)
  };
}

function getCsmBonus(scoreValue) {
  const score = Number(scoreValue || 0);
  const rule = CSM_BONUS_RULES.find((candidate) => score >= candidate.minScore);
  return rule?.bonusUsd || 0;
}

function summarizeCsmEntries(entries = []) {
  const rows = new Map(CSM_MEMBERS.map((name) => [
    name,
    {
      name,
      checks: 0,
      strikes: 0,
      score: 0,
      bonusUsd: 0,
      baseSalaryUsd: CSM_BASE_SALARY_USD,
      totalUsd: CSM_BASE_SALARY_USD
    }
  ]));

  for (const entry of Array.isArray(entries) ? entries : []) {
    const tipo = String(entry?.tipo || '').trim().toLowerCase();
    if (!['check', 'strike'].includes(tipo)) continue;

    const name = normalizeCsmMember(entry?.closer_nombre) || String(entry?.closer_nombre || '').trim();
    if (!name) continue;

    const row = rows.get(name) || {
      name,
      checks: 0,
      strikes: 0,
      score: 0,
      bonusUsd: 0,
      baseSalaryUsd: CSM_BASE_SALARY_USD,
      totalUsd: CSM_BASE_SALARY_USD
    };
    const quantity = Math.max(1, Math.round(Number(entry?.cantidad || 1) || 1));

    if (tipo === 'check') row.checks += quantity;
    if (tipo === 'strike') row.strikes += quantity;
    rows.set(name, row);
  }

  return [...rows.values()].map((row) => {
    const score = row.checks - row.strikes;
    const bonusUsd = getCsmBonus(score);
    return {
      ...row,
      score,
      bonusUsd,
      totalUsd: CSM_BASE_SALARY_USD + bonusUsd,
      negative: score < 0
    };
  });
}

function getCsmRules() {
  return {
    members: [...CSM_MEMBERS],
    categories: {
      check: [...CSM_CATEGORIES.check],
      strike: [...CSM_CATEGORIES.strike]
    },
    baseSalaryUsd: CSM_BASE_SALARY_USD,
    bonusRules: [...CSM_BONUS_RULES].reverse().map((rule) => ({
      label: rule.label,
      bonusUsd: rule.bonusUsd,
      totalUsd: CSM_BASE_SALARY_USD + rule.bonusUsd
    })),
    cutoff: 'El mes cierra el último día hábil (lunes a viernes); las cargas posteriores pasan al mes siguiente.'
  };
}

function buildCsmReport(periods = []) {
  const history = periods.map((period) => ({
    anio: Number(period.anio),
    mes: Number(period.mes),
    members: summarizeCsmEntries(period.entries)
  }));

  const alerts = CSM_MEMBERS.flatMap((name) => {
    let consecutiveNegativeMonths = 0;
    for (const period of history) {
      const member = period.members.find((row) => row.name === name);
      if (!member?.negative) break;
      consecutiveNegativeMonths += 1;
    }

    if (consecutiveNegativeMonths < 3) return [];
    return [{
      name,
      consecutiveNegativeMonths,
      threshold: consecutiveNegativeMonths >= 6 ? 6 : 3
    }];
  });

  return {
    current: history[0] || null,
    history,
    alerts,
    rules: getCsmRules()
  };
}

module.exports = {
  CSM_MEMBERS,
  CSM_CATEGORIES,
  CSM_BASE_SALARY_USD,
  CSM_BONUS_RULES,
  normalizeCsmMember,
  normalizeCsmCategory,
  getLastBusinessDay,
  getCsmAccountingPeriod,
  validateCsmEntryInput,
  getCsmBonus,
  summarizeCsmEntries,
  getCsmRules,
  buildCsmReport
};
