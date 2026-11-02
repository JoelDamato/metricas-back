const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('public/metricas-v2/js/views/comisiones.page.js','utf8');
const start=source.indexOf('  function renderAreaAuditRows('),end=source.indexOf('  function showAreaAudit(',start);
const render=vm.runInNewContext(source.slice(start,end)+';renderAreaAuditRows',{
 normalizeText:v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''),
 formatInteger:String,formatCurrency:v=>Number(v||0).toFixed(2),formatPercent:v=>`${Number(v)*100}%`,formatDetailDate:v=>v,
 escapeHtml:v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),window:{}
});
const area={details:[
 {transactionId:'receipt-1',clientName:'Paula <script>',tipo:'Venta',product:'MEG',closer:'Patricia',grossCashArs:1210,totalDeductionsArs:210,ivaArs:210,cashArs:1000,commissionPct:.04,commissionAmount:40,acreditacionDate:'2026-10-30'},
 {transactionId:'receipt-2',clientName:'Sebastián',tipo:'Cobranza',product:'MEG',closer:'Claudio',grossCashArs:2420,totalDeductionsArs:420,ivaArs:420,cashArs:2000,commissionPct:.04,commissionAmount:80,acreditacionDate:'2026-10-31'}
]};
test('auditoría muestra cada comprobante y los totales de cash y comisión sin duplicar cobros',()=>{
 const html=render(area);assert.match(html,/2 de 2 comprobantes/);assert.match(html,/receipt-1/);assert.match(html,/receipt-2/);assert.match(html,/3630.00/);assert.match(html,/630.00/);assert.match(html,/3000.00/);assert.match(html,/120.00/);assert.match(html,/Paula &lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
});
test('buscar por cliente, ID o closer filtra el detalle y recalcula únicamente los totales mostrados',()=>{
 for(const query of ['sebastian','receipt-2','Claudio']){const html=render(area,query);assert.match(html,/1 de 2 comprobantes/);assert.doesNotMatch(html,/receipt-1/);assert.match(html,/receipt-2/);assert.doesNotMatch(html,/3000.00/);assert.match(html,/2000.00/);}
 assert.match(render(area,'inexistente'),/No hay comprobantes/);assert.match(render({details:[]}),/0 de 0 comprobantes/);
});
