const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.join(__dirname, '../public/metricas-v2/views/mag-sistema-agendas.html'),
  'utf8'
);

test('Sistema de Agendas usa cash neto de IVA en sus cálculos y alertas', () => {
  const netSelections = source.match(/cash_collected_neto,cash_collected/g) || [];
  const netFallbacks = source.match(/cash_collected_neto \?\? row\?\.cash_collected/g) || [];

  assert.ok(netSelections.length >= 4);
  assert.ok(netFallbacks.length >= 2);
});

test('Sistema de Agendas no suma comprobantes no conciliados como cash conciliado', () => {
  assert.match(source, /hasOwnProperty\.call\(row\|\|\{},'cash_collected_conciliado'\)/);
  assert.match(source, /return Number\.isFinite\(conciliado\) && conciliado>0 \? conciliado : 0;/);
});
