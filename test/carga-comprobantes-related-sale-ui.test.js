const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const apiScript = fs.readFileSync(
  path.join(__dirname, '../public/metricas-v2/js/api/metricas.api.js'),
  'utf8'
);
const pageScript = fs.readFileSync(
  path.join(__dirname, '../public/metricas-v2/js/views/carga-comprobantes.page.js'),
  'utf8'
);

test('la búsqueda manual de venta envía la identidad completa del cliente', async () => {
  let requestedUrl = '';
  const sandbox = {
    URLSearchParams,
    window: {
      http: {
        getJson: async (url) => {
          requestedUrl = url;
          return { ok: true };
        }
      }
    }
  };

  vm.runInNewContext(apiScript, sandbox);
  await sandbox.window.metricasApi.lookupComprobantesLoaderRelatedSale(
    'sale-page-id',
    { ghlId: 'GHL-AbC123', clientPageId: 'client-page-id' }
  );

  const url = new URL(requestedUrl, 'https://example.test');
  assert.equal(url.pathname, '/api/metricas/comprobantes-loader/venta-relacionada');
  assert.equal(url.searchParams.get('saleId'), 'sale-page-id');
  assert.equal(url.searchParams.get('ghlId'), 'GHL-AbC123');
  assert.equal(url.searchParams.get('clientPageId'), 'client-page-id');
});

test('la identidad de una venta debe coincidir sin normalizar el GHL', () => {
  const helperStart = pageScript.indexOf('function compactNotionId');
  const helperEnd = pageScript.indexOf('function invalidateRelatedSaleLookup');
  assert.ok(helperStart >= 0 && helperEnd > helperStart, 'deben existir los helpers de identidad');

  const sandbox = {};
  vm.runInNewContext(`
    ${pageScript.slice(helperStart, helperEnd)}
    result = {
      exact: relatedSaleMatchesClient(
        { ghlId: 'GHL-AbC123', clientPageIds: ['sale-client'] },
        { ghlId: 'GHL-AbC123', pageId: 'sale-client' }
      ),
      ghlCaseMismatch: relatedSaleMatchesClient(
        { ghlId: 'ghl-abc123' },
        { ghlId: 'GHL-AbC123', pageId: 'sale-client' }
      ),
      relationMismatch: relatedSaleMatchesClient(
        { ghlId: 'GHL-AbC123', clientPageIds: ['another-client'] },
        { ghlId: 'GHL-AbC123', pageId: 'sale-client' }
      ),
      duplicateClientPage: relatedSaleMatchesClient(
        { clientPageId: 'duplicate-client-page' },
        { ghlId: 'GHL-AbC123', pageId: 'primary-client-page', pageIds: ['duplicate-client-page'] }
      ),
      mixedRelations: relatedSaleMatchesClient(
        { clientPageIds: ['sale-client', 'another-client'] },
        { ghlId: 'GHL-AbC123', pageId: 'sale-client' }
      ),
      noIdentity: relatedSaleMatchesClient(
        { notionPageId: 'sale-page' },
        { ghlId: 'GHL-AbC123', pageId: 'sale-client' }
      )
    };
  `, sandbox);

  assert.equal(sandbox.result.exact, true);
  assert.equal(sandbox.result.ghlCaseMismatch, false);
  assert.equal(sandbox.result.relationMismatch, false);
  assert.equal(sandbox.result.duplicateClientPage, true);
  assert.equal(sandbox.result.mixedRelations, false);
  assert.equal(sandbox.result.noIdentity, false);
});

test('las respuestas obsoletas de cliente y venta quedan descartadas', () => {
  assert.match(pageScript, /clientLookupRequestId: 0/);
  assert.match(pageScript, /relatedSaleLookupRequestId: 0/);
  assert.match(pageScript, /requestId !== state\.clientLookupRequestId/);
  assert.match(pageScript, /clientRequestId === state\.clientLookupRequestId/);
  assert.match(pageScript, /requestId === state\.relatedSaleLookupRequestId/);
  assert.match(pageScript, /exactGhlId\(refs\.ghlId\.value\) === ghlId/);
  assert.match(pageScript, /compactNotionId\(refs\.clientPageId\.value\) === compactNotionId\(clientPageId\)/);
  assert.match(pageScript, /compactNotionId\(refs\.latestSaleId\.value\) === compactNotionId\(saleId\)/);
  assert.match(pageScript, /refs\.ghlInput\?\.addEventListener\('input'/);
  assert.match(pageScript, /state\.client = null/);
});

test('una sugerencia automática contradictoria no se aplica al formulario', () => {
  assert.match(
    pageScript,
    /const sale = relatedSaleMatchesClient\(suggestedSale, client\) \? suggestedSale : null;/
  );
  assert.match(
    pageScript,
    /relatedSaleMatchesClient\(state\.relatedSale, state\.client\)/
  );
  assert.match(
    pageScript,
    /lookupComprobantesLoaderRelatedSale\(saleId, \{ ghlId, clientPageId \}\)/
  );
});
