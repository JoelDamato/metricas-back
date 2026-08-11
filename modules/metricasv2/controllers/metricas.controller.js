const supabaseService = require('../services/supabase.service');
const assistantService = require('../services/assistant.service');
const comprobantesLoaderService = require('../services/comprobantes-loader.service');
const closerPersonalReportService = require('../services/closer-personal-report.service');
const mercadoPagoService = require('../services/mercado-pago.service');
const arcaPdfService = require('../services/arca-pdf.service');
const commissionsService = require('../services/commissions.service');
const diagnosticosService = require('../services/diagnosticos.service');
const access = require('../../auth/access');

async function health(req, res) {
  res.json({
    ok: true,
    service: 'metricas',
    date: new Date().toISOString()
  });
}

async function listDiagnosticos(req, res, next) {
  try { res.json({ ok: true, diagnosticos: await diagnosticosService.listDiagnosticos() }); } catch (error) { next(error); }
}

async function createDiagnostico(req, res, next) {
  try { res.json({ ok: true, diagnostico: await diagnosticosService.createDiagnostico(req.body || {}, req.authUser) }); } catch (error) { next(error); }
}

async function updateDiagnostico(req, res, next) {
  try { res.json({ ok: true, diagnostico: await diagnosticosService.updateDiagnostico(req.params.id, req.body || {}, req.authUser) }); } catch (error) { next(error); }
}

async function deleteDiagnostico(req, res, next) {
  try { res.json({ ok: true, ...(await diagnosticosService.deleteDiagnostico(req.params.id)) }); } catch (error) { next(error); }
}

async function getPublicDiagnostico(req, res, next) {
  try { res.json({ ok: true, diagnostico: await diagnosticosService.getPublicDiagnostico(req.params.token) }); } catch (error) { next(error); }
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
        select: 'creado_por,responsable_venta,estado,tipo,producto_format,f_venta,f_acreditacion,facturacion,cash_collected_neto_total,cash_collected_neto,cash_collected_total,cash_collected,ghlid'
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

async function getAgendaBonusRules(req, res, next) {
  try {
    const rules = await supabaseService.getAgendaBonusRules({
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

async function saveAgendaBonusRules(req, res, next) {
  try {
    const rules = await supabaseService.upsertAgendaBonusRules(req.body || {}, req.authUser);

    res.json({
      ok: true,
      rules
    });
  } catch (error) {
    next(error);
  }
}

async function listAgendaCalendarAssignments(req, res, next) {
  try {
    const assignments = await supabaseService.listAgendaCalendarAssignments({
      anio: req.query.anio,
      mes: req.query.mes
    });

    res.json({
      ok: true,
      assignments
    });
  } catch (error) {
    next(error);
  }
}

async function saveAgendaCalendarAssignment(req, res, next) {
  try {
    const assignment = await supabaseService.upsertAgendaCalendarAssignment(req.body || {}, req.authUser);

    res.json({
      ok: true,
      assignment
    });
  } catch (error) {
    next(error);
  }
}

async function getAgendaCheckpoints(req, res, next) {
  try {
    const area = String(req.query.area || '').trim().toLowerCase() === 'csm' ? 'csm' : 'agendas';
    const checkpoints = await supabaseService.getAgendaCheckpoints({
      anio: req.query.anio,
      mes: req.query.mes,
      area
    });
    const csmReport = area === 'csm'
      ? await supabaseService.getCsmCheckpointReport({
        anio: checkpoints.anio,
        mes: checkpoints.mes,
        current: checkpoints
      })
      : null;

    res.json({
      ok: true,
      ...checkpoints,
      ...(csmReport ? { csmReport } : {}),
      canEdit: area === 'csm'
        ? access.canEditCsmCheckpointsForUser(req.authUser)
        : access.canEditAgendaCheckpointsForUser(req.authUser)
    });
  } catch (error) {
    next(error);
  }
}

async function saveAgendaCheckpoint(req, res, next) {
  try {
    const area = String(req.body?.area || '').trim().toLowerCase() === 'csm' ? 'csm' : 'agendas';
    const canEdit = area === 'csm'
      ? access.canEditCsmCheckpointsForUser(req.authUser)
      : access.canEditAgendaCheckpointsForUser(req.authUser);
    if (!canEdit) {
      return res.status(403).json({
        ok: false,
        message: area === 'csm'
          ? 'Solo Belén Herrera o Mati pueden cargar o eliminar checks y strikes de CSM'
          : 'Solo Leo o Mati pueden cargar o eliminar checks, strikes y pendientes'
      });
    }

    const checkpoints = await supabaseService.updateAgendaCheckpoint({
      ...(req.body || {}),
      area
    }, req.authUser);
    const csmReport = area === 'csm'
      ? await supabaseService.getCsmCheckpointReport({
        anio: checkpoints.anio,
        mes: checkpoints.mes,
        current: checkpoints
      })
      : null;

    res.json({
      ok: true,
      ...checkpoints,
      ...(csmReport ? { csmReport } : {}),
      canEdit: true
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
    const sale = await comprobantesLoaderService.lookupRelatedSaleById(
      req.query.saleId || req.query.id || '',
      {
        ghlId: req.query.ghlId || '',
        clientPageId: req.query.clientPageId || ''
      }
    );
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

async function getEditableComprobante(req, res, next) {
  try {
    const comprobante = await comprobantesLoaderService.getEditableComprobante(req.params.id, req.authUser);
    res.json({ ok: true, comprobante });
  } catch (error) {
    next(error);
  }
}

async function updateEditableComprobante(req, res, next) {
  try {
    const result = await comprobantesLoaderService.updateEditableComprobante(req.params.id, req.body || {}, req.authUser);
    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
}

async function deleteEditableComprobante(req, res, next) {
  try {
    const result = await comprobantesLoaderService.deleteEditableComprobante(req.params.id, req.authUser);
    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
}

async function listMyComprobantes(req, res, next) {
  try {
    const result = await comprobantesLoaderService.listMyComprobantes(req.authUser, {
      limit: req.query.limit,
      responsible: req.query.responsible
    });
    res.json({
      ok: true,
      responsibleName: result.responsibleName,
      canViewAll: result.canViewAll === true,
      canViewBySetter: result.canViewBySetter === true,
      selectedResponsible: result.selectedResponsible || result.responsibleName,
      responsibleOptions: result.responsibleOptions || [],
      count: result.rows.length,
      rows: result.rows
    });
  } catch (error) {
    next(error);
  }
}

async function listUtmBuilderPresets(req, res, next) {
  try {
    const presets = await supabaseService.listUtmLinkPresets({
      key: req.query.key
    });

    res.json({
      ok: true,
      presets
    });
  } catch (error) {
    next(error);
  }
}

async function saveUtmBuilderPreset(req, res, next) {
  try {
    const preset = await supabaseService.upsertUtmLinkPreset(req.body || {}, req.authUser);
    res.json({
      ok: true,
      preset
    });
  } catch (error) {
    next(error);
  }
}

async function deleteUtmBuilderPreset(req, res, next) {
  try {
    const result = await supabaseService.deleteUtmLinkPreset(req.body || {});
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function receiveContactoInstagramWebhook(req, res, next) {
  try {
    if (String(req.body?.action || '').trim().toLowerCase() === 'search') {
      const result = await supabaseService.searchContactoInstagramWebhook(req.body || {});
      res.json({
        ok: true,
        exists: result.exists,
        contact: result.contact
      });
      return;
    }

    const contact = await supabaseService.upsertContactoInstagramWebhook(req.body || {});
    res.json({
      ok: true,
      contact
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
      month: req.body?.month,
      additionalPrompt: req.body?.additionalPrompt
    }, req.authUser);

    res.set('Cache-Control', 'no-store, max-age=0');
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

    res.set('Cache-Control', 'no-store, max-age=0');
    res.json({
      ok: true,
      exists: Boolean(stored?.exists),
      report: stored?.report || null
    });
  } catch (error) {
    next(error);
  }
}

async function getMercadoPagoClubRecords(req, res, next) {
  try {
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const data = await mercadoPagoService.getClubRecords(req.query.month || defaultMonth);
    res.json({ ok: true, ...data });
  } catch (error) {
    next(error);
  }
}

async function getStoredMercadoPagoClubRecords(req, res, next) {
  try {
    const data = await mercadoPagoService.getStoredWorkflowRecords(req.query.month, req.query.status);
    res.json({ ok: true, ...data });
  } catch (error) {
    next(error);
  }
}

async function createManualInvoiceRecord(req, res, next) {
  try {
    const record = await mercadoPagoService.createManualInvoiceRecord(req.body || {}, req.authUser);
    res.json({ ok: true, record });
  } catch (error) {
    next(error);
  }
}

async function updateManualInvoiceRecord(req, res, next) {
  try { res.json({ ok: true, record: await mercadoPagoService.updateManualInvoiceRecord(req.params.id, req.body || {}) }); } catch (error) { next(error); }
}
async function deleteManualInvoiceRecord(req, res, next) {
  try { res.json({ ok: true, ...(await mercadoPagoService.deleteManualInvoiceRecord(req.params.id)) }); } catch (error) { next(error); }
}

async function updateMercadoPagoClubRecipient(req, res, next) {
  try {
    const record = await mercadoPagoService.updateInvoiceRecipient(req.params.kind, req.params.id, req.body || {});
    res.json({ ok: true, record });
  } catch (error) {
    next(error);
  }
}

async function reconcileMercadoPagoClubRecords(req, res, next) {
  try {
    const result = await mercadoPagoService.reconcileRecords(req.body?.records, req.authUser);
    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
}

async function unreconcileMercadoPagoClubRecord(req, res, next) {
  try {
    const result = await mercadoPagoService.unreconcileRecord(req.body || {});
    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
}

async function invoiceMercadoPagoClubRecords(req, res, next) {
  try {
    const result = await mercadoPagoService.invoiceRecords(req.body?.records, req.authUser);
    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
}

async function previewMercadoPagoClubInvoices(req, res, next) {
  try {
    const result = await mercadoPagoService.previewInvoiceRecords(req.body?.records);
    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
}

async function creditNoteMercadoPagoClubInvoice(req, res, next) {
  try {
    const result = await mercadoPagoService.issueCreditNote(req.body || {}, req.authUser);
    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
}

function escapeInvoiceHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function arcaDateLabel(value) {
  const text = String(value || '');
  return /^\d{8}$/.test(text) ? `${text.slice(6, 8)}/${text.slice(4, 6)}/${text.slice(0, 4)}` : text;
}

function invoiceDateLabel(value) {
  if (!value) return 'No informado';
  const text = String(value);
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T12:00:00Z` : text;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? arcaDateLabel(text) : date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
}

function invoiceDisplayDates(row, arca) {
  const issued = new Date(arca.issuedAt || row.invoiced_at);
  const safeIssued = Number.isNaN(issued.getTime()) ? new Date() : issued;
  const serviceFrom = arca.serviceFrom || new Date(Date.UTC(safeIssued.getUTCFullYear(), safeIssued.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const serviceTo = arca.serviceTo || new Date(Date.UTC(safeIssued.getUTCFullYear(), safeIssued.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  return {
    issued: invoiceDateLabel(arca.issuedAt || row.invoiced_at),
    serviceFrom: invoiceDateLabel(serviceFrom),
    serviceTo: invoiceDateLabel(serviceTo),
    paymentDueDate: invoiceDateLabel(arca.paymentDueDate || arca.issuedAt || row.invoiced_at)
  };
}

async function viewMercadoPagoClubInvoice(req, res, next) {
  try {
    const row = await mercadoPagoService.getInvoiceRecord(req.params.kind, req.params.id);
    if (req.query.format === 'pdf') {
      const pdf = await arcaPdfService.createInvoicePdf(row);
      res.set('Content-Disposition', `inline; filename="factura-${row.arca_invoice_number || row.record_id}.pdf"`);
      return res.type('application/pdf').send(pdf);
    }
    const record = row.record_snapshot || {};
    const arca = row.arca_response || {};
    const invoiceType = String(arca.invoiceType || 'B').toUpperCase();
    const formatMoney = (value) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(value || 0));
    const total = Number(arca.amounts?.total || record.amount || arca.amount || 0);
    const net = Number(arca.amounts?.net || 0);
    const exempt = Number(arca.amounts?.exempt ?? (arca.taxTreatment === 'Exento' ? total : 0));
    const vat = Number(arca.amounts?.vat || 0);
    const isTaxed = vat > 0;
    const unitPrice = isTaxed ? net : total;
    const dates = invoiceDisplayDates(row, arca);
    const [pointOfSale = '00005', invoiceNumber = ''] = String(row.arca_invoice_number || '00005-').split('-');
    const documentType = String(record.identificationType || (Number(arca.documentType) === 80 ? 'CUIT' : Number(arca.documentType) === 96 ? 'DNI' : 'Documento'));
    const recipientName = arca.recipientName || record.payer || 'Consumidor final';
    const recipientAddress = arca.recipientAddress || record.payerAddress || 'No informado';
    const legends = [
      arca.showMonotributoLegend ? `<section class="legend"><strong>Ley N.º 27.618</strong><p>${escapeInvoiceHtml(arca.legends?.[0] || '')}</p></section>` : '',
      arca.showTransparency ? `<section class="legend"><strong>Régimen de Transparencia Fiscal al Consumidor (Ley 27.743)</strong><p>IVA CONTENIDO: ${escapeInvoiceHtml(formatMoney(vat))}<br>OTROS IMPUESTOS NACIONALES INDIRECTOS: ${escapeInvoiceHtml(formatMoney(0))}</p></section>` : ''
    ].join('');
    res.type('html').send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Factura ${escapeInvoiceHtml(invoiceType)} ${escapeInvoiceHtml(row.arca_invoice_number)}</title><style>
      body{margin:0;background:#eef1f5;color:#20242c;font-family:Arial,sans-serif}.page{width:min(820px,calc(100% - 32px));margin:28px auto;background:#fff;padding:38px;box-sizing:border-box;box-shadow:0 10px 35px #17203320}.header{display:grid;grid-template-columns:1fr 72px 1fr;border:1px solid #333}.header>div{padding:20px}.brand img{display:block;width:120px;max-height:82px;object-fit:contain;margin-bottom:10px}.brand p,.right p{font-size:12px;line-height:1.45}.letter{display:grid;place-items:center;align-self:start;margin-top:-1px;border:1px solid #333;font-size:34px;font-weight:700}.right{border-left:1px solid #333}.title{font-size:25px;font-weight:700}.muted{color:#626b78}.customer{margin-top:18px;padding:18px;border:1px solid #555;background:#fafafa;display:grid;grid-template-columns:1fr 1fr;gap:20px}.customer-left-stack,.customer-right-stack{display:grid;gap:12px;align-content:start}.detail{width:100%;margin-top:22px;border-collapse:collapse}.detail th,.detail td{padding:13px;border:1px solid #777;text-align:left}.detail th{background:#00112f;color:#fff}.amount{text-align:right!important;font-weight:700}.totals{width:330px;margin:24px 0 24px auto;border:1px solid #555;padding:16px}.totals p{display:flex;justify-content:space-between;margin:8px 0}.total{font-size:20px;font-weight:700}.legend{margin:12px 0;padding:13px 15px;border:1px solid #b8c1d1;border-radius:6px;background:#f6f8fc;font-size:12px}.legend p{margin:7px 0 0}.cae{border-top:2px solid #333;padding-top:18px}.actions{display:flex;gap:10px;margin:20px auto;width:min(820px,calc(100% - 32px))}.actions button,.actions a{border:0;border-radius:8px;padding:11px 16px;background:#1267c4;color:#fff;text-decoration:none;font-weight:700;cursor:pointer}@media print{body{background:#fff}.page{margin:0;width:100%;box-shadow:none}.actions{display:none}}
    </style></head><body><div class="actions"><a href="/views/mercado-pago-club.html">← Volver</a><button onclick="window.print()">Imprimir / Guardar PDF</button></div><main class="page">
      <section class="header"><div class="brand"><img src="/assets/club-del-costo-logo.png" alt="Club del Costo"><strong>RANDAZZO MATIAS HERNAN</strong><p class="muted">Domicilio Comercial: Brown Almte Av. 706 Piso 9 Dpto A - Ciudad de Buenos Aires<br>Condición frente al IVA: Responsable Inscripto<br>CUIT: 20-34813700-0<br>Ingresos Brutos: 20348137000<br>Fecha de Inicio de Actividades: 01/06/2021</p></div><div class="letter">${escapeInvoiceHtml(invoiceType)}</div><div class="right"><div class="title">FACTURA</div><p>Punto de Venta: <strong>${escapeInvoiceHtml(pointOfSale)}</strong><br>Comp. Nro.: <strong>${escapeInvoiceHtml(invoiceNumber)}</strong></p><p>Fecha de Emisión: <strong>${escapeInvoiceHtml(dates.issued)}</strong></p><p>Período Facturado Desde: <strong>${escapeInvoiceHtml(dates.serviceFrom)}</strong><br>Hasta: <strong>${escapeInvoiceHtml(dates.serviceTo)}</strong></p><p>Fecha de Vto. para el pago: <strong>${escapeInvoiceHtml(dates.paymentDueDate)}</strong></p></div></section>
      <section class="customer"><div class="customer-left-stack"><div><strong>Apellido y Nombre / Razón Social</strong><br>${escapeInvoiceHtml(recipientName)}</div><div><strong>Domicilio Comercial</strong><br>${escapeInvoiceHtml(recipientAddress)}</div><div><strong>${escapeInvoiceHtml(documentType)}:</strong><br>${escapeInvoiceHtml(record.identificationNumber || arca.documentNumber || 'No informado')}</div></div><div class="customer-right-stack"><div><strong>Condición IVA</strong><br>${escapeInvoiceHtml(arca.vatCondition || 'Consumidor Final')}</div><div><strong>Condición de venta</strong><br>${escapeInvoiceHtml(record.paymentMethod || 'Mercado Pago')}</div></div></section>
      <table class="detail"><thead><tr><th>Cantidad</th><th>Descripción</th><th>Precio unitario</th><th>Subtotal</th></tr></thead><tbody><tr><td>1</td><td>${escapeInvoiceHtml(arca.description || record.description || 'Suscripción Club del Costo')}</td><td class="amount">${escapeInvoiceHtml(formatMoney(unitPrice))}</td><td class="amount">${escapeInvoiceHtml(formatMoney(unitPrice))}</td></tr></tbody></table>
      <section class="totals">${isTaxed ? `<p><span>Subtotal gravado</span><strong>${escapeInvoiceHtml(formatMoney(net))}</strong></p><p><span>IVA (21%)</span><strong>${escapeInvoiceHtml(formatMoney(vat))}</strong></p>` : `<p><span>Importe exento</span><strong>${escapeInvoiceHtml(formatMoney(exempt))}</strong></p>`}<p class="total"><span>TOTAL</span><span>${escapeInvoiceHtml(formatMoney(total))}</span></p></section>
      ${legends}
      <section class="cae"><h3>Comprobante autorizado por ARCA</h3><p>CAE: <strong>${escapeInvoiceHtml(row.arca_cae)}</strong></p><p>Vencimiento CAE: <strong>${escapeInvoiceHtml(arcaDateLabel(arca.caeExpiration))}</strong></p><p class="muted">Operación Mercado Pago N.º ${escapeInvoiceHtml(row.record_id)}</p></section>
    </main></body></html>`);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listDiagnosticos,
  createDiagnostico,
  updateDiagnostico,
  deleteDiagnostico,
  getPublicDiagnostico,
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
  getAgendaBonusRules,
  saveAgendaBonusRules,
  listAgendaCalendarAssignments,
  saveAgendaCalendarAssignment,
  getAgendaCheckpoints,
  saveAgendaCheckpoint,
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
  getEditableComprobante,
  updateEditableComprobante,
  deleteEditableComprobante,
  listMyComprobantes,
  listUtmBuilderPresets,
  saveUtmBuilderPreset,
  deleteUtmBuilderPreset,
  receiveContactoInstagramWebhook,
  generateCloserPersonalReport,
  getCloserPersonalReport,
  getMercadoPagoClubRecords,
  getStoredMercadoPagoClubRecords,
  createManualInvoiceRecord,
  updateManualInvoiceRecord,
  deleteManualInvoiceRecord,
  updateMercadoPagoClubRecipient,
  reconcileMercadoPagoClubRecords,
  unreconcileMercadoPagoClubRecord,
  previewMercadoPagoClubInvoices,
  invoiceMercadoPagoClubRecords,
  viewMercadoPagoClubInvoice,
  creditNoteMercadoPagoClubInvoice
};
