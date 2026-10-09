const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const access = require('../modules/auth/access');
const service = require('../modules/metricasv2/services/comprobantes-direct.service');

const MATI = { email: 'matirandazzo@gmail.com', nombre: 'Mati Randazzo' };
const NADIA = { email: 'nadia.cavallini@gmail.com', nombre: 'Nadia Cavallini' };
const OTHER = { email: 'otro@example.com', nombre: 'Otro Usuario' };

function salePayload(overrides = {}) {
  return {
    tipo: 'Venta',
    ghlId: 'lead-direct-123',
    clientName: 'Cliente Directo',
    clientPageId: '29f48251-7a95-800d-9168-fefc4ff0ff16',
    responsableVenta: 'Claudio Nicolini',
    fechaVenta: '2026-09-21',
    fechaAcreditacion: '2026-09-21',
    tc: 1210,
    cashCollectedArs: 1210000,
    medioPago: 'MP -LINK',
    dniCuit: '20348137000',
    productName: 'Meg 2.1',
    facturacionUsd: 2000,
    cantidadPagos: 1,
    submissionKey: 'direct-test-sale-0001',
    attachmentFiles: [],
    ...overrides
  };
}

function lead(overrides = {}) {
  return {
    id: '29f48251-7a95-800d-9168-fefc4ff0ff16',
    ghlid: 'lead-direct-123',
    nombre: 'Cliente Directo',
    mail: 'cliente@example.com',
    telefono: '1111111111',
    setter: 'Nahuel Iasci',
    closer: 'Claudio Nicolini',
    origen_actual: 'Postulación MEG - APSET',
    primer_origen: 'Postulación MEG - VSL',
    fecha_agenda: '2026-09-15T12:00:00Z',
    monto_incobrable: 375,
    modelo_negocio: 'Servicios',
    ...overrides
  };
}

function config() {
  return {
    products: service._test.DEFAULT_PRODUCTS,
    paymentMethods: service._test.DEFAULT_PAYMENT_METHODS,
    responsiblePeople: service._test.DEFAULT_RESPONSIBLE_PEOPLE,
    rules: service._test.DEFAULT_RULES
  };
}

function ids(...values) {
  let index = 0;
  return () => values[index++] || `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
}

test('el laboratorio y su página quedan restringidos exactamente a Mati y Nadia', () => {
  assert.equal(service.canAccessLab(MATI), true);
  assert.equal(service.canAccessLab(NADIA), true);
  assert.equal(service.canAccessLab(OTHER), false);
  assert.equal(access.canAccessPageForUser(MATI, 'comprobantes-config.html'), true);
  assert.equal(access.canAccessPageForUser(NADIA, 'comprobantes-config.html'), true);
  assert.equal(access.canAccessPageForUser({ ...OTHER, role: 'total' }, 'comprobantes-config.html'), false);
});

test('calcula IVA y comisión incluidos con las mismas fórmulas de Notion', () => {
  const normalized = require('../modules/metricasv2/services/comprobantes-loader.service')._test
    .normalizePayload(salePayload(), MATI, { allowMissingAttachments: true });
  normalized.responsableVenta = salePayload().responsableVenta;
  const result = service._test.buildRows({
    normalized,
    config: config(),
    lead: lead(),
    relatedSale: null,
    user: MATI,
    idFactory: ids('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001'),
    now: new Date('2026-09-21T18:00:00Z')
  });

  const row = result.rows[0];
  assert.equal(row.cash_collected, 1000);
  assert.equal(row.iva, 210000);
  assert.equal(row.comisiones, service._test.includedAmount(1210000, 0.0629));
  assert.equal(row.facturacion_ars, 2420000);
  assert.equal(row.cash_neto_ars_snapshot, 1210000 - row.iva - row.comisiones);
  assert.equal(row.cash_collected_neto_ars, 1000000);
  assert.equal(row.cash_collected_neto, Number((1000000 / 1210).toFixed(6)));
  assert.equal(row.origen_actual, 'Postulación MEG - APSET');
  assert.equal(row.primer_origen, 'Postulación MEG - VSL');
  assert.equal(row.lead_id, lead().id);
  assert.equal(row.agenda_format, '15/09/26');
  assert.equal(row.agenda_periodo_m, '09');
  assert.equal(row.agenda_periodo_a, '26');
  assert.equal(row.monto_incobrable, 375);
  assert.equal(row.venta_relacionada, row.id);
  assert.equal(row.cobranza_relacionada, row.id);
  assert.equal(row.cash_collected_total, 1000);
  assert.equal(row.source_system, 'supabase_direct');
  assert.equal(row.responsable_venta, 'Claudio Nicolini');
  assert.equal(row.responsable_venta_id, '91000000-0000-4000-8000-000000000006');
  [
    'csm_2_0',
    'conciliacion_financiera_2',
    'conciliar',
    'facturacion_arca',
    'facturar',
    'fecha_facturado',
    'finalizar',
    'rebotar_pago',
    'rectificar_pago',
    'crear_registro_csm',
    'estado_cc',
    'porcentaje_venta_vieja_format',
    'porcentaje_venta_vieja',
    'f_renovacion',
    'f_renovacion_string'
  ].forEach((column) => assert.equal(Object.hasOwn(row, column), true, `falta ${column}`));
});

test('rechaza responsables inexistentes o desactivados antes de preparar una carga', () => {
  const loader = require('../modules/metricasv2/services/comprobantes-loader.service');
  const unknown = loader._test.normalizePayload(
    salePayload({ responsableVenta: 'Persona Inexistente' }),
    MATI,
    { allowMissingAttachments: true }
  );
  unknown.responsableVenta = 'Persona Inexistente';
  assert.throws(() => service._test.buildRows({
    normalized: unknown,
    config: config(),
    lead: lead(),
    user: MATI
  }), /responsable de venta.*no existe o está inactivo/i);

  const inactiveConfig = config();
  inactiveConfig.responsiblePeople = inactiveConfig.responsiblePeople.map((item) => (
    item.name === 'Claudio Nicolini' ? { ...item, active: false } : item
  ));
  const inactive = loader._test.normalizePayload(salePayload(), MATI, { allowMissingAttachments: true });
  inactive.responsableVenta = 'Claudio Nicolini';
  assert.throws(() => service._test.buildRows({
    normalized: inactive,
    config: inactiveConfig,
    lead: lead(),
    user: MATI
  }), /responsable de venta.*no existe o está inactivo/i);
});

test('valida altas configurables y evita nombres, códigos o emails duplicados', () => {
  const valid = service._test.validateConfig({
    ...config(),
    products: [...config().products, { name: 'Producto Local', active: true, clubPrices: [] }],
    paymentMethods: [...config().paymentMethods, {
      name: 'Medio Local', active: true, type: 'Propia', account: '', ivaRate: 0.21, commissionRate: 0.03, initialBalance: 50000
    }],
    responsiblePeople: [...config().responsiblePeople, {
      name: 'Responsable Local', email: 'local@example.test', role: 'Closer', active: true
    }]
  });
  assert.equal(valid.products.at(-1).code, 'producto-local');
  assert.equal(valid.paymentMethods.at(-1).commissionRate, 0.03);
  assert.equal(valid.paymentMethods.at(-1).initialBalance, 50000);
  assert.equal(valid.responsiblePeople.at(-1).email, 'local@example.test');

  assert.throws(() => service._test.validateConfig({
    ...config(),
    paymentMethods: config().paymentMethods.map((item) => (
      item.code === 'jt-icbc-dolares-29f48251' ? { ...item, active: true } : item
    ))
  }), /nombre de medio de pago activo duplicado/i);

  assert.throws(() => service._test.validateConfig({
    ...config(),
    responsiblePeople: [
      ...config().responsiblePeople,
      { name: 'Otra persona', code: 'otra-persona', email: 'IAScINaHueL@gmail.com', role: 'Setter' }
    ]
  }), /email de responsable duplicado/i);
});

test('el preflight reconoce los 51 medios y bloquea las validaciones operativas pendientes', () => {
  const readiness = service._test.buildCutoverReadiness({
    ...config(),
    migrationReady: true
  }, { available: true, count: 0 });

  assert.equal(readiness.ready, false);
  assert.equal(readiness.expectedPaymentMethods, 51);
  assert.equal(readiness.expectedHistoricalFiles, 1166);
  assert.equal(readiness.blocking.includes('payment_catalog'), false);
  assert.ok(readiness.blocking.includes('csm_rule'));
  assert.ok(readiness.blocking.includes('arca_control'));
  assert.ok(readiness.blocking.includes('historical_files'));
  assert.ok(readiness.blocking.includes('historical_reconciliation'));
  assert.ok(readiness.blocking.includes('observation_window'));
});

test('el preflight sólo queda listo con 51 medios, cola vacía y todas las validaciones', () => {
  const base = config();
  const paymentMethods = [...base.paymentMethods];
  while (paymentMethods.length < 51) {
    const number = paymentMethods.length + 1;
    paymentMethods.push({
      code: `historico-${number}`,
      name: `Histórico ${number}`,
      active: false,
      type: 'Histórico',
      account: '',
      ivaRate: 0,
      commissionRate: 0,
      initialBalance: 0
    });
  }
  const readiness = service._test.buildCutoverReadiness({
    ...base,
    paymentMethods,
    migrationReady: true,
    rules: {
      ...base.rules,
      cutoverChecklist: {
        csmRuleStatus: 'validated',
        arcaControlStatus: 'validated',
        historicalFilesVerified: true,
        historicalReconciliationVerified: true,
        observationWindowCompleted: true
      }
    }
  }, { available: true, count: 0 });

  assert.equal(readiness.ready, true);
  assert.deepEqual(readiness.blocking, []);
});

test('una venta en tres cheques crea venta + cobranzas y conserva la relación y el total', () => {
  const payload = salePayload({
    medioPago: 'E-cheq Bco Frances',
    cashCollectedArs: 3630000,
    facturacionUsd: 3000,
    cantidadPagos: 3,
    chequeCount: 3,
    cheques: [
      { montoArs: 1210000, fechaAcreditacion: '2026-09-21' },
      { montoArs: 1210000, fechaAcreditacion: '2026-10-21' },
      { montoArs: 1210000, fechaAcreditacion: '2026-11-21' }
    ],
    submissionKey: 'direct-three-cheques-01'
  });
  const normalized = require('../modules/metricasv2/services/comprobantes-loader.service')._test
    .normalizePayload(payload, MATI, { allowMissingAttachments: true });
  const result = service._test.buildRows({
    normalized,
    config: config(),
    lead: lead(),
    user: MATI,
    idFactory: ids(
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000003',
      '20000000-0000-4000-8000-000000000001'
    ),
    now: new Date('2026-09-21T18:00:00Z')
  });

  assert.deepEqual(result.rows.map((row) => row.tipo), ['Venta', 'Cobranza', 'Cobranza']);
  assert.deepEqual(result.rows.map((row) => row.venta_relacionada), [
    result.rows[0].id,
    result.rows[0].id,
    result.rows[0].id
  ]);
  assert.deepEqual(result.rows.map((row) => row.cash_collected_total), [3000, 0, 0]);
  assert.deepEqual(result.rows.map((row) => row.f_acreditacion.slice(0, 10)), [
    '2026-09-21',
    '2026-10-21',
    '2026-11-21'
  ]);
  assert.equal(result.rows[0].producto_format, 'Meg 2.1');
  assert.equal(result.rows[1].producto_format, null);
  assert.equal(result.rows[2].producto_format, null);
  assert.equal(result.rows[0].finalizar, true);
  assert.equal(result.rows[1].finalizar, true);
  assert.equal(result.rows[2].finalizar, true);
});

test('una venta Club usa el precio configurado y replica el neto de la fórmula Notion', () => {
  const normalized = require('../modules/metricasv2/services/comprobantes-loader.service')._test
    .normalizePayload(salePayload({
      productName: 'Club',
      clubPriceKey: 'club1',
      cashCollectedArs: undefined,
      facturacionUsd: undefined,
      dniCuit: '',
      submissionKey: 'direct-club-sale-0001'
    }), MATI, { allowMissingAttachments: true });
  const result = service._test.buildRows({
    normalized,
    config: config(),
    lead: lead(),
    user: MATI,
    idFactory: ids('10000000-0000-4000-8000-000000000021', '20000000-0000-4000-8000-000000000021')
  });
  const row = result.rows[0];
  const base = 39500 / 1.21;
  const expectedNet = Number((base - base * 0.0629 - base * 0.035).toFixed(6));
  assert.equal(row.cash_collected_ars, 39500);
  assert.equal(row.facturacion, Number((39500 / 1210).toFixed(2)));
  assert.equal(row.neto_club, expectedNet);
  assert.match(row.info_comprobantes, /Precio Club 1: ARS 39500/);
});

test('conserva soporte, sesiones y bonus y calcula la renovación por meses calendario', () => {
  const normalized = require('../modules/metricasv2/services/comprobantes-loader.service')._test
    .normalizePayload(salePayload({
      fechaVenta: '2026-01-31',
      mesesSoporte: 1,
      sesiones: 8,
      bonusMati: true,
      submissionKey: 'direct-renewal-fields-01'
    }), MATI, { allowMissingAttachments: true });
  const result = service._test.buildRows({
    normalized,
    config: config(),
    lead: lead(),
    user: MATI,
    idFactory: ids('10000000-0000-4000-8000-000000000025', '20000000-0000-4000-8000-000000000025')
  });
  assert.equal(result.rows[0].meses_soporte, 1);
  assert.equal(result.rows[0].sesiones_configuradas, 8);
  assert.equal(result.rows[0].bonus_mati, true);
  assert.equal(result.rows[0].f_renovacion.slice(0, 10), '2026-02-28');
  assert.equal(result.rows[0].f_renovacion_string, '28/02/26');
});

test('una cobranza sólo acepta una venta de Supabase perteneciente al mismo GHL ID', async () => {
  const relatedSale = {
    id: '30000000-0000-4000-8000-000000000001',
    ghlid: 'lead-direct-123',
    f_venta: '2026-08-15T03:00:00Z',
    tipo: 'Venta'
  };
  const repository = {
    getConfig: async () => ({ migrationReady: true, ...config() }),
    getLead: async () => lead(),
    getSale: async () => relatedSale
  };
  const result = await service.preview(salePayload({
    tipo: 'Cobranza',
    productName: undefined,
    facturacionUsd: undefined,
    cantidadPagos: undefined,
    latestSaleId: relatedSale.id,
    submissionKey: 'direct-collection-0001'
  }), MATI, {
    repository,
    idFactory: ids('40000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001'),
    now: new Date('2026-09-21T18:00:00Z')
  });

  assert.equal(result.dryRun, true);
  assert.equal(result.persisted, false);
  assert.equal(result.rows[0].tipo, 'Cobranza');
  assert.equal(result.rows[0].responsable_venta, 'Claudio Nicolini');
  assert.equal(result.rows[0].responsable_venta_id, '91000000-0000-4000-8000-000000000006');
  assert.equal(result.rows[0].venta_relacionada, relatedSale.id);
  assert.equal(result.rows[0].f_venta.slice(0, 10), '2026-08-15');
  assert.equal(result.rows[0].cash_collected_total, 0);
  assert.equal(result.rows[0].finalizar, true);

  await assert.rejects(
    service.preview(salePayload({
      tipo: 'Cobranza',
      productName: undefined,
      facturacionUsd: undefined,
      cantidadPagos: undefined,
      submissionKey: 'direct-collection-wrong'
    }), MATI, {
      repository: { ...repository, getSale: async () => ({ ...relatedSale, ghlid: 'otro-lead' }) }
    }),
    /pertenece a otro cliente/
  );
});

test('resuelve un cliente CSM sólo mediante su relación canónica existente en Supabase', async () => {
  const linkedLead = lead();
  const repository = {
    getLead: async () => null,
    getCsm: async () => ({
      ghlid: linkedLead.ghlid,
      nombre: 'Nombre CSM',
      crm_2_0: linkedLead.id
    }),
    getLeadById: async (id) => (id === linkedLead.id ? linkedLead : null),
    getSale: async () => null
  };
  const client = await service.lookupClient(linkedLead.ghlid, OTHER, {
    repository,
    allowOperationalUser: true
  });
  assert.equal(client.pageId, linkedLead.id);
  assert.equal(client.source, 'leads_raw');
  assert.equal(client.latestSale, null);

  const invalidRepository = {
    ...repository,
    getLeadById: async () => ({ ...linkedLead, ghlid: 'otro-ghl' })
  };
  await assert.rejects(
    service.lookupClient(linkedLead.ghlid, OTHER, {
      repository: invalidRepository,
      allowOperationalUser: true
    }),
    /cliente canónico/i
  );
});

test('extrae correctamente el GHL ID desde un enlace de contacto', () => {
  assert.equal(
    service._test.parseGhlId('https://app.gohighlevel.com/v2/location/abc/contacts/detail/lead-direct-123'),
    'lead-direct-123'
  );
});

test('la creación directa queda bloqueada por defecto antes de tocar el repositorio', async () => {
  const originalEnabled = process.env.COMPROBANTES_SUPABASE_DIRECT_ENABLED;
  const originalWrites = process.env.COMPROBANTES_SUPABASE_DIRECT_WRITES_ENABLED;
  delete process.env.COMPROBANTES_SUPABASE_DIRECT_ENABLED;
  delete process.env.COMPROBANTES_SUPABASE_DIRECT_WRITES_ENABLED;
  let calls = 0;
  try {
    await assert.rejects(
      service.create(salePayload(), MATI, {
        repository: {
          getConfig: async () => { calls += 1; return { migrationReady: true, ...config() }; }
        }
      }),
      /bloqueado en modo simulación/
    );
    assert.equal(calls, 0);
  } finally {
    if (originalEnabled === undefined) delete process.env.COMPROBANTES_SUPABASE_DIRECT_ENABLED;
    else process.env.COMPROBANTES_SUPABASE_DIRECT_ENABLED = originalEnabled;
    if (originalWrites === undefined) delete process.env.COMPROBANTES_SUPABASE_DIRECT_WRITES_ENABLED;
    else process.env.COMPROBANTES_SUPABASE_DIRECT_WRITES_ENABLED = originalWrites;
  }
});

test('los dos seguros de escritura deben estar activos al mismo tiempo', () => {
  const originalEnabled = process.env.COMPROBANTES_SUPABASE_DIRECT_ENABLED;
  const originalWrites = process.env.COMPROBANTES_SUPABASE_DIRECT_WRITES_ENABLED;
  try {
    const combinations = [
      [undefined, undefined, true],
      ['true', undefined, true],
      [undefined, 'true', true],
      ['true', 'true', false]
    ];
    for (const [enabled, writesEnabled, expectedDryRun] of combinations) {
      if (enabled === undefined) delete process.env.COMPROBANTES_SUPABASE_DIRECT_ENABLED;
      else process.env.COMPROBANTES_SUPABASE_DIRECT_ENABLED = enabled;
      if (writesEnabled === undefined) delete process.env.COMPROBANTES_SUPABASE_DIRECT_WRITES_ENABLED;
      else process.env.COMPROBANTES_SUPABASE_DIRECT_WRITES_ENABLED = writesEnabled;
      assert.equal(service.getSafetyStatus().dryRunOnly, expectedDryRun);
    }
  } finally {
    if (originalEnabled === undefined) delete process.env.COMPROBANTES_SUPABASE_DIRECT_ENABLED;
    else process.env.COMPROBANTES_SUPABASE_DIRECT_ENABLED = originalEnabled;
    if (originalWrites === undefined) delete process.env.COMPROBANTES_SUPABASE_DIRECT_WRITES_ENABLED;
    else process.env.COMPROBANTES_SUPABASE_DIRECT_WRITES_ENABLED = originalWrites;
  }
});

test('el cutover exige tres seguros y queda apagado por defecto', () => {
  const names = [
    'COMPROBANTES_SUPABASE_DIRECT_ENABLED',
    'COMPROBANTES_SUPABASE_DIRECT_WRITES_ENABLED',
    'COMPROBANTES_SUPABASE_DIRECT_CUTOVER_ENABLED'
  ];
  const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    names.forEach((name) => { delete process.env[name]; });
    assert.equal(service.isCutoverActive(), false);
    process.env.COMPROBANTES_SUPABASE_DIRECT_ENABLED = 'true';
    process.env.COMPROBANTES_SUPABASE_DIRECT_WRITES_ENABLED = 'true';
    assert.equal(service.isCutoverActive(), false);
    process.env.COMPROBANTES_SUPABASE_DIRECT_CUTOVER_ENABLED = 'true';
    assert.equal(service.isCutoverActive(), true);
    delete process.env.COMPROBANTES_SUPABASE_DIRECT_WRITES_ENABLED;
    assert.equal(service.isCutoverActive(), false);
  } finally {
    names.forEach((name) => {
      if (original[name] === undefined) delete process.env[name];
      else process.env[name] = original[name];
    });
  }
});

test('aunque se activen los tres flags, el preflight corta antes de subir archivos', async () => {
  const names = [
    'COMPROBANTES_SUPABASE_DIRECT_ENABLED',
    'COMPROBANTES_SUPABASE_DIRECT_WRITES_ENABLED',
    'COMPROBANTES_SUPABASE_DIRECT_CUTOVER_ENABLED'
  ];
  const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  let uploads = 0;
  try {
    names.forEach((name) => { process.env[name] = 'true'; });
    const repository = {
      async getConfig() {
        return { ...config(), migrationReady: true };
      },
      async listPendingFileCleanup() {
        return [];
      },
      async uploadFile() {
        uploads += 1;
      }
    };
    await assert.rejects(
      service.create(salePayload(), MATI, { repository }),
      /Corte bloqueado por preflight:.*csm_rule/i
    );
    assert.equal(uploads, 0);
  } finally {
    names.forEach((name) => {
      if (original[name] === undefined) delete process.env[name];
      else process.env[name] = original[name];
    });
  }
});

test('la creación directa sube archivos seguros y envía un único lote atómico', async () => {
  const uploaded = [];
  const batches = [];
  const removed = [];
  const file = {
    name: '../../../Factura Cliente.png',
    type: 'image/png',
    base64: Buffer.from('archivo-de-prueba').toString('base64')
  };
  const repository = {
    getConfig: async () => ({ migrationReady: true, ...config() }),
    getLead: async () => lead(),
    getSubmission: async () => null,
    uploadFile: async (bucket, objectPath, source) => uploaded.push({ bucket, objectPath, source }),
    createBatch: async (payload) => {
      batches.push(payload);
      return { ok: true, idempotentReplay: false, created: payload.rows.map((row) => ({ id: row.id, type: row.tipo })) };
    },
    removeFiles: async (bucket, paths) => removed.push({ bucket, paths })
  };

  const result = await service.create(salePayload({ attachmentFiles: [file] }), MATI, {
    repository,
    bypassSafety: true,
    idFactory: ids('10000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000011'),
    now: new Date('2026-09-21T18:00:00Z')
  });

  assert.equal(result.persisted, true);
  assert.equal(result.created.length, 1);
  assert.equal(uploaded.length, 1);
  assert.equal(batches.length, 1);
  assert.equal(removed.length, 0);
  assert.match(uploaded[0].objectPath, /^20000000-0000-4000-8000-000000000011\/0-[a-f0-9]{12}-Factura-Cliente\.png$/);
  assert.equal(uploaded[0].source.name, file.name);
  assert.equal(batches[0].files[0].name, file.name);
  assert.equal(Object.hasOwn(batches[0].files[0], 'fileIndex'), false);
  assert.equal(batches[0].rows[0].batch_id, batches[0].batchId);
});

test('si el lote falla de forma confirmada elimina los archivos ya subidos', async () => {
  const removed = [];
  let submissionChecks = 0;
  const repository = {
    getConfig: async () => ({ migrationReady: true, ...config() }),
    getLead: async () => lead(),
    getSubmission: async () => { submissionChecks += 1; return null; },
    uploadFile: async () => ({ ok: true }),
    createBatch: async () => { throw new Error('transacción rechazada'); },
    removeFiles: async (bucket, paths) => removed.push({ bucket, paths })
  };
  const file = {
    name: 'comprobante.pdf',
    type: 'application/pdf',
    base64: Buffer.from('pdf-de-prueba').toString('base64')
  };

  await assert.rejects(
    service.create(salePayload({ attachmentFiles: [file] }), MATI, {
      repository,
      bypassSafety: true,
      idFactory: ids('10000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000012')
    }),
    /transacción rechazada/
  );
  assert.equal(submissionChecks, 2);
  assert.equal(removed.length, 1);
  assert.equal(removed[0].paths.length, 1);
});

test('si también falla la limpieza de un lote rechazado deja el archivo en la cola durable', async () => {
  const queued = [];
  const file = {
    name: 'fallo-doble.pdf',
    type: 'application/pdf',
    base64: Buffer.from('fallo-doble-local').toString('base64')
  };
  const repository = {
    getConfig: async () => ({ migrationReady: true, ...config() }),
    getLead: async () => lead(),
    getSubmission: async () => null,
    uploadFile: async () => ({ ok: true }),
    createBatch: async () => { throw new Error('lote rechazado'); },
    removeFiles: async () => { throw new Error('storage caído'); },
    enqueueFileCleanup: async (files, context) => queued.push({ files, context })
  };

  await assert.rejects(
    service.create(salePayload({ attachmentFiles: [file] }), MATI, {
      repository,
      bypassSafety: true,
      idFactory: ids('10000000-0000-4000-8000-000000000016', '20000000-0000-4000-8000-000000000016')
    }),
    (error) => {
      assert.match(error.message, /lote rechazado/);
      assert.equal(error.cleanupQueued, 1);
      return true;
    }
  );
  assert.equal(queued.length, 1);
  assert.equal(queued[0].context.reason, 'failed_batch_cleanup_failed');
  assert.equal(queued[0].files[0].comprobante_id, '10000000-0000-4000-8000-000000000016');
});

test('una carrera idempotente devuelve éxito y encola el archivo temporal si Storage falla', async () => {
  const queued = [];
  const file = {
    name: 'reintento.pdf',
    type: 'application/pdf',
    base64: Buffer.from('reintento-local').toString('base64')
  };
  const repository = {
    getConfig: async () => ({ migrationReady: true, ...config() }),
    getLead: async () => lead(),
    getSubmission: async () => null,
    uploadFile: async () => ({ ok: true }),
    createBatch: async () => ({
      ok: true,
      idempotentReplay: true,
      created: [{ id: 'existente', type: 'Venta' }]
    }),
    removeFiles: async () => { throw new Error('storage caído'); },
    enqueueFileCleanup: async (files, context) => queued.push({ files, context })
  };

  const result = await service.create(salePayload({ attachmentFiles: [file] }), MATI, {
    repository,
    bypassSafety: true,
    idFactory: ids('10000000-0000-4000-8000-000000000017', '20000000-0000-4000-8000-000000000017')
  });

  assert.equal(result.persisted, true);
  assert.equal(result.duplicateCleanup.queued, 1);
  assert.equal(queued[0].context.reason, 'idempotent_replay_cleanup_failed');
});

test('si Supabase confirmó el lote pero se cortó la respuesta lo recupera sin borrar archivos válidos', async () => {
  let submissionChecks = 0;
  let removeCalls = 0;
  const repository = {
    getConfig: async () => ({ migrationReady: true, ...config() }),
    getLead: async () => lead(),
    getSubmission: async () => {
      submissionChecks += 1;
      return submissionChecks === 1
        ? null
        : { status: 'completed', created: [{ id: 'persistido', type: 'Venta' }] };
    },
    uploadFile: async () => ({ ok: true }),
    createBatch: async () => { throw new Error('socket cerrado'); },
    removeFiles: async () => { removeCalls += 1; }
  };
  const file = {
    name: 'comprobante.webp',
    type: 'image/webp',
    base64: Buffer.from('webp-de-prueba').toString('base64')
  };

  const result = await service.create(salePayload({ attachmentFiles: [file] }), MATI, {
    repository,
    bypassSafety: true,
    idFactory: ids('10000000-0000-4000-8000-000000000013', '20000000-0000-4000-8000-000000000013')
  });
  assert.equal(result.persisted, true);
  assert.equal(result.recoveredAfterAmbiguousResponse, true);
  assert.equal(result.result.idempotentReplay, true);
  assert.deepEqual(result.result.created, [{ id: 'persistido', type: 'Venta' }]);
  assert.equal(removeCalls, 0);
});

test('un reintento completado no vuelve a subir archivos ni crea otro lote', async () => {
  let uploadCalls = 0;
  let batchCalls = 0;
  const repository = {
    getConfig: async () => ({ migrationReady: true, ...config() }),
    getLead: async () => lead(),
    getSubmission: async () => ({
      status: 'completed',
      created: [{ id: 'venta-existente', type: 'Venta' }]
    }),
    uploadFile: async () => { uploadCalls += 1; },
    createBatch: async () => { batchCalls += 1; }
  };
  const file = {
    name: 'comprobante.jpg',
    type: 'image/jpeg',
    base64: Buffer.from('jpg-de-prueba').toString('base64')
  };

  const result = await service.create(salePayload({ attachmentFiles: [file] }), MATI, {
    repository,
    bypassSafety: true,
    idFactory: ids('10000000-0000-4000-8000-000000000014', '20000000-0000-4000-8000-000000000014')
  });
  assert.equal(result.result.idempotentReplay, true);
  assert.deepEqual(result.result.created, [{ id: 'venta-existente', type: 'Venta' }]);
  assert.equal(uploadCalls, 0);
  assert.equal(batchCalls, 0);
});

test('si Storage falla después de una baja registra cada archivo para reintento durable', async () => {
  const queued = [];
  const comprobanteId = '10000000-0000-4000-8000-000000000015';
  const repository = {
    getComprobante: async () => ({
      id: comprobanteId,
      tipo: 'Cobranza',
      estado: null,
      created_by_email: MATI.email,
      responsable_venta: 'Mati Randazzo',
      source_system: 'supabase_direct'
    }),
    listFiles: async () => [
      { comprobante_id: comprobanteId, bucket: 'comprobantes', object_path: 'lote/uno.pdf' },
      { comprobante_id: comprobanteId, bucket: 'comprobantes', object_path: 'lote/dos.png' }
    ],
    deleteComprobante: async () => ({ ok: true, id: comprobanteId }),
    removeFiles: async () => { throw new Error('Storage temporalmente no disponible'); },
    enqueueFileCleanup: async (files, context) => queued.push({ files, context })
  };

  const result = await service.deleteEditableComprobante(comprobanteId, MATI, {
    repository,
    allowOperationalUser: true,
    bypassSafety: true
  });

  assert.equal(result.cleanupQueued, 2);
  assert.equal(queued.length, 1);
  assert.deepEqual(queued[0].files.map((file) => file.object_path), ['lote/uno.pdf', 'lote/dos.png']);
  assert.equal(queued[0].context.comprobanteId, comprobanteId);
  assert.equal(queued[0].context.actorEmail, MATI.email);
  assert.match(queued[0].context.error, /Storage temporalmente no disponible/);
  assert.match(result.message, /2 archivo\(s\).*cola/i);
});

test('Mati o Nadia pueden consultar y reintentar la cola; cada resultado queda registrado', async () => {
  const finished = [];
  const repository = {
    listPendingFileCleanup: async () => [
      { id: 1, bucket: 'comprobantes', object_path: 'pendiente/ok.pdf' },
      { id: 2, bucket: 'comprobantes', object_path: 'pendiente/falla.pdf' }
    ],
    removeFiles: async (_bucket, paths) => {
      if (paths[0].includes('falla')) throw new Error('Storage sigue caído');
    },
    finishFileCleanup: async (id, success, error, actorEmail) => {
      finished.push({ id, success, error, actorEmail });
    }
  };

  const listed = await service.getStorageCleanupQueue(MATI, { repository });
  assert.equal(listed.count, 2);
  const result = await service.retryStorageCleanup(NADIA, { repository, bypassSafety: true });
  assert.deepEqual({ attempted: result.attempted, completed: result.completed, failed: result.failed }, {
    attempted: 2,
    completed: 1,
    failed: 1
  });
  assert.deepEqual(finished.map((item) => [item.id, item.success]), [[1, true], [2, false]]);
  assert.equal(finished.every((item) => item.actorEmail === NADIA.email), true);
  await assert.rejects(service.getStorageCleanupQueue(OTHER, { repository }), /sólo está habilitado para Mati y Nadia/i);
});

test('la migración define idempotencia, relaciones, archivos, RLS y RPC transaccional', () => {
  const sql = fs.readFileSync(path.join(
    __dirname,
    '../supabase/migrations/20260921173000_create_comprobantes_supabase_direct_lab.sql'
  ), 'utf8');
  assert.match(sql, /submission_key text not null unique/i);
  assert.match(sql, /comprobantes_submission_operation_uidx/i);
  assert.match(sql, /foreign key \(venta_id\) references public\.comprobantes\(id\)/i);
  assert.match(sql, /foreign key \(lead_id\) references public\.leads_raw\(id\)/i);
  assert.match(sql, /foreign key \(responsable_venta_id\) references public\.comprobantes_responsables_config\(id\)/i);
  assert.match(sql, /create table if not exists public\.comprobantes_responsables_config/i);
  assert.match(sql, /create table if not exists public\.comprobantes_archivos/i);
  assert.match(sql, /create table if not exists public\.comprobantes_storage_cleanup_queue/i);
  assert.match(sql, /comprobantes_storage_cleanup_pending_idx/i);
  assert.match(sql, /metricas_create_comprobante_batch_v1/i);
  assert.match(sql, /metricas_update_comprobante_direct_v1/i);
  assert.match(sql, /metricas_delete_comprobante_direct_v1/i);
  assert.match(sql, /metricas_enqueue_storage_cleanup_v1/i);
  assert.match(sql, /metricas_finish_storage_cleanup_v1/i);
  assert.match(sql, /metricas_update_comprobante_reconciliation_v1/i);
  assert.match(sql, /cobranzas o devoluciones relacionadas/i);
  assert.match(sql, /event_type, actor_email, payload/i);
  assert.match(sql, /lead\.id = v_item->>'lead_id'/i);
  assert.match(sql, /objectPath' not like v_batch_id::text \|\| '\/%'/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all .* anon, authenticated/i);
  assert.match(sql, /alter table public\.comprobantes_storage_cleanup_queue enable row level security/i);
  assert.match(sql, /revoke all on public\.comprobantes_storage_cleanup_queue from anon, authenticated/i);
});

test('la configuración privada existe en Administración y permite configurar la carga', () => {
  const admin = fs.readFileSync(path.join(__dirname, '../public/metricas-v2/views/administracion.html'), 'utf8');
  const page = fs.readFileSync(path.join(__dirname, '../public/metricas-v2/views/comprobantes-config.html'), 'utf8');
  assert.match(admin, /comprobantes-config\.html/);
  assert.match(page, /Privado · Mati y Nadia/);
  assert.match(page, /Configuración de carga de comprobantes/i);
  assert.match(page, /Responsables de venta/i);
  assert.match(page, /comprobantesLabAddProduct/);
  assert.match(page, /comprobantesLabAddPayment/);
  assert.match(page, /comprobantesLabAddResponsible/);
  assert.match(page, /comprobantesLabExportConfig/);
  assert.match(page, /comprobantesLabImportConfig/);
  assert.match(page, /comprobantesLabPaymentSearch/);
  assert.match(page, /comprobantesLabPaymentStatus/);



  assert.match(page, /Medios de pago generales/i);
  assert.doesNotMatch(page, /simulador|preflight|laboratorio/i);

  assert.match(page, /desactivan: no se borran/i);
});

test('sube hasta tres archivos en paralelo y confirma progreso real en orden', async () => {
  let active = 0, maxActive = 0;
  const progress = [];
  const attachments = Array.from({length:6}, (_, i) => ({name:`archivo-${i}.pdf`,type:'application/pdf',base64:Buffer.from(`pdf-${i}`).toString('base64')}));
  const repository = {
    getConfig: async () => ({migrationReady:true,...config()}), getLead: async () => lead(),
    uploadFile: async () => {active++;maxActive=Math.max(maxActive,active);await new Promise(resolve=>setTimeout(resolve,5));active--;},
    createBatch: async payload => {assert.equal(active,0);assert.deepEqual(payload.files.map(f=>f.name),attachments.map(f=>f.name));return {created:payload.rows.map(r=>({id:r.id}))};}
  };
  await service.create(salePayload({attachmentFiles:attachments}),MATI,{repository,bypassSafety:true,onProgress:event=>progress.push(event)});
  assert.equal(maxActive,3);
  assert.deepEqual(progress.filter(e=>e.stage==='uploading').map(e=>e.completed),[0,1,2,3,4,5,6]);
  assert.equal(progress.at(-1).stage,'saving');
});

test('un fallo espera las subidas en curso antes de limpiar los archivos', async () => {
  let active=0,cleaned=0,batches=0;
  const repository={getConfig:async()=>({migrationReady:true,...config()}),getLead:async()=>lead(),
    uploadFile:async(_bucket,_path,file)=>{if(file.name==='fallo.pdf')throw new Error('fallo controlado');active++;await new Promise(resolve=>setTimeout(resolve,10));active--;},
    createBatch:async()=>{batches++;},removeFiles:async(_bucket,paths)=>{assert.equal(active,0);cleaned+=paths.length;}};
  const attachmentFiles=['uno.pdf','dos.pdf','fallo.pdf','no-subir.pdf'].map(name=>({name,type:'application/pdf',base64:Buffer.from(name).toString('base64')}));
  await assert.rejects(service.create(salePayload({attachmentFiles}),MATI,{repository,bypassSafety:true}),/fallo controlado/);
  assert.equal(cleaned,2);assert.equal(batches,0);
});
