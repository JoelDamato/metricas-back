const supabaseService = require('../services/supabase.service');
const assistantService = require('../services/assistant.service');

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
      estrategia: req.query.estrategia
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

module.exports = {
  health,
  getResources,
  getResourceRows,
  getKpiCloserRules,
  saveKpiCloserRules,
  getMarketingInvestment,
  saveMarketingInvestment,
  listMarketingInvestments,
  updateMarketingInvestmentRecord,
  deleteMarketingInvestmentRecord,
  getMarketingAovDia1,
  getMarketingVentasTotales,
  askAssistant
};
