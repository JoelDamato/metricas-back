#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer');

const directService = require('../modules/metricasv2/services/comprobantes-direct.service');

async function main() {
  let browser;
  try {
  browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const htmlPath = path.join(__dirname, '../public/metricas-v2/views/comprobantes-config.html');
  const scriptPath = path.join(__dirname, '../public/metricas-v2/js/views/comprobantes-config.page.js');
  const html = fs.readFileSync(htmlPath, 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  const config = {
    products: directService._test.DEFAULT_PRODUCTS,
    paymentMethods: directService._test.DEFAULT_PAYMENT_METHODS,
    responsiblePeople: directService._test.DEFAULT_RESPONSIBLE_PEOPLE,
    rules: directService._test.DEFAULT_RULES,
    source: 'local-ui-snapshot',
    migrationReady: true,
    safety: { dryRunOnly: true }
  };
  config.readiness = directService._test.buildCutoverReadiness(config, { available: true, count: 0 });

  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await page.evaluate((localConfig) => {
    window.http = { getJson: async (url) => (
      String(url).includes('storage-cleanup')
        ? { ok: true, migrationReady: true, count: 0, rows: [] }
        : { ok: true, config: structuredClone(localConfig) }
    ) };
    window.fetch = async () => ({ ok: true, json: async () => ({ ok: true }) });
  }, config);
  await page.addScriptTag({ path: scriptPath });
  await page.waitForFunction(() => document.querySelectorAll('[data-product-index]').length > 0);

  assert.equal(await page.$$eval('[data-product-index]', (rows) => rows.length), config.products.length);
  assert.equal(await page.$$eval('[data-payment-index]', (rows) => rows.length), config.paymentMethods.length);
  assert.equal(await page.$$eval('[data-responsible-index]', (rows) => rows.length), config.responsiblePeople.length);
  await page.select('#comprobantesLabPaymentStatus', 'inactive');
  await page.$eval('#comprobantesLabPaymentStatus', (select) => select.dispatchEvent(new Event('change', { bubbles: true })));
  assert.equal(await page.$$eval('[data-payment-index]:not([hidden])', (rows) => rows.length), 34);
  await page.select('#comprobantesLabPaymentStatus', 'unnamed');
  await page.$eval('#comprobantesLabPaymentStatus', (select) => select.dispatchEvent(new Event('change', { bubbles: true })));
  assert.equal(await page.$$eval('[data-payment-index]:not([hidden])', (rows) => rows.length), 3);
  await page.select('#comprobantesLabPaymentStatus', 'all');
  await page.$eval('#comprobantesLabPaymentStatus', (select) => select.dispatchEvent(new Event('change', { bubbles: true })));
  await page.$eval('#comprobantesLabPaymentSearch', (input) => {
    input.value = 'Mercado Pago';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.equal(await page.$$eval('[data-payment-index]:not([hidden])', (rows) => rows.length), 2);
  await page.$eval('#comprobantesLabPaymentSearch', (input) => {
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  await page.click('#comprobantesLabAddProduct');
  assert.equal(await page.$$eval('[data-product-index]', (rows) => rows.length), config.products.length + 1);
  assert.equal(await page.$eval('[data-product-index]:last-child [data-action="remove-new"]', (button) => button.textContent.trim()), 'Quitar');

  await page.click('#comprobantesLabAddPayment');
  assert.equal(await page.$$eval('[data-payment-index]', (rows) => rows.length), config.paymentMethods.length + 1);

  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-product-index]')];
    const clubRow = rows.find((row) => row.querySelector('code')?.textContent.trim() === 'club');
    clubRow.querySelector('[data-action="add-price"]').click();
  });
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-product-index]')];
    const clubRow = rows.find((row) => row.querySelector('code')?.textContent.trim() === 'club');
    const prices = clubRow.querySelectorAll('.comprobantes-lab-price');
    const newest = prices[prices.length - 1];
    newest.querySelector('[data-price-field="amountArs"]').value = '51000';
  });
  await page.click('#comprobantesLabAddResponsible');
  assert.equal(await page.$$eval('[data-responsible-index]', (rows) => rows.length), config.responsiblePeople.length + 1);
  await page.evaluate((localConfig) => {
    const imported = structuredClone(localConfig);
    imported.paymentMethods.push({
      code: 'medio-importado-local',
      name: 'Medio Importado Local',
      active: false,
      type: 'Propia',
      account: 'Dato local',
      ivaRate: 0.21,
      commissionRate: 0.01,
      initialBalance: 123
    });
    const transfer = new DataTransfer();
    transfer.items.add(new File(
      [JSON.stringify({ version: 1, config: imported })],
      'config-local.json',
      { type: 'application/json' }
    ));
    const input = document.querySelector('#comprobantesLabImportConfig');
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, config);
  await page.waitForFunction(() => [...document.querySelectorAll('[data-payment-index]')]
    .some((row) => row.querySelector('[data-field="name"]')?.value === 'Medio Importado Local'));
  assert.equal(await page.$$eval('[data-payment-index]', (rows) => rows.length), config.paymentMethods.length + 1);
  assert.match(await page.$eval('#comprobantesLabPaymentsCount', (node) => node.textContent), /52\/51 cargados/);
  assert.equal(await page.$eval('#comprobantesLabSave', (button) => button.disabled), true);
  assert.doesNotMatch(await page.$eval('body', node => node.textContent), /simulador|preflight|laboratorio/i);
  assert.equal(await page.$$eval('[data-product-payment]', nodes => nodes.length), 0);
  assert.deepEqual(pageErrors, []);

  console.log(JSON.stringify({
    environment: 'Puppeteer headless local, sin servidor',
    productionConnections: 0,
    productsRendered: config.products.length,
    paymentMethodsRendered: config.paymentMethods.length,
    responsiblePeopleRendered: config.responsiblePeople.length,
    addProductVerified: true,
    addPaymentMethodVerified: true,
    addResponsibleVerified: true,
    configImportVerified: true,
    simulatorRemoved: true,
    generalPaymentMethods: true,
    paymentReviewFiltersVerified: true,
    clubPriceEditorVerified: true,
    dryRunLockVerified: true,
    pageErrors: pageErrors.length
  }, null, 2));
  } finally {
    if (browser) await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
