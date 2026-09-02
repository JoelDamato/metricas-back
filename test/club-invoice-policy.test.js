const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  FIXED_DESCRIPTION,
  MONOTRIBUTO_LEGEND,
  TRANSPARENCY_LEGEND,
  buildClubInvoicePolicy,
  arcaAmountsXml
} = require('../modules/metricasv2/services/club-invoice-policy.service');
const {
  previewInvoice,
  resolveRecipient,
  invoiceDates,
  buildPadronEnvelope,
  recipientFromPadron,
  buildInvoiceConsultEnvelope,
  parseAuthorizedInvoiceConsult,
  recoverInvoiceAttempt
} = require('../modules/metricasv2/services/arca-invoicing.service');
const { validateRecipientFields } = require('../modules/metricasv2/services/mercado-pago.service');
const {
  ARCA_HTTPS_AGENT,
  discoverRenderSecretFiles,
  credentialPathCandidates,
  resolveCredentialPath,
  materializeCredentialPem,
  credentialsAreReusable,
  isTransientArcaError
} = require('../scripts/arca_wsfe_probe');

test('Consumidor Final usa Factura B, concepto fijo e importe exento', () => {
  const policy = buildClubInvoicePolicy(
    { amount: 15000, description: 'Nombre de MP' },
    { vatConditionId: 5 }
  );

  assert.equal(policy.case, 'consumidor_final');
  assert.equal(policy.description, FIXED_DESCRIPTION);
  assert.equal(policy.taxTreatment, 'Exento');
  assert.deepEqual(policy.amounts, {
    total: 15000,
    net: 0,
    exempt: 15000,
    vat: 0,
    vatRate: 0,
    vatRateId: null
  });
  assert.deepEqual(policy.legends, [TRANSPARENCY_LEGEND]);
});

test('Monotributo usa concepto fijo y ambas leyendas obligatorias', () => {
  const policy = buildClubInvoicePolicy(
    { amount: 15000, description: 'Nombre de MP' },
    { vatConditionId: 6 }
  );

  assert.equal(policy.case, 'monotributo');
  assert.equal(policy.taxTreatment, 'Exento');
  assert.equal(policy.showMonotributoLegend, true);
  assert.deepEqual(policy.legends, [MONOTRIBUTO_LEGEND, TRANSPARENCY_LEGEND]);
});

test('Responsable Inscripto usa el nombre de Mercado Pago e IVA 21%', () => {
  const policy = buildClubInvoicePolicy(
    { amount: 15000, description: 'Membresía Club Empresas' },
    { vatConditionId: 1 }
  );

  assert.equal(policy.case, 'responsable_inscripto');
  assert.equal(policy.description, 'Membresía Club Empresas');
  assert.equal(policy.taxTreatment, 'Gravado 21%');
  assert.deepEqual(policy.amounts, {
    total: 15000,
    net: 12396.69,
    exempt: 0,
    vat: 2603.31,
    vatRate: 0.21,
    vatRateId: 5
  });
  assert.deepEqual(policy.legends, []);
});

test('XML ARCA discrimina la alícuota únicamente para el caso gravado', () => {
  const taxed = buildClubInvoicePolicy({ amount: 15000, description: 'Club RI' }, { vatConditionId: 1 });
  const exempt = buildClubInvoicePolicy({ amount: 15000 }, { vatConditionId: 5 });

  assert.match(arcaAmountsXml(taxed.amounts), /<ImpNeto>12396\.69<\/ImpNeto>/);
  assert.match(arcaAmountsXml(taxed.amounts), /<ImpIVA>2603\.31<\/ImpIVA>/);
  assert.match(arcaAmountsXml(taxed.amounts), /<Id>5<\/Id><BaseImp>12396\.69<\/BaseImp>/);
  assert.match(arcaAmountsXml(exempt.amounts), /<ImpOpEx>15000\.00<\/ImpOpEx>/);
  assert.doesNotMatch(arcaAmountsXml(exempt.amounts), /<AlicIva>/);
});

test('carga manual deriva Factura B o A de la condición IVA', async () => {
  const consumer = await resolveRecipient({
    source: 'manual',
    requestedInvoiceType: 'B',
    vatConditionId: 5,
    identificationType: 'DNI',
    identificationNumber: '30111222'
  });
  const monotributo = await resolveRecipient({
    source: 'manual',
    requestedInvoiceType: 'A',
    vatConditionId: 6,
    identificationType: 'CUIT',
    identificationNumber: '20-12345678-3'
  });

  assert.equal(consumer.invoiceType, 'B');
  assert.equal(consumer.documentType, 96);
  assert.equal(monotributo.invoiceType, 'A');
  assert.equal(monotributo.vatCondition, 'Responsable Monotributo');
});

test('carga manual bloquea una combinación factura/condición inválida', async () => {
  await assert.rejects(
    resolveRecipient({
      source: 'manual',
      requestedInvoiceType: 'B',
      vatConditionId: 1,
      identificationType: 'CUIT',
      identificationNumber: '20-12345678-3'
    }),
    /requieren Factura A/
  );
});

test('previsualización fiscal manual resuelve el comprobante sin solicitar CAE', async () => {
  const preview = await previewInvoice({
    source: 'manual',
    requestedInvoiceType: 'A',
    vatConditionId: 1,
    identificationType: 'CUIT',
    identificationNumber: '30-71234567-9',
    payer: 'Empresa de Prueba S.A.',
    payerAddress: 'Av. Siempre Viva 123 - Córdoba',
    description: 'Membresía Club Empresas',
    amount: 15000,
    currency: 'ARS'
  });

  assert.equal(preview.invoiceType, 'A');
  assert.equal(preview.vatCondition, 'Responsable Inscripto');
  assert.equal(preview.taxTreatment, 'Gravado 21%');
  assert.equal(preview.amounts.vat, 2603.31);
  assert.equal(preview.recipientName, 'Empresa de Prueba S.A.');
  assert.equal(preview.recipientAddress, 'Av. Siempre Viva 123 - Córdoba');
});

test('período facturado cubre el mes completo y el vencimiento coincide con la emisión', () => {
  const dates = invoiceDates(new Date('2026-07-28T15:30:00.000Z'));

  assert.equal(dates.issued.toISOString(), '2026-07-28T15:30:00.000Z');
  assert.equal(dates.serviceFrom.toISOString(), '2026-07-01T00:00:00.000Z');
  assert.equal(dates.serviceTo.toISOString(), '2026-07-31T00:00:00.000Z');
  assert.equal(dates.paymentDueDate.toISOString(), '2026-07-28T15:30:00.000Z');
});

test('datos fiscales completados evitan consultar el Padrón para un registro importado', async () => {
  const fields = validateRecipientFields({
    payer: 'Empresa Importada S.A.',
    payerAddress: 'Av. Córdoba 1234 - CABA',
    vatConditionId: 1,
    identificationType: 'CUIT',
    identificationNumber: '30-71234567-9'
  });
  const recipient = await resolveRecipient(fields);

  assert.equal(fields.requestedInvoiceType, 'A');
  assert.equal(recipient.recipientName, 'Empresa Importada S.A.');
  assert.equal(recipient.recipientAddress, 'Av. Córdoba 1234 - CABA');
  assert.equal(recipient.vatCondition, 'Responsable Inscripto');
});

test('datos fiscales exigen domicilio y CUIT válido para Factura A', () => {
  assert.throws(
    () => validateRecipientFields({
      payer: 'Empresa sin domicilio',
      payerAddress: '',
      vatConditionId: 1,
      identificationType: 'CUIT',
      identificationNumber: '30712345679'
    }),
    /Domicilio Comercial/
  );
  assert.throws(
    () => validateRecipientFields({
      payer: 'Empresa con CUIT inválido',
      payerAddress: 'Calle 123',
      vatConditionId: 1,
      identificationType: 'CUIT',
      identificationNumber: '123'
    }),
    /CUIT válido/
  );
});

test('consulta de Padrón envía parámetros SOAP sin heredar el namespace del método', () => {
  const xml = buildPadronEnvelope({ token: 'token-prueba', sign: 'firma-prueba' }, '27312950214');

  assert.match(xml, /<a5:getPersona_v2 xmlns:a5="http:\/\/a5\.soap\.ws\.server\.puc\.sr\/"><token>/);
  assert.match(xml, /<idPersona>27312950214<\/idPersona><\/a5:getPersona_v2>/);
  assert.doesNotMatch(xml, /<getPersona_v2 xmlns="http:\/\/a5\.soap\.ws\.server\.puc\.sr\/">/);
});

test('CUIT sin IVA ni Monotributo se factura B como Consumidor Final conservando su identificación', () => {
  const xml = `
    <personaReturn>
      <persona>
        <apellido>GORMAN</apellido><nombre>GABRIELA</nombre>
        <domicilioFiscal>
          <direccion>Calle 123</direccion><localidad>Rosario</localidad><descripcionProvincia>Santa Fe</descripcionProvincia>
        </domicilioFiscal>
        <impuesto><descripcionImpuesto>GANANCIAS PERSONAS FISICAS</descripcionImpuesto></impuesto>
      </persona>
    </personaReturn>`;
  const recipient = recipientFromPadron(
    { identificationType: 'CUIT', payer: 'correo@ejemplo.com', payerAddress: '' },
    '27253656676',
    xml
  );

  assert.equal(recipient.invoiceType, 'B');
  assert.equal(recipient.documentType, 80);
  assert.equal(recipient.documentNumber, '27253656676');
  assert.equal(recipient.vatConditionId, 5);
  assert.equal(recipient.vatCondition, 'Consumidor Final');
  assert.equal(recipient.recipientName, 'GORMAN GABRIELA');
  assert.equal(recipient.recipientAddress, 'Calle 123 - Rosario - Santa Fe');
});

test('credenciales ARCA contemplan la ubicación oficial de Secret Files en Render', () => {
  const candidates = credentialPathCandidates('certificado.crt', '/ruta/explicita/certificado.crt');

  assert.equal(candidates[0], '/ruta/explicita/certificado.crt');
  assert.equal(candidates[1], '/etc/secrets/certificado.crt');
  assert.match(resolveCredentialPath('matias-randazzo-wsfe-produccion.crt'), /secrets\/arca\/matias-randazzo-wsfe-produccion\.crt$/);
});

test('credenciales ARCA detectan certificados y claves aunque Render cambie sus nombres', () => {
  const secretDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arca-secrets-'));
  try {
    fs.writeFileSync(path.join(secretDir, 'certificado-produccion'), '-----BEGIN CERTIFICATE-----\nprueba\n-----END CERTIFICATE-----');
    fs.writeFileSync(path.join(secretDir, 'clave-privada'), '-----BEGIN PRIVATE KEY-----\nprueba\n-----END PRIVATE KEY-----');
    fs.writeFileSync(path.join(secretDir, 'otro-secreto'), 'sin credenciales');

    assert.deepEqual(discoverRenderSecretFiles('certificate', secretDir), [path.join(secretDir, 'certificado-produccion')]);
    assert.deepEqual(discoverRenderSecretFiles('key', secretDir), [path.join(secretDir, 'clave-privada')]);
  } finally {
    fs.rmSync(secretDir, { recursive: true, force: true });
  }
});

test('credenciales ARCA aceptan PEM multilínea desde variables de entorno', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'arca-env-'));
  try {
    const certificatePath = materializeCredentialPem(
      '-----BEGIN CERTIFICATE-----\\ncontenido\\n-----END CERTIFICATE-----',
      'certificado.crt',
      tempRoot
    );
    const keyPath = materializeCredentialPem(
      '-----BEGIN PRIVATE KEY-----\ncontenido\n-----END PRIVATE KEY-----',
      'privada.key',
      tempRoot
    );

    assert.equal(fs.readFileSync(certificatePath, 'utf8'), '-----BEGIN CERTIFICATE-----\ncontenido\n-----END CERTIFICATE-----\n');
    assert.equal(fs.statSync(certificatePath).mode & 0o777, 0o600);
    assert.equal(fs.statSync(keyPath).mode & 0o777, 0o600);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('conexiones ARCA usan compatibilidad TLS aislada para el servidor fiscal', () => {
  assert.equal(ARCA_HTTPS_AGENT.options.ciphers, 'DEFAULT@SECLEVEL=1');
  assert.equal(ARCA_HTTPS_AGENT.options.minVersion, 'TLSv1.2');
});

test('ticket WSAA se reutiliza hasta cinco minutos antes de vencer', () => {
  const now = Date.parse('2026-07-30T12:00:00.000Z');
  const base = { token: 'token', sign: 'sign' };

  assert.equal(credentialsAreReusable({ ...base, expirationTime: '2026-07-30T13:00:00.000Z' }, now), true);
  assert.equal(credentialsAreReusable({ ...base, expirationTime: '2026-07-30T12:04:59.000Z' }, now), false);
  assert.equal(credentialsAreReusable({ token: '', sign: 'sign', expirationTime: '2026-07-30T13:00:00.000Z' }, now), false);
});

test('reconoce socket hang up y resets de ARCA como errores transitorios', () => {
  assert.equal(isTransientArcaError(Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' })), true);
  assert.equal(isTransientArcaError({ response: { status: 503 }, message: 'Service unavailable' }), true);
  assert.equal(isTransientArcaError(new Error('ARCA rechazó el comprobante')), false);
});

test('consulta en ARCA el comprobante exacto después de una conexión interrumpida', async () => {
  const attempt = {
    pending: true,
    invoiceType: 'B',
    invoiceTypeCode: 6,
    pointOfSale: 5,
    invoiceNumber: 352,
    amount: 39500
  };
  let request = null;
  const recovered = await recoverInvoiceAttempt(attempt, {
    auth: { token: 'token-prueba', sign: 'firma-prueba' },
    getLastAuthorizedInvoice: async () => 352,
    postWsfe: async (action, body, options) => {
      request = { action, body, options };
      return '<ResultGet><Resultado>A</Resultado><CodAutorizacion>86350000000001</CodAutorizacion><FchVto>20260912</FchVto></ResultGet>';
    }
  });

  assert.equal(request.action, 'FECompConsultar');
  assert.equal(request.options.retryable, true);
  assert.match(request.body, /<CbteTipo>6<\/CbteTipo><CbteNro>352<\/CbteNro><PtoVta>5<\/PtoVta>/);
  assert.equal(recovered.pending, undefined);
  assert.equal(recovered.cae, '86350000000001');
  assert.equal(recovered.recoveredAfterConnectionInterruption, true);
});

test('no inventa una autorización si el último comprobante de ARCA es anterior', async () => {
  let consulted = false;
  const recovered = await recoverInvoiceAttempt({
    pending: true,
    invoiceTypeCode: 1,
    invoiceNumber: 740
  }, {
    auth: { token: 'token-prueba', sign: 'firma-prueba' },
    getLastAuthorizedInvoice: async () => 739,
    postWsfe: async () => { consulted = true; }
  });

  assert.equal(recovered, null);
  assert.equal(consulted, false);
});

test('la consulta de recuperación usa el método oficial FECompConsultar', () => {
  const xml = buildInvoiceConsultEnvelope({ token: 'token', sign: 'firma' }, 1, 740);
  assert.match(xml, /<FECompConsultar/);
  assert.match(xml, /<CbteTipo>1<\/CbteTipo><CbteNro>740<\/CbteNro><PtoVta>5<\/PtoVta>/);
  assert.deepEqual(parseAuthorizedInvoiceConsult('<Resultado>A</Resultado><CodAutorizacion>123</CodAutorizacion><FchVto>20260912</FchVto>'), {
    cae: '123',
    caeExpiration: '20260912'
  });
});

test('el workflow guarda el intento antes de solicitar CAE y lo recupera antes de reemitir', () => {
  const source = fs.readFileSync(path.join(__dirname, '../modules/metricasv2/services/mercado-pago.service.js'), 'utf8');
  assert.match(source, /workflow\.arca_response\?\.pending/);
  assert.match(source, /recoverInvoiceAttempt\(pendingAttempt\)/);
  assert.match(source, /onAttempt: saveAttempt/);
});

test('factura y nota de crédito conservan el botón antes de esperar la confirmación', () => {
  const source = fs.readFileSync(path.join(__dirname, '../public/metricas-v2/js/views/mercado-pago-club.page.js'), 'utf8');

  assert.match(source, /const button = event\.currentTarget;\s+if \(!await confirmArcaEmission\(records\.length\)\) return;/);
  assert.match(source, /const confirmButton = clickEvent\.currentTarget;\s+if \(!await confirmArcaEmission\(1\)\) return;/);
  assert.match(source, /const progress = showArcaProgress\(records\.length\);/);
  assert.match(source, /closeInvoicePreview\(\);\s+await loadRecords\(\);\s+statusNode\.textContent = `La emisión se interrumpió:/);
});
