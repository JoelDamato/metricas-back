const axios = require('axios');
const crypto = require('crypto');
const env = require('../config/env');
const auditedPaymentMethods = require('../config/comprobantes-payment-methods.audit.json');
const comprobantesLoaderService = require('./comprobantes-loader.service');

const LAB_ALLOWED_EMAILS = new Set([
  'matirandazzo@gmail.com',
  'nadia.cavallini@gmail.com'
]);

const MAX_BATCH_OPERATIONS = 6;
const DEFAULT_STORAGE_BUCKET = 'comprobantes';
const EXPECTED_AUDITED_PAYMENT_METHODS = 51;
const EXPECTED_HISTORICAL_FILES = 1166;

const DEFAULT_PRODUCTS = [
  { legacyNotionId: '33d48251-7a95-806e-96d5-cd8cdaa81bc0', code: 'consultoria', name: 'Consultoria', active: true, clubPrices: [] },
  { legacyNotionId: '33848251-7a95-80c5-92e6-ebb958f11d09', code: 'costos-rentables', name: 'Costos Rentables', active: true, clubPrices: [] },
  { legacyNotionId: '2d848251-7a95-8022-ab0a-f90cb7f54946', code: 'solo-sesiones', name: 'Solo sesiones', active: true, clubPrices: [] },
  { legacyNotionId: '2d848251-7a95-80f3-8e0b-c986abc4fe96', code: 'renovacion-programa-sesiones', name: 'Renovacion programa + Sesiones', active: true, clubPrices: [] },
  { legacyNotionId: '2d848251-7a95-800f-931a-f716f9739bd6', code: 'renovacion-programa', name: 'Renovacion programa', active: true, clubPrices: [] },
  { legacyNotionId: '2aa48251-7a95-803b-aa68-e03fbd79a5a9', code: 'renovacion-meg-personalizado', name: 'Renovacion - Meg Personalizado', active: true, clubPrices: [] },
  {
    legacyNotionId: '29f48251-7a95-800d-9168-fefc4ff0ff16',
    code: 'club',
    name: 'Club',
    active: true,
    clubPrices: [
      { key: 'club1', label: 'Precio Club 1', amountArs: 39500 },
      { key: 'club2', label: 'Precio Club 2', amountArs: 25000 }
    ]
  },
  { legacyNotionId: '29548251-7a95-80a7-859e-ec830d76e1b9', code: 'reportes-financieros', name: 'Reportes Financieros', active: true, clubPrices: [] },
  { legacyNotionId: '29548251-7a95-807d-93bf-d2b153268b6d', code: 'meg-personalizado', name: 'Meg Personalizado', active: true, clubPrices: [] },
  { legacyNotionId: '29548251-7a95-8053-b6a0-c6ed814217b7', code: 'meg-1-0', name: 'Meg 1.0', active: false, clubPrices: [] },
  { legacyNotionId: '29548251-7a95-80c5-a22c-fcde26e622d4', code: 'meg-2-0', name: 'Meg 2.0', active: false, clubPrices: [] },
  { legacyNotionId: '29548251-7a95-8007-a319-f3275e93edde', code: 'meg-2-1', name: 'Meg 2.1', active: true, clubPrices: [] },
  { legacyNotionId: '29548251-7a95-806b-acb7-d56534ebd3fa', code: 'renovacion-meg-2-1', name: 'Renovacion - Meg 2.1', active: true, clubPrices: [] },
  { legacyNotionId: '29548251-7a95-803f-b8c7-d1a9890b7010', code: 'renovacion-meg-2-0', name: 'Renovacion - Meg 2.0', active: false, clubPrices: [] },
  { legacyNotionId: '28048251-7a95-8038-9b18-ff1f0543a3b6', code: 'renovacion-meg-1-0', name: 'Renovacion - Meg 1.0', active: false, clubPrices: [] }
];

const DEFAULT_PAYMENT_METHODS = auditedPaymentMethods.map((item) => ({ ...item }));

const DEFAULT_RESPONSIBLE_PEOPLE = [
  ['91000000-0000-4000-8000-000000000001', 'mauro-gaitan', 'Mauro Gaitan', 'gaitanmauro23@gmail.com', 'Closer'],
  ['91000000-0000-4000-8000-000000000002', 'carlos-tu', 'Carlos Tu', 'charliecarlostu@gmail.com', 'Closer'],
  ['91000000-0000-4000-8000-000000000003', 'walter-alegre', 'Walter Alegre', 'walteralegre56@gmail.com', 'Closer'],
  ['91000000-0000-4000-8000-000000000004', 'patricia-conti', 'Patricia Conti', 'posadaelmontecito@gmail.com', 'Closer'],
  ['91000000-0000-4000-8000-000000000005', 'pablo-butera', 'Pablo Butera', 'pmbutera1234@gmail.com', 'Closer'],
  ['91000000-0000-4000-8000-000000000006', 'claudio-nicolini', 'Claudio Nicolini', 'meg.claudionicolini@gmail.com', 'Closer'],
  ['91000000-0000-4000-8000-000000000007', 'nahuel-iasci', 'Nahuel Iasci', 'iascinahuel@gmail.com', 'Setter'],
  ['91000000-0000-4000-8000-000000000008', 'mati-randazzo', 'Mati Randazzo', 'matirandazzo@gmail.com', 'Ambos'],
  ['91000000-0000-4000-8000-000000000009', 'nadia-cavallini', 'Nadia Cavallini', 'nadia.cavallini@gmail.com', 'Ambos']
].map(([id, code, name, email, role]) => ({ id, code, name, email, role, active: true }));

const DEFAULT_RULES = {
  clubVatRate: 0.21,
  clubProcessorRate: 0.0629,
  clubIibbRate: 0.035,
  relatedSaleRequiredFor: ['Cobranza', 'Devolución'],
  maxBatchOperations: MAX_BATCH_OPERATIONS,
  cutoverChecklist: {
    csmRuleStatus: 'pending',
    arcaControlStatus: 'pending',
    historicalFilesVerified: false,
    historicalReconciliationVerified: false,
    observationWindowCompleted: false
  }
};

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function defaultConfig() {
  return {
    products: clone(DEFAULT_PRODUCTS),
    paymentMethods: clone(DEFAULT_PAYMENT_METHODS),
    responsiblePeople: clone(DEFAULT_RESPONSIBLE_PEOPLE),
    rules: clone(DEFAULT_RULES)
  };
}

function boolEnv(name) {
  return /^(1|true|yes|on)$/i.test(String(process.env[name] || '').trim());
}

function canAccessLab(user = {}) {
  return LAB_ALLOWED_EMAILS.has(normalizeEmail(user.email));
}

function assertLabAccess(user = {}) {
  if (canAccessLab(user)) return;
  const error = new Error('El laboratorio Supabase de comprobantes sólo está habilitado para Mati y Nadia');
  error.statusCode = 403;
  throw error;
}

function getSafetyStatus() {
  const enabled = boolEnv('COMPROBANTES_SUPABASE_DIRECT_ENABLED');
  const writesEnabled = boolEnv('COMPROBANTES_SUPABASE_DIRECT_WRITES_ENABLED');
  const cutoverEnabled = boolEnv('COMPROBANTES_SUPABASE_DIRECT_CUTOVER_ENABLED');
  return {
    enabled,
    writesEnabled,
    cutoverEnabled,
    dryRunOnly: !(enabled && writesEnabled),
    cutoverActive: enabled && writesEnabled && cutoverEnabled,
    storageBucket: process.env.SUPABASE_COMPROBANTES_BUCKET || DEFAULT_STORAGE_BUCKET
  };
}

function isCutoverActive() {
  return getSafetyStatus().cutoverActive;
}

function buildCutoverReadiness(config = {}, cleanup = {}) {
  const products = Array.isArray(config.products) ? config.products : [];
  const paymentMethods = Array.isArray(config.paymentMethods) ? config.paymentMethods : [];
  const responsiblePeople = Array.isArray(config.responsiblePeople) ? config.responsiblePeople : [];
  const checklist = config.rules?.cutoverChecklist || {};
  const cleanupAvailable = cleanup.available === true;
  const cleanupCount = Number(cleanup.count || 0);
  const checks = [
    {
      id: 'migration',
      label: 'Migración Supabase aplicada',
      ok: config.migrationReady !== false,
      detail: config.migrationReady === false ? 'Las tablas y RPC del laboratorio todavía no están disponibles.' : 'Esquema disponible.'
    },
    {
      id: 'payment_catalog',
      label: 'Catálogo histórico de medios de pago',
      ok: paymentMethods.length >= EXPECTED_AUDITED_PAYMENT_METHODS,
      detail: `${paymentMethods.length}/${EXPECTED_AUDITED_PAYMENT_METHODS} medios cargados.`
    },
    {
      id: 'active_catalogs',
      label: 'Catálogos operativos activos',
      ok: products.some((item) => item.active !== false)
        && paymentMethods.some((item) => item.active !== false)
        && responsiblePeople.some((item) => item.active !== false && ['Closer', 'Ambos'].includes(item.role)),
      detail: 'Debe existir al menos un producto, medio de pago y closer activos.'
    },
    {
      id: 'csm_rule',
      label: 'Regla de alta/actualización CSM validada',
      ok: checklist.csmRuleStatus === 'validated',
      detail: checklist.csmRuleStatus === 'validated' ? 'Validación registrada.' : 'Pendiente de definir y validar la regla exacta.'
    },
    {
      id: 'arca_control',
      label: 'Control de facturación ARCA validado',
      ok: checklist.arcaControlStatus === 'validated',
      detail: checklist.arcaControlStatus === 'validated' ? 'Validación registrada.' : 'Pendiente de reemplazar o aprobar el control histórico.'
    },
    {
      id: 'historical_files',
      label: 'Adjuntos históricos verificados',
      ok: checklist.historicalFilesVerified === true,
      detail: checklist.historicalFilesVerified === true
        ? 'Verificación registrada.'
        : `Pendiente verificar/migrar los ${EXPECTED_HISTORICAL_FILES.toLocaleString('es-AR')} adjuntos auditados.`
    },
    {
      id: 'historical_reconciliation',
      label: 'Reconciliación histórica aprobada',
      ok: checklist.historicalReconciliationVerified === true,
      detail: checklist.historicalReconciliationVerified === true ? 'Verificación registrada.' : 'Pendiente comparar el histórico completo.'
    },
    {
      id: 'cleanup_queue',
      label: 'Cola de archivos sin pendientes',
      ok: cleanupAvailable && cleanupCount === 0,
      detail: cleanupAvailable ? `${cleanupCount} archivo(s) pendiente(s).` : 'No se pudo verificar la cola persistente.'
    },
    {
      id: 'observation_window',
      label: 'Observación controlada completada',
      ok: checklist.observationWindowCompleted === true,
      detail: checklist.observationWindowCompleted === true ? 'Ventana aprobada.' : 'Pendiente completar 48–72 horas sin diferencias.'
    }
  ];
  return {
    ready: checks.every((check) => check.ok),
    checks,
    expectedPaymentMethods: EXPECTED_AUDITED_PAYMENT_METHODS,
    expectedHistoricalFiles: EXPECTED_HISTORICAL_FILES,
    blocking: checks.filter((check) => !check.ok).map((check) => check.id)
  };
}

function assertWritesEnabled() {
  const status = getSafetyStatus();
  if (status.enabled && status.writesEnabled) return;
  const error = new Error('El laboratorio está bloqueado en modo simulación; no se escribió nada en Supabase');
  error.statusCode = 409;
  throw error;
}

function requiredSupabaseEnv() {
  if (env.supabaseUrl && env.supabaseKey) return;
  const error = new Error('Faltan las variables de Supabase para el laboratorio de comprobantes');
  error.statusCode = 500;
  throw error;
}

function headers(extra = {}) {
  requiredSupabaseEnv();
  return {
    apikey: env.supabaseKey,
    Authorization: `Bearer ${env.supabaseKey}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

function isMissingRelationError(error) {
  const status = Number(error?.response?.status || 0);
  const code = String(error?.response?.data?.code || '');
  return status === 404 || ['42P01', 'PGRST205'].includes(code);
}

const httpRepository = {
  async getConfig() {
    try {
      const [products, paymentMethods, responsiblePeople, rules] = await Promise.all([
        axios.get(`${env.supabaseUrl}/rest/v1/comprobantes_productos_config`, {
          headers: headers(),
          params: { select: '*', order: 'position.asc,name.asc' }
        }),
        axios.get(`${env.supabaseUrl}/rest/v1/comprobantes_medios_pago_config`, {
          headers: headers(),
          params: { select: '*', order: 'position.asc,name.asc' }
        }),
        axios.get(`${env.supabaseUrl}/rest/v1/comprobantes_responsables_config`, {
          headers: headers(),
          params: { select: '*', order: 'position.asc,name.asc' }
        }),
        axios.get(`${env.supabaseUrl}/rest/v1/comprobantes_reglas_config`, {
          headers: headers(),
          params: { select: '*', id: 'eq.default', limit: 1 }
        })
      ]);

      return {
        migrationReady: true,
        products: (products.data || []).map((row) => ({
          id: row.id,
          legacyNotionId: row.legacy_notion_id || null,
          code: row.code,
          name: row.name,
          active: row.active !== false,
          clubPrices: Array.isArray(row.club_prices) ? row.club_prices : []
        })),
        paymentMethods: (paymentMethods.data || []).map((row) => ({
          id: row.id,
          legacyNotionId: row.legacy_notion_id || null,
          code: row.code,
          name: row.name,
          active: row.active !== false,
          type: row.payment_type || '',
          account: row.account_label || '',
          ivaRate: Number(row.iva_rate || 0),
          commissionRate: Number(row.commission_rate || 0),
          initialBalance: Number(row.initial_balance || 0)
        })),
        responsiblePeople: (responsiblePeople.data || []).map((row) => ({
          id: row.id,
          code: row.code,
          name: row.name,
          email: row.email || '',
          role: row.role,
          active: row.active !== false
        })),
        rules: rules.data?.[0]?.rules || clone(DEFAULT_RULES)
      };
    } catch (error) {
      if (isMissingRelationError(error)) return { migrationReady: false, ...defaultConfig() };
      throw error;
    }
  },

  async saveConfig(config, user) {
    const response = await axios.post(
      `${env.supabaseUrl}/rest/v1/rpc/metricas_save_comprobantes_config_v1`,
      { p_config: config, p_actor_email: normalizeEmail(user.email) },
      { headers: headers() }
    );
    return response.data;
  },

  async getLead(ghlId) {
    const response = await axios.get(`${env.supabaseUrl}/rest/v1/leads_raw`, {
      headers: headers(),
      params: {
        select: '*',
        ghlid: `eq.${ghlId}`,
        order: 'last_edited_time.desc.nullslast,created_time.desc.nullslast',
        limit: 1
      }
    });
    return response.data?.[0] || null;
  },

  async getLeadById(id) {
    const response = await axios.get(`${env.supabaseUrl}/rest/v1/leads_raw`, {
      headers: headers(),
      params: { select: '*', id: `eq.${id}`, limit: 1 }
    });
    return response.data?.[0] || null;
  },

  async getCsm(ghlId) {
    const response = await axios.get(`${env.supabaseUrl}/rest/v1/csm`, {
      headers: headers(),
      params: {
        select: 'id,ghlid,nombre,mail,telefono,actividad,crm_2_0',
        ghlid: `eq.${ghlId}`,
        order: 'updated_at.desc.nullslast,created_at.desc.nullslast',
        limit: 1
      }
    });
    return response.data?.[0] || null;
  },

  async getSale(id, ghlId) {
    const params = {
      select: 'id,ghlid,cliente,lead_id,cliente_format,producto_format,f_venta,fecha_correspondiente,fecha_creado,f_acreditacion,facturacion,cash_collected,cash_ar,cash_collected_ar,cash_collected_ars,cash_collected_total,tipo,porcentaje_venta_vieja',
      tipo: 'eq.Venta',
      limit: 1
    };
    if (id) params.id = `eq.${id}`;
    else {
      params.ghlid = `eq.${ghlId}`;
      params.order = 'f_venta.desc.nullslast,fecha_creado.desc.nullslast';
    }
    const response = await axios.get(`${env.supabaseUrl}/rest/v1/comprobantes`, {
      headers: headers(),
      params
    });
    return response.data?.[0] || null;
  },

  async getComprobante(id) {
    const response = await axios.get(`${env.supabaseUrl}/rest/v1/comprobantes`, {
      headers: headers(),
      params: { select: '*', id: `eq.${id}`, limit: 1 }
    });
    return response.data?.[0] || null;
  },

  async createBatch(payload) {
    const response = await axios.post(
      `${env.supabaseUrl}/rest/v1/rpc/metricas_create_comprobante_batch_v1`,
      { p_payload: payload },
      { headers: headers() }
    );
    return response.data;
  },

  async updateComprobante(payload) {
    const response = await axios.post(
      `${env.supabaseUrl}/rest/v1/rpc/metricas_update_comprobante_direct_v1`,
      { p_payload: payload },
      { headers: headers() }
    );
    return response.data;
  },

  async deleteComprobante(payload) {
    const response = await axios.post(
      `${env.supabaseUrl}/rest/v1/rpc/metricas_delete_comprobante_direct_v1`,
      { p_payload: payload },
      { headers: headers() }
    );
    return response.data;
  },

  async updateReconciliation(payload) {
    const response = await axios.post(
      `${env.supabaseUrl}/rest/v1/rpc/metricas_update_comprobante_reconciliation_v1`,
      { p_payload: payload },
      { headers: headers() }
    );
    return response.data;
  },

  async listFiles(comprobanteId) {
    const response = await axios.get(`${env.supabaseUrl}/rest/v1/comprobantes_archivos`, {
      headers: headers(),
      params: {
        select: 'id,comprobante_id,bucket,object_path,original_name,mime_type,size_bytes,sha256,created_at',
        comprobante_id: `eq.${comprobanteId}`,
        order: 'created_at.asc'
      }
    });
    return response.data || [];
  },

  async signFile(bucket, objectPath, expiresIn = 600) {
    const response = await axios.post(
      `${env.supabaseUrl}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${objectPath.split('/').map(encodeURIComponent).join('/')}`,
      { expiresIn },
      { headers: headers() }
    );
    const signedPath = response.data?.signedURL || response.data?.signedUrl || response.data?.signed_url;
    return signedPath && /^https?:\/\//i.test(signedPath)
      ? signedPath
      : `${String(env.supabaseUrl).replace(/\/$/, '')}/storage/v1${signedPath || ''}`;
  },

  async getSubmission(submissionKey) {
    const batchResponse = await axios.get(`${env.supabaseUrl}/rest/v1/comprobantes_submission_batches`, {
      headers: headers(),
      params: {
        select: 'id,submission_key,status,operation_count,actor_email,created_at,completed_at',
        submission_key: `eq.${submissionKey}`,
        limit: 1
      }
    });
    const batch = batchResponse.data?.[0] || null;
    if (!batch) return null;

    const rowsResponse = await axios.get(`${env.supabaseUrl}/rest/v1/comprobantes`, {
      headers: headers(),
      params: {
        select: 'id,tipo,operation_index',
        submission_key: `eq.${submissionKey}`,
        order: 'operation_index.asc'
      }
    });
    return {
      ...batch,
      created: (rowsResponse.data || []).map((row) => ({ id: row.id, type: row.tipo }))
    };
  },

  async uploadFile(bucket, objectPath, file) {
    const response = await axios.post(
      `${env.supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath.split('/').map(encodeURIComponent).join('/')}`,
      Buffer.from(file.base64, 'base64'),
      {
        headers: headers({
          'Content-Type': file.type || 'application/octet-stream',
          'x-upsert': 'false'
        }),
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      }
    );
    return response.data;
  },

  async removeFiles(bucket, paths) {
    if (!paths.length) return;
    await axios.delete(`${env.supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}`, {
      headers: headers(),
      data: { prefixes: paths }
    });
  },

  async enqueueFileCleanup(files, context = {}) {
    if (!files.length) return;
    await axios.post(
      `${env.supabaseUrl}/rest/v1/rpc/metricas_enqueue_storage_cleanup_v1`,
      {
        p_payload: {
          comprobanteId: context.comprobanteId || files[0]?.comprobante_id || null,
          actorEmail: normalizeEmail(context.actorEmail) || null,
          reason: String(context.reason || 'delete_cleanup_failed').slice(0, 100),
          error: String(context.error || '').slice(0, 2000) || null,
          files: files.map((file) => ({
            comprobanteId: file.comprobante_id || context.comprobanteId || null,
            bucket: file.bucket,
            objectPath: file.object_path
          }))
        }
      },
      { headers: headers() }
    );
  },

  async listPendingFileCleanup(limit = 100) {
    const response = await axios.get(`${env.supabaseUrl}/rest/v1/comprobantes_storage_cleanup_queue`, {
      headers: headers(),
      params: {
        select: 'id,comprobante_id,bucket,object_path,reason,last_error,requested_by_email,attempts,created_at,last_attempt_at',
        completed_at: 'is.null',
        order: 'created_at.asc',
        limit: Math.min(Math.max(Number(limit) || 100, 1), 500)
      }
    });
    return response.data || [];
  },

  async finishFileCleanup(id, success, error, actorEmail) {
    const response = await axios.post(
      `${env.supabaseUrl}/rest/v1/rpc/metricas_finish_storage_cleanup_v1`,
      {
        p_id: Number(id),
        p_success: success === true,
        p_error: error ? String(error).slice(0, 2000) : null,
        p_actor_email: normalizeEmail(actorEmail)
      },
      { headers: headers() }
    );
    return response.data;
  }
};

async function cleanupStorageFiles(repository, files = [], context = {}) {
  const validFiles = files.filter((file) => file?.bucket && file?.object_path);
  const result = { removed: 0, queued: 0, errors: [] };
  const byBucket = new Map();
  validFiles.forEach((file) => {
    const bucketFiles = byBucket.get(file.bucket) || [];
    bucketFiles.push(file);
    byBucket.set(file.bucket, bucketFiles);
  });

  for (const [bucket, bucketFiles] of byBucket.entries()) {
    try {
      await repository.removeFiles(bucket, bucketFiles.map((file) => file.object_path));
      result.removed += bucketFiles.length;
    } catch (error) {
      result.errors.push(error.message);
      if (typeof repository.enqueueFileCleanup !== 'function') continue;
      try {
        await repository.enqueueFileCleanup(bucketFiles, {
          ...context,
          error: error.message
        });
        result.queued += bucketFiles.length;
      } catch (queueError) {
        result.errors.push(`No se pudo registrar el reintento de Storage: ${queueError.message}`);
      }
    }
  }
  return result;
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((Number(value || 0) + Number.EPSILON) * factor) / factor;
}

function includedAmount(gross, rate) {
  const safeRate = Number(rate || 0);
  if (!(safeRate > 0)) return 0;
  return round(Number(gross || 0) * safeRate / (1 + safeRate), 2);
}

function safeStorageFileName(value) {
  const safe = String(value || 'archivo')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(-180);
  return safe || 'archivo';
}

function formatDate(value) {
  const match = String(value || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1].slice(-2)}` : '';
}

function storedDate(value) {
  const date = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T03:00:00Z` : null;
}

function period(value) {
  const date = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? { month: date.slice(5, 7), year: date.slice(2, 4) }
    : { month: null, year: null };
}

function addCalendarMonths(value, months) {
  const date = String(value || '').slice(0, 10);
  const amount = Number(months);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(amount) || amount <= 0) return null;
  const [year, month, day] = date.split('-').map(Number);
  const targetFirst = new Date(Date.UTC(year, month - 1 + amount, 1));
  const lastDay = new Date(Date.UTC(
    targetFirst.getUTCFullYear(),
    targetFirst.getUTCMonth() + 1,
    0
  )).getUTCDate();
  const result = new Date(Date.UTC(
    targetFirst.getUTCFullYear(),
    targetFirst.getUTCMonth(),
    Math.min(day, lastDay)
  ));
  return result.toISOString().slice(0, 10);
}

function resolvePersonName(user = {}) {
  return comprobantesLoaderService.getResponsibleNameForUser(user)
    || String(user.nombre || user.name || user.email || '').trim();
}

function validateConfig(config) {
  if (!config
    || !Array.isArray(config.products)
    || !Array.isArray(config.paymentMethods)
    || !Array.isArray(config.responsiblePeople)) {
    const error = new Error('La configuración de comprobantes no tiene un formato válido');
    error.statusCode = 400;
    throw error;
  }
  const validateRate = (value, label) => {
    const number = Number(value || 0);
    if (!Number.isFinite(number) || number < 0 || number > 1) {
      const error = new Error(`${label} debe estar entre 0 y 1`);
      error.statusCode = 400;
      throw error;
    }
    return number;
  };
  const assertUnique = (items, getter, label) => {
    const seen = new Set();
    items.forEach((item) => {
      const value = normalizeText(getter(item));
      if (!value) return;
      if (seen.has(value)) {
        const error = new Error(`${label} duplicado: ${getter(item)}`);
        error.statusCode = 400;
        throw error;
      }
      seen.add(value);
    });
  };
  const catalogCode = (item, name, label) => {
    const code = String(item.code || normalizeText(name).replace(/[^a-z0-9]+/g, '-')).replace(/^-|-$/g, '');
    if (!code) {
      const error = new Error(`Falta el código de ${label} ${name}`);
      error.statusCode = 400;
      throw error;
    }
    return code;
  };
  const products = config.products.map((item, index) => {
    const name = String(item?.name || '').trim();
    if (!name) {
      const error = new Error(`Falta el nombre del producto ${index + 1}`);
      error.statusCode = 400;
      throw error;
    }
    const clubPrices = Array.isArray(item.clubPrices)
      ? item.clubPrices.map((price, priceIndex) => {
          const key = String(price.key || '').trim();
          const label = String(price.label || '').trim();
          const amountArs = round(Number(price.amountArs || 0), 2);
          if (!key || !label || !(amountArs > 0)) {
            const error = new Error(`El precio ${priceIndex + 1} de ${name} necesita código, nombre e importe mayor a cero`);
            error.statusCode = 400;
            throw error;
          }
          return { key, label, amountArs };
        })
      : [];
    assertUnique(clubPrices, (price) => price.key, `Código de precio de ${name}`);
    return {
      id: item.id || undefined,
      legacyNotionId: item.legacyNotionId || null,
      code: catalogCode(item, name, 'producto'),
      name,
      active: item.active !== false,
      clubPrices
    };
  });
  const paymentMethods = config.paymentMethods.map((item, index) => {
    const name = String(item?.name || '').trim();
    if (!name) {
      const error = new Error(`Falta el nombre del medio de pago ${index + 1}`);
      error.statusCode = 400;
      throw error;
    }
    const initialBalance = Number(item.initialBalance || 0);
    if (!Number.isFinite(initialBalance)) {
      const error = new Error(`El saldo inicial de ${name} no es válido`);
      error.statusCode = 400;
      throw error;
    }
    return {
      id: item.id || undefined,
      legacyNotionId: item.legacyNotionId || null,
      code: catalogCode(item, name, 'medio de pago'),
      name,
      active: item.active !== false,
      type: String(item.type || '').trim(),
      account: String(item.account || '').trim(),
      ivaRate: validateRate(item.ivaRate, `IVA de ${name}`),
      commissionRate: validateRate(item.commissionRate, `Comisión de ${name}`),
      initialBalance: round(initialBalance, 2)
    };
  });
  const responsiblePeople = config.responsiblePeople.map((item, index) => {
    const name = String(item?.name || '').trim();
    if (!name) {
      const error = new Error(`Falta el nombre del responsable ${index + 1}`);
      error.statusCode = 400;
      throw error;
    }
    const role = String(item.role || 'Closer').trim();
    if (!['Closer', 'Setter', 'Ambos'].includes(role)) {
      const error = new Error(`El rol de ${name} no es válido`);
      error.statusCode = 400;
      throw error;
    }
    const email = normalizeEmail(item.email);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      const error = new Error(`El email de ${name} no es válido`);
      error.statusCode = 400;
      throw error;
    }
    return {
      id: item.id || undefined,
      code: catalogCode(item, name, 'responsable'),
      name,
      email,
      role,
      active: item.active !== false
    };
  });
  assertUnique(products, (item) => item.code, 'Código de producto');
  assertUnique(products, (item) => item.name, 'Nombre de producto');
  assertUnique(paymentMethods, (item) => item.code, 'Código de medio de pago');
  // Notion conserva dos nombres históricos que sólo difieren por tilde. Pueden
  // coexistir inactivos para trazabilidad, pero nunca habilitarse a la vez.
  assertUnique(
    paymentMethods.filter((item) => item.active !== false),
    (item) => item.name,
    'Nombre de medio de pago activo'
  );
  assertUnique(responsiblePeople, (item) => item.code, 'Código de responsable');
  assertUnique(responsiblePeople, (item) => item.name, 'Nombre de responsable');
  assertUnique(responsiblePeople, (item) => item.email, 'Email de responsable');
  const rules = {
    ...clone(DEFAULT_RULES),
    ...(config.rules || {}),
    cutoverChecklist: {
      ...clone(DEFAULT_RULES.cutoverChecklist),
      ...(config.rules?.cutoverChecklist || {})
    }
  };
  ['clubVatRate', 'clubProcessorRate', 'clubIibbRate'].forEach((key) => {
    rules[key] = validateRate(rules[key], key);
  });
  rules.maxBatchOperations = MAX_BATCH_OPERATIONS;
  ['csmRuleStatus', 'arcaControlStatus'].forEach((key) => {
    if (!['pending', 'validated'].includes(rules.cutoverChecklist[key])) {
      const error = new Error(`${key} debe ser pending o validated`);
      error.statusCode = 400;
      throw error;
    }
  });
  [
    'historicalFilesVerified',
    'historicalReconciliationVerified',
    'observationWindowCompleted'
  ].forEach((key) => {
    rules.cutoverChecklist[key] = rules.cutoverChecklist[key] === true;
  });
  delete rules.productPaymentMethods;
  return { products, paymentMethods, responsiblePeople, rules };
}

async function loadConfig(options = {}) {
  const repository = options.repository || httpRepository;
  try {
    const stored = await repository.getConfig();
    const normalized = validateConfig({
      products: stored.products?.length ? stored.products : DEFAULT_PRODUCTS,
      paymentMethods: stored.paymentMethods?.length ? stored.paymentMethods : DEFAULT_PAYMENT_METHODS,
      responsiblePeople: stored.responsiblePeople?.length ? stored.responsiblePeople : DEFAULT_RESPONSIBLE_PEOPLE,
      rules: stored.rules || DEFAULT_RULES
    });
    return {
      ...normalized,
      migrationReady: stored.migrationReady !== false,
      source: stored.migrationReady === false ? 'audited-notion-snapshot' : 'supabase'
    };
  } catch (error) {
    if (!options.allowFallback && !isMissingRelationError(error)) throw error;
    return {
      ...defaultConfig(),
      migrationReady: false,
      source: 'audited-notion-snapshot',
      warning: 'Las tablas del laboratorio todavía no están aplicadas; se muestra el snapshot auditado.'
    };
  }
}

async function getConfig(user, options = {}) {
  assertLabAccess(user);
  const config = await loadConfig(options);
  return {
    ...config,
    safety: getSafetyStatus(),
    readiness: await getCutoverReadiness(user, { ...options, config })
  };
}

async function getCutoverReadiness(user, options = {}) {
  assertLabAccess(user);
  const repository = options.repository || httpRepository;
  const config = options.config || await loadConfig({ ...options, repository });
  let cleanup = { available: false, count: 0 };
  if (config.migrationReady !== false && typeof repository.listPendingFileCleanup === 'function') {
    try {
      const rows = await repository.listPendingFileCleanup(options.cleanupLimit || 500);
      cleanup = { available: true, count: rows.length };
    } catch (error) {
      if (!isMissingRelationError(error)) throw error;
    }
  }
  return buildCutoverReadiness(config, cleanup);
}

async function assertCutoverReady(user, options = {}) {
  const repository = options.repository || httpRepository;
  const config = options.config || await loadConfig({ ...options, repository, allowFallback: false });
  let cleanup = { available: false, count: 0 };
  if (config.migrationReady !== false && typeof repository.listPendingFileCleanup === 'function') {
    const rows = await repository.listPendingFileCleanup(options.cleanupLimit || 500);
    cleanup = { available: true, count: rows.length };
  }
  const readiness = buildCutoverReadiness(config, cleanup);
  if (readiness.ready) return readiness;
  const error = new Error(`Corte bloqueado por preflight: ${readiness.blocking.join(', ')}`);
  error.statusCode = 409;
  error.readiness = readiness;
  error.actorEmail = normalizeEmail(user?.email);
  throw error;
}

function assertOperationalAccess(user = {}, options = {}) {
  if (options.allowOperationalUser && normalizeEmail(user.email)) return;
  assertLabAccess(user);
}

function canSelectResponsible(user = {}) {
  return canAccessLab(user) || comprobantesLoaderService._test.canSelectResponsibleVenta(user);
}

async function getBootstrap(user, options = {}) {
  assertOperationalAccess(user, options);
  const config = await loadConfig({ ...options, allowFallback: false });
  if (!config.migrationReady) {
    const error = new Error('La configuración Supabase de comprobantes todavía no está disponible');
    error.statusCode = 409;
    throw error;
  }
  const selectable = canSelectResponsible(user);
  const responsibleDefault = selectable ? '' : resolvePersonName(user);
  const responsibleOptions = config.responsiblePeople
    .filter((person) => person.active !== false && ['Closer', 'Ambos'].includes(person.role))
    .map((person) => person.name)
    .sort((left, right) => left.localeCompare(right, 'es'));
  const products = config.products.filter((item) => item.active !== false);
  const paymentMethods = config.paymentMethods.filter((item) => item.active !== false);
  const club = products.find((item) => normalizeText(item.name) === 'club');
  return {
    responsibleVentaDefault: responsibleDefault,
    responsibleVentaOptions: selectable ? responsibleOptions : [responsibleDefault].filter(Boolean),
    canSelectResponsibleVenta: selectable,
    tipoOptions: ['Venta', 'Cobranza', 'Devolución'],
    mediosDePagoOptions: paymentMethods.map((item) => item.name),
    mediosDePago: paymentMethods.map((item) => ({
      id: item.id || item.legacyNotionId || item.code,
      name: item.name,
      active: true,
      account: item.account || ''
    })),
    cantidadPagosOptions: Array.from({ length: MAX_BATCH_OPERATIONS }, (_, index) => index + 1),
    productsSource: 'supabase',
    products: products.map((item) => item.name),
    clubPriceOptions: club?.clubPrices || [],
    uploadAcceptedTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    dataSource: 'supabase_direct',
    safety: getSafetyStatus()
  };
}

function parseGhlId(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    const contactsIndex = pathParts.findIndex((part) => normalizeText(part) === 'contacts');
    if (contactsIndex >= 0) {
      const nextIndex = normalizeText(pathParts[contactsIndex + 1]) === 'detail'
        ? contactsIndex + 2
        : contactsIndex + 1;
      if (pathParts[nextIndex]) return pathParts[nextIndex];
    }
  } catch (_error) {
    // Un GHL ID plano no es una URL y se usa tal cual.
  }
  return raw.match(/[A-Za-z0-9_-]{8,}/)?.[0] || '';
}

function saleForClient(row = {}) {
  return row ? {
    notionPageId: row.id || null,
    id: row.id || null,
    ghlId: row.ghlid || null,
    clientPageId: row.cliente || row.lead_id || null,
    clientPageIds: [row.cliente || row.lead_id].filter(Boolean),
    cliente: row.cliente_format || '',
    producto: row.producto_format || '',
    fechaVenta: row.f_venta || row.fecha_correspondiente || null,
    fechaAcreditacion: row.f_acreditacion || null,
    fechaCreado: row.fecha_creado || null,
    facturacionUsd: Number(row.facturacion || 0),
    cashCollectedArs: Number(row.cash_ar ?? row.cash_collected_ar ?? row.cash_collected_ars ?? 0),
    cashCollectedTotal: Number(row.cash_collected_total || 0)
  } : null;
}

function relationId(value) {
  const match = String(value || '').match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
    || String(value || '').match(/[0-9a-f]{32}/i);
  if (!match) return '';
  const compact = match[0].replace(/-/g, '').toLowerCase();
  return compact.replace(/^(........)(....)(....)(....)(............)$/, '$1-$2-$3-$4-$5');
}

async function resolveLead(repository, ghlId) {
  const direct = await repository.getLead(ghlId);
  if (direct) return direct;
  if (typeof repository.getCsm !== 'function' || typeof repository.getLeadById !== 'function') return null;
  const csm = await repository.getCsm(ghlId);
  const linkedLeadId = relationId(csm?.crm_2_0);
  if (!linkedLeadId) return null;
  const linkedLead = await repository.getLeadById(linkedLeadId);
  if (!linkedLead || String(linkedLead.ghlid || '') !== String(ghlId)) return null;
  return {
    ...linkedLead,
    nombre: linkedLead.nombre || csm.nombre,
    mail: linkedLead.mail || csm.mail,
    telefono: linkedLead.telefono || csm.telefono,
    etapa: linkedLead.etapa || csm.actividad
  };
}

async function lookupClient(rawGhlId, user, options = {}) {
  assertOperationalAccess(user, options);
  const repository = options.repository || httpRepository;
  const ghlId = parseGhlId(rawGhlId);
  if (!ghlId) {
    const error = new Error('No pude encontrar un GHL ID válido en el valor ingresado');
    error.statusCode = 400;
    throw error;
  }
  const lead = await resolveLead(repository, ghlId);
  if (!lead) {
    const error = new Error('No encontré un cliente canónico con ese GHL ID en Supabase');
    error.statusCode = 404;
    throw error;
  }
  const latestSale = await repository.getSale(null, ghlId);
  return {
    pageId: lead.id || null,
    pageIds: [lead.id].filter(Boolean),
    ghlId,
    nombre: lead.nombre || '',
    mail: lead.mail || '',
    telefono: lead.telefono || lead.whatsapp || '',
    etapa: lead.etapa || '',
    source: 'leads_raw',
    latestSale: saleForClient(latestSale),
    latestSaleLookupError: null
  };
}

async function lookupRelatedSale(rawId, expectedClient = {}, user = {}, options = {}) {
  assertOperationalAccess(user, options);
  const id = relationId(rawId);
  if (!id) {
    const error = new Error('No pude leer un ID válido para la venta relacionada');
    error.statusCode = 400;
    throw error;
  }
  const repository = options.repository || httpRepository;
  const sale = await repository.getSale(id, String(expectedClient.ghlId || '').trim());
  if (!sale || String(sale.ghlid || '') !== String(expectedClient.ghlId || '')) {
    const error = new Error('La venta relacionada no existe en Supabase o pertenece a otro cliente');
    error.statusCode = 400;
    throw error;
  }
  return saleForClient(sale);
}

async function saveConfig(rawConfig, user, options = {}) {
  assertLabAccess(user);
  if (!options.bypassSafety) assertWritesEnabled();
  const config = validateConfig(rawConfig);
  const repository = options.repository || httpRepository;
  const saved = await repository.saveConfig(config, user);
  return { saved, config };
}

function findActiveByName(items, name, label) {
  const match = items.find((item) => item.active !== false && normalizeText(item.name) === normalizeText(name));
  if (!match) {
    const error = new Error(`${label} ${name} no existe o está inactivo en la configuración Supabase`);
    error.statusCode = 400;
    throw error;
  }
  return match;
}

function operationSpecs(normalized) {
  const isCheque = comprobantesLoaderService._test.isChequePaymentMethod(normalized.medioPago);
  if (isCheque && normalized.cheques.length) {
    const chequeNames = new Set(normalized.cheques.map((item) => item.archivoNombre).filter(Boolean));
    const supplemental = normalized.attachmentNames.filter((name) => !chequeNames.has(name));
    return normalized.cheques.map((cheque, index) => ({
      type: normalized.tipo === 'Venta' && index === 0 ? 'Venta' : 'Cobranza',
      cashArs: cheque.montoArs,
      accreditationDate: cheque.fechaAcreditacion,
      attachmentNames: [
        ...(cheque.archivoNombre ? [cheque.archivoNombre] : []),
        ...(index === 0 ? supplemental : [])
      ],
      cheque: true
    }));
  }
  return [{
    type: normalized.tipo === 'Devolución' ? 'Devolucion' : normalized.tipo,
    cashArs: normalized.cashCollectedArs,
    accreditationDate: normalized.fechaAcreditacion,
    attachmentNames: normalized.attachmentNames,
    cheque: isCheque
  }];
}

function leadSnapshot(lead = {}, normalized = {}) {
  const agendaDate = lead.fecha_agenda || null;
  const agendaPeriod = period(agendaDate);
  const montoIncobrable = Number(lead.monto_incobrable);
  return {
    cliente: lead.id || normalized.clientPageId,
    lead_id: lead.id || normalized.clientPageId,
    cliente_format: lead.nombre || normalized.clientName,
    ghlid: lead.ghlid || normalized.ghlId,
    mail: lead.mail || null,
    telefono: lead.telefono || lead.whatsapp || null,
    adname: lead.adname || null,
    adset: lead.adset || null,
    campaign: lead.campaign || null,
    calidad: lead.calidad_lead || lead.calidad || null,
    modelo_de_negocio: lead.modelo_negocio || null,
    origen: lead.origen || null,
    origen_actual: lead.origen_actual || null,
    primer_origen: lead.primer_origen || null,
    ultimo_origen: lead.ultimo_origen || null,
    responsable_actual: lead.closer || lead.responsable || null,
    setter: lead.setter || null,
    score: Number.isFinite(Number(lead.score)) ? Number(lead.score) : null,
    monto_incobrable: Number.isFinite(montoIncobrable) ? montoIncobrable : 0,
    fecha_de_agendamiento: agendaDate,
    agenda_format: formatDate(agendaDate),
    agenda_periodo_m: agendaPeriod.month,
    agenda_periodo_a: agendaPeriod.year,
    fecha_de_llamada: lead.fecha_llamada || null,
    llamada_meg: lead.llamada_meg || null,
    calendario_agendado: lead.calendario_agendado || null,
    estrategia_a: lead.estrategia_a || null
  };
}

function buildRows({ normalized, config, lead, relatedSale, user, idFactory = () => crypto.randomUUID(), now = new Date() }) {
  const responsible = findActiveByName(
    config.responsiblePeople,
    normalized.responsableVenta,
    'El responsable de venta'
  );
  const product = normalized.tipo === 'Venta'
    ? findActiveByName(config.products, normalized.productName, 'El producto')
    : null;
  const payment = findActiveByName(config.paymentMethods, normalized.medioPago, 'El medio de pago');



  if (product && normalizeText(product.name) === 'club') {
    const price = product.clubPrices.find((item) => item.key === normalized.clubPriceKey);
    if (!price || !(Number(price.amountArs) > 0)) {
      const error = new Error('El precio Club elegido no existe en la configuración Supabase');
      error.statusCode = 400;
      throw error;
    }
    normalized.cashCollectedArs = Number(price.amountArs);
    normalized.facturacionUsd = round(normalized.cashCollectedArs / normalized.tc, 2);
    normalized.clubPriceLabel = price.label;
  }

  const specs = operationSpecs(normalized);
  if (!specs.length || specs.length > Number(config.rules.maxBatchOperations || MAX_BATCH_OPERATIONS)) {
    const error = new Error(`La carga debe tener entre 1 y ${MAX_BATCH_OPERATIONS} operaciones`);
    error.statusCode = 400;
    throw error;
  }

  const ids = specs.map(() => idFactory());
  const batchId = idFactory();
  const newSaleId = specs[0].type === 'Venta' ? ids[0] : null;
  const relatedSaleId = newSaleId || relatedSale?.id || null;
  if (config.rules.relatedSaleRequiredFor.includes(normalized.tipo) && !relatedSaleId) {
    const error = new Error('No encontré una venta relacionada en Supabase para esta operación');
    error.statusCode = 400;
    throw error;
  }

  const saleDate = normalized.fechaVenta
    || String(relatedSale?.f_venta || relatedSale?.fecha_correspondiente || '').slice(0, 10);
  if (!saleDate) {
    const error = new Error('La venta relacionada no tiene fecha de venta');
    error.statusCode = 400;
    throw error;
  }

  const totalBatchCashUsd = round(
    specs.reduce((total, item) => total + Number(item.cashArs || 0) / Number(normalized.tc || 1), 0),
    2
  );
  const totalBatchNetOfVatUsd = round(
    specs.reduce((total, item) => {
      const gross = Number(item.cashArs || 0);
      return total + (gross - includedAmount(gross, payment.ivaRate)) / Number(normalized.tc || 1);
    }, 0),
    6
  );
  const client = leadSnapshot(lead, normalized);
  const createdAt = now.toISOString();
  const salePeriod = period(saleDate);
  const correspondingPeriod = period(saleDate);
  const renewalDate = normalized.tipo === 'Venta'
    ? addCalendarMonths(saleDate, normalized.mesesSoporte)
    : null;
  const uploadedBy = resolvePersonName(user);
  const commonInfo = [
    `Carga ID: ${normalized.submissionKey}`,
    `Cargado por: ${uploadedBy}`,
    `Responsable venta: ${normalized.responsableVenta}`,
    normalized.clubPriceLabel ? `${normalized.clubPriceLabel}: ARS ${normalized.cashCollectedArs}` : '',
    normalized.infoComprobantes,
    normalized.mesesSoporte !== null ? `Meses de soporte: ${normalized.mesesSoporte}` : '',
    normalized.sesiones !== null ? `Sesiones: ${normalized.sesiones}` : '',
    normalized.bonusMati ? 'Bonus Mati: Sí' : '',
    normalized.attachmentNames.length ? `Adjuntos: ${normalized.attachmentNames.join(', ')}` : ''
  ].filter(Boolean).join(' | ');

  const rows = specs.map((spec, index) => {
    const cashArs = round(spec.cashArs, 2);
    const cashUsd = round(cashArs / normalized.tc, 2);
    const ivaArs = includedAmount(cashArs, payment.ivaRate);
    const commissionArs = includedAmount(cashArs, payment.commissionRate);
    const accreditationPeriod = period(spec.accreditationDate);
    const isSale = spec.type === 'Venta';
    const isClub = isSale && normalizeText(product?.name) === 'club';
    const netBeforeClubTaxes = isClub ? cashArs / (1 + Number(config.rules.clubVatRate || 0)) : 0;
    const netClub = isClub
      ? round(netBeforeClubTaxes
        - netBeforeClubTaxes * Number(config.rules.clubProcessorRate || 0)
        - netBeforeClubTaxes * Number(config.rules.clubIibbRate || 0), 6)
      : null;
    const facturationUsd = (isSale || spec.type === 'Devolucion')
      ? normalized.facturacionUsd
      : null;
    const relationId = relatedSaleId;
    const firstAttachmentName = spec.attachmentNames[0] || null;
    return {
      id: ids[index],
      ...client,
      tipo: spec.type,
      comprobante: firstAttachmentName,
      cantidad_de_pagos: isSale
        ? `${normalized.cantidadPagos} ${normalized.cantidadPagos === 1 ? 'Pago' : 'Pagos'}`
        : null,
      cash_collected: cashUsd,
      cash_ar: cashArs,
      cash_collected_ar: cashArs,
      cash_collected_ars: cashArs,
      cash_collected_total: isSale ? totalBatchCashUsd : 0,
      cash_collected_neto: round((cashArs - ivaArs) / normalized.tc, 6),
      cash_collected_neto_ars: round(cashArs - ivaArs, 2),
      cash_collected_neto_total: isSale ? totalBatchNetOfVatUsd : 0,
      facturacion: facturationUsd,
      facturacion_ars: facturationUsd == null ? null : round(facturationUsd * normalized.tc, 2),
      monto_pesos: cashArs,
      iva: ivaArs,
      comisiones: commissionArs,
      neto_club: isClub && config.rules.commissionBaseFromPaymentMethod ? round(Math.max(0, cashArs - ivaArs - commissionArs), 6) : netClub,
      tc: String(normalized.tc),
      dni_cuit: normalized.dniCuit || null,
      info_comprobantes: commonInfo,
      productos: isSale ? (product.id || product.legacyNotionId || product.code) : null,
      producto_format: isSale ? product.name : null,
      medios_de_pago: payment.id || payment.legacyNotionId || payment.code,
      medios_de_pago_format: payment.name,
      tipo_banco: payment.type || null,
      responsable_venta: normalized.responsableVenta,
      responsable_venta_id: responsible.id || null,
      creado_por: uploadedBy,
      cheque: spec.cheque,
      fecha_respaldo: storedDate(saleDate),
      fecha_correspondiente: storedDate(saleDate),
      f_venta: storedDate(saleDate),
      fecha_de_acreditacion: storedDate(spec.accreditationDate),
      f_acreditacion: storedDate(spec.accreditationDate),
      fecha_creado: createdAt,
      correspondiente_format: formatDate(saleDate),
      fecha_de_venta_format: formatDate(saleDate),
      f_acreditacion_format: formatDate(spec.accreditationDate),
      correspondiente_periodo_m: correspondingPeriod.month,
      correspondiente_periodo_a: correspondingPeriod.year,
      venta_periodo_m: salePeriod.month,
      venta_periodo_a: salePeriod.year,
      acreditado_periodo_m: accreditationPeriod.month,
      acreditado_periodo_y: accreditationPeriod.year,
      f_transaccion_string: formatDate(spec.accreditationDate),
      conciliacion_financiera: 'false',
      conciliacion_financiera_2: 'false',
      conciliar: 'false',
      estado: null,
      rebotar_pago: false,
      rectificar_pago: false,
      facturacion_arca: null,
      facturar: null,
      fecha_facturado: null,
      // El flujo histórico finaliza cada operación: las no-ventas en el alta y
      // la venta principal inmediatamente después de enlazarla consigo misma.
      finalizar: true,
      crear_registro_csm: null,
      csm_2_0: null,
      estado_cc: null,
      verificacion: '✅ Verificado',
      verificacion_comisiones: relationId ? '🟢 Verificado' : '🔴 Error',
      porcentaje_venta_vieja: !isSale && Number(relatedSale?.porcentaje_venta_vieja || 0) > 0
        ? Number(relatedSale.porcentaje_venta_vieja)
        : null,
      porcentaje_venta_vieja_format: null,
      meses_soporte: isSale ? normalized.mesesSoporte : null,
      sesiones_configuradas: isSale ? normalized.sesiones : null,
      bonus_mati: isSale ? normalized.bonusMati === true : false,
      f_renovacion: isSale && renewalDate ? storedDate(renewalDate) : null,
      f_renovacion_string: isSale && renewalDate ? formatDate(renewalDate) : null,
      cobranza_relacionada: isSale ? relationId : null,
      venta_relacionada: relationId,
      submission_key: normalized.submissionKey,
      batch_id: batchId,
      operation_index: index,
      source_system: 'supabase_direct',
      cliente_ghlid: client.ghlid,
      venta_id: relationId,
      producto_id: isSale ? product.id || null : null,
      medio_pago_id: payment.id || null,
      iva_tasa: Number(payment.ivaRate || 0),
      comision_tasa: Number(payment.commissionRate || 0),
      iva_usd: round(ivaArs / normalized.tc, 6),
      comision_usd: round(commissionArs / normalized.tc, 6),
      cash_neto_ars_snapshot: round(cashArs - ivaArs - commissionArs, 2),
      cash_neto_usd_snapshot: round((cashArs - ivaArs - commissionArs) / normalized.tc, 6),
      created_by_email: normalizeEmail(user.email)
    };
  });

  const files = normalized.attachmentFiles.map((file, fileIndex) => {
    const operationIndex = Math.max(0, specs.findIndex((spec) => spec.attachmentNames.includes(file.name)));
    return {
      operationIndex,
      fileIndex,
      name: file.name,
      mimeType: file.type,
      sizeBytes: Number(file.size || Buffer.from(file.base64, 'base64').length),
      sha256: crypto.createHash('sha256').update(Buffer.from(file.base64, 'base64')).digest('hex')
    };
  });

  return {
    submissionKey: normalized.submissionKey,
    batchId,
    relatedSaleId,
    rows,
    files,
    calculation: {
      totalBatchCashUsd,
      totalBatchNetOfVatUsd,
      paymentMethod: payment.name,
      ivaRate: Number(payment.ivaRate || 0),
      commissionRate: Number(payment.commissionRate || 0)
    }
  };
}

async function prepare(payload, user, options = {}) {
  assertOperationalAccess(user, options);
  const repository = options.repository || httpRepository;
  const configResult = options.config
    ? { ...validateConfig(options.config), migrationReady: true, source: 'test' }
    : await loadConfig({ repository, allowFallback: true });
  const requestedGhlId = String(payload?.ghlId || '').trim();
  const lead = options.lead || await resolveLead(repository, requestedGhlId);
  if (!lead || String(lead.ghlid || '') !== requestedGhlId) {
    const error = new Error('No encontré el cliente en leads_raw de Supabase');
    error.statusCode = 404;
    throw error;
  }
  const normalized = comprobantesLoaderService._test.normalizePayload({
    ...payload,
    clientName: payload.clientName || lead.nombre,
    clientPageId: payload.clientPageId || lead.id
  }, user, {
    allowMissingAttachments: options.allowMissingAttachments !== false
  });
  // En el laboratorio Mati/Nadia pueden seleccionar responsable. En el futuro
  // cutover el cargador conserva exactamente las reglas de selección existentes.
  normalized.responsableVenta = canSelectResponsible(user)
    ? String(payload?.responsableVenta || '').trim()
    : resolvePersonName(user);
  if (!normalized.responsableVenta) {
    const error = new Error('Falta el responsable de venta');
    error.statusCode = 400;
    throw error;
  }
  if (!normalized.submissionKey || !/^[A-Za-z0-9-]{16,100}$/.test(normalized.submissionKey)) {
    const error = new Error('Falta un identificador único válido para simular la carga');
    error.statusCode = 400;
    throw error;
  }

  normalized.clientName = lead.nombre || normalized.clientName;
  normalized.clientPageId = lead.id || normalized.clientPageId;

  let relatedSale = options.relatedSale || null;
  if (normalized.tipo === 'Cobranza' || normalized.tipo === 'Devolución') {
    relatedSale = relatedSale || await repository.getSale(normalized.latestSaleId, normalized.ghlId);
    if (!relatedSale || String(relatedSale.ghlid || '') !== String(normalized.ghlId)) {
      const error = new Error('La venta relacionada no existe en Supabase o pertenece a otro cliente');
      error.statusCode = 400;
      throw error;
    }
    normalized.fechaVenta = String(relatedSale.f_venta || relatedSale.fecha_correspondiente || '').slice(0, 10);
  }

  const prepared = buildRows({
    normalized,
    config: configResult,
    lead,
    relatedSale,
    user,
    idFactory: options.idFactory,
    now: options.now
  });
  return {
    ...prepared,
    migrationReady: configResult.migrationReady !== false,
    configSource: configResult.source || 'supabase',
    safety: getSafetyStatus()
  };
}

async function preview(payload, user, options = {}) {
  const prepared = await prepare(payload, user, options);
  return { ...prepared, dryRun: true, persisted: false };
}

async function create(payload, user, options = {}) {
  assertOperationalAccess(user, options);
  if (!options.bypassSafety) assertWritesEnabled();
  const repository = options.repository || httpRepository;
  if (!options.bypassSafety && isCutoverActive()) {
    await assertCutoverReady(user, { ...options, repository });
  }
  options.onProgress?.({stage:'validating'});
  const prepared = await prepare(payload, user, { ...options, repository });
  if (!prepared.migrationReady && !options.bypassMigrationCheck) {
    const error = new Error('La migración del laboratorio todavía no está aplicada; no se escribió nada');
    error.statusCode = 409;
    throw error;
  }

  const bucket = getSafetyStatus().storageBucket;
  const existingSubmission = typeof repository.getSubmission === 'function'
    ? await repository.getSubmission(prepared.submissionKey)
    : null;
  if (existingSubmission?.actorEmail && normalizeEmail(existingSubmission.actorEmail) !== normalizeEmail(user.email)) {const error=new Error('La carga pertenece a otro usuario');error.statusCode=403;throw error;}
  if (existingSubmission?.status === 'completed') {
    const created = existingSubmission.created || [];
    return {
      ...prepared,
      rows: [],
      files: [],
      created,
      dryRun: false,
      persisted: true,
      result: {
        ok: true,
        idempotentReplay: true,
        submissionKey: prepared.submissionKey,
        created
      }
    };
  }

  const uploadedFiles = [];
  let batchAttempted = false;
  try {
    const files = new Array(prepared.files.length);
    const staged = prepared.files.map(metadata => ({bucket,object_path:`${prepared.batchId}/${metadata.operationIndex}-${metadata.sha256.slice(0,12)}-${safeStorageFileName(metadata.name)}`}));
    if (repository.stageFiles) await repository.stageFiles(staged, normalizeEmail(user.email));
    let nextFile=0,completed=0,uploadError=null;
    options.onProgress?.({stage:'uploading',completed,total:prepared.files.length});
    async function worker() {
      while (!uploadError && nextFile<prepared.files.length) {
        const index=nextFile++,metadata=prepared.files[index];
        try {
          const source=payload.attachmentFiles[metadata.fileIndex];
          if (!source || source.name!==metadata.name) throw new Error(`No encontré el archivo ${metadata.name} para subirlo a Supabase`);
          const objectPath=staged[index].object_path;
          await repository.uploadFile(bucket,objectPath,source);
          uploadedFiles.push({comprobante_id:prepared.rows[metadata.operationIndex]?.id||null,bucket,object_path:objectPath});
          const {fileIndex,...persistedMetadata}=metadata;
          files[index]={...persistedMetadata,bucket,objectPath};
          completed++;options.onProgress?.({stage:'uploading',completed,total:prepared.files.length});
        } catch(error) {uploadError=uploadError||error;}
      }
    }
    // Wait for every in-flight upload before cleanup; never leave a late upload behind.
    await Promise.all(Array.from({length:Math.min(3,prepared.files.length)},()=>worker()));
    if (uploadError) throw uploadError;
    options.onProgress?.({stage:'saving'});
    batchAttempted = true;
    const result = await repository.createBatch({
      submissionKey: prepared.submissionKey,
      batchId: prepared.batchId,
      actorEmail: normalizeEmail(user.email),
      rows: prepared.rows,
      files
    });
    const duplicateCleanup = result?.idempotentReplay && uploadedFiles.length
      ? await cleanupStorageFiles(repository, uploadedFiles, {
          actorEmail: user.email,
          reason: 'idempotent_replay_cleanup_failed'
        })
      : null;
    return {
      ...prepared,
      created: result?.created || [],
      dryRun: false,
      persisted: true,
      ...(duplicateCleanup ? { duplicateCleanup } : {}),
      result
    };
  } catch (error) {
    let submission = null;
    let confirmationError = null;
    if (batchAttempted && typeof repository.getSubmission === 'function') {
      try {
        submission = await repository.getSubmission(prepared.submissionKey);
      } catch (caughtConfirmationError) {
        confirmationError = caughtConfirmationError;
      }
    }

    if (submission?.status === 'completed') {
      const created = submission.created || [];
      return {
        ...prepared,
        created,
        dryRun: false,
        persisted: true,
        recoveredAfterAmbiguousResponse: true,
        result: {
          ok: true,
          idempotentReplay: true,
          submissionKey: prepared.submissionKey,
          created
        }
      };
    }

    const cleanupIsSafe = !batchAttempted || !confirmationError;
    if (uploadedFiles.length && cleanupIsSafe) {
      const cleanup = await cleanupStorageFiles(repository, uploadedFiles, {
        actorEmail: user.email,
        reason: 'failed_batch_cleanup_failed'
      });
      if (cleanup.errors.length) error.cleanupError = cleanup.errors.join(' | ');
      if (cleanup.queued) error.cleanupQueued = cleanup.queued;
    }
    if (confirmationError) {
      error.confirmationError = confirmationError.message;
      error.cleanupDeferred = true;
    }
    throw error;
  }
}

function requiredText(value, label) {
  const text = String(value ?? '').trim();
  if (!text) {
    const error = new Error(`Falta ${label}`);
    error.statusCode = 400;
    throw error;
  }
  return text;
}

function positiveNumber(value, label) {
  const number = Number(String(value ?? '').replace(',', '.'));
  if (!Number.isFinite(number) || number <= 0) {
    const error = new Error(`${label} debe ser mayor a cero`);
    error.statusCode = 400;
    throw error;
  }
  return number;
}

function validDate(value, label) {
  const date = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00Z`))) {
    const error = new Error(`Falta ${label} o no es válida`);
    error.statusCode = 400;
    throw error;
  }
  return date;
}

function validComprobanteId(value) {
  const id = String(value || '').trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) {
    const error = new Error('El comprobante indicado no es válido');
    error.statusCode = 400;
    throw error;
  }
  return id;
}

function canManageRow(row = {}, user = {}) {
  if (/^\[(TEST SUPABASE LOCAL|SUPABASE DIRECT)\]/.test(String(row.info_comprobantes || ''))) {
    try {
      const actor=JSON.parse(String(row.info_comprobantes).split('\nTEST_METADATA=').pop()).actorEmail;
      if (actor) return normalizeEmail(actor) === normalizeEmail(user.email)
        && comprobantesLoaderService._test.canEditComprobanteStatus(row);
    } catch { /* Historical rows retain their existing ownership rule. */ }
  }
  const sameCreator = normalizeEmail(row.created_by_email)
    && normalizeEmail(row.created_by_email) === normalizeEmail(user.email);
  return (sameCreator && comprobantesLoaderService._test.canEditComprobanteStatus(row))
    || comprobantesLoaderService._test.canManageOwnComprobante(row, user);
}

function canViewRow(row = {}, user = {}) {
  if (canAccessLab(user)) return true;
  const person = normalizeText(resolvePersonName(user));
  return Boolean(person) && [row.responsable_venta, row.setter, row.creado_por]
    .some((value) => normalizeText(value) === person);
}

async function getManagedRow(rawId, user, options = {}) {
  assertOperationalAccess(user, options);
  const repository = options.repository || httpRepository;
  const row = await repository.getComprobante(validComprobanteId(rawId));
  if (!row) {
    const error = new Error('No encontré ese comprobante en Supabase');
    error.statusCode = 404;
    throw error;
  }
  if (!canManageRow(row, user)) {
    const error = new Error('Sólo quien cargó un comprobante no conciliado o rebotado puede editarlo o eliminarlo');
    error.statusCode = 403;
    throw error;
  }
  return { row, repository };
}

async function isDirectComprobante(rawId, options = {}) {
  const repository = options.repository || httpRepository;
  const row = await repository.getComprobante(validComprobanteId(rawId));
  return row?.source_system === 'supabase_direct';
}

function editableData(row = {}, bootstrap = {}) {
  const type = String(row.tipo || '').replace('Devolucion', 'Devolución');
  const payments = String(row.cantidad_de_pagos || '').match(/\d+/)?.[0] || '';
  return {
    id: row.id,
    tipo: type,
    estado: row.estado || '',
    rebotar_pago: row.rebotar_pago,
    motivoRebote: row.motivo_rebote || '',
    clientName: row.cliente_format || '',
    ghlId: row.ghlid || '',
    responsibleName: row.responsable_venta || '',
    createdBy: row.creado_por || '',
    isCheque: row.cheque === true || row.cheque === 'true',
    fechaVenta: String(row.f_venta || '').slice(0, 10),
    fechaAcreditacion: String(row.f_acreditacion || '').slice(0, 10),
    dniCuit: row.dni_cuit || '',
    medioPago: row.medios_de_pago_format || row.medios_de_pago || '',
    tc: row.tc ?? '',
    cashCollectedArs: row.cash_ar ?? row.cash_collected_ar ?? row.cash_collected_ars ?? '',
    productName: row.producto_format || '',
    facturacionUsd: row.facturacion ?? '',
    cantidadPagos: Number(payments) || '',
    infoComprobantes: row.info_comprobantes || '',
    mediosDePagoOptions: bootstrap.mediosDePagoOptions || [],
    products: bootstrap.products || [],
    cantidadPagosOptions: bootstrap.cantidadPagosOptions || []
  };
}

async function getEditableComprobante(rawId, user, options = {}) {
  const { row } = await getManagedRow(rawId, user, options);
  const bootstrap = await getBootstrap(user, { ...options, allowOperationalUser: true });
  return editableData(row, bootstrap);
}

async function updateEditableComprobante(rawId, payload, user, options = {}) {
  if (!options.bypassSafety) assertWritesEnabled();
  const { row, repository } = await getManagedRow(rawId, user, options);
  const type = String(row.tipo || '').replace('Devolucion', 'Devolución');
  if (!['Venta', 'Cobranza', 'Devolución'].includes(type)) {
    const error = new Error('El tipo actual del comprobante no permite edición desde esta vista');
    error.statusCode = 409;
    throw error;
  }
  const config = await loadConfig({ repository, allowFallback: false });
  const accreditationDate = validDate(payload.fechaAcreditacion, 'la fecha de acreditación');
  const saleDate = type === 'Venta'
    ? validDate(payload.fechaVenta, 'la fecha de venta')
    : String(row.f_venta || row.fecha_correspondiente || '').slice(0, 10);
  const tc = positiveNumber(payload.tc, 'La tasa de cambio');
  const cashArs = positiveNumber(payload.cashCollectedArs, 'Cash collected ARS');
  const payment = findActiveByName(config.paymentMethods, requiredText(payload.medioPago, 'el medio de pago'), 'El medio de pago');
  const product = type === 'Venta'
    ? findActiveByName(config.products, requiredText(payload.productName, 'el producto adquirido'), 'El producto')
    : null;
  const facturationUsd = type === 'Venta'
    ? positiveNumber(payload.facturacionUsd, 'La facturación USD')
    : (type === 'Devolución' && String(payload.facturacionUsd || '').trim()
      ? positiveNumber(payload.facturacionUsd, 'La facturación USD')
      : null);
  const payments = type === 'Venta' && row.cheque !== true && row.cheque !== 'true' ? Number(payload.cantidadPagos) : null;
  if (type === 'Venta' && row.cheque !== true && row.cheque !== 'true' && (!Number.isInteger(payments) || payments < 1 || payments > MAX_BATCH_OPERATIONS)) {
    const error = new Error(`La cantidad de pagos debe ser un número entero entre 1 y ${MAX_BATCH_OPERATIONS}`);
    error.statusCode = 400;
    throw error;
  }
  const ivaArs = includedAmount(cashArs, payment.ivaRate);
  const commissionArs = includedAmount(cashArs, payment.commissionRate);
  const info = String(payload.infoComprobantes ?? row.info_comprobantes ?? '').trim();
  const salePeriod = period(saleDate);
  const accreditationPeriod = period(accreditationDate);
  const patch = {
    fecha_de_acreditacion: storedDate(accreditationDate),
    f_acreditacion: storedDate(accreditationDate),
    f_acreditacion_format: formatDate(accreditationDate),
    f_transaccion_string: formatDate(accreditationDate),
    acreditado_periodo_m: accreditationPeriod.month,
    acreditado_periodo_y: accreditationPeriod.year,
    cash_collected: round(cashArs / tc, 2),
    cash_ar: cashArs,
    cash_collected_ar: cashArs,
    cash_collected_ars: cashArs,
    monto_pesos: cashArs,
    tc: String(tc),
    dni_cuit: requiredText(payload.dniCuit, 'el DNI / CUIT'),
    info_comprobantes: info,
    medios_de_pago: payment.id || payment.legacyNotionId || payment.code,
    medios_de_pago_format: payment.name,
    medio_pago_id: payment.id || null,
    tipo_banco: payment.type || null,
    cheque: comprobantesLoaderService._test.isChequePaymentMethod(payment.name),
    iva: ivaArs,
    comisiones: commissionArs,
    iva_tasa: Number(payment.ivaRate || 0),
    comision_tasa: Number(payment.commissionRate || 0),
    iva_usd: round(ivaArs / tc, 6),
    comision_usd: round(commissionArs / tc, 6),
    cash_neto_ars_snapshot: round(cashArs - ivaArs - commissionArs, 2),
    cash_neto_usd_snapshot: round((cashArs - ivaArs - commissionArs) / tc, 6),
    cash_collected_neto: round((cashArs - ivaArs) / tc, 6),
    cash_collected_neto_ars: round(cashArs - ivaArs, 2)
  };
  if (type === 'Venta') Object.assign(patch, {
    productos: product.id || product.legacyNotionId || product.code,
    producto_id: product.id || null,
    producto_format: product.name,
    facturacion: facturationUsd,
    facturacion_ars: round(facturationUsd * tc, 2),
    cantidad_de_pagos: `${payments} ${payments === 1 ? 'Pago' : 'Pagos'}`,
    fecha_respaldo: storedDate(saleDate),
    fecha_correspondiente: storedDate(saleDate),
    f_venta: storedDate(saleDate),
    correspondiente_format: formatDate(saleDate),
    fecha_de_venta_format: formatDate(saleDate),
    correspondiente_periodo_m: salePeriod.month,
    correspondiente_periodo_a: salePeriod.year,
    venta_periodo_m: salePeriod.month,
    venta_periodo_a: salePeriod.year
  });
  if (type === 'Devolución') patch.facturacion = facturationUsd;
  const result = await repository.updateComprobante({
    id: row.id,
    actorEmail: normalizeEmail(user.email),
    patch,
    expectedRow: row,
    resubmit: payload.resubmit === true || payload.resubmit === 'true'
  });
  return {
    id: row.id,
    message: payload.resubmit === true || payload.resubmit === 'true' ? 'Corrección guardada y reenviada a conciliación.' : 'Cambios guardados directamente en Supabase.',
    updated: {
      estado: result?.row?.estado ?? '',
      rebotar_pago: result?.row?.rebotar_pago ?? row.rebotar_pago,
      motivo_rebote: result?.row?.motivo_rebote ?? '',
      fechaVenta: saleDate,
      fechaAcreditacion: accreditationDate,
      dniCuit: patch.dni_cuit,
      medioPago: payment.name,
      tc,
      cashCollectedArs: cashArs,
      productName: product?.name || '',
      facturacionUsd: facturationUsd,
      cantidadPagos: payments,
      infoComprobantes: info
    },
    result
  };
}

async function deleteEditableComprobante(rawId, user, options = {}) {
  if (!options.bypassSafety) assertWritesEnabled();
  const { row, repository } = await getManagedRow(rawId, user, options);
  const files = typeof repository.listFiles === 'function' ? await repository.listFiles(row.id) : [];
  const result = await repository.deleteComprobante({
    id: row.id,
    actorEmail: normalizeEmail(user.email),
    expectedRow: row
  });
  const cleanup = await cleanupStorageFiles(repository, files, {
    comprobanteId: row.id,
    actorEmail: user.email,
    reason: 'delete_cleanup_failed'
  });
  const cleanupErrors = cleanup.errors;
  const cleanupQueued = cleanup.queued;
  return {
    id: row.id,
    message: cleanupQueued
      ? `Comprobante eliminado de Supabase; ${cleanupQueued} archivo(s) quedaron en cola para reintentar la limpieza.`
      : cleanupErrors.length
        ? 'Comprobante eliminado de Supabase, pero no se pudo completar ni registrar la limpieza del almacenamiento.'
      : 'Comprobante eliminado de Supabase.',
    cleanupErrors,
    cleanupQueued,
    result
  };
}

const RECONCILIATION_STATES = {
  conciliated: 'Conciliado',
  not_conciliated: null,
  bounced: 'Rebotado'
};

async function updateReconciliation(rawId, rawState, user, options = {}) {
  assertOperationalAccess(user, { ...options, allowOperationalUser: true });
  if (!options.bypassSafety) assertWritesEnabled();
  const state = String(rawState || '').trim().toLowerCase();
  if (!Object.hasOwn(RECONCILIATION_STATES, state)) {
    const error = new Error('Estado inválido. Elegí Conciliado, No conciliado o Rebotado');
    error.statusCode = 400;
    throw error;
  }
  const repository = options.repository || httpRepository;
  const id = validComprobanteId(rawId);
  const result = await repository.updateReconciliation({
    id,
    actorEmail: normalizeEmail(user.email),
    state,
    status: RECONCILIATION_STATES[state],
    bounced: state === 'bounced'
  });
  return {
    row: result?.row || result,
    state,
    message: `Comprobante marcado como ${RECONCILIATION_STATES[state] || 'No conciliado'}`
  };
}

async function listSignedFiles(rawId, user, options = {}) {
  assertOperationalAccess(user, { ...options, allowOperationalUser: true });
  const repository = options.repository || httpRepository;
  const id = validComprobanteId(rawId);
  const row = await repository.getComprobante(id);
  if (!row) {
    const error = new Error('No encontré ese comprobante en Supabase');
    error.statusCode = 404;
    throw error;
  }
  if (!canViewRow(row, user)) {
    const error = new Error('No tenés permiso para ver los archivos de este comprobante');
    error.statusCode = 403;
    throw error;
  }
  const files = await repository.listFiles(id);
  return Promise.all(files.map(async (file) => ({
    id: file.id,
    name: file.original_name,
    mimeType: file.mime_type,
    sizeBytes: Number(file.size_bytes || 0),
    url: await repository.signFile(file.bucket, file.object_path, 600),
    expiresIn: 600
  })));
}

async function getStorageCleanupQueue(user, options = {}) {
  assertLabAccess(user);
  const repository = options.repository || httpRepository;
  try {
    const rows = typeof repository.listPendingFileCleanup === 'function'
      ? await repository.listPendingFileCleanup(options.limit)
      : [];
    return { migrationReady: true, count: rows.length, rows };
  } catch (error) {
    if (isMissingRelationError(error)) return { migrationReady: false, count: 0, rows: [] };
    throw error;
  }
}

async function retryStorageCleanup(user, options = {}) {
  assertLabAccess(user);
  if (!options.bypassSafety) assertWritesEnabled();
  const repository = options.repository || httpRepository;
  const rows = typeof repository.listPendingFileCleanup === 'function'
    ? await repository.listPendingFileCleanup(options.limit)
    : [];
  const summary = { attempted: rows.length, completed: 0, failed: 0, results: [] };
  for (const row of rows) {
    try {
      await repository.removeFiles(row.bucket, [row.object_path]);
      await repository.finishFileCleanup(row.id, true, null, user.email);
      summary.completed += 1;
      summary.results.push({ id: row.id, ok: true });
    } catch (error) {
      summary.failed += 1;
      try {
        await repository.finishFileCleanup(row.id, false, error.message, user.email);
      } catch (finishError) {
        error.message = `${error.message}; además falló registrar el intento: ${finishError.message}`;
      }
      summary.results.push({ id: row.id, ok: false, error: error.message });
    }
  }
  return summary;
}

module.exports = {
  canAccessLab,
  getSafetyStatus,
  isCutoverActive,
  getConfig,
  getCutoverReadiness,
  getBootstrap,
  saveConfig,
  lookupClient,
  lookupRelatedSale,
  preview,
  create,
  getEditableComprobante,
  updateEditableComprobante,
  deleteEditableComprobante,
  isDirectComprobante,
  updateReconciliation,
  listSignedFiles,
  getStorageCleanupQueue,
  retryStorageCleanup,
  _test: {
    DEFAULT_PRODUCTS,
    DEFAULT_PAYMENT_METHODS,
    DEFAULT_RESPONSIBLE_PEOPLE,
    DEFAULT_RULES,
    EXPECTED_AUDITED_PAYMENT_METHODS,
    EXPECTED_HISTORICAL_FILES,
    validateConfig,
    buildCutoverReadiness,
    assertCutoverReady,
    includedAmount,
    safeStorageFileName,
    operationSpecs,
    buildRows,
    leadSnapshot,
    storedDate,
    period,
    addCalendarMonths,
    assertWritesEnabled,
    canManageRow,
    canViewRow,
    editableData,
    parseGhlId,
    saleForClient,
    relationId,
    resolveLead
  }
};
