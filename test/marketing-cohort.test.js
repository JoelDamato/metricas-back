const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('node:vm');
const cohort=require('../public/metricas-v2/js/marketing-cohort');
const {resolveMarketingOrigin,buildMarketingLeadByGhlId}=require('../modules/metricasv2/services/marketing-origin.service');
test('VSL + rt exige RT actual y VSL inicial, sin sumar los dos orígenes',()=>{
 for(const row of [{origen_actual:'rt',primer_origen:'VSL'},{origen_actual:' RT ',primer_origen:'Postulación MEG - VSL - form'},{origen_actual:'Postulación MEG - RT',primer_origen:'Postulaci%C3%B3n%20MEG%20-%20VSL'}])assert.equal(cohort.matches(row,cohort.combined),true);
 for(const row of [{origen_actual:'VSL',primer_origen:'VSL'},{origen_actual:'rt',primer_origen:'ORG'},{origen_actual:'rt',origen:'VSL'},{primer_origen:'VSL'}])assert.equal(cohort.matches(row,cohort.combined),false);
});
test('comprobantes filtran usando primer origen del lead vinculado y actualizado',()=>{
 const source=fs.readFileSync('modules/metricasv2/services/supabase.service.js','utf8');
 const fn=source.match(/function matchesCurrentMarketingOrigin\([\s\S]*?\n}/)[0];
 const matches=vm.runInNewContext('('+fn+')',{resolveMarketingOrigin,require:()=>cohort});
 const linked=buildMarketingLeadByGhlId([{ghlid:'abc',origen_actual:'rt',primer_origen:'VSL',last_edited_time:'2026-10-09'}]);
 assert.equal(matches({ghlid:'abc'},linked,cohort.combined),true);
 assert.equal(matches({ghlid:'other'},linked,cohort.combined),false);
 linked.get('abc').primer_origen='ORG';assert.equal(matches({ghlid:'abc',primer_origen:'VSL'},linked,cohort.combined),false);
});
test('CSV incluye toda la cohorte, identificadores, filtros y protege fórmulas',()=>{
 const rows=Array.from({length:75},(_,i)=>({id:String(i),ghlid:'ghl'+i,nombre:i?'Cliente; "ñ"':'=1+1',telefono:'+541123456789',fecha_agenda:'2026-10-09',origen_actual:'RT',primer_origen:'VSL'}));
 const csv=cohort.csv(rows,{from:'2026-10-01',to:'2026-10-09',origen:cohort.combined});
 assert.equal(csv.split('\r\n').length,76);assert(csv.startsWith('\uFEFF'));assert(csv.includes('ghl74'));assert(csv.includes('"\'=1+1"'));assert(csv.includes('"\'+541123456789"'));assert(csv.includes('Cliente; ""ñ""'));assert(csv.includes('VSL + rt'));assert(csv.includes('"Primer origen"'));
});
