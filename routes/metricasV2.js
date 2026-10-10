const express = require('express');
const multer = require('multer');
const controller = require('../modules/metricasv2/controllers/metricas.controller');
const authController = require('../modules/metricasv2/controllers/auth.controller');

const router = express.Router();
router.use('/settlements',require('../modules/settlements/router'));
router.use('/training', require('../modules/training/router').privateRouter());
router.use('/recordings', require('../modules/recordings/router').createRouter());
router.use('/tickets', require('../modules/tickets/router'));
const comprobanteAttachments = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 12,
    fields: 4,
    fieldSize: 1024 * 1024
  }
});

router.get('/auth/session', authController.session);
router.post('/auth/login', authController.login);
router.post('/auth/logout', authController.logout);
router.get('/auth/users', authController.listUsers);
router.post('/auth/users', authController.createUser);
router.patch('/auth/users/:id', authController.updateUser);
router.patch('/auth/users/:id/password', authController.updateUserPassword);
router.delete('/auth/users/:id', authController.deleteUser);
router.get('/health', controller.health);
const csmFollowup = require('../modules/csm/followup');
router.get('/csm-followup', csmFollowup.list);
router.put('/csm-followup/:ghlid', csmFollowup.save);
router.put('/csm-followup-rules/:stage', csmFollowup.saveRule);
router.get('/diagnosticos', controller.listDiagnosticos);
router.get('/diagnosticos/clientes-csm', controller.listDiagnosticoClients);
router.post('/diagnosticos', controller.createDiagnostico);
router.patch('/diagnosticos/:id', controller.updateDiagnostico);
router.delete('/diagnosticos/:id', controller.deleteDiagnostico);
router.get('/commissions/dashboard', controller.getCommissionsDashboard);
router.get('/commissions/person', controller.getCommissionPersonDetail);
router.get('/commercial-area', controller.getMyCommercialArea);
router.get('/pdi', controller.listPdiRecords);
router.post('/pdi', controller.upsertPdiRecord);
router.delete('/pdi/:closerKey', controller.deletePdiRecord);
router.get('/commissions/config', controller.getCommissionConfig);
router.post('/commissions/config', controller.saveCommissionConfig);
router.post('/commissions/config/default', controller.saveDefaultCommissionConfig);
router.post('/commissions/config/lock', controller.lockCommissionMonth);
router.get('/alertas-operativas', controller.getOperationalAlertsData);
router.get('/views', controller.getResources);
router.get('/views/:resource', controller.getResourceRows);
router.get('/kpi-closers/rules', controller.getKpiCloserRules);
router.post('/kpi-closers/rules', controller.saveKpiCloserRules);
router.get('/agenda-bonus/rules', controller.getAgendaBonusRules);
router.post('/agenda-bonus/rules', controller.saveAgendaBonusRules);
router.get('/agenda-calendar/assignments', controller.listAgendaCalendarAssignments);
router.post('/agenda-calendar/assignments', controller.saveAgendaCalendarAssignment);
router.get('/agenda-checkpoints', controller.getAgendaCheckpoints);
router.post('/agenda-checkpoints', controller.saveAgendaCheckpoint);
router.get('/reportes/premio', controller.getReportesPremioConfig);
router.post('/reportes/premio', controller.saveReportesPremioConfig);
router.get('/reportes/comentarios', controller.listReportComments);
router.post('/reportes/comentarios', controller.createReportComment);
router.patch('/reportes/comentarios/:id/read', controller.markReportCommentRead);
router.get('/marketing/origins',async(req,res,next)=>{try{res.set('Cache-Control','no-store').json(await require('../modules/metricasv2/services/supabase.service').getMarketingOrigins());}catch(error){next(error);}});
router.get('/marketing/dashboard',async(req,res,next)=>{try{res.set('Cache-Control','no-store').json(await require('../modules/metricasv2/services/supabase.service').getMarketingDashboard({from:req.query.from,to:req.query.to,origen:req.query.origen||''}));}catch(error){next(error);}});
router.get('/marketing/inversion', controller.getMarketingInvestment);
router.post('/marketing/inversion', controller.saveMarketingInvestment);
router.get('/marketing/inversiones', controller.listMarketingInvestments);
router.patch('/marketing/inversiones', controller.updateMarketingInvestmentRecord);
router.delete('/marketing/inversiones', controller.deleteMarketingInvestmentRecord);
router.get('/marketing/aov-dia-1', controller.getMarketingAovDia1);
router.get('/marketing/ventas-totales', controller.getMarketingVentasTotales);
router.get('/mercado-pago/club', controller.getMercadoPagoClubRecords);
router.get('/mercado-pago/club/workflow', controller.getStoredMercadoPagoClubRecords);
router.post('/mercado-pago/club/manual', controller.createManualInvoiceRecord);
router.patch('/mercado-pago/club/manual/:id', controller.updateManualInvoiceRecord);
router.delete('/mercado-pago/club/manual/:id', controller.deleteManualInvoiceRecord);
router.patch('/mercado-pago/club/recipient/:kind/:id', controller.updateMercadoPagoClubRecipient);
router.post('/mercado-pago/club/reconcile', controller.reconcileMercadoPagoClubRecords);
router.post('/mercado-pago/club/billing-selection', async (req,res,next) => {
  try {res.json({ok:true,...await require('../modules/metricasv2/services/mercado-pago.service').setBillingSelection(req.body?.keys,req.body?.excluded,req.authUser)});}
  catch(error){next(error);}
});
router.post('/mercado-pago/club/unreconcile', controller.unreconcileMercadoPagoClubRecord);
router.post('/mercado-pago/club/invoice-preview', controller.previewMercadoPagoClubInvoices);
router.post('/mercado-pago/club/invoice', controller.invoiceMercadoPagoClubRecords);
router.get('/mercado-pago/club/invoice/:kind/:id', controller.viewMercadoPagoClubInvoice);
router.post('/mercado-pago/club/credit-note', controller.creditNoteMercadoPagoClubInvoice);
router.get('/marketing/cash-collected-agenda', controller.getMarketingCashCollectedAgenda);
router.get('/marketing/campaign-totales', controller.getMarketingCampaignTotals);
router.get('/utm-builder/presets', controller.listUtmBuilderPresets);
router.post('/utm-builder/presets', controller.saveUtmBuilderPreset);
router.delete('/utm-builder/presets', controller.deleteUtmBuilderPreset);
router.get('/reportes-personales/pdf', controller.getCloserPersonalPdf);
router.post('/reportes-personales/pdf', express.raw({ type: ['application/pdf', 'application/octet-stream'], limit: '20mb' }), controller.uploadCloserPersonalPdf);
router.get('/dolar-hoy', controller.getDollarQuotes);
router.get('/comprobantes-loader/bootstrap', controller.getComprobantesLoaderBootstrap);
router.get('/comprobantes-direct/config', controller.getComprobantesDirectConfig);
router.put('/comprobantes-direct/config', controller.saveComprobantesDirectConfig);
router.get('/comprobantes-direct/storage-cleanup', controller.getComprobantesStorageCleanup);
router.post('/comprobantes-direct/storage-cleanup/retry', controller.retryComprobantesStorageCleanup);
router.post(
  '/comprobantes-direct/preview',
  comprobanteAttachments.array('attachmentFiles', 12),
  controller.previewComprobanteDirect
);
router.post(
  '/comprobantes-direct/create',
  comprobanteAttachments.array('attachmentFiles', 12),
  controller.createComprobanteDirect
);
router.get('/comprobantes-loader/mine', controller.listMyComprobantes);
router.get('/comprobantes-loader/cliente', controller.lookupComprobantesLoaderClient);
router.get('/comprobantes-loader/venta-relacionada', controller.lookupComprobantesLoaderRelatedSale);
router.get('/comprobantes-loader/:id/editable', controller.getEditableComprobante);
router.get('/comprobantes-loader/:id/files', controller.listComprobanteFiles);
router.post(
  '/comprobantes-loader',
  comprobanteAttachments.array('attachmentFiles', 12),
  controller.createComprobanteManual
);
router.patch('/comprobantes-loader/:id', controller.updateEditableComprobante);
router.delete('/comprobantes-loader/:id', controller.deleteEditableComprobante);
router.get('/comprobantes-reconciliation', controller.listReconciliationComprobantes);
router.patch('/comprobantes-reconciliation/:id/note', async (req,res,next) => { try { const result=await require('../modules/metricasv2/services/comprobantes-reconciliation.service').saveReconciliationNote(req.params.id,req.body,req.authUser); res.json({ok:true,...result}); } catch(error) { next(error); } });
router.patch('/comprobantes-reconciliation/:id', controller.updateReconciliationComprobante);
router.post('/assistant/ask', controller.askAssistant);
router.get('/closers/personal-report', controller.getCloserPersonalReport);
router.post('/closers/personal-report', controller.generateCloserPersonalReport);
router.get('/closers/team-report', controller.getCloserTeamReport);
router.post('/closers/team-report', controller.generateCloserTeamReport);

module.exports = router;
