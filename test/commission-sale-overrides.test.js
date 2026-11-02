const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const service = require('../modules/metricasv2/services/commission-sale-overrides.service');
const sale = '10000000-0000-4000-8000-000000000001';
const payment = '10000000-0000-4000-8000-000000000002';
const second = '10000000-0000-4000-8000-000000000003';
const anotherSale = '10000000-0000-4000-8000-000000000004';
const nadia = { email: 'nadia.cavallini@gmail.com' };
const data = { closer_pct: .12, setter_pct: .065, revision: 0, reason: 'Acuerdo especial' };
const rows = [
 { id: sale, tipo: 'Venta', ghlid: 'client', cliente: 'client' },
 { id: payment, tipo: 'Cobranza', venta_relacionada: sale, ghlid: 'client', cliente: 'client' },
 { id: second, tipo: 'Cobranza', venta_relacionada: payment, ghlid: 'client', cliente: 'client' },
 { id: anotherSale, tipo: 'Venta', ghlid: 'client', cliente: 'client' }
];
test('porcentajes por rol se heredan desde la venta, sin usar otra venta del mismo cliente', () => {
 const details = rows.flatMap(row => ['Closer', 'Setter'].map(role => ({ transactionId: row.id, role, baseAmount: 1000, commissionPct: .08, commissionAmount: 80 })));
 const result = service.applyOverrides(details, rows, [{ sale_id: sale, ...data }]);
 for (const detail of result) {
  const expected = detail.transactionId === anotherSale ? .08 : detail.role === 'Closer' ? .12 : .065;
  assert.equal(detail.commissionPct, expected);
  assert.equal(detail.commissionAmount, 1000 * expected);
 }
 const zero = service.applyOverrides(details, rows, [{ sale_id: sale, closer_pct: 0, setter_pct: null }]);
 assert.equal(zero[0].commissionAmount, 0);
 assert.equal(zero[1].commissionAmount, 80);
 assert.equal(service.saleIdFor({ id: 'bad', tipo: 'Cobranza', ghlid: 'client' }, new Map(rows.map(row => [row.id, row]))), null);
 assert.equal(service.saleIdFor({ id: 'bad', tipo: 'Cobranza', venta_relacionada: sale, ghlid: 'other' }, new Map(rows.map(row => [row.id, row]))), null);
});
test('sólo Nadia y porcentajes completos entre 0 y 100', () => {
 assert.throws(() => service.validate({ email: 'otro@example.com' }, sale, data), { statusCode: 403 });
 for (const value of [-1, 1.1, NaN, undefined, '0.1']) assert.throws(() => service.validate(nadia, sale, { ...data, closer_pct: value }));
 service.validate(nadia, sale, { ...data, closer_pct: 0, setter_pct: null });
});
test('base de datos resuelve la venta, audita, rechaza conflictos y conserva meses bloqueados', async () => {
 const { PGlite } = require('@electric-sql/pglite');
 const db = new PGlite();
 try {
  await db.exec('create role anon;create role authenticated;create role service_role; create table comprobantes(id text primary key,tipo text,ghlid text,cliente text,cliente_format text,producto_format text,responsable_venta text,setter text,venta_relacionada text,cobranza_relacionada text,f_acreditacion timestamptz);create table commission_month_snapshots(month_key text primary key,locked boolean);');
  await db.exec(fs.readFileSync('supabase/migrations/20261102180000_commission_sale_overrides.sql','utf8'));
  for (const row of rows) await db.query('insert into comprobantes(id,tipo,ghlid,cliente,venta_relacionada,f_acreditacion) values($1,$2,$3,$4,$5,$6)', [row.id,row.tipo,row.ghlid,row.cliente,row.venta_relacionada || null,'2026-11-02T12:00:00Z']);
  const write = async (id, payload, actor = nadia.email) => (await db.query('select commission_sale_override_write($1,$2,$3) as result',[id,actor,JSON.stringify(payload)])).rows[0].result;
  await assert.rejects(write(payment,data,'otro@example.com'));
  const saved = await write(second,data);
  assert.equal(saved.sale_id,sale);
  assert.equal(Number(saved.closer_pct),.12);
  assert.equal(Number(saved.setter_pct),.065);
  assert.equal(saved.revision,1);
  assert.equal((await db.query('select * from commission_sale_overrides')).rows.length,1);
  await assert.rejects(write(payment,data),/cambió/);
  const restored = await write(payment,{...data,closer_pct:null,setter_pct:0,revision:1});
  assert.equal(restored.closer_pct,null);
  assert.equal(Number(restored.setter_pct),0);
  const audit = (await db.query('select * from commission_sale_override_audit order by id')).rows;
  assert.equal(audit.length,2);
  assert.equal(audit[0].receipt_id,second);
  assert.equal(Number(audit[1].before_row.closer_pct),.12);
  await db.exec("insert into commission_month_snapshots values('2026-11',true)");
  await assert.rejects(write(sale,{...data,revision:2}),/bloqueado/);
  await db.query('update comprobantes set venta_relacionada=$1 where id=$2',[second,payment]);
  await assert.rejects(write(second,{...data,revision:2}),/inequívoca/);
  await db.exec('set role anon');
  await assert.rejects(db.query('select * from commission_sale_overrides'));
  await assert.rejects(db.query('select commission_sale_override_context($1)',[sale]));
 } finally { await db.close(); }
});

test('el cálculo mensual usa la excepción por rol antes de sumar las liquidaciones y permite quitarla', () => {
 const commissions = require('../modules/metricasv2/services/commissions.service');
 const config = commissions.normalizeConfig({ global: { includeOnlyVerified: false } });
 const source = rows.map(row => ({ ...row, estado: 'Conciliado', f_acreditacion: '2026-11-02', f_venta: '2026-10-20', responsable_venta: 'Walter Alegre', setter: 'Nahuel Iasci', origen_actual: 'APSET', producto_format: 'MEG 2.1', cash_ar: 100000, cash_collected: 100, tc: 1000, facturacion: row.tipo === 'Venta' ? 1000 : 0, porcentaje_venta_vieja: .25 }));
 const run = commissionOverrides => commissions._test.buildTransactionDetails({ monthKey: '2026-11', config, comprobantesRows: source, settersRows: [], commissionOverrides });
 const normal = run([]);
 const updated = run([{sale_id:sale,...data}]);
 assert(updated.some(detail => detail.transactionId === second && detail.role === 'Closer'));
 assert(updated.some(detail => detail.transactionId === second && detail.role === 'Setter'));
 for (const detail of updated.filter(d => !d.isBonus && d.transactionId !== anotherSale)) {
  const pct = detail.role === 'Closer' ? .12 : .065;
  assert.equal(detail.commissionPct,pct);
  assert.equal(detail.commissionAmount,detail.baseAmount*pct);
 }
 assert.deepEqual(run([{sale_id:sale,closer_pct:null,setter_pct:null}]),normal);
});
