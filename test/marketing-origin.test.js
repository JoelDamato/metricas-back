const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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

test('no usa origen histórico como respaldo', () => {
  assert.equal(resolveMarketingOrigin({ origen: 'APSET' }), '');
  assert.equal(resolveMarketingOrigin({}), '');
});

test('no usa el origen histórico del lead vinculado como respaldo', () => {
  const leadByGhlId = buildMarketingLeadByGhlId([{
    ghlid: 'contact-historico',
    origen: 'APSET'
  }]);

  assert.equal(resolveMarketingOrigin({ ghlid: 'contact-historico' }, leadByGhlId), '');
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

test('el frontend de Marketing excluye registros sin origen_actual', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../public/metricas-v2/js/views/marketing.page.js'),
    'utf8'
  );

  assert.match(source, /return String\(row\?\.origen_actual \|\| ''\)\.trim\(\);/);
  assert.doesNotMatch(source, /row\?\.origen_actual \|\| row\?\.origen/);
  assert.match(source, /Boolean\(currentOrigin\)/);
});

test('la vista diaria usa exclusivamente origen_actual y descarta vacíos', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../supabase/migrations/20260828183000_marketing_only_origen_actual.sql'),
    'utf8'
  );

  assert.match(source, /nullif\(btrim\(l\.origen_actual\), ''\) as marketing_origin/i);
  assert.match(source, /where c\.marketing_origin is not null/i);
  assert.doesNotMatch(source, /c\.origen\) as marketing_origin/i);
  assert.doesNotMatch(source, /l\.origen\) as marketing_origin/i);
});
