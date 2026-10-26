const arca = require('./arca-invoicing.service');

// Display-only lookup: issuing an invoice still resolves its stored recipient again.
function createClassifier(resolve = record => arca.resolveRecipient(record)) {
  const cache = new Map();
  async function classify(record) {
    const documentType = String(record.identificationType || '').trim().toUpperCase();
    const documentNumber = String(record.identificationNumber || '').replace(/\D/g, '');
    const valid = documentType === 'DNI' ? /^\d{7,8}$/.test(documentNumber)
      : ['CUIT', 'CUIL'].includes(documentType) && /^\d{11}$/.test(documentNumber);
    if (!valid) return { fiscalStatus: 'missing', fiscalError: 'Falta DNI/CUIT válido. Completá los datos fiscales.' };
    const input = { identificationType: documentType, identificationNumber: documentNumber };
    for (const key of ['source', 'payer', 'payerAddress', 'requestedInvoiceType']) input[key] = String(record[key] || '').slice(0, 500);
    input.vatConditionId = Number(record.vatConditionId) || null;
    const key = JSON.stringify(input);
    const cached = cache.get(key);
    if (cached && cached.until > Date.now()) return cached.promise;
    if (cache.size >= 2000) cache.delete(cache.keys().next().value);
    const entry = { until: Date.now() + 15 * 60 * 1000 };
    entry.promise = Promise.resolve().then(() => resolve(input)).then(recipient => ({
      fiscalStatus: 'resolved',
      fiscalClassification: {
        invoiceType: recipient.invoiceType,
        vatConditionId: recipient.vatConditionId,
        vatCondition: recipient.vatCondition
      }
    })).catch(error => {
      entry.until = Date.now() + 30000;
      return { fiscalStatus: 'error', fiscalError: String(error.message || 'No se pudo consultar la condición fiscal.').slice(0, 500) };
    });
    cache.set(key, entry);
    return entry.promise;
  }
  return async function classifyRecords(records) {
    if (!Array.isArray(records) || !records.length || records.length > 20 || records.some(r => !r || !['payment', 'subscription', 'manual'].includes(r.kind) || !String(r.id || '').trim())) {
      throw Object.assign(new Error('Enviá entre 1 y 20 registros válidos para consultar la condición fiscal.'), { statusCode: 400 });
    }
    const results = new Array(records.length);
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(4, records.length) }, async () => {
      while (cursor < records.length) {
        const index = cursor++;
        const row = records[index];
        results[index] = { kind: row.kind, id: String(row.id), ...await classify(row) };
      }
    }));
    return { records: results };
  };
}
module.exports = { createClassifier, classifyRecords: createClassifier() };
