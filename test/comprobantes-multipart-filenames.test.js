const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const multer = require('multer');
const { multipartAttachments } = require('../modules/metricasv2/services/comprobantes-attachments');
const { validateChequeRows } = require('../modules/metricasv2/services/comprobantes-loader.service')._test;

async function browserUpload(names, payload) {
  const boundary = 'receipt-regression-boundary';
  const parts = [
    `--${boundary}\r\nContent-Disposition: form-data; name="payload"\r\n\r\n${JSON.stringify(payload)}\r\n`,
    ...names.map((name, index) =>
      `--${boundary}\r\nContent-Disposition: form-data; name="attachmentFiles"; filename="${name}"\r\nContent-Type: image/png\r\n\r\nfile-${index}\r\n`),
    `--${boundary}--\r\n`
  ];
  const body = Buffer.from(parts.join(''), 'utf8');
  const req = Readable.from([body]);
  req.headers = {
    'content-type': `multipart/form-data; boundary=${boundary}`,
    'content-length': String(body.length)
  };
  await new Promise((resolve, reject) =>
    multer({ storage: multer.memoryStorage() }).array('attachmentFiles', 12)(
      req, {}, (error) => error ? reject(error) : resolve()
    ));
  return { req, files: req.files, payload: JSON.parse(req.body.payload) };
}

test('los tres cheques del video conservan sus nombres UTF-8 y su archivo al recibir multipart', async () => {
  const names = [
    'cheque-1-Adrián Dotro cheque 2.094.307 04 11 2026.png',
    'cheque-2-Adrián Dotro Cheque 2.584.515 16 11 2026.png',
    'cheque-3-Adrián Dotro Cheque 2.584.515 pesos 16 12 2026.png'
  ];
  const amounts = [2094307, 2584515, 2584515];
  const cheques = names.map((archivoNombre, index) => ({
    archivoNombre, montoArs: amounts[index], fechaAcreditacion: '2026-11-04'
  }));
  const { files, payload } = await browserUpload(names, { attachmentNames: names, cheques });
  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  // Reproduce the actual error before the boundary repair.
  assert.throws(() => validateChequeRows(cheques, 3, total,
    files.map((file) => ({ name: file.originalname }))), /No encontré el archivo/);
  const attachments = multipartAttachments(files, payload);
  assert.doesNotThrow(() => validateChequeRows(cheques, 3, total, attachments));
  assert.deepEqual(attachments.map((file) => file.name), names);
  attachments.forEach((file, index) =>
    assert.equal(Buffer.from(file.base64, 'base64').toString(), `file-${index}`));
});

test('ASCII, ñ, acentos descompuestos y Unicode mantienen la asociación exacta', async () => {
  const names = ['cheque.pdf', 'Peña.png', 'Adria\u0301n.png', '支払 💵.png'];
  const { files, payload } = await browserUpload(names, { attachmentNames: names });
  assert.deepEqual(multipartAttachments(files, payload).map((file) => file.name), names);
});

test('no reasigna archivos ausentes ni modifica nombres ya correctos', () => {
  const file = (originalname) => ({ originalname, buffer: Buffer.from('data') });
  for (const name of ['Adrián.png', 'Peña.png', '支払.png', 'AdriÃ¡n.png']) {
    assert.equal(multipartAttachments([file(name)], { attachmentNames: [name] })[0].name, name);
  }
  const attachments = multipartAttachments([file('otro.png')], {
    attachmentNames: ['Adrián.png'], cheques: [{ archivoNombre: 'Adrián.png' }]
  });
  assert.throws(() => validateChequeRows([
    { archivoNombre: 'Adrián.png', montoArs: 100 }
  ], 1, 100, attachments), /No encontré el archivo/);
});

test('envío completo de Claudio: multipart → controlador → servicio → tres cobranzas y reintento sin duplicados', async (t) => {
  const controller = require('../modules/metricasv2/controllers/metricas.controller');
  const runtime = require('../modules/metricasv2/services/comprobantes-supabase.service');
  const direct = require('../modules/metricasv2/services/comprobantes-direct.service');
  const repository = runtime._test.repository;
  // Isolate only the external data/storage boundary. Controller, normalization,
  // authorization, upload orchestration and batch construction are real.
  for (const key of Object.keys(repository)) {
    t.mock.method(repository, key, async () => { throw new Error(`Unexpected repository call: ${key}`); });
  }
  const names = [
    'cheque-1-Adrián Dotro cheque 2.094.307 04 11 2026.png',
    'cheque-2-Adrián Dotro Cheque 2.584.515 16 11 2026.png',
    'cheque-3-Adrián Dotro Cheque 2.584.515 pesos 16 12 2026.png'
  ];
  const amounts = [2094307, 2584515, 2584515];
  const dates = ['2026-11-04', '2026-11-16', '2026-12-16'];
  const clientId = '29f48251-7a95-800d-9168-fefc4ff0ff16';
  const saleId = '6520aab0-ff8a-4cd3-bf2a-f5a7b75b96a5';
  const actor = { email: 'meg.claudionicolini@gmail.com', nombre: 'Claudio Nicolini' };
  const payload = {
    tipo: 'Cobranza', ghlId: 'video-regression-client', clientPageId: clientId,
    clientName: 'Adrián Dotro', responsableVenta: 'Claudio Nicolini',
    fechaVenta: '2026-10-15', fechaAcreditacion: '2026-10-19',
    tc: 1545, cashCollectedArs: 7263337, medioPago: 'E-cheq Bco Frances',
    dniCuit: '3368363269', latestSaleId: saleId, chequeCount: 3,
    submissionKey: 'video-claudio-multipart-regression',
    attachmentNames: names,
    cheques: names.map((archivoNombre, i) => ({
      archivoNombre, montoArs: amounts[i], fechaAcreditacion: dates[i]
    }))
  };
  t.mock.method(repository, 'getConfig', async () => ({
    migrationReady: true,
    products: direct._test.DEFAULT_PRODUCTS,
    paymentMethods: direct._test.DEFAULT_PAYMENT_METHODS,
    responsiblePeople: direct._test.DEFAULT_RESPONSIBLE_PEOPLE,
    rules: direct._test.DEFAULT_RULES
  }));
  t.mock.method(repository, 'getLead', async () => ({
    id: clientId, ghlid: payload.ghlId, nombre: payload.clientName, closer: actor.nombre
  }));
  t.mock.method(repository, 'getSale', async () => ({
    id: saleId, ghlid: payload.ghlId, tipo: 'Venta', f_venta: '2026-10-15',
    responsable_venta: actor.nombre
  }));
  let saved = null;
  let batchCount = 0;
  const uploads = [];
  t.mock.method(repository, 'getSubmission', async () => saved && ({
    status: 'completed', actorEmail: actor.email,
    created: saved.rows.map((row) => ({ id: row.id, type: row.tipo }))
  }));
  t.mock.method(repository, 'stageFiles', async () => {});
  t.mock.method(repository, 'uploadFile', async (bucket, objectPath, file) => {
    uploads.push({ objectPath, file });
  });
  t.mock.method(repository, 'createBatch', async (batch) => {
    saved = batch;
    batchCount += 1;
    return { created: batch.rows.map((row) => ({ id: row.id, type: row.tipo })) };
  });

  async function submit() {
    const { req } = await browserUpload(names, payload);
    req.authUser = actor;
    req.headers.accept = 'application/x-ndjson';
    const events = [];
    let ended = false;
    await controller.createComprobanteManual(req, {
      setHeader() {}, flushHeaders() {}, flush() {},
      write(line) { events.push(JSON.parse(line)); },
      end() { ended = true; }
    }, (error) => { throw error; });
    assert.equal(ended, true);
    assert.equal(events.some((event) => event.type === 'error'), false, JSON.stringify(events));
    return events;
  }
  const events = await submit();
  assert.equal(events.at(-1).type, 'result');
  assert.equal(events.at(-1).data.created.length, 3);
  assert.equal(saved.rows.length, 3);
  saved.rows.forEach((row, i) => {
    assert.equal(row.tipo, 'Cobranza');
    assert.equal(row.venta_relacionada, saleId);
    assert.equal(row.responsable_venta, actor.nombre);
    assert.equal(Number(row.cash_ar), amounts[i]);
    assert.equal(row.f_acreditacion.slice(0, 10), dates[i]);
    assert.equal(saved.files[i].operationIndex, i);
    assert.equal(saved.files[i].name, names[i]);
    const upload = uploads.find((item) => item.objectPath === saved.files[i].objectPath);
    assert.equal(Buffer.from(upload.file.base64, 'base64').toString(), `file-${i}`);
  });
  assert.ok(events.some((event) => event.stage === 'uploading' && event.completed === 3));
  assert.ok(events.some((event) => event.stage === 'saving'));
  const retry = await submit();
  assert.equal(retry.at(-1).data.result.idempotentReplay, true);
  assert.equal(retry.at(-1).data.created.length, 3);
  assert.equal(batchCount, 1);
  assert.equal(uploads.length, 3);
});
