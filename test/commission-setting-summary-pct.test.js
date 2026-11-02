const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('public/metricas-v2/js/views/comisiones.page.js','utf8');
const start=source.indexOf('  function getSetterSummaryPct('),end=source.indexOf('  function renderAreaAuditRows(',start);
const state={dashboard:{config:{global:{minimumSetterPct:.045},agendaScale:[{min:16,pct:.055},{min:0,pct:.045},{min:31,pct:.06}],setterFixedOverrides:[]},webinarSetters:[]}};
const {buildSheetRows,getSetterSummaryPct}=vm.runInNewContext(source.slice(start,end)+';({buildSheetRows,getSetterSummaryPct})',{
 state,normalizeText:v=>String(v||'').toLowerCase(),isNahuelSetter:v=>v==='Nahuel Iasci',getAgendaRowsCountForPerson:()=>25,qualifiesForSettingCount:()=>true
});
test('resumen usa 5,5% por 25 agendas aunque el primer comprobante sea 4,5% o 3%, conservando los importes',()=>{
 const rows=[.045,.03,.055].map((pct,i)=>({transactionId:String(i),person:'Nahuel Iasci',role:'Setter',category:'MEG',tipo:'Venta',closer:'Otra persona',commissionPct:pct,commissionAmount:1000*pct}));
 for(const details of [rows,[...rows].reverse()]){const summary=buildSheetRows(details)[0];assert.equal(summary.settingPct,.055);assert.equal(summary.agendas,25);assert.equal(summary.comisionSetting,130);assert.equal(summary.total,130);}
 assert.deepEqual(rows.map(r=>r.commissionPct),[.045,.03,.055]);
});
test('el porcentaje del resumen respeta mes, escalera, regla individual y sector webinar',()=>{
 assert.equal(getSetterSummaryPct('Nahuel Iasci',11,.03),.045);
 assert.equal(getSetterSummaryPct('Nahuel Iasci',31,.03),.06);
 state.dashboard.config.setterFixedOverrides=[{person:'Nahuel Iasci',enabled:true,pct:.07}];assert.equal(getSetterSummaryPct('Nahuel Iasci',25,.03),.07);state.dashboard.config.setterFixedOverrides=[];
 state.dashboard.webinarSetters=[{person:'Brenda Damato',pct:.035}];assert.equal(getSetterSummaryPct('Brenda Damato',12,.03),.035);
});
