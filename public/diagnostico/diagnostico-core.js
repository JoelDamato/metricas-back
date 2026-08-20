(function diagnosticCoreFactory(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DiagnosticCore = api;
}(typeof window !== 'undefined' ? window : globalThis, function buildDiagnosticCore() {
  const STAGES = ['inicial', 'medio', 'final'];
  const PERCENT_FIELDS = new Set([
    'margenContribucion', 'margenMarcacion', 'costosFinancieros', 'impuestosVariables',
    'margenMarcacionProducto', 'margenContribucionProducto'
  ]);
  const TEXT_FIELDS = new Set(['productoMasVendido']);

  const COST_NUM_FIELDS = [
    { key: 'productoMasVendido', label: 'Producto/servicio más vendido' },
    { key: 'margenMarcacionProducto', label: 'Margen de marcación de ese producto (%)' },
    { key: 'margenContribucionProducto', label: 'Margen de contribución de ese producto (%)', derivedFrom: 'margenMarcacionProducto' },
    { key: 'costosFinancieros', label: 'Costos financieros (comisión de tarjeta, etc.) (%)' },
    { key: 'impuestosVariables', label: 'Impuestos variables (IIBB, etc.) (%)' }
  ];
  const COST_SELECT_FIELDS = [
    { key: 'costosOcultosNivel', label: '¿Cómo mide los costos ocultos?', options: ['Con % exacto por cada uno', 'A ojo / estimado', 'No los mide'] },
    { key: 'entiendeMargenReal', label: '¿Conoce la diferencia entre margen de marcación y contribución?', options: ['Sí, entiende la diferencia', 'Cree que son lo mismo', 'No sabe'] },
    { key: 'trasladoFinanciero', label: '¿Traslada el costo financiero al precio?', options: ['No traslada y no sabe el impacto en su rentabilidad', 'No traslada pero sabe el impacto en su rentabilidad', 'Sí, con fórmula incorrecta (PV × (1+%))', 'Sí, con fórmula correcta (PV ÷ (1−%))'] },
    { key: 'trasladoImpositivo', label: '¿Traslada los impuestos variables al precio?', options: ['No traslada y no sabe el impacto en su rentabilidad', 'No traslada pero sabe el impacto en su rentabilidad', 'Sí, con fórmula incorrecta (PV × (1+%))', 'Sí, con fórmula correcta (PV ÷ (1−%))'] },
    { key: 'ivaEsCosto', label: '¿El IVA es un costo?', options: ['Sí', 'No'] }
  ];
  const RESULT_NUM_FIELDS = [
    { key: 'margenMarcacion', label: 'Margen de marcación (%)' },
    { key: 'margenContribucion', label: 'Margen de contribución bruto (%)', derivedFrom: 'margenMarcacion' },
    { key: 'facturacionPromedio', label: 'Facturación promedio mensual ($)' },
    { key: 'costosFijos', label: 'Costos fijos totales ($)' }
  ];
  const RESULT_SELECT_FIELDS = [
    { key: 'comoCalculaRentabilidad', label: '¿Cómo calculás tu rentabilidad?', options: ['No lo sé / no lo calculo', 'Creo que gané o perdí, sin cálculo', 'Ventas menos compras', 'Ventas menos todos los costos, a mano', 'Ventas menos costos, con Excel/sistema'] },
    { key: 'ivaRentabilidadGeneral', label: '¿Tenés en cuenta el IVA al calcular tu rentabilidad general?', options: ['Sí', 'No'] },
    { key: 'mezclaCostosFinancierosFijos', label: '¿Mezcla cuotas de créditos o IVA dentro de los costos fijos económicos?', options: ['No', 'Sí'] }
  ];
  const FINANCE_NUM_FIELDS = [
    { key: 'dineroDisponible', label: 'Dinero disponible ($)' },
    { key: 'porCobrar', label: 'Por cobrar a 30 días ($)' },
    { key: 'deudaProveedores', label: 'A pagar a proveedores, 30 días ($)' },
    { key: 'otrasDeudas', label: 'Otras deudas/pagos, 30 días ($)' },
    { key: 'cobranzaEstimada', label: 'Cobranza estimada por ventas, próximos 30 días ($)' },
    { key: 'pagosCostosFijos', label: 'Pagos de costos fijos, próximos 30 días ($)' }
  ];
  const FINANCE_SELECT_FIELDS = [
    { key: 'conoceSituacionFinanciera', label: '¿Conoce disponible, por cobrar y por pagar a 30 días?', options: ['No lo sabe', 'Tiene una idea aproximada', 'Lo tiene calculado con precisión'] },
    { key: 'tieneFondoEmergencia', label: '¿Tenés fondo de emergencia?', options: ['Sí', 'No'] },
    { key: 'tieneFondoInversiones', label: '¿Tenés fondo de inversiones?', options: ['Sí', 'No'] }
  ];

  function stageAreas(stage) {
    const compareStage = stage === 'medio' ? 'inicial' : stage === 'final' ? 'medio' : null;
    const later = stage !== 'inicial';
    return [
      {
        key: 'costos', label: 'Costos y Precios', autoScore: true, compareStage,
        question: later
          ? '¿Entendió sus márgenes y costos ocultos, y aplicó mejoras concretas?'
          : '¿Conoce con precisión sus costos variables, margen de contribución y margen de marcación?',
        numFields: COST_NUM_FIELDS, selectFields: COST_SELECT_FIELDS
      },
      {
        key: 'resultados', label: 'Estado de Resultados', autoScore: true, compareStage,
        question: later
          ? '¿Armó su estado de resultados con datos reales y puede explicar cada número?'
          : '¿Sabe si el negocio ganó o perdió el mes pasado con datos reales?',
        numFields: RESULT_NUM_FIELDS, selectFields: RESULT_SELECT_FIELDS
      },
      {
        key: 'finanzas', label: 'Finanzas y Cash Flow', autoScore: true, compareStage,
        question: '¿Sabe cuánto tiene disponible, cuánto debe y cuánto cobrará durante los próximos 30 días?',
        numFields: FINANCE_NUM_FIELDS, selectFields: FINANCE_SELECT_FIELDS
      }
    ];
  }

  const STAGE_ITEMS = Object.fromEntries(STAGES.map((stage) => [stage, stageAreas(stage)]));
  const PATTERNS = [
    { key: 'mezclaCostosFijosVariables', label: 'Confunde costos fijos con costos variables', category: 'economico' },
    { key: 'mezclaFinanzas', label: 'Mezcla finanzas personales con las del negocio', category: 'financiero' },
    { key: 'confundeEconomicoFinanciero', label: 'Confunde estado económico con financiero', category: 'financiero' },
    { key: 'noHacePresupuestos', label: 'No hace presupuestos mensuales', category: 'economico' },
    { key: 'noProyectaIngresosPagos', label: 'No proyecta ingresos y pagos', category: 'financiero' },
    { key: 'noAnalizaResultadosMensual', label: 'No analiza resultados económicos mes a mes', category: 'economico' },
    { key: 'noTrabajaConObjetivos', label: 'No trabaja con objetivos', category: 'economico' },
    { key: 'pocoTiempoEstrategico', label: 'Dedica poco tiempo a tareas estratégicas', category: 'economico' },
    { key: 'otro', label: 'Otro', category: 'ambas' }
  ];

  const SCORE_MAPS = {
    costosOcultosNivel: { 'No los mide': 1, 'A ojo / estimado': 2, 'Con % exacto por cada uno': 5 },
    entiendeMargenReal: { 'No sabe': 1, 'Cree que son lo mismo': 1, 'Sí, entiende la diferencia': 5 },
    trasladoFinanciero: {
      'No traslada y no sabe el impacto en su rentabilidad': 1,
      'No traslada pero sabe el impacto en su rentabilidad': 3,
      'Sí, con fórmula incorrecta (PV × (1+%))': 3,
      'Sí, con fórmula correcta (PV ÷ (1−%))': 5,
      'No traslada (lo absorbe)': 1,
      'Sí, con fórmula incorrecta': 3,
      'Sí, con fórmula correcta': 5
    },
    trasladoImpositivo: null,
    ivaEsCosto: { No: 5, Sí: 1 },
    comoCalculaRentabilidad: {
      'No lo sé / no lo calculo': 1,
      'Creo que gané o perdí, sin cálculo': 2,
      'Ventas menos compras': 3,
      'Ventas menos todos los costos, a mano': 4,
      'Ventas menos costos, con Excel/sistema': 5
    },
    ivaRentabilidadGeneral: { No: 5, Sí: 1 },
    mezclaCostosFinancierosFijos: { No: 5, Sí: 1 },
    conoceSituacionFinanciera: { 'No lo sabe': 1, 'Tiene una idea aproximada': 3, 'Lo tiene calculado con precisión': 5 },
    tieneFondoEmergencia: { No: 1, Sí: 5 },
    tieneFondoInversiones: { No: 1, Sí: 5 }
  };
  SCORE_MAPS.trasladoImpositivo = SCORE_MAPS.trasladoFinanciero;

  const LEGACY_PATTERN_MAP = {
    'Mezcla finanzas personales y del negocio': 'mezclaFinanzas',
    'No compara ni proyecta resultados': 'noAnalizaResultadosMensual',
    'Otro': 'otro'
  };

  function cleanObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function emptyCheckpoint(stage) {
    const areas = {};
    STAGE_ITEMS[stage].forEach((item) => {
      areas[item.key] = { score: null, note: '', nums: {}, selects: {} };
      item.numFields.forEach((field) => { areas[item.key].nums[field.key] = ''; });
      item.selectFields.forEach((field) => { areas[item.key].selects[field.key] = ''; });
    });
    return { date: '', csm: '', riesgo: '', patterns: [], otroDetalle: '', areas };
  }

  function emptyData(csmName = '') {
    const checkpoints = Object.fromEntries(STAGES.map((stage) => [stage, emptyCheckpoint(stage)]));
    STAGES.forEach((stage) => { checkpoints[stage].csm = csmName; });
    return { schemaVersion: 2, checkpoints };
  }

  function migrateValues(area, item) {
    const legacyValues = cleanObject(area.values);
    area.nums = cleanObject(area.nums);
    area.selects = cleanObject(area.selects);
    item.numFields.forEach((field) => {
      if (area.nums[field.key] === undefined) area.nums[field.key] = legacyValues[field.key] ?? '';
    });
    item.selectFields.forEach((field) => {
      if (area.selects[field.key] === undefined) area.selects[field.key] = legacyValues[field.key] ?? '';
    });
    area.note = String(area.note || '');
    if (area.score !== null && area.score !== undefined) area.score = Number(area.score) || null;
    else area.score = null;
  }

  function migrateLegacyFinal(data) {
    const finalAreas = cleanObject(data.checkpoints.final?.areas);
    const legacyRentability = finalAreas.rentabilidadFinal;
    if (legacyRentability) {
      const values = cleanObject(legacyRentability.values);
      Object.entries(values).forEach(([key, value]) => {
        const target = RESULT_NUM_FIELDS.some((field) => field.key === key) ? 'resultados' : 'costos';
        const targetArea = finalAreas[target];
        if (targetArea?.nums && !targetArea.nums[key]) targetArea.nums[key] = value;
      });
    }
    const legacyFinance = finalAreas.finanzas_u7 || finalAreas.finanzas_u6;
    if (legacyFinance && finalAreas.finanzas?.score == null) finalAreas.finanzas.score = legacyFinance.score ?? null;
  }

  function normalizeData(value, csmName = '') {
    const data = cleanObject(value);
    data.checkpoints = cleanObject(data.checkpoints);
    STAGES.forEach((stage) => {
      const checkpoint = cleanObject(data.checkpoints[stage]);
      checkpoint.areas = cleanObject(checkpoint.areas);
      data.checkpoints[stage] = checkpoint;
      STAGE_ITEMS[stage].forEach((item) => {
        const area = cleanObject(checkpoint.areas[item.key]);
        checkpoint.areas[item.key] = area;
        migrateValues(area, item);
      });
      checkpoint.date = String(checkpoint.date || '');
      checkpoint.csm = String(checkpoint.csm || csmName || '');
      checkpoint.riesgo = String(checkpoint.riesgo || '');
      const legacyPatterns = Object.values(checkpoint.areas).flatMap((area) => Array.isArray(area.patterns) ? area.patterns : []);
      const currentPatterns = Array.isArray(checkpoint.patterns) ? checkpoint.patterns : [];
      const mapped = [...currentPatterns, ...legacyPatterns.map((pattern) => LEGACY_PATTERN_MAP[pattern]).filter(Boolean)];
      checkpoint.patterns = [...new Set(mapped)].filter((key) => PATTERNS.some((pattern) => pattern.key === key));
      const unmapped = legacyPatterns.filter((pattern) => !LEGACY_PATTERN_MAP[pattern]);
      checkpoint.otroDetalle = String(checkpoint.otroDetalle || unmapped.join(' · '));
      if (unmapped.length && !checkpoint.patterns.includes('otro')) checkpoint.patterns.push('otro');
    });
    migrateLegacyFinal(data);
    STAGES.forEach((stage) => {
      autofillDerivedMargins(data.checkpoints[stage]);
      applyAutoScores(data.checkpoints[stage]);
    });
    data.schemaVersion = 2;
    return data;
  }

  function computeAutoScore(checkpoint, areaKey) {
    const selections = checkpoint?.areas?.[areaKey]?.selects || {};
    const keys = areaKey === 'costos'
      ? ['costosOcultosNivel', 'entiendeMargenReal', 'trasladoFinanciero', 'trasladoImpositivo', 'ivaEsCosto']
      : areaKey === 'resultados'
        ? ['comoCalculaRentabilidad', 'ivaRentabilidadGeneral', 'mezclaCostosFinancierosFijos']
        : ['conoceSituacionFinanciera', 'tieneFondoEmergencia', 'tieneFondoInversiones'];
    const scores = keys.map((key) => SCORE_MAPS[key]?.[selections[key]]).filter((score) => score !== undefined);
    if (!scores.length) return null;
    return Math.floor(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  }

  function applyAutoScores(checkpoint) {
    ['costos', 'resultados', 'finanzas'].forEach((key) => {
      const score = computeAutoScore(checkpoint, key);
      if (score !== null && checkpoint?.areas?.[key]) checkpoint.areas[key].score = score;
    });
    return checkpoint;
  }

  function getPatternScore(checkpoint, stage) {
    const validKeys = PATTERNS
      .filter((pattern) => pattern.key !== 'otro' && (stage !== 'medio' || pattern.category === 'economico'))
      .map((pattern) => pattern.key);
    const count = (checkpoint?.patterns || []).filter((key) => validKeys.includes(key)).length;
    if (stage === 'medio') {
      if (count === 0) return 5;
      if (count <= 1) return 4;
      if (count <= 2) return 3;
      if (count <= 3) return 2;
      return 1;
    }
    if (count === 0) return 5;
    if (count <= 2) return 4;
    if (count <= 4) return 3;
    if (count <= 6) return 2;
    return 1;
  }

  function band(score) {
    if (score === null || score === undefined) return 'grey';
    if (score <= 2) return 'red';
    if (score === 3) return 'yellow';
    return 'green';
  }

  function bandLabel(value) {
    return value === 'red' ? 'Crítico' : value === 'yellow' ? 'En desarrollo' : value === 'green' ? 'Avanzado' : 'Sin datos';
  }

  function computeSummary(checkpoint, stage) {
    applyAutoScores(checkpoint);
    const scores = STAGE_ITEMS[stage].map((item) => checkpoint.areas[item.key].score).filter((score) => score !== null && score !== undefined);
    if (scores.length) scores.push(getPatternScore(checkpoint, stage));
    const average = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
    const summaryBand = average === null ? 'grey' : average <= 2.4 ? 'red' : average <= 3.4 ? 'yellow' : 'green';
    return { average, band: summaryBand, count: scores.length, patternScore: getPatternScore(checkpoint, stage) };
  }

  function parseMoney(value) {
    if (value === null || value === undefined || value === '') return NaN;
    const raw = String(value).trim();
    const negative = raw.startsWith('-');
    const cleaned = raw.replace(/\./g, '').replace(',', '.').replace(/,/g, '').replace(/[^0-9.]/g, '');
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? (negative ? -parsed : parsed) : NaN;
  }

  function parsePercent(value) {
    if (value === null || value === undefined || value === '') return NaN;
    const raw = String(value).trim();
    const negative = raw.startsWith('-');
    const cleaned = raw.replace(',', '.').replace(/,/g, '').replace(/[^0-9.]/g, '');
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? (negative ? -parsed : parsed) : NaN;
  }

  function formatMoneyInput(value) {
    if (value === null || value === undefined) return '';
    const raw = String(value);
    if (/[a-zA-Z]/.test(raw)) return raw;
    const negative = raw.trim().startsWith('-');
    const digits = raw.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
    if (!digits) return negative ? '-' : '';
    return `${negative ? '-' : ''}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
  }

  function formatPercentInput(value) {
    if (value === null || value === undefined) return '';
    const raw = String(value);
    if (/[a-zA-Z]/.test(raw)) return raw;
    const negative = raw.trim().startsWith('-');
    let cleaned = raw.replace(/[^0-9.,]/g, '').replace(',', '.');
    const dot = cleaned.indexOf('.');
    if (dot >= 0) cleaned = cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, '');
    if (!cleaned) return negative ? '-' : '';
    return `${negative ? '-' : ''}${cleaned}%`;
  }

  function formatField(key, value) {
    if (!value) return '';
    if (TEXT_FIELDS.has(key)) return String(value);
    return PERCENT_FIELDS.has(key) ? formatPercentInput(value) : formatMoneyInput(value);
  }

  function marginContributionFromMarkup(value) {
    const markup = parsePercent(value);
    return Number.isFinite(markup) ? (markup * 100) / (100 + markup) : null;
  }

  function autofillDerivedMargins(checkpoint) {
    const pairs = [
      ['resultados', 'margenMarcacion', 'margenContribucion'],
      ['costos', 'margenMarcacionProducto', 'margenContribucionProducto']
    ];
    pairs.forEach(([areaKey, source, target]) => {
      const nums = checkpoint?.areas?.[areaKey]?.nums;
      if (!nums || !nums[source]) return;
      const result = marginContributionFromMarkup(nums[source]);
      if (result !== null) nums[target] = formatPercentInput(result.toFixed(1));
    });
  }

  function effectiveCost(percent, transferOption) {
    const value = parsePercent(percent);
    if (!Number.isFinite(value)) return 0;
    if (transferOption === 'Sí, con fórmula correcta (PV ÷ (1−%))' || transferOption === 'Sí, con fórmula correcta') return 0;
    if (transferOption === 'Sí, con fórmula incorrecta (PV × (1+%))' || transferOption === 'Sí, con fórmula incorrecta') return (value * value) / 100;
    return value;
  }

  function calculateStage(checkpoint) {
    const costs = checkpoint?.areas?.costos || { nums: {}, selects: {} };
    const results = checkpoint?.areas?.resultados || { nums: {} };
    const finance = checkpoint?.areas?.finanzas || { nums: {} };
    const grossMargin = parsePercent(results.nums?.margenContribucion);
    const hasFinancialCost = String(costs.nums?.costosFinancieros || '').trim() !== '';
    const hasTaxCost = String(costs.nums?.impuestosVariables || '').trim() !== '';
    const financialCost = hasFinancialCost ? effectiveCost(costs.nums?.costosFinancieros, costs.selects?.trasladoFinanciero) : null;
    const taxCost = hasTaxCost ? effectiveCost(costs.nums?.impuestosVariables, costs.selects?.trasladoImpositivo) : null;
    const netMargin = Number.isFinite(grossMargin) ? grossMargin - (financialCost || 0) - (taxCost || 0) : null;
    const sales = parseMoney(results.nums?.facturacionPromedio);
    const fixedCosts = parseMoney(results.nums?.costosFijos);
    const contribution = Number.isFinite(sales) && netMargin !== null ? sales * (netMargin / 100) : null;
    const variableCosts = contribution !== null ? sales - contribution : null;
    const monthlyResult = contribution !== null && Number.isFinite(fixedCosts) ? contribution - fixedCosts : null;
    const netProfitPercent = monthlyResult !== null && sales !== 0 ? (monthlyResult / sales) * 100 : null;
    const breakEven = Number.isFinite(fixedCosts) && netMargin ? fixedCosts / (netMargin / 100) : null;

    const financeKeys = ['dineroDisponible', 'porCobrar', 'deudaProveedores', 'otrasDeudas', 'cobranzaEstimada', 'pagosCostosFijos'];
    const hasFinance = financeKeys.some((key) => String(finance.nums?.[key] || '').trim());
    const numberOrZero = (key) => {
      const parsed = parseMoney(finance.nums?.[key]);
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const available = numberOrZero('dineroDisponible');
    const receivable = numberOrZero('porCobrar');
    const providerDebt = numberOrZero('deudaProveedores');
    const otherDebt = numberOrZero('otrasDeudas');
    const estimatedCollection = numberOrZero('cobranzaEstimada');
    const fixedPayments = numberOrZero('pagosCostosFijos');

    return {
      financialCost, taxCost, netMargin, sales, variableCosts, contribution, fixedCosts,
      monthlyResult, netProfitPercent, breakEven,
      finance: hasFinance ? {
        providersResult: available + receivable - providerDebt,
        totalResult: available + receivable - providerDebt - otherDebt,
        projectedIncome: available + receivable + estimatedCollection,
        projectedExpense: providerDebt + otherDebt + fixedPayments,
        projectedResult: available + receivable + estimatedCollection - providerDebt - otherDebt - fixedPayments
      } : null
    };
  }

  function formatMoney(value) {
    return value === null || value === undefined || !Number.isFinite(Number(value))
      ? '—'
      : `$ ${Math.round(Number(value)).toLocaleString('es-AR')}`;
  }

  function formatPercent(value) {
    return value === null || value === undefined || !Number.isFinite(Number(value)) ? '—' : `${Number(value).toFixed(1)}%`;
  }

  return {
    STAGES, STAGE_ITEMS, PATTERNS, PERCENT_FIELDS, TEXT_FIELDS,
    emptyData, normalizeData, computeAutoScore, applyAutoScores, getPatternScore,
    computeSummary, band, bandLabel, parseMoney, parsePercent, formatMoneyInput,
    formatPercentInput, formatField, marginContributionFromMarkup, autofillDerivedMargins,
    effectiveCost, calculateStage, formatMoney, formatPercent
  };
}));
