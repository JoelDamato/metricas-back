const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildMarketingLeadByGhlId,
  resolveMarketingOrigin
} = require('../modules/metricasv2/services/marketing-origin.service');

test('prioriza origen_actual sobre el origen histórico del lead', () => {
  assert.equal(
    resolveMarketingOrigin({
      origen_actual: 'Postulación MEG - VSL nuevo',
      origen: 'Postulación MEG - APSET viejo'
    }),
    'Postulación MEG - VSL nuevo'
  );
});

test('un comprobante toma origen_actual desde el lead vinculado por GHL ID', () => {
  const leadByGhlId = buildMarketingLeadByGhlId([
    {
      ghlid: 'contact-123',
      origen_actual: 'Instagram orgánico',
      origen: 'Postulación antigua',
      last_edited_time: '2026-07-30T10:00:00Z'
    }
  ]);

  assert.equal(
    resolveMarketingOrigin({
      ghlid: 'CONTACT-123',
      origen: 'Postulación antigua'
    }, leadByGhlId),
    'Instagram orgánico'
  );
});

test('mantiene origen como respaldo para registros todavía no migrados', () => {
  assert.equal(resolveMarketingOrigin({ origen: 'APSET' }), 'APSET');
  assert.equal(resolveMarketingOrigin({}), 'Sin origen');
});

test('si hay duplicados de GHL usa el lead actualizado más recientemente', () => {
  const leadByGhlId = buildMarketingLeadByGhlId([
    {
      ghlid: 'contact-456',
      origen_actual: 'Origen anterior',
      last_edited_time: '2026-07-29T10:00:00Z'
    },
    {
      ghlid: 'contact-456',
      origen_actual: 'Origen actual',
      last_edited_time: '2026-07-30T10:00:00Z'
    }
  ]);

  assert.equal(
    resolveMarketingOrigin({ ghlid: 'contact-456' }, leadByGhlId),
    'Origen actual'
  );
});
