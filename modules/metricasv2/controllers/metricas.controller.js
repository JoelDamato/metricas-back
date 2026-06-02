const supabaseService = require('../services/supabase.service');
const assistantService = require('../services/assistant.service');
const comprobantesLoaderService = require('../services/comprobantes-loader.service');
const closerPersonalReportService = require('../services/closer-personal-report.service');
const commissionsService = require('../services/commissions.service');
const access = require('../../auth/access');

async function health(req, res) {
  res.json({
    ok: true,
    service: 'metricas',
    date: new Date().toISOString()
  });
}

async function getResources(req, res, next) {
  try {
    const resources = await supabaseService.listResources();
    res.json({
      ok: true,
      count: resources.length,
      resources
    });
  } catch (error) {
    next(error);
  }
}

async function listAllResourceRows(resource, options = {}) {
  const pageSize = Math.min(Math.max(Number(options.limit || 1000), 1), 1000);
  const rows = [];
  let offset = Number(options.offset || 0);

  while (true) {
    const chunk = await supabaseService.listRows(resource, {
      ...options,
      limit: pageSize,
      offset
    });

    rows.push(...chunk);

    if (chunk.length < pageSize) break;
    offset += pageSize;
  }

  return rows;
}

async function getOperationalAlertsData(req, res, next) {
  try {
    const [csmRows, comprobantesRows, leadsRows] = await Promise.all([
      listAllResourceRows('csm', {
        select: 'nombre,ghlid,abandono,f_pago_con_acceso,f_acceso,f_onboarding,f_diagnostico,modulo_1,modelo_negocio'
      }),
      listAllResourceRows('comprobantes', {
        select: 'creado_por,responsable_venta,estado,tipo,producto_format,f_venta,f_acreditacion,facturacion,cash_collected_total,cash_collected,ghlid'
      }),
      listAllResourceRows('leads_raw', {
        select: 'nombre,mail,telefono,whatsapp,ghlid,fecha_creada,created_time,origen,primer_origen,setter,closer,fecha_agenda,fecha_llamada,agendo,aplica,llamada_meg,estrategia_a'
      })
    ]);

    res.json({
      ok: true,
      rows: {
        csm: csmRows,
        comprobantes: comprobantesRows,
        leads: leadsRows
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getCommissionsDashboard(req, res, next) {
  try {
    const data = await commissionsService.buildCommissionDashboard(req.query.month);
    res.json({
      ok: true,
      ...data
    });
  } catch (error) {
    next(error);
  }
}

async function getCommissionPersonDetail(req, res, next) {
  try {
    const data = await commissionsService.getCommissionPersonDetail(req.query.month, req.query.person);
    res.json({
      ok: true,
      ...data
    });
  } catch (error) {
    next(error);
  }
}

async function getCommissionConfig(req, res, next) {
  try {
    const data = await commissionsService.getCommissionConfig(req.query.month);
    res.json({
      ok: true,
      ...data
    });
  } catch (error) {
    next(error);
  }
}

async function saveCommissionConfig(req, res, next) {
  try {
    const data = await commissionsService.saveCommissionConfig(req.body?.month, req.body?.config || {}, req.authUser);
    res.json({
      ok: true,
      ...data
    });
  } catch (error) {
    next(error);
  }
}

async function saveDefaultCommissionConfig(req, res, next) {
  try {
    const config = await commissionsService.saveDefaultCommissionConfig(req.body?.config || {}, req.authUser);
    res.json({
      ok: true,
      config
    });
  } catch (error) {
    next(error);
  }
}

async function lockCommissionMonth(req, res, next) {
  try {
    const data = await commissionsService.lockCommissionMonth(req.body?.month, req.authUser);
    res.json({
      ok: true,
      ...data
    });
  } catch (error) {
    next(error);
  }
}

async function getResourceRows(req, res, next) {
  try {
    const resource = req.params.resource;
    const eqFilters = {};

    Object.keys(req.query).forEach((key) => {
      if (!key.startsWith('eq_')) return;
      const field = key.slice(3);
      if (!field) return;
      eqFilters[field] = req.query[key];
    });

    const rows = await supabaseService.listRows(resource, {
      limit: req.query.limit,
      offset: req.query.offset,
      select: req.query.select,
      orderBy: req.query.orderBy,
      orderDir: req.query.orderDir,
      from: req.query.from,
      to: req.query.to,
      dateField: req.query.dateField,
      eqFilters
    });

    res.json({
      ok: true,
      resource: supabaseService.normalizeResourceName(resource),
      count: rows.length,
      rows
    });
  } catch (error) {
    next(error);
  }
}

async function getKpiCloserRules(req, res, next) {
  try {
    const rules = await supabaseService.getKpiCloserRules({
      anio: req.query.anio,
      mes: req.query.mes
    });

    res.json({
      ok: true,
      rules
    });
  } catch (error) {
    next(error);
  }
}

async function saveKpiCloserRules(req, res, next) {
  try {
    const rules = await supabaseService.upsertKpiCloserRules(req.body || {});

    res.json({
      ok: true,
      rules
    });
  } catch (error) {
    next(error);
  }
}

async function getReportesPremioConfig(req, res, next) {
  try {
    const config = await supabaseService.getReportesPremioConfig();

    res.json({
      ok: true,
      config
    });
  } catch (error) {
    next(error);
  }
}

async function saveReportesPremioConfig(req, res, next) {
  try {
    const config = await supabaseService.upsertReportesPremioConfig(req.body || {}, req.authUser);

    res.json({
      ok: true,
      config
    });
  } catch (error) {
    next(error);
  }
}

async function listReportComments(req, res, next) {
  try {
    const comments = await supabaseService.listReportComments({
      from: req.query.from,
      to: req.query.to,
      unread: req.query.unread
    }, req.authUser);

    res.json({
      ok: true,
      count: comments.length,
      comments
    });
  } catch (error) {
    next(error);
  }
}

async function createReportComment(req, res, next) {
  try {
    const comment = await supabaseService.createReportComment(req.body || {}, req.authUser);

    res.json({
      ok: true,
      comment
    });
  } catch (error) {
    next(error);
  }
}

async function markReportCommentRead(req, res, next) {
  try {
    const comment = await supabaseService.markReportCommentRead(req.params.id, req.authUser);

    res.json({
      ok: true,
      comment
    });
  } catch (error) {
    next(error);
  }
}

async function getMarketingInvestment(req, res, next) {
  try {
    const investment = await supabaseService.getMarketingInvestment({
      from: req.query.from,
      to: req.query.to,
      origen: req.query.origen
    });

    res.json({
      ok: true,
      investment
    });
  } catch (error) {
    next(error);
  }
}

async function saveMarketingInvestment(req, res, next) {
  try {
    const investment = await supabaseService.upsertMarketingInvestment(req.body || {});

    res.json({
      ok: true,
      investment
    });
  } catch (error) {
    next(error);
  }
}

async function listMarketingInvestments(req, res, next) {
  try {
    const rows = await supabaseService.listMarketingInvestments({
      from: req.query.from,
      to: req.query.to
    });

    res.json({
      ok: true,
      count: rows.length,
      rows
    });
  } catch (error) {
    next(error);
  }
}

async function updateMarketingInvestmentRecord(req, res, next) {
  try {
    const investment = await supabaseService.updateMarketingInvestmentRecord(req.body || {});

    res.json({
      ok: true,
      investment
    });
  } catch (error) {
    next(error);
  }
}

async function deleteMarketingInvestmentRecord(req, res, next) {
  try {
    const result = await supabaseService.deleteMarketingInvestmentRecord(req.body || {});

    res.json({
      ok: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
}

async function getMarketingAovDia1(req, res, next) {
  try {
    const data = await supabaseService.getMarketingAovDia1({
      from: req.query.from,
      to: req.query.to,
      origen: req.query.origen,
      estrategia: req.query.estrategia,
      closer: req.query.closer
    });

    res.json({
      ok: true,
      ...data
    });
  } catch (error) {
    next(error);
  }
}

async function askAssistant(req, res, next) {
  try {
    const result = await assistantService.askMetricAssistant(req.body?.question, req.body?.pageContext || {});
    res.json({
      ok: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
}

async function getMarketingVentasTotales(req, res, next) {
  try {
    const data = await supabaseService.getMarketingVentasTotales({
      from: req.query.from,
      to: req.query.to,
      origen: req.query.origen
    });

    res.json({
      ok: true,
      ...data
    });
  } catch (error) {
    next(error);
  }
}

async function getMarketingCashCollectedAgenda(req, res, next) {
  try {
    const data = await supabaseService.getMarketingCashCollectedAgenda({
      from: req.query.from,
      to: req.query.to,
      origen: req.query.origen
    });

    res.json({
      ok: true,
      ...data
    });
  } catch (error) {
    next(error);
  }
}

async function getMarketingCampaignTotals(req, res, next) {
  try {
    const rows = await supabaseService.getMarketingCampaignTotals({
      from: req.query.from,
      to: req.query.to,
      origen: req.query.origen
    });

    res.json({
      ok: true,
      count: rows.length,
      rows
    });
  } catch (error) {
    next(error);
  }
}

async function getCloserPersonalPdf(req, res, next) {
  try {
    const pdf = await supabaseService.getCloserPersonalPdf({
      closer: req.query.closer,
      month: req.query.month,
      filename: req.query.filename
    });

    res.json({
      ok: true,
      pdf
    });
  } catch (error) {
    next(error);
  }
}

async function uploadCloserPersonalPdf(req, res, next) {
  try {
    const pdf = await supabaseService.uploadCloserPersonalPdf({
      closer: req.query.closer,
      month: req.query.month,
      filename: req.query.filename
    }, Buffer.from(req.body || []), req.authUser);

    res.json({
      ok: true,
      pdf
    });
  } catch (error) {
    next(error);
  }
}

async function getDollarQuotes(req, res, next) {
  try {
    const response = await fetch('https://dolarapi.com/v1/dolares');
    if (!response.ok) {
      throw new Error(`No se pudo obtener cotizaciones (${response.status})`);
    }

    const rows = await response.json();
    const byCasa = new Map((rows || []).map((row) => [String(row.casa || '').toLowerCase(), row]));
    const pick = (casa) => byCasa.get(casa) || null;
    const oficial = pick('oficial');
    const blue = pick('blue');
    const mep = pick('bolsa');

    res.json({
      ok: true,
      quotes: {
        oficial: oficial ? {
          nombre: 'Dólar Oficial',
          compra: Number(oficial.compra || 0),
          venta: Number(oficial.venta || 0),
          fechaActualizacion: oficial.fechaActualizacion || null
        } : null,
        blue: blue ? {
          nombre: 'Dólar Blue',
          compra: Number(blue.compra || 0),
          venta: Number(blue.venta || 0),
          fechaActualizacion: blue.fechaActualizacion || null
        } : null,
        mep: mep ? {
          nombre: 'Dólar MEP',
          compra: Number(mep.compra || 0),
          venta: Number(mep.venta || 0),
          fechaActualizacion: mep.fechaActualizacion || null
        } : null
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getComprobantesLoaderBootstrap(req, res, next) {
  try {
    const bootstrap = await comprobantesLoaderService.getBootstrap(req.authUser);
    res.json({
      ok: true,
      bootstrap
    });
  } catch (error) {
    next(error);
  }
}

async function lookupComprobantesLoaderClient(req, res, next) {
  try {
    const client = await comprobantesLoaderService.lookupClientByGhlId(req.query.ghlId || req.query.url || '');
    res.json({
      ok: true,
      client
    });
  } catch (error) {
    next(error);
  }
}

async function lookupComprobantesLoaderRelatedSale(req, res, next) {
  try {
    const sale = await comprobantesLoaderService.lookupRelatedSaleById(req.query.saleId || req.query.id || '');
    res.json({
      ok: true,
      sale
    });
  } catch (error) {
    next(error);
  }
}

async function createComprobanteManual(req, res, next) {
  try {
    const result = await comprobantesLoaderService.createComprobante(req.body || {}, req.authUser);
    res.json({
      ok: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
}

async function generateCloserPersonalReport(req, res, next) {
  try {
    if (!access.canGenerateCloserAiReportForUser(req.authUser)) {
      const error = new Error('No tenés permiso para generar reportes de closers con GPT');
      error.statusCode = 403;
      throw error;
    }

    const report = await closerPersonalReportService.generateAndStoreCloserPersonalReport({
      closer: req.body?.closer,
      month: req.body?.month
    }, req.authUser);

    res.json({
      ok: true,
      report
    });
  } catch (error) {
    next(error);
  }
}

async function getCloserPersonalReport(req, res, next) {
  try {
    const stored = await closerPersonalReportService.getStoredCloserPersonalReport({
      closer: req.query.closer,
      month: req.query.month
    });

    res.json({
      ok: true,
      exists: Boolean(stored?.exists),
      report: stored?.report || null
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  health,
  getCommissionConfig,
  getCommissionsDashboard,
  getCommissionPersonDetail,
  saveCommissionConfig,
  saveDefaultCommissionConfig,
  lockCommissionMonth,
  getOperationalAlertsData,
  getResources,
  getResourceRows,
  getKpiCloserRules,
  saveKpiCloserRules,
  getReportesPremioConfig,
  saveReportesPremioConfig,
  listReportComments,
  createReportComment,
  markReportCommentRead,
  getMarketingInvestment,
  saveMarketingInvestment,
  listMarketingInvestments,
  updateMarketingInvestmentRecord,
  deleteMarketingInvestmentRecord,
  getMarketingAovDia1,
  getMarketingVentasTotales,
  getMarketingCashCollectedAgenda,
  getMarketingCampaignTotals,
  getCloserPersonalPdf,
  uploadCloserPersonalPdf,
  getDollarQuotes,
  askAssistant,
  getComprobantesLoaderBootstrap,
  lookupComprobantesLoaderClient,
  lookupComprobantesLoaderRelatedSale,
  createComprobanteManual,
  generateCloserPersonalReport,
  getCloserPersonalReport
};
