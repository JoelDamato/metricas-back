const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const service = fs.readFileSync(path.join(root, 'modules/metricasv2/services/mercado-pago.service.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260826211500_protect_invoiced_mp_workflow.sql'), 'utf8');

test('la conciliación usa una función atómica que no degrada facturas emitidas', () => {
  assert.match(service, /rest\/v1\/rpc\/reconcile_mp_records/);
  assert.doesNotMatch(service, /resolution=merge-duplicates,return=minimal/);
  assert.match(migration, /where workflow\.status in \('pending', 'reconciled'\)/);
  assert.match(migration, /workflow\.arca_cae is null/);
  assert.match(migration, /workflow\.arca_invoice_number is null/);
});

test('la base exige que toda fila con CAE permanezca facturada', () => {
  assert.match(migration, /mercado_pago_club_workflow_arca_state_consistency/);
  assert.match(migration, /status = 'invoiced' and arca_cae is not null and arca_invoice_number is not null/);
  assert.match(migration, /set status = 'invoiced'/);
});

test('una factura ya emitida se reconoce aunque encuentre un estado histórico inconsistente', () => {
  assert.match(service, /row\?\.status === 'invoiced' \|\| \(row\?\.arca_cae && row\?\.arca_invoice_number\)/);
  assert.match(service, /alreadyInvoiced: true/);
  assert.match(service, /está siendo procesada en ARCA desde/);
  assert.match(service, /no está disponible para facturar \(estado:/);
});
