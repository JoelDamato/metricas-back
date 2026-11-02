const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const service = require('../modules/metricasv2/services/commissions.service');

test('Club de 39500 usa el mismo neto histórico en cargas nuevas aunque falten cargos guardados', () => {
 const config = service.normalizeConfig({ global: { includeOnlyVerified: false }, personRoles: [{person:'Patricia Conti',role:'Closer'}] });
 for (const source of [{}, {source_system:'supabase_direct'}, {info_comprobantes:'[SUPABASE DIRECT] prueba'}]) {
  const rows = [{id:'club-sale',tipo:'Venta',estado:'Conciliado',producto_format:'Club',responsable_venta:'Patricia Conti',f_venta:'2026-11-01',f_acreditacion:'2026-11-01',cash_ar:39500,tc:1500,facturacion:999,facturacion_ars:1498500,iva:6855.37,comisiones:0,medios_de_pago_format:'Mercado Pago',...source}];
  const details = service._test.buildTransactionDetails({monthKey:'2026-11',config,comprobantesRows:rows,settersRows:[]});
  const report = service._test.buildPersonalCommercialArea({month:'2026-11',details}, {nombre:'Patricia Conti',email:'patricia@example.com'});
  const club = report.details.find(d=>d.category==='Club');
  const cents = value => Math.round(value*100)/100;
  assert.equal(club.cashArs,39500);
  assert.equal(club.facturacionArs,39500);
  assert.equal(club.facturacionUsd,null);
  assert.equal(club.cashUsd,null);
  assert.equal(cents(club.ivaArs),6855.37);
  assert.equal(cents(club.externalCommissionsArs),3195.91);
  assert.equal(cents(club.netTotalArs),29448.72);
  assert.equal(cents(club.baseAmount),29448.72);
  assert.equal(club.commissionAmount,club.baseAmount*club.commissionPct);
  const again = service._test.buildPersonalCommercialArea({month:'2026-11',details:report.details}, {nombre:'Patricia Conti',email:'patricia@example.com'}).details[0];
  assert.equal(again.cashArs,39500);
  assert.equal(cents(again.netTotalArs),29448.72);
 }
});

test('Club conserva el bruto real de otros precios y no impone el precio de 39500', () => {
 const breakdown=service._test.computeClubNetBreakdown(25000);
 assert.equal(breakdown.grossArs,25000);
 assert.equal(Math.round(breakdown.netArs*100)/100,18638.43);
});

const script = fs.readFileSync('public/metricas-v2/js/views/comisiones.page.js','utf8');
function extract(name) {
 const start=script.indexOf(`  function ${name}(`);
 const end=script.indexOf('\n  function ',start+4);
 return script.slice(start,end<0?undefined:end);
}
function tableContext(rows,filter='only') {
 const node=()=>({innerHTML:'',querySelector:()=>null,querySelectorAll:()=>[]});
 const nodes={commissionPersonSummary:node(),commissionPersonDetails:node()};
 const context={
  state:{clubFilter:filter,selectedPerson:'all'},ALL_PEOPLE_VALUE:'all',document:{getElementById:id=>nodes[id]},
  normalizeText:v=>String(v||'').toLowerCase(),escapeHtml:v=>String(v??''),formatInteger:String,
  formatCurrency:v=>`ARS ${v}`,formatUsd:v=>`USD ${v}`,formatDetailCurrency:v=>`ARS ${v}`,
  formatDetailUsd:v=>`USD ${v}`,formatDetailPercent:String,formatDetailText:v=>v||'',formatDetailDate:v=>v||'',
  renderComprobanteSortHeader:(label)=>label,formatComprobanteProduct:d=>d.product,
  buildCloserPeopleFromDetails:()=>[],getFilteredCommissionDetails:()=>rows,
  buildDisplayComprobanteRows:rows=>rows,sortComprobanteRows:rows=>rows,
  fillPinnedColumnSelect:()=>{},buildPinnedOptionsFromTable:()=>[],applyPinnedColumn:()=>{},bindPinnedColumnHeaders:()=>{},pinnedPersonColumnSelect:null,
  getNotionPageUrl:()=>'',buildNotionPageUrl:()=>'',renderComprobanteStatusBadge:()=>'',formatDetailDateTime:v=>v||'',renderChequeBadge:()=>''
 };
 for(const name of ['isClubDetail','isClubOnlyView','displayedCashArs','displayedSalesArs','getDetailSetterPct','getDetailSetterCommission','sumDetailRows','buildComprobantesFooterRow','renderPersonPanel']) vm.runInNewContext(extract(name),context);
 vm.runInNewContext('renderPersonPanel()',context);
 return nodes.commissionPersonDetails.innerHTML;
}
test('tabla y totales Club no muestran USD ni TC y conservan bruto, IVA, comisiones y comisionable', () => {
 const row={transactionId:'club',category:'Club',tipo:'Venta',product:'Club',role:'Closer',cashArs:90000,grossArs:121000,cashUsd:80,facturacionUsd:999,facturacionArs:1498500,tc:1500,ivaArs:21000,externalCommissionsArs:10000,netTotalArs:90000,commissionAmount:36000,commissionPct:.4};
 const html=tableContext([row]);
 assert.doesNotMatch(html,/USD|<th>TC<\/th>/);
 assert.match(html,/Vendido ARS/);assert.match(html,/Cobrado ARS/);assert.match(html,/Monto comisionable ARS/);
 assert.equal((html.match(/ARS 121000/g)||[]).length,4);
 assert.match(html,/ARS 21000/);assert.match(html,/ARS 10000/);assert.match(html,/ARS 90000/);
 const mixed=tableContext([row,{...row,transactionId:'meg',product:'MEG',category:'MEG',cashUsd:200,facturacionUsd:1000}], '');
 assert.match(mixed,/USD 200/);assert.match(mixed,/USD 1000/);
 assert.doesNotMatch(mixed,/USD 80|USD 999|USD 280|USD 1999/);
});
