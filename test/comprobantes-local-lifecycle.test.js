const test = require('node:test');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const pgTest = test;
const { buildMutation } = require('../modules/metricasv2/services/comprobantes-local-mutations');
const { buildTransaction } = require('../modules/metricasv2/services/comprobantes-local-test.service')._test;

pgTest('venta histórica y nuevas cobranzas: alta, reintento, edición, conflicto, baja y reversión de saldo', async () => {
 const db = new PGlite();
 try {
  await db.exec(`create table leads_raw(id text primary key,facturacion_total numeric,cash_collected_total numeric,saldo numeric);
   create table comprobantes(id text primary key,cliente text,tipo text,venta_relacionada text,cash_collected numeric,facturacion numeric,cash_collected_total numeric,monto_incobrable numeric,info_comprobantes text,fecha_creado text,estado text);
   insert into leads_raw values('lead',1000,200,800);
   insert into comprobantes values('january','lead','Venta','january',200,1000,200,800,'histórico','2026-01-01',null);`);
  const get = async id => (await db.query('select * from comprobantes where id=$1',[id])).rows[0];
  const totals = async () => (await db.query('select * from leads_raw')).rows[0];
  const collection={id:'october',cliente:'lead',tipo:'Cobranza',venta_relacionada:'january',cash_collected:100,facturacion:null,cash_collected_total:0,monto_incobrable:null,info_comprobantes:'unique-collection |',fecha_creado:'2026-10-03',estado:null};
  const create=buildTransaction([collection],[], 'unique-collection |','lead','january');
  await db.exec(create);await db.exec(create);
  assert.equal(Number((await totals()).saldo),700);
  assert.equal(Number((await get('january')).cash_collected_total),300);
  const before=await get('october');
  await db.exec(buildMutation({before,patch:{cash_collected:150}}));
  assert.equal(Number((await totals()).saldo),650);
  assert.equal(Number((await get('january')).cash_collected_total),350);
  await assert.rejects(db.exec(buildMutation({before,patch:{cash_collected:999}})),/cambió/);await db.exec('rollback');
  assert.equal(Number((await totals()).saldo),650);
  await assert.rejects(db.exec(buildMutation({before:await get('january'),remove:true})),/cobranzas/);await db.exec('rollback');
  await db.exec(buildMutation({before:await get('october'),remove:true}));
  assert.equal(Number((await totals()).saldo),800);
  assert.equal(Number((await get('january')).cash_collected_total),200);
  const refund={...collection,id:'refund',tipo:'Devolucion',cash_collected:50,facturacion:50,info_comprobantes:'unique-refund |'};
  await db.exec(buildTransaction([refund],[],'unique-refund |','lead','january'));
  assert.equal(Number((await totals()).saldo),800);
  assert.equal(Number((await get('january')).monto_incobrable),800);
  await db.exec(buildMutation({before:await get('refund'),remove:true}));
  assert.equal(Number((await totals()).facturacion_total),1000);
  await db.exec(buildMutation({before:await get('january'),patch:{facturacion:1200,cash_collected:300}}));
  assert.equal(Number((await totals()).saldo),900);
  assert.equal(Number((await get('january')).monto_incobrable),900);
  await db.exec(buildMutation({before:await get('january'),remove:true}));
  assert.equal(Number((await totals()).saldo),0);
  assert.equal(Number((await totals()).cash_collected_total),0);
 } finally {await db.close();}
});

pgTest('se rechaza una cobranza de otro cliente sin crear filas ni cambiar saldos',async()=>{
 const db=new PGlite();try{
  await db.exec(`create table leads_raw(id text primary key,facturacion_total numeric,cash_collected_total numeric,saldo numeric);
   create table comprobantes(id text primary key,cliente text,tipo text,venta_relacionada text,cash_collected numeric,facturacion numeric,cash_collected_total numeric,monto_incobrable numeric,info_comprobantes text,fecha_creado text);
   insert into leads_raw values('other',100,0,100);
   insert into comprobantes(id,cliente,tipo) values('sale','lead','Venta');`);
  await assert.rejects(db.exec(buildTransaction([{id:'bad',cliente:'other',tipo:'Cobranza',cash_collected:50,info_comprobantes:'bad'}],[],'bad','other','sale')),/otro cliente/);await db.exec('rollback');
  assert.equal((await db.query("select count(*)::int n from comprobantes where id='bad'")).rows[0].n,0);
 }finally{await db.close();}
});
