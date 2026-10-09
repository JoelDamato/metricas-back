#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const directService = require('../modules/metricasv2/services/comprobantes-direct.service');
const loaderService = require('../modules/metricasv2/services/comprobantes-loader.service');

const pgliteEntry = process.env.PGLITE_PACKAGE_PATH
  || '@electric-sql/pglite';

if (!fs.existsSync(pgliteEntry)) {
  throw new Error(`No encontré PGlite en ${pgliteEntry}. Instalalo fuera del proyecto y definí PGLITE_PACKAGE_PATH.`);
}

const { PGlite } = require(pgliteEntry);
const { pgcrypto } = require(path.join(path.dirname(pgliteEntry), 'contrib/pgcrypto.cjs'));

const MATI = { email: 'matirandazzo@gmail.com', nombre: 'Mati Randazzo' };
const NAHUEL = { email: 'iascinahuel@gmail.com', nombre: 'Nahuel Iasci' };
const LEAD = {
  id: '29f48251-7a95-800d-9168-fefc4ff0ff16',
  ghlid: 'local-lead-001',
  nombre: 'Cliente Local',
  mail: 'cliente-local@example.test',
  telefono: '1111111111',
  setter: 'Nahuel Iasci',
  closer: 'Claudio Nicolini',
  origen_actual: 'Postulación MEG - APSET',
  primer_origen: 'Postulación MEG - VSL',
  fecha_agenda: '2026-09-15T12:00:00Z',
  llamada_meg: 'Efectuada',
  modelo_negocio: 'Servicios',
  monto_incobrable: 0
};

const MIGRATION_COLUMNS = new Set([
  'submission_key',
  'batch_id',
  'operation_index',
  'source_system',
  'legacy_notion_id',
  'lead_id',
  'cliente_ghlid',
  'venta_id',
  'producto_id',
  'medio_pago_id',
  'responsable_venta_id',
  'iva_tasa',
  'comision_tasa',
  'iva_usd',
  'comision_usd',
  'cash_collected_neto',
  'cash_collected_neto_ars',
  'cash_collected_neto_total',
  'cash_neto_ars_snapshot',
  'cash_neto_usd_snapshot',
  'meses_soporte',
  'sesiones_configuradas',
  'bonus_mati',
  'created_by_email',
  'deleted_at'
]);

const NUMERIC_COLUMNS = new Set([
  'score',
  'monto_incobrable',
  'cash_collected',
  'cash_ar',
  'cash_collected_ar',
  'cash_collected_ars',
  'cash_collected_total',
  'facturacion',
  'facturacion_ars',
  'monto_pesos',
  'iva',
  'comisiones',
  'neto_club',
  'porcentaje_venta_vieja'
]);

const TIMESTAMP_COLUMNS = new Set([
  'fecha_correspondiente',
  'fecha_creado',
  'fecha_de_agendamiento',
  'fecha_respaldo',
  'fecha_de_acreditacion',
  'f_acreditacion',
  'f_venta',
  'f_renovacion',
  'fecha_facturado'
]);

const BOOLEAN_COLUMNS = new Set([
  'cheque',
  'rebotar_pago',
  'rectificar_pago',
  'finalizar',
  'bonus_mati'
]);

function fixedIds(...ids) {
  let index = 0;
  return () => ids[index++];
}

function file(name, type, content) {
  const buffer = Buffer.from(content);
  return { name, type, size: buffer.length, base64: buffer.toString('base64') };
}

function salePayload() {
  const files = [
    file('cheque-1.png', 'image/png', 'cheque-local-1'),
    file('cheque-2.png', 'image/png', 'cheque-local-2'),
    file('cheque-3.png', 'image/png', 'cheque-local-3')
  ];
  return {
    tipo: 'Venta',
    ghlId: LEAD.ghlid,
    clientName: LEAD.nombre,
    clientPageId: LEAD.id,
    responsableVenta: 'Claudio Nicolini',
    fechaVenta: '2026-09-21',
    fechaAcreditacion: '2026-09-21',
    tc: 1210,
    cashCollectedArs: 3630000,
    medioPago: 'E-cheq Bco Frances',
    dniCuit: '20348137000',
    productName: 'Meg 2.1',
    facturacionUsd: 3000,
    cantidadPagos: 3,
    chequeCount: 3,
    cheques: [
      { montoArs: 1210000, fechaAcreditacion: '2026-09-21', archivoNombre: files[0].name },
      { montoArs: 1210000, fechaAcreditacion: '2026-10-21', archivoNombre: files[1].name },
      { montoArs: 1210000, fechaAcreditacion: '2026-11-21', archivoNombre: files[2].name }
    ],
    submissionKey: 'local-sale-three-cheques-001',
    attachmentFiles: files
  };
}

function collectionPayload(saleId) {
  return {
    tipo: 'Cobranza',
    ghlId: LEAD.ghlid,
    clientName: LEAD.nombre,
    clientPageId: LEAD.id,
    responsableVenta: 'Claudio Nicolini',
    fechaVenta: '2026-09-21',
    fechaAcreditacion: '2026-12-21',
    tc: 1210,
    cashCollectedArs: 1210000,
    medioPago: 'Exentos',
    dniCuit: '20348137000',
    latestSaleId: saleId,
    submissionKey: 'local-collection-0000001',
    attachmentFiles: [file('cobranza.pdf', 'application/pdf', 'cobranza-local')]
  };
}

function clubPayload() {
  return {
    tipo: 'Venta',
    ghlId: LEAD.ghlid,
    clientName: LEAD.nombre,
    clientPageId: LEAD.id,
    responsableVenta: 'Claudio Nicolini',
    fechaVenta: '2026-09-21',
    fechaAcreditacion: '2026-09-21',
    tc: 1210,
    medioPago: 'Club - Transferencias',
    dniCuit: '',
    productName: 'Club',
    clubPriceKey: 'club1',
    submissionKey: 'local-club-sale-0000001',
    attachmentFiles: [file('club.png', 'image/png', 'club-local')]
  };
}

function refundPayload(saleId) {
  return {
    tipo: 'Devolución',
    ghlId: LEAD.ghlid,
    clientName: LEAD.nombre,
    clientPageId: LEAD.id,
    responsableVenta: 'Claudio Nicolini',
    fechaAcreditacion: '2026-09-22',
    tc: 1210,
    cashCollectedArs: 121000,
    medioPago: 'Banco Matias',
    dniCuit: '20348137000',
    facturacionUsd: 100,
    latestSaleId: saleId,
    submissionKey: 'local-refund-0000000001',
    attachmentFiles: [file('devolucion.pdf', 'application/pdf', 'devolucion-local')]
  };
}

function sqlType(column) {
  if (column === 'id') return 'text primary key';
  if (BOOLEAN_COLUMNS.has(column)) return 'boolean';
  if (NUMERIC_COLUMNS.has(column)) return 'numeric';
  if (TIMESTAMP_COLUMNS.has(column)) return 'timestamptz';
  return 'text';
}

function baseComprobantesSql(sampleRow) {
  const columns = Object.keys(sampleRow)
    .filter((column) => !MIGRATION_COLUMNS.has(column))
    .map((column) => `${column} ${sqlType(column)}`);
  return `create table public.comprobantes (${columns.join(',\n')});`;
}

async function bootstrapDatabase(db, sampleRow) {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;
    create schema storage;
    create table storage.buckets (
      id text primary key,
      name text not null,
      public boolean not null default false,
      file_size_limit bigint,
      allowed_mime_types text[]
    );
    create table public.leads_raw (
      id text primary key,
      ghlid text,
      nombre text,
      fecha_agenda timestamptz,
      monto_incobrable numeric
    );
    ${baseComprobantesSql(sampleRow)}
  `);
  await db.query(
    `insert into public.leads_raw (id, ghlid, nombre, fecha_agenda, monto_incobrable)
     values ($1, $2, $3, $4, $5)`,
    [LEAD.id, LEAD.ghlid, LEAD.nombre, LEAD.fecha_agenda, LEAD.monto_incobrable]
  );
  const migration = fs.readFileSync(path.join(
    __dirname,
    '../supabase/migrations/20260921173000_create_comprobantes_supabase_direct_lab.sql'
  ), 'utf8');
  await db.exec(migration);
}

function createRepository(db) {
  const objects = new Map();
  return {
    objects,
    async getConfig() {
      const productsResult = await db.query(
        'select id, legacy_notion_id, code, name, active, club_prices from public.comprobantes_productos_config order by position, name'
      );
      const paymentsResult = await db.query(
        'select id, legacy_notion_id, code, name, active, payment_type, account_label, iva_rate, commission_rate, initial_balance from public.comprobantes_medios_pago_config order by position, name'
      );
      const responsibleResult = await db.query(
        'select id, code, name, email, role, active from public.comprobantes_responsables_config order by position, name'
      );
      const rulesResult = await db.query("select rules from public.comprobantes_reglas_config where id = 'default'");
      return {
        migrationReady: true,
        products: productsResult.rows.map((row) => ({
          id: row.id,
          legacyNotionId: row.legacy_notion_id,
          code: row.code,
          name: row.name,
          active: row.active,
          clubPrices: row.club_prices
        })),
        paymentMethods: paymentsResult.rows.map((row) => ({
          id: row.id,
          legacyNotionId: row.legacy_notion_id,
          code: row.code,
          name: row.name,
          active: row.active,
          type: row.payment_type,
          account: row.account_label,
          ivaRate: Number(row.iva_rate),
          commissionRate: Number(row.commission_rate),
          initialBalance: Number(row.initial_balance)
        })),
        responsiblePeople: responsibleResult.rows.map((row) => ({
          id: row.id,
          code: row.code,
          name: row.name,
          email: row.email || '',
          role: row.role,
          active: row.active
        })),
        rules: rulesResult.rows[0].rules
      };
    },
    async getLead(ghlId) {
      const result = await db.query('select id, ghlid, nombre, fecha_agenda, monto_incobrable from public.leads_raw where ghlid = $1', [ghlId]);
      if (!result.rows[0]) return null;
      return {
        ...LEAD,
        ...result.rows[0],
        fecha_agenda: result.rows[0].fecha_agenda instanceof Date
          ? result.rows[0].fecha_agenda.toISOString()
          : result.rows[0].fecha_agenda
      };
    },
    async getSale(id, ghlId) {
      const result = id
        ? await db.query('select * from public.comprobantes where id = $1 and tipo = $2 limit 1', [id, 'Venta'])
        : await db.query('select * from public.comprobantes where ghlid = $1 and tipo = $2 order by f_venta desc limit 1', [ghlId, 'Venta']);
      const row = result.rows[0];
      if (!row) return null;
      return Object.fromEntries(Object.entries(row).map(([key, value]) => [
        key,
        value instanceof Date ? value.toISOString() : value
      ]));
    },
    async getComprobante(id) {
      const result = await db.query('select * from public.comprobantes where id = $1 limit 1', [id]);
      const row = result.rows[0];
      if (!row) return null;
      return Object.fromEntries(Object.entries(row).map(([key, value]) => [
        key,
        value instanceof Date ? value.toISOString() : value
      ]));
    },
    async getSubmission(submissionKey) {
      const batchResult = await db.query(
        'select id, submission_key, status from public.comprobantes_submission_batches where submission_key = $1',
        [submissionKey]
      );
      if (!batchResult.rows[0]) return null;
      const rowsResult = await db.query(
        'select id, tipo from public.comprobantes where submission_key = $1 order by operation_index',
        [submissionKey]
      );
      return {
        ...batchResult.rows[0],
        created: rowsResult.rows.map((row) => ({ id: row.id, type: row.tipo }))
      };
    },
    async uploadFile(bucket, objectPath, source) {
      const key = `${bucket}/${objectPath}`;
      if (objects.has(key)) throw new Error(`Objeto duplicado: ${key}`);
      objects.set(key, Buffer.from(source.base64, 'base64'));
      return { key };
    },
    async removeFiles(bucket, paths) {
      paths.forEach((objectPath) => objects.delete(`${bucket}/${objectPath}`));
    },
    async enqueueFileCleanup(files, context = {}) {
      await db.query(
        'select public.metricas_enqueue_storage_cleanup_v1($1::jsonb)',
        [JSON.stringify({
          comprobanteId: context.comprobanteId || files[0]?.comprobante_id || null,
          actorEmail: String(context.actorEmail || '').toLowerCase() || null,
          reason: context.reason || 'delete_cleanup_failed',
          error: String(context.error || '') || null,
          files: files.map((source) => ({
            comprobanteId: source.comprobante_id || context.comprobanteId || null,
            bucket: source.bucket,
            objectPath: source.object_path
          }))
        })]
      );
    },
    async createBatch(payload) {
      const result = await db.query(
        'select public.metricas_create_comprobante_batch_v1($1::jsonb) as result',
        [JSON.stringify(payload)]
      );
      return result.rows[0].result;
    },
    async updateComprobante(payload) {
      const result = await db.query(
        'select public.metricas_update_comprobante_direct_v1($1::jsonb) as result',
        [JSON.stringify(payload)]
      );
      return result.rows[0].result;
    },
    async deleteComprobante(payload) {
      const result = await db.query(
        'select public.metricas_delete_comprobante_direct_v1($1::jsonb) as result',
        [JSON.stringify(payload)]
      );
      return result.rows[0].result;
    },
    async updateReconciliation(payload) {
      const result = await db.query(
        'select public.metricas_update_comprobante_reconciliation_v1($1::jsonb) as result',
        [JSON.stringify(payload)]
      );
      return result.rows[0].result;
    },
    async listFiles(comprobanteId) {
      const result = await db.query(
        'select * from public.comprobantes_archivos where comprobante_id = $1 order by created_at',
        [comprobanteId]
      );
      return result.rows;
    },
    async signFile(bucket, objectPath) {
      return `https://local.invalid/${bucket}/${objectPath}`;
    }
  };
}

async function scalar(db, sql, params = []) {
  const result = await db.query(sql, params);
  return Object.values(result.rows[0] || {})[0];
}

async function main() {
  const normalized = loaderService._test.normalizePayload(salePayload(), MATI, { allowMissingAttachments: false });
  const sample = directService._test.buildRows({
    normalized,
    config: {
      products: directService._test.DEFAULT_PRODUCTS,
      paymentMethods: directService._test.DEFAULT_PAYMENT_METHODS,
      responsiblePeople: directService._test.DEFAULT_RESPONSIBLE_PEOPLE,
      rules: directService._test.DEFAULT_RULES
    },
    lead: LEAD,
    user: MATI,
    idFactory: fixedIds(
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000003',
      '20000000-0000-4000-8000-000000000001'
    ),
    now: new Date('2026-09-21T18:00:00Z')
  });
  const legacyWebhookSource = fs.readFileSync(path.join(__dirname, '../controllers/webhookcom.js'), 'utf8');
  const legacyRowBlock = legacyWebhookSource.slice(
    legacyWebhookSource.indexOf('const row = {'),
    legacyWebhookSource.indexOf('Object.keys(row)')
  );
  const legacyWebhookFields = [...legacyRowBlock.matchAll(/^\s{4}([a-zA-Z0-9_]+):/gm)]
    .map((match) => match[1]);
  const missingLegacyFields = legacyWebhookFields.filter((field) => !Object.hasOwn(sample.rows[0], field));
  assert.deepEqual(missingLegacyFields, [], `Faltan campos del webhook histórico: ${missingLegacyFields.join(', ')}`);
  assert.equal(sample.rows.every((row) => row.finalizar === true), true);

  const db = new PGlite({ extensions: { pgcrypto } });
  await db.waitReady;
  await bootstrapDatabase(db, sample.rows[0]);
  const repository = createRepository(db);
  const seededConfig = await repository.getConfig();
  const expectedPaymentMethods = directService._test.DEFAULT_PAYMENT_METHODS;
  const comparablePayment = (item) => ({
    legacyNotionId: item.legacyNotionId,
    code: item.code,
    name: item.name,
    active: item.active,
    type: item.type,
    ivaRate: Number(item.ivaRate || 0),
    commissionRate: Number(item.commissionRate || 0),
    initialBalance: Number(item.initialBalance || 0),
    account: item.account
  });
  assert.equal(seededConfig.paymentMethods.length, 51);
  assert.equal(seededConfig.paymentMethods.filter((item) => item.active).length, 17);
  assert.deepEqual(
    seededConfig.paymentMethods.map(comparablePayment).sort((a, b) => a.legacyNotionId.localeCompare(b.legacyNotionId)),
    expectedPaymentMethods.map(comparablePayment).sort((a, b) => a.legacyNotionId.localeCompare(b.legacyNotionId))
  );

  const sale = await directService.create(salePayload(), MATI, {
    repository,
    bypassSafety: true,
    idFactory: fixedIds(
      '10000000-0000-4000-8000-000000000011',
      '10000000-0000-4000-8000-000000000012',
      '10000000-0000-4000-8000-000000000013',
      '20000000-0000-4000-8000-000000000011'
    ),
    now: new Date('2026-09-21T18:00:00Z')
  });
  assert.equal(sale.persisted, true);
  assert.deepEqual(sale.rows.map((row) => row.tipo), ['Venta', 'Cobranza', 'Cobranza']);
  assert.equal(await scalar(db, 'select count(*)::integer from public.comprobantes'), 3);
  assert.equal(await scalar(db, 'select count(*)::integer from public.comprobantes_archivos'), 3);
  assert.equal(repository.objects.size, 3);
  assert.equal(Number(await scalar(
    db,
    'select cash_collected_total from public.comprobantes where id = $1',
    [sale.rows[0].id]
  )), 3000);

  const retry = await directService.create(salePayload(), MATI, {
    repository,
    bypassSafety: true,
    idFactory: fixedIds(
      '10000000-0000-4000-8000-000000000031',
      '10000000-0000-4000-8000-000000000032',
      '10000000-0000-4000-8000-000000000033',
      '20000000-0000-4000-8000-000000000031'
    )
  });
  assert.equal(retry.result.idempotentReplay, true);
  assert.equal(await scalar(db, 'select count(*)::integer from public.comprobantes'), 3);
  assert.equal(repository.objects.size, 3);

  const collection = await directService.create(collectionPayload(sale.rows[0].id), MATI, {
    repository,
    bypassSafety: true,
    idFactory: fixedIds(
      '10000000-0000-4000-8000-000000000021',
      '20000000-0000-4000-8000-000000000021'
    ),
    now: new Date('2026-09-21T19:00:00Z')
  });
  assert.equal(collection.rows[0].venta_relacionada, sale.rows[0].id);
  assert.equal(await scalar(db, 'select count(*)::integer from public.comprobantes'), 4);
  assert.equal(Number(await scalar(
    db,
    'select cash_collected_total from public.comprobantes where id = $1',
    [sale.rows[0].id]
  )), 4000);
  assert.equal(Number(Number(await scalar(
    db,
    'select cash_collected_neto_total from public.comprobantes where id = $1',
    [sale.rows[0].id]
  )).toFixed(6)), 3479.338843);

  const bootstrap = await directService.getBootstrap(MATI, {
    repository,
    allowOperationalUser: true
  });
  assert.equal(bootstrap.productsSource, 'supabase');
  assert.equal(bootstrap.mediosDePagoOptions.includes('Banco Matias'), true);
  const lookedUpClient = await directService.lookupClient(LEAD.ghlid, MATI, {
    repository,
    allowOperationalUser: true
  });
  assert.equal(lookedUpClient.latestSale.ghlId, LEAD.ghlid);
  const lookedUpSale = await directService.lookupRelatedSale(sale.rows[0].id, {
    ghlId: LEAD.ghlid,
    clientPageId: LEAD.id
  }, MATI, {
    repository,
    allowOperationalUser: true
  });
  assert.equal(lookedUpSale.id, sale.rows[0].id);

  const editable = await directService.getEditableComprobante(collection.rows[0].id, MATI, {
    repository,
    allowOperationalUser: true
  });
  assert.equal(editable.tipo, 'Cobranza');
  assert.equal(await directService.isDirectComprobante(collection.rows[0].id, { repository }), true);
  const edited = await directService.updateEditableComprobante(collection.rows[0].id, {
    fechaAcreditacion: '2026-12-22',
    tc: 1210,
    cashCollectedArs: 605000,
    medioPago: 'Banco Matias',
    dniCuit: '20348137000',
    infoComprobantes: editable.infoComprobantes
  }, MATI, {
    repository,
    allowOperationalUser: true,
    bypassSafety: true
  });
  assert.equal(edited.updated.cashCollectedArs, 605000);
  assert.equal(Number(await scalar(
    db,
    'select cash_collected_total from public.comprobantes where id = $1',
    [sale.rows[0].id]
  )), 3500);
  assert.equal(Number(Number(await scalar(
    db,
    'select cash_collected_neto_total from public.comprobantes where id = $1',
    [sale.rows[0].id]
  )).toFixed(6)), 2892.561983);

  await directService.updateReconciliation(collection.rows[0].id, 'conciliated', MATI, {
    repository,
    bypassSafety: true
  });
  assert.equal(await scalar(
    db,
    'select estado from public.comprobantes where id = $1',
    [collection.rows[0].id]
  ), 'Conciliado');
  await assert.rejects(
    directService.updateEditableComprobante(collection.rows[0].id, {
      fechaAcreditacion: '2026-12-23',
      tc: 1210,
      cashCollectedArs: 605000,
      medioPago: 'Banco Matias',
      dniCuit: '20348137000'
    }, MATI, { repository, allowOperationalUser: true, bypassSafety: true }),
    /conciliado.*editar|no conciliado.*editar/i
  );
  await directService.updateReconciliation(collection.rows[0].id, 'bounced', MATI, {
    repository,
    bypassSafety: true
  });
  assert.equal(await scalar(
    db,
    'select rebotar_pago from public.comprobantes where id = $1',
    [collection.rows[0].id]
  ), true);

  const signedFiles = await directService.listSignedFiles(sale.rows[0].id, MATI, { repository });
  assert.equal(signedFiles.length, 1);
  assert.match(signedFiles[0].url, /^https:\/\/local\.invalid\//);
  await assert.rejects(
    directService.deleteEditableComprobante(sale.rows[0].id, MATI, {
      repository,
      allowOperationalUser: true,
      bypassSafety: true
    }),
    /cobranzas o devoluciones relacionadas/i
  );
  const nahuelSale = await directService.create({
    ...clubPayload(),
    submissionKey: 'local-nahuel-club-000001'
  }, NAHUEL, {
    repository,
    allowOperationalUser: true,
    bypassSafety: true,
    idFactory: fixedIds(
      '10000000-0000-4000-8000-000000000091',
      '20000000-0000-4000-8000-000000000091'
    ),
    now: new Date('2026-09-21T22:00:00Z')
  });
  assert.equal(nahuelSale.rows[0].responsable_venta, 'Nahuel Iasci');
  assert.equal(nahuelSale.rows[0].created_by_email, NAHUEL.email);
  await directService.deleteEditableComprobante(nahuelSale.rows[0].id, NAHUEL, {
    repository,
    allowOperationalUser: true,
    bypassSafety: true
  });
  assert.equal(repository.objects.size, 4);

  const club = await directService.create(clubPayload(), MATI, {
    repository,
    bypassSafety: true,
    idFactory: fixedIds(
      '10000000-0000-4000-8000-000000000041',
      '20000000-0000-4000-8000-000000000041'
    ),
    now: new Date('2026-09-21T20:00:00Z')
  });
  const clubRow = club.rows[0];
  const clubBase = 39500 / 1.21;
  const expectedClubNet = Number((clubBase - clubBase * 0.0629 - clubBase * 0.035).toFixed(6));
  assert.equal(clubRow.tipo, 'Venta');
  assert.equal(Number(clubRow.cash_collected_ars), 39500);
  assert.equal(Number(clubRow.neto_club), expectedClubNet);
  assert.equal(Number(await scalar(
    db,
    'select neto_club from public.comprobantes where id = $1',
    [clubRow.id]
  )), expectedClubNet);

  const refund = await directService.create(refundPayload(sale.rows[0].id), MATI, {
    repository,
    bypassSafety: true,
    idFactory: fixedIds(
      '10000000-0000-4000-8000-000000000051',
      '20000000-0000-4000-8000-000000000051'
    ),
    now: new Date('2026-09-21T21:00:00Z')
  });
  assert.equal(refund.rows[0].tipo, 'Devolucion');
  assert.equal(refund.rows[0].venta_id, sale.rows[0].id);
  assert.equal(Number(await scalar(
    db,
    'select cash_collected_total from public.comprobantes where id = $1',
    [sale.rows[0].id]
  )), 3500);

  const deletedRefund = await directService.deleteEditableComprobante(refund.rows[0].id, MATI, {
    repository,
    allowOperationalUser: true,
    bypassSafety: true
  });
  assert.equal(deletedRefund.cleanupErrors.length, 0);
  assert.equal(await scalar(db, 'select count(*)::integer from public.comprobantes'), 5);
  assert.equal(await scalar(db, 'select count(*)::integer from public.comprobantes_archivos'), 5);
  assert.equal(repository.objects.size, 5);

  await assert.rejects(
    db.query('select public.metricas_create_comprobante_batch_v1($1::jsonb)', [JSON.stringify({
      submissionKey: 'local-unauthorized-0001',
      batchId: '20000000-0000-4000-8000-000000000061',
      actorEmail: 'intruso@example.test',
      rows: [{
        ...sale.rows[0],
        id: '10000000-0000-4000-8000-000000000061',
        submission_key: 'local-unauthorized-0001',
        batch_id: '20000000-0000-4000-8000-000000000061',
        operation_index: 0,
        venta_id: '10000000-0000-4000-8000-000000000061',
        venta_relacionada: '10000000-0000-4000-8000-000000000061',
        cobranza_relacionada: '10000000-0000-4000-8000-000000000061',
        created_by_email: 'intruso@example.test'
      }],
      files: []
    })]),
    /responsable de venta.*no coincide con el usuario/i
  );

  const mismatchedSubmission = 'local-client-mismatch-01';
  const mismatchedBatchId = '20000000-0000-4000-8000-000000000071';
  const mismatchedSaleId = '10000000-0000-4000-8000-000000000071';
  await assert.rejects(
    db.query('select public.metricas_create_comprobante_batch_v1($1::jsonb)', [JSON.stringify({
      submissionKey: mismatchedSubmission,
      batchId: mismatchedBatchId,
      actorEmail: MATI.email,
      rows: [{
        ...sale.rows[0],
        id: mismatchedSaleId,
        ghlid: 'otro-cliente-local',
        submission_key: mismatchedSubmission,
        batch_id: mismatchedBatchId,
        operation_index: 0,
        venta_id: mismatchedSaleId,
        venta_relacionada: mismatchedSaleId,
        cobranza_relacionada: mismatchedSaleId
      }],
      files: []
    })]),
    /cliente supabase.*no coincide/i
  );
  assert.equal(await scalar(
    db,
    'select count(*)::integer from public.comprobantes_submission_batches where submission_key = $1',
    [mismatchedSubmission]
  ), 0);

  const rollbackSubmission = 'local-rollback-batch-0001';
  const rollbackBatchId = '20000000-0000-4000-8000-000000000099';
  const rollbackSaleId = '10000000-0000-4000-8000-000000000098';
  const rollbackRows = [
    {
      ...sale.rows[0],
      id: rollbackSaleId,
      submission_key: rollbackSubmission,
      batch_id: rollbackBatchId,
      operation_index: 0,
      venta_id: rollbackSaleId,
      venta_relacionada: rollbackSaleId,
      cobranza_relacionada: rollbackSaleId
    },
    {
      ...sale.rows[1],
      id: '10000000-0000-4000-8000-000000000099',
      submission_key: rollbackSubmission,
      batch_id: rollbackBatchId,
      operation_index: 1,
      venta_id: rollbackSaleId,
      venta_relacionada: rollbackSaleId,
      medio_pago_id: '99999999-9999-4999-8999-999999999999'
    }
  ];
  await assert.rejects(
    db.query('select public.metricas_create_comprobante_batch_v1($1::jsonb)', [JSON.stringify({
      submissionKey: rollbackSubmission,
      batchId: rollbackBatchId,
      actorEmail: MATI.email,
      rows: rollbackRows,
      files: []
    })]),
    /medio de pago no existe o esta inactivo/i
  );
  assert.equal(await scalar(
    db,
    'select count(*)::integer from public.comprobantes where submission_key = $1',
    [rollbackSubmission]
  ), 0);
  assert.equal(await scalar(
    db,
    'select count(*)::integer from public.comprobantes_submission_batches where submission_key = $1',
    [rollbackSubmission]
  ), 0);

  const changedConfig = {
    products: directService._test.DEFAULT_PRODUCTS.map((item) => (
      item.code === 'club'
        ? { ...item, clubPrices: item.clubPrices.map((price) => (price.key === 'club1' ? { ...price, amountArs: 42000 } : price)) }
        : item
    )).concat({ code: 'producto-local', name: 'Producto Local', active: true, clubPrices: [] }),
    paymentMethods: directService._test.DEFAULT_PAYMENT_METHODS.map((item) => (
      item.code === 'mp-link' ? { ...item, commissionRate: 0.07, initialBalance: 125000 } : item
    )).concat({ code: 'medio-local', name: 'Medio Local', active: true, type: 'Propia', account: '', ivaRate: 0.21, commissionRate: 0.03, initialBalance: 50000 }),
    responsiblePeople: directService._test.DEFAULT_RESPONSIBLE_PEOPLE.map((item) => (
      item.code === 'nahuel-iasci' ? { ...item, active: false } : item
    )).concat({ code: 'responsable-local', name: 'Responsable Local', email: 'responsable@example.test', role: 'Closer', active: true }),
    rules: directService._test.DEFAULT_RULES
  };
  await db.query(
    'select public.metricas_save_comprobantes_config_v1($1::jsonb, $2)',
    [JSON.stringify(changedConfig), MATI.email]
  );
  assert.equal(Number(await scalar(
    db,
    "select commission_rate from public.comprobantes_medios_pago_config where code = 'mp-link'"
  )), 0.07);
  assert.equal(Number(await scalar(
    db,
    "select initial_balance from public.comprobantes_medios_pago_config where code = 'mp-link'"
  )), 125000);
  assert.equal(Number(await scalar(
    db,
    "select (club_prices->0->>'amountArs')::numeric from public.comprobantes_productos_config where code = 'club'"
  )), 42000);
  assert.equal(await scalar(
    db,
    "select active from public.comprobantes_responsables_config where code = 'nahuel-iasci'"
  ), false);
  assert.equal(await scalar(
    db,
    "select count(*)::integer from public.comprobantes_productos_config where code = 'producto-local'"
  ), 1);
  assert.equal(await scalar(
    db,
    "select count(*)::integer from public.comprobantes_medios_pago_config where code = 'medio-local'"
  ), 1);
  assert.equal(await scalar(
    db,
    "select count(*)::integer from public.comprobantes_responsables_config where code = 'responsable-local'"
  ), 1);

  const inactiveResponsibleSubmission = 'local-inactive-responsible-01';
  const inactiveResponsibleBatch = '20000000-0000-4000-8000-000000000081';
  const inactiveResponsibleSale = '10000000-0000-4000-8000-000000000081';
  await assert.rejects(
    db.query('select public.metricas_create_comprobante_batch_v1($1::jsonb)', [JSON.stringify({
      submissionKey: inactiveResponsibleSubmission,
      batchId: inactiveResponsibleBatch,
      actorEmail: MATI.email,
      rows: [{
        ...sale.rows[0],
        id: inactiveResponsibleSale,
        submission_key: inactiveResponsibleSubmission,
        batch_id: inactiveResponsibleBatch,
        operation_index: 0,
        venta_id: inactiveResponsibleSale,
        venta_relacionada: inactiveResponsibleSale,
        cobranza_relacionada: inactiveResponsibleSale,
        responsable_venta: 'Nahuel Iasci',
        responsable_venta_id: '91000000-0000-4000-8000-000000000007'
      }],
      files: []
    })]),
    /responsable de venta no existe, esta inactivo o no coincide/i
  );
  assert.equal(await scalar(
    db,
    'select count(*)::integer from public.comprobantes_submission_batches where submission_key = $1',
    [inactiveResponsibleSubmission]
  ), 0);

  assert.equal(await scalar(
    db,
    "select relrowsecurity from pg_class where oid = 'public.comprobantes_archivos'::regclass"
  ), true);
  assert.equal(await scalar(
    db,
    "select relrowsecurity from pg_class where oid = 'public.comprobantes_responsables_config'::regclass"
  ), true);
  assert.equal(await scalar(
    db,
    "select relrowsecurity from pg_class where oid = 'public.comprobantes_storage_cleanup_queue'::regclass"
  ), true);
  const cleanupPayload = {
    comprobanteId: '10000000-0000-4000-8000-000000000051',
    actorEmail: MATI.email,
    error: 'fallo Storage local simulado',
    files: [{ bucket: 'comprobantes', objectPath: 'local-pending/archivo.pdf' }]
  };
  await db.query(
    'select public.metricas_enqueue_storage_cleanup_v1($1::jsonb)',
    [JSON.stringify(cleanupPayload)]
  );
  await db.query(
    'select public.metricas_enqueue_storage_cleanup_v1($1::jsonb)',
    [JSON.stringify(cleanupPayload)]
  );
  assert.equal(await scalar(
    db,
    'select count(*)::integer from public.comprobantes_storage_cleanup_queue'
  ), 1);
  assert.equal(await scalar(
    db,
    'select attempts from public.comprobantes_storage_cleanup_queue limit 1'
  ), 2);
  const cleanupQueueId = await scalar(
    db,
    'select id from public.comprobantes_storage_cleanup_queue limit 1'
  );
  await db.query(
    'select public.metricas_finish_storage_cleanup_v1($1, $2, $3, $4)',
    [cleanupQueueId, false, 'reintento local fallido', MATI.email]
  );
  assert.equal(await scalar(
    db,
    'select attempts from public.comprobantes_storage_cleanup_queue where id = $1',
    [cleanupQueueId]
  ), 3);
  await db.query(
    'select public.metricas_finish_storage_cleanup_v1($1, $2, $3, $4)',
    [cleanupQueueId, true, null, MATI.email]
  );
  assert.equal(await scalar(
    db,
    'select completed_at is not null from public.comprobantes_storage_cleanup_queue where id = $1',
    [cleanupQueueId]
  ), true);
  assert.equal(await scalar(
    db,
    "select has_function_privilege('anon', 'public.metricas_create_comprobante_batch_v1(jsonb)', 'execute')"
  ), false);
  assert.equal(await scalar(
    db,
    "select has_function_privilege('service_role', 'public.metricas_create_comprobante_batch_v1(jsonb)', 'execute')"
  ), true);
  assert.equal(await scalar(
    db,
    "select has_function_privilege('anon', 'public.metricas_enqueue_storage_cleanup_v1(jsonb)', 'execute')"
  ), false);
  assert.equal(await scalar(
    db,
    "select has_function_privilege('service_role', 'public.metricas_enqueue_storage_cleanup_v1(jsonb)', 'execute')"
  ), true);
  assert.equal(await scalar(
    db,
    "select has_function_privilege('anon', 'public.metricas_finish_storage_cleanup_v1(bigint,boolean,text,text)', 'execute')"
  ), false);
  assert.equal(await scalar(
    db,
    "select has_function_privilege('service_role', 'public.metricas_finish_storage_cleanup_v1(bigint,boolean,text,text)', 'execute')"
  ), true);

  const report = {
    database: 'PGlite efímero en memoria',
    migrationApplied: true,
    productionConnections: 0,
    saleOperations: sale.rows.length,
    collectionOperations: collection.rows.length,
    clubOperations: club.rows.length,
    refundOperations: refund.rows.length,
    finalRows: await scalar(db, 'select count(*)::integer from public.comprobantes'),
    finalFiles: await scalar(db, 'select count(*)::integer from public.comprobantes_archivos'),
    storedObjects: repository.objects.size,
    saleCashCollectedTotalUsd: Number(await scalar(
      db,
      'select cash_collected_total from public.comprobantes where id = $1',
      [sale.rows[0].id]
    )),
    idempotentReplay: retry.result.idempotentReplay,
    rollbackVerified: true,
    unauthorizedActorRejected: true,
    clientMismatchRejected: true,
    clubFormulaVerified: true,
    refundRelationVerified: true,
    operationalBootstrapVerified: true,
    clientAndSaleLookupVerified: true,
    directEditVerified: true,
    aggregateRecalculationVerified: true,
    netCashPerPaymentMethodVerified: true,
    legacyWebhookFieldParityVerified: true,
    automaticFinalizationParityVerified: true,
    reconciliationVerified: true,
    reconciledEditBlocked: true,
    relatedSaleDeleteBlocked: true,
    directDeleteAndStorageCleanupVerified: true,
    durableStorageCleanupQueueVerified: true,
    storageCleanupRetryLifecycleVerified: true,
    signedFilesVerified: true,
    regularUploaderVerified: true,
    configUpdateVerified: true,
    auditedPaymentMethodsVerified: `${seededConfig.paymentMethods.length} total / ${seededConfig.paymentMethods.filter((item) => item.active).length} activos`,
    paymentInitialBalanceVerified: true,
    catalogCreateAndDeactivateVerified: true,
    clubPriceUpdateVerified: true,
    responsibleRelationVerified: Boolean(sale.rows[0].responsable_venta_id),
    inactiveResponsibleRejected: true,
    rlsVerified: true,
    rpcPermissionsVerified: true
  };
  console.log(JSON.stringify(report, null, 2));
  await db.close();
}

module.exports = { bootstrapDatabase, createRepository, salePayload, LEAD, MATI };

if (require.main === module) main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
