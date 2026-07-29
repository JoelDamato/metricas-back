const test = require('node:test');
const assert = require('node:assert/strict');
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
  buildPadronEnvelope
} = require('../modules/metricasv2/services/arca-invoicing.service');
const { validateRecipientFields } = require('../modules/metricasv2/services/mercado-pago.service');
const {
  credentialPathCandidates,
  resolveCredentialPath
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

test('credenciales ARCA contemplan la ubicación oficial de Secret Files en Render', () => {
  const candidates = credentialPathCandidates('certificado.crt', '/ruta/explicita/certificado.crt');

  assert.equal(candidates[0], '/ruta/explicita/certificado.crt');
  assert.equal(candidates[1], '/etc/secrets/certificado.crt');
  assert.match(resolveCredentialPath('matias-randazzo-wsfe-produccion.crt'), /secrets\/arca\/matias-randazzo-wsfe-produccion\.crt$/);
});
