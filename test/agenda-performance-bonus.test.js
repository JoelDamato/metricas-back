const {test}=require('node:test');
const assert=require('node:assert/strict');
const report=require('../public/metricas-v2/js/agenda-monthly-report');
const kpi={anio:2026,mes:11,closer:'Carlos Tu',efectuadas_agenda:10,aplica_agenda:20,tasa_cierre:0.5};
function bonus(share=50,entries=[],rows=[kpi],rules={}){
 return report.buildPerformanceBonus({teamTotal:10000,distributions:[{name:'Carlos Tu',sharePct:share,cash:share*100}]},rows,rules,entries,2026,11)[0].amount;
}
test('50% exacto califica y se paga el 1% del cash propio, no del equipo',()=>{assert.equal(bonus(),50);assert.equal(bonus(60),60);assert.equal(bonus(49.99),0);});
test('requiere ambos KPIs del mes y cero strikes aunque tenga checks',()=>{
 assert.equal(bonus(50,[],[{...kpi,tasa_cierre:0.4}]),0);
 assert.equal(bonus(50,[],[{...kpi,efectuadas_agenda:8}]),0);
 assert.equal(bonus(50,[],[{...kpi,mes:10}]),0);
 assert.equal(bonus(50,[],[],{}),0);
 assert.equal(bonus(50,[],[kpi],{tasa_asistencia_pct:60}),0);
 assert.equal(bonus(50,[{closer_nombre:'Carlos Tu',tipo:'strike',cantidad:1},{closer_nombre:'Carlos Tu',tipo:'check',cantidad:10}]),0);
});
