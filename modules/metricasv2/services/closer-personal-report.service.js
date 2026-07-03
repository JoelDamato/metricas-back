const axios = require('axios');
const env = require('../config/env');
const supabaseService = require('./supabase.service');

const RESOURCE = 'agenda_detalle_por_origen_closer';
const EXCLUDED_CLOSERS = ['sin closer', 'nahuel', 'shirlet', 'shirley'];
const CLOSER_ALIAS_MAP = {
  'pablo butera': 'Pablo Butera',
  'pablo butera vie': 'Pablo Butera',
  'nahuel iasci': 'Nahuel Iasci'
};
const CLOSER_STYLE_MAP = {
  'Walter Alegre': { color: '#3A7BF5', colorDark: '#1A3A8A' },
  'Carlos Tu': { color: '#14B87A', colorDark: '#0A5A3C' },
  'Claudio Nicolini': { color: '#E8950A', colorDark: '#7A4500' },
  'Mauro Gaitan': { color: '#8B5CF6', colorDark: '#4A1E8A' },
  'Pablo Butera': { color: '#F472B6', colorDark: '#8A1A50' },
  'Patricia Conti': { color: '#34D399', colorDark: '#0A5A3C' }
};

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function canonicalizeCloserName(value) {
  const text = String(value || '').trim();
  if (!text) return text;
  return CLOSER_ALIAS_MAP[normalizeText(text)] || text;
}

function resolveResponsibleCloser(row = {}) {
  return canonicalizeCloserName(row.responsable_venta || row.closer);
}

function shouldIncludeCloser(value) {
  const normalized = normalizeText(value);
  if (!normalized) return false;
  return !EXCLUDED_CLOSERS.some((term) => normalized.includes(term));
}

function safeDiv(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : 0;
}

function formatInteger(value) {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatCurrency(value, currency = 'USD') {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1).replace('.', ',')}%`;
}

function formatMonthLabel(monthValue) {
  const [year, month] = String(monthValue || '').split('-').map(Number);
  if (!year || !month) return '';
  const date = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(date);
}

function parseMonthValue(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    const error = new Error('El mes debe venir en formato YYYY-MM');
    error.statusCode = 400;
    throw error;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    monthValue: `${match[1]}-${match[2]}`
  };
}

function normalizeRows(rows) {
  return (rows || [])
    .map((row) => ({
      ...row,
      closer: resolveResponsibleCloser(row),
      anio: Number(row.anio || 0),
      mes: Number(row.mes || 0),
      total_agendados: Number(row.total_agendados ?? row.total_leads ?? 0),
      total_aplica: Number(row.total_aplica || 0),
      total_respondio: Number(row.total_respondio || 0),
      total_confirmo: Number(row.total_confirmo || 0),
      total_cancelado: Number(row.total_cancelado || 0),
      total_no_asistidas: Number(row.total_no_asistidas || 0),
      total_pendientes: Number(row.total_pendientes || 0),
      total_efectuadas: Number(row.total_efectuadas || 0),
      total_ventas: Number(row.total_ventas || 0),
      total_paid_upfront: Number(row.total_paid_upfront || 0),
      ccne: Number(row.ccne || 0),
      cce_llamada: Number(row.cce_llamada || 0),
      cce_whatsapp: Number(row.cce_whatsapp || 0),
      facturacion_total_mes: Number(row.facturacion_total_mes ?? row.facturacion_total ?? 0),
      facturacion_f_agenda: Number(row.facturacion_f_agenda || 0),
      cash_collected_real_mes: Number(row.cash_collected_real_mes ?? row.cash_collected_total ?? 0),
      cash_collected_otros_meses: Number(row.cash_collected_otros_meses || 0),
      cash_collected_agendas_mes: Number(row.cash_collected_agendas_mes ?? row.cash_collected_agenda ?? 0)
    }))
    .filter((row) => row.anio > 0 && row.mes > 0 && shouldIncludeCloser(row.closer));
}

function aggregateByCloser(rows) {
  const map = new Map();

  (rows || []).forEach((row) => {
    const closer = String(row.closer || '').trim();
    if (!closer) return;

    if (!map.has(closer)) {
      map.set(closer, {
        closer,
        agendas: 0,
        aplicables: 0,
        respuesta: 0,
        confirmados: 0,
        canceladas: 0,
        noAsistidas: 0,
        pendientes: 0,
        efectuadas: 0,
        ventas: 0,
        paidUpfront: 0,
        ccne: 0,
        cceLlamada: 0,
        cceWhatsapp: 0,
        facturacionTotalMes: 0,
        facturacionAgenda: 0,
        cashRealMes: 0,
        cashOtrosMeses: 0,
        cashAgendasMes: 0
      });
    }

    const current = map.get(closer);
    current.agendas += row.total_agendados;
    current.aplicables += row.total_aplica;
    current.respuesta += row.total_respondio;
    current.confirmados += row.total_confirmo;
    current.canceladas += row.total_cancelado;
    current.noAsistidas += row.total_no_asistidas;
    current.pendientes += row.total_pendientes;
    current.efectuadas += row.total_efectuadas;
    current.ventas += row.total_ventas;
    current.paidUpfront += row.total_paid_upfront;
    current.ccne += row.ccne;
    current.cceLlamada += row.cce_llamada;
    current.cceWhatsapp += row.cce_whatsapp;
    current.facturacionTotalMes += row.facturacion_total_mes;
    current.facturacionAgenda += row.facturacion_f_agenda;
    current.cashRealMes += row.cash_collected_real_mes;
    current.cashOtrosMeses += row.cash_collected_otros_meses;
    current.cashAgendasMes += row.cash_collected_agendas_mes;
  });

  return [...map.values()].map((row) => ({
    ...row,
    cierrePct: safeDiv(row.ventas * 100, row.efectuadas),
    efectuadasSobreAplicablesPct: safeDiv(row.efectuadas * 100, row.aplicables),
    ventasSobreAgendasPct: safeDiv(row.ventas * 100, row.agendas),
    ventasSobreAsistidasPct: safeDiv(row.ventas * 100, row.efectuadas),
    noAsistidasPct: safeDiv(row.noAsistidas * 100, row.aplicables),
    cashPorAgenda: safeDiv(row.cashAgendasMes, row.agendas),
    cashPorReunion: safeDiv(row.cashAgendasMes, row.efectuadas),
    ticketPromedio: safeDiv(row.facturacionAgenda, row.ventas),
    cashPorVenta: safeDiv(row.cashAgendasMes, row.ventas),
    cashSobreFacturacionPct: safeDiv(row.cashAgendasMes * 100, row.facturacionAgenda),
    paidUpfrontPct: safeDiv(row.paidUpfront * 100, row.facturacionTotalMes),
    cceLlamadaPct: safeDiv(row.cceLlamada * 100, row.aplicables),
    cceWhatsappPct: safeDiv(row.cceWhatsapp * 100, row.aplicables)
  })).sort((a, b) => {
    const diff = b.cashAgendasMes - a.cashAgendasMes;
    if (diff !== 0) return diff;
    return a.closer.localeCompare(b.closer, 'es');
  });
}

function summarizeRows(rows) {
  return rows.reduce((acc, row) => {
    acc.agendas += row.agendas;
    acc.ventas += row.ventas;
    acc.aplicables += row.aplicables;
    acc.efectuadas += row.efectuadas;
    acc.noAsistidas += row.noAsistidas;
    acc.facturacionAgenda += row.facturacionAgenda;
    acc.cashAgendasMes += row.cashAgendasMes;
    acc.cashRealMes += row.cashRealMes;
    acc.cashOtrosMeses += row.cashOtrosMeses;
    acc.facturacionTotalMes += row.facturacionTotalMes;
    acc.paidUpfront += row.paidUpfront;
    return acc;
  }, {
    agendas: 0,
    ventas: 0,
    aplicables: 0,
    efectuadas: 0,
    noAsistidas: 0,
    facturacionAgenda: 0,
    cashAgendasMes: 0,
    cashRealMes: 0,
    cashOtrosMeses: 0,
    facturacionTotalMes: 0,
    paidUpfront: 0
  });
}

function averageMetric(rows, accessor) {
  const values = (rows || [])
    .map((row) => Number(accessor(row) || 0))
    .filter((value) => Number.isFinite(value));
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildMetricsPayload({ closerRow, teamRows, monthValue, monthsActive }) {
  const summary = summarizeRows(teamRows);
  const teamAvg = {
    cashTotal: averageMetric(teamRows, (row) => row.cashAgendasMes),
    tasaCierre: averageMetric(teamRows, (row) => row.cierrePct),
    tasaEfectuadas: averageMetric(teamRows, (row) => row.efectuadasSobreAplicablesPct),
    pctNoAsistidas: averageMetric(teamRows, (row) => row.noAsistidasPct),
    pctCobroAgenda: averageMetric(teamRows, (row) => row.cashSobreFacturacionPct),
    cashPorAgenda: averageMetric(teamRows, (row) => row.cashPorAgenda),
    ticketPromedio: averageMetric(teamRows, (row) => row.ticketPromedio),
    conversionReunionVenta: averageMetric(teamRows, (row) => row.ventasSobreAsistidasPct)
  };

  const rankingPosition = Math.max(teamRows.findIndex((row) => row.closer === closerRow.closer), 0) + 1;
  const activeClosers = teamRows.length;
  const shareOfTeamCashPct = safeDiv(closerRow.cashAgendasMes * 100, summary.cashAgendasMes);
  const status = monthsActive < 4
    ? `Closer nuevo · ${monthsActive} ${monthsActive === 1 ? 'mes activo' : 'meses activos'}`
    : `Closer establecido · ${monthsActive} meses activos`;

  return {
    closer: closerRow.closer,
    monthValue,
    monthLabel: formatMonthLabel(monthValue),
    monthsActive,
    rankingPosition,
    activeClosers,
    shareOfTeamCashPct,
    status,
    teamSummary: {
      agendas: summary.agendas,
      aplicables: summary.aplicables,
      efectuadas: summary.efectuadas,
      ventas: summary.ventas,
      cashAgendasMes: summary.cashAgendasMes,
      facturacionAgenda: summary.facturacionAgenda,
      tasaCierrePct: safeDiv(summary.ventas * 100, summary.efectuadas),
      tasaEfectuadasPct: safeDiv(summary.efectuadas * 100, summary.aplicables)
    },
    closerMetrics: {
      agendas: closerRow.agendas,
      aplicables: closerRow.aplicables,
      efectuadas: closerRow.efectuadas,
      noAsistidas: closerRow.noAsistidas,
      noAsistidasPct: closerRow.noAsistidasPct,
      ventas: closerRow.ventas,
      cierrePct: closerRow.cierrePct,
      efectuadasSobreAplicablesPct: closerRow.efectuadasSobreAplicablesPct,
      ventasSobreAgendasPct: closerRow.ventasSobreAgendasPct,
      ventasSobreAsistidasPct: closerRow.ventasSobreAsistidasPct,
      paidUpfront: closerRow.paidUpfront,
      paidUpfrontPct: closerRow.paidUpfrontPct,
      ccne: closerRow.ccne,
      cceLlamada: closerRow.cceLlamada,
      cceWhatsapp: closerRow.cceWhatsapp,
      facturacionAgenda: closerRow.facturacionAgenda,
      facturacionTotalMes: closerRow.facturacionTotalMes,
      cashAgendasMes: closerRow.cashAgendasMes,
      cashRealMes: closerRow.cashRealMes,
      cashOtrosMeses: closerRow.cashOtrosMeses,
      cashSobreFacturacionPct: closerRow.cashSobreFacturacionPct,
      cashPorAgenda: closerRow.cashPorAgenda,
      cashPorReunion: closerRow.cashPorReunion,
      ticketPromedio: closerRow.ticketPromedio,
      cashPorVenta: closerRow.cashPorVenta,
      cceLlamadaPct: closerRow.cceLlamadaPct,
      cceWhatsappPct: closerRow.cceWhatsappPct
    },
    teamAverages: teamAvg
  };
}

function requireOpenAi() {
  if (!env.openAiApiKey) {
    const error = new Error('Falta OPENAI_API_KEY para generar el reporte con GPT');
    error.statusCode = 500;
    throw error;
  }
}

function extractResponseText(responseData) {
  if (typeof responseData?.output_text === 'string' && responseData.output_text.trim()) {
    return responseData.output_text.trim();
  }

  const outputs = Array.isArray(responseData?.output) ? responseData.output : [];
  for (const item of outputs) {
    const contents = Array.isArray(item?.content) ? item.content : [];
    for (const content of contents) {
      if (typeof content?.text === 'string' && content.text.trim()) {
        return content.text.trim();
      }
    }
  }

  return '';
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getOpenAiErrorMessage(err = {}) {
  const data = err?.response?.data || {};
  return String(
    data?.error?.message
    || data?.message
    || err?.message
    || 'Error desconocido de OpenAI'
  );
}

function isRetryableOpenAiError(err = {}) {
  const status = Number(err?.response?.status || 0);
  return status === 408
    || status === 409
    || status === 429
    || status >= 500
    || ['ECONNABORTED', 'ECONNRESET', 'ETIMEDOUT'].includes(err?.code);
}

async function requestOpenAiReport(payload) {
  const maxAttempts = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await axios.post(
        'https://api.openai.com/v1/responses',
        payload,
        {
          headers: {
            Authorization: `Bearer ${env.openAiApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000
        }
      );
    } catch (err) {
      lastError = err;
      if (attempt >= maxAttempts || !isRetryableOpenAiError(err)) break;
      await delay(650 * attempt);
    }
  }

  const status = Number(lastError?.response?.status || 0);
  const providerMessage = getOpenAiErrorMessage(lastError);
  const error = new Error(
    status
      ? `OpenAI respondió ${status} al generar el reporte: ${providerMessage}`
      : `No pude conectar con OpenAI para generar el reporte: ${providerMessage}`
  );
  error.statusCode = 502;
  error.details = {
    provider: 'openai',
    status: status || null,
    message: providerMessage
  };
  throw error;
}

async function generateNarrative(metrics, options = {}) {
  requireOpenAi();
  const additionalPrompt = String(options.additionalPrompt || '').trim();

  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['chips', 'kpis', 'fortalezas', 'atencion', 'mensaje', 'pasos', 'sistemaMsg'],
    properties: {
      chips: {
        type: 'array',
        items: { type: 'string' },
        minItems: 2,
        maxItems: 4
      },
      kpis: {
        type: 'array',
        minItems: 6,
        maxItems: 6,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['lbl', 'val', 'sub', 'cls'],
          properties: {
            lbl: { type: 'string' },
            val: { type: 'string' },
            sub: { type: 'string' },
            cls: { type: 'string', enum: ['', 'highlight', 'warn', 'danger'] }
          }
        }
      },
      fortalezas: {
        type: 'array',
        minItems: 2,
        maxItems: 4,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['dot', 'txt'],
          properties: {
            dot: { type: 'string', enum: ['green', 'amber', 'blue'] },
            txt: { type: 'string' }
          }
        }
      },
      atencion: {
        type: 'array',
        minItems: 1,
        maxItems: 4,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['dot', 'txt'],
          properties: {
            dot: { type: 'string', enum: ['green', 'amber', 'blue'] },
            txt: { type: 'string' }
          }
        }
      },
      mensaje: { type: 'string' },
      pasos: {
        type: 'array',
        minItems: 3,
        maxItems: 3,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['num', 'color', 'txt'],
          properties: {
            num: { type: 'string' },
            color: { type: 'string', enum: ['#3A7BF5', '#14B87A', '#E8950A', '#E84A4A', '#8B5CF6', '#F472B6', '#34D399'] },
            txt: { type: 'string' }
          }
        }
      },
      sistemaMsg: { type: 'string' }
    }
  };

  const instructions = [
    'Sos un coach comercial senior de Central de Métricas.',
    'Escribís en español rioplatense.',
    'Usá SOLO los números recibidos.',
    'No inventes métricas, meses, comparaciones ni conclusiones que no se desprendan de los datos.',
    'El tono tiene que ser ejecutivo, directo, útil y motivador.',
    'Señalá fortalezas reales y áreas a trabajar sin exagerar.',
    'No uses markdown, no uses emojis, no uses HTML.',
    'En los textos, escribí los números ya formateados como texto común si hace falta.',
    'Los 6 KPI deben reflejar los datos del closer y sus subtítulos deben explicar el contexto del mes.',
    'Tomá como tasa de cierre la relación ventas sobre asistidas/efectuadas.',
    'Tomá como tasa de efectuadas la relación asistidas/efectuadas sobre agendas aplicables.',
    'Los próximos pasos deben ser accionables y concretos.'
  ].join(' ');

  const input = `
Generá un reporte personal para el closer ${metrics.closer} del mes ${metrics.monthLabel}.

Datos base:
${JSON.stringify(metrics, null, 2)}

${additionalPrompt ? `\nContexto o pedido adicional del usuario:\n${additionalPrompt}\n` : ''}
`;

  const response = await requestOpenAiReport({
    model: env.openAiReportModel,
    instructions,
    input,
    text: {
      format: {
        type: 'json_schema',
        name: 'closer_personal_report',
        strict: true,
        schema
      }
    }
  });

  const text = extractResponseText(response.data);
  if (!text) {
    const error = new Error('OpenAI no devolvió contenido para el reporte');
    error.statusCode = 502;
    throw error;
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    const error = new Error('OpenAI devolvió un JSON inválido para el reporte');
    error.statusCode = 502;
    error.details = { provider: 'openai', message: err.message };
    throw error;
  }
}

async function generateCloserPersonalReport({ closer, month, additionalPrompt }) {
  const closerName = canonicalizeCloserName(closer);
  if (!closerName) {
    const error = new Error('Falta el closer para generar el reporte');
    error.statusCode = 400;
    throw error;
  }

  const { year, month: monthNumber, monthValue } = parseMonthValue(month);
  const monthRows = normalizeRows(await supabaseService.listRows(RESOURCE, {
    limit: 1000,
    orderBy: 'mes',
    orderDir: 'asc',
    eqFilters: { anio: year }
  })).filter((row) => row.anio === year && row.mes === monthNumber);

  const teamRows = aggregateByCloser(monthRows);
  const closerRow = teamRows.find((row) => row.closer === closerName);
  if (!closerRow) {
    const error = new Error(`No encontré datos para ${closerName} en ${monthValue}`);
    error.statusCode = 404;
    throw error;
  }

  const yearlyRows = normalizeRows(await supabaseService.listRows(RESOURCE, {
    limit: 1000,
    orderBy: 'mes',
    orderDir: 'asc',
    eqFilters: { anio: year }
  }));

  const monthsActive = new Set(
    yearlyRows
      .filter((row) => row.closer === closerName)
      .map((row) => `${row.anio}-${String(row.mes).padStart(2, '0')}`)
  ).size || 1;

  const metrics = buildMetricsPayload({
    closerRow,
    teamRows,
    monthValue,
    monthsActive
  });

  const normalizedAdditionalPrompt = String(additionalPrompt || '').trim();
  const narrative = await generateNarrative(metrics, { additionalPrompt: normalizedAdditionalPrompt });
  const style = CLOSER_STYLE_MAP[closerName] || { color: '#3A7BF5', colorDark: '#1A3A8A' };

  return {
    closer: closerName,
    month: monthValue,
    monthLabel: metrics.monthLabel,
    status: metrics.status,
    monthsActive,
    rankingPosition: metrics.rankingPosition,
    activeClosers: metrics.activeClosers,
    shareOfTeamCashPct: metrics.shareOfTeamCashPct,
    metrics: {
      closer: metrics.closerMetrics,
      teamAverages: metrics.teamAverages
    },
    style,
    report: narrative,
    additionalPrompt: normalizedAdditionalPrompt || null,
    generatedAt: new Date().toISOString()
  };
}

async function getStoredCloserPersonalReport({ closer, month }) {
  return supabaseService.getStoredCloserPersonalReport({ closer, month });
}

async function generateAndStoreCloserPersonalReport({ closer, month, additionalPrompt }, user) {
  const payload = await generateCloserPersonalReport({ closer, month, additionalPrompt });
  const stored = await supabaseService.saveCloserPersonalReport({
    closer: payload.closer,
    month: payload.month
  }, payload, user);
  return stored.report || payload;
}

module.exports = {
  generateCloserPersonalReport,
  getStoredCloserPersonalReport,
  generateAndStoreCloserPersonalReport
};
