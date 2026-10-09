const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const controller = require('../modules/metricasv2/controllers/metricas.controller');
const comprobantesLoaderService = require('../modules/metricasv2/services/comprobantes-loader.service');
const runtime=require('../modules/metricasv2/services/comprobantes-supabase.service');
const comprobantesDirectService = require('../modules/metricasv2/services/comprobantes-direct.service');
const metricasV2ErrorHandler = require('../modules/metricasv2/errorHandler');

const root = path.resolve(__dirname, '..');
const pageScript = fs.readFileSync(
  path.join(root, 'public/metricas-v2/js/views/carga-comprobantes.page.js'),
  'utf8'
);
const apiScript = fs.readFileSync(
  path.join(root, 'public/metricas-v2/js/api/metricas.api.js'),
  'utf8'
);
const httpScript = fs.readFileSync(
  path.join(root, 'public/metricas-v2/js/api/http.js'),
  'utf8'
);
const routesScript = fs.readFileSync(path.join(root, 'routes/metricasV2.js'), 'utf8');

test('los adjuntos se envían como multipart sin mantener copias base64 en la revisión', () => {
  assert.doesNotMatch(pageScript, /readAsDataURL|function readFileAsBase64/);
  assert.match(pageScript, /function attachmentMetadata\(\)/);
  assert.match(pageScript, /api\.createComprobanteManual\(payload, getAllAttachments\(\), updateRealProgress\)/);
  assert.match(apiScript, /const formData = new FormData\(\)/);
  assert.match(apiScript, /formData\.append\('attachmentFiles', file, file\.name\)/);
  assert.match(apiScript, /delete requestPayload\.attachmentFiles/);
  assert.match(routesScript, /comprobanteAttachments\.array\('attachmentFiles', 12\)/);
});

test('la solicitud multipart tiene recuperación por timeout y conserva la clave de envío', () => {
  assert.match(httpScript, /const controller = typeof AbortController/);
  assert.match(httpScript, /if \(error\?\.name === 'AbortError'\)/);
  assert.match(apiScript, /timeoutMs: 4 \* 60 \* 1000/);
  assert.match(apiScript, /conserva la misma clave para no duplicar comprobantes/);
  assert.doesNotMatch(pageScript, /catch \(error\)[\s\S]{0,500}state\.submissionKey = null/);
});

test('el controlador reconstruye los adjuntos multipart para Supabase', async (t) => {
  let receivedPayload = null;
  let receivedUser = null;
  t.mock.method(runtime, 'create', async (payload, user) => {
    receivedPayload = payload;
    receivedUser = user;
    return { created: [{ id: 'supabase-row-1', type: 'Venta' }] };
  });

  const req = {
    body: {
      payload: JSON.stringify({
        tipo: 'Venta',
        submissionKey: 'cmp-repeat-safe-123456'
      })
    },
    files: [{
      originalname: 'comprobante.pdf',
      mimetype: 'application/pdf',
      size: 4,
      buffer: Buffer.from('test')
    }],
    authUser: { email: 'patricia@example.com' }
  };
  let responseBody = null;
  let nextError = null;
  await controller.createComprobanteManual(
    req,
    { json(body) { responseBody = body; } },
    (error) => { nextError = error; }
  );

  assert.equal(nextError, null);
  assert.equal(receivedUser, req.authUser);
  assert.equal(receivedPayload.submissionKey, 'cmp-repeat-safe-123456');
  assert.deepEqual(receivedPayload.attachmentFiles, [{
    name: 'comprobante.pdf',
    type: 'application/pdf',
    size: 4,
    base64: Buffer.from('test').toString('base64')
  }]);
  assert.deepEqual(responseBody, {
    ok: true,
    created: [{ id: 'supabase-row-1', type: 'Venta' }]
  });
});

test('la pantalla carga en Supabase sin depender del corte ni llamar a Notion', async (t) => {
  let directCall = null;
  let notionCalls = 0;
  t.mock.method(comprobantesDirectService, 'isCutoverActive', () => false);
  t.mock.method(runtime, 'create', async (payload, user, options) => {
    directCall = { payload, user, options };
    return { created: [{ id: 'supabase-row-1', type: 'Venta' }], persisted: true };
  });
  t.mock.method(comprobantesLoaderService, 'createComprobante', async () => {
    notionCalls += 1;
    throw new Error('No debería llamar a Notion');
  });
  const req = {
    body: { payload: JSON.stringify({ tipo: 'Venta', submissionKey: 'cmp-direct-safe-123456' }) },
    files: [],
    authUser: { email: 'iascinahuel@gmail.com', nombre: 'Nahuel Iasci' }
  };
  let responseBody;
  let nextError = null;
  await controller.createComprobanteManual(
    req,
    { json(body) { responseBody = body; } },
    (error) => { nextError = error; }
  );
  assert.equal(nextError, null);
  assert.equal(notionCalls, 0);
  assert.deepEqual(directCall.options, {});
  assert.equal(directCall.user.email, req.authUser.email);
  assert.deepEqual(responseBody.created, [{ id: 'supabase-row-1', type: 'Venta' }]);
});

test('un límite multipart devuelve 413 con un mensaje recuperable', () => {
  const error = new Error('Too many files');
  error.code = 'LIMIT_FILE_COUNT';
  let statusCode = null;
  let responseBody = null;
  metricasV2ErrorHandler(
    error,
    { method: 'POST', originalUrl: '/api/metricas/comprobantes-loader' },
    {
      status(code) {
        statusCode = code;
        return this;
      },
      json(body) {
        responseBody = body;
        return this;
      }
    },
    () => {}
  );

  assert.equal(statusCode, 413);
  assert.match(responseBody.message, /30 MB/);
});
