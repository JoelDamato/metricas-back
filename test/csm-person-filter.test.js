const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('el detalle y exportación por persona excluyen movimientos ajenos sin cambiar los datos',()=>{
 const fields={'detail-member':{value:'Belu'}};
 const context={document:{getElementById:id=>fields[id]},window:{}};
 const source=fs.readFileSync('public/metricas-v2/js/views/csm-rendimiento.page.js','utf8').replace('  init();','  window.probe = {state, filteredEntries};');
 vm.runInNewContext(source,context);
 const p=context.window.probe;p.state.entries=[{closer_nombre:'Belu',tipo:'check'},{closer_nombre:'Vale',tipo:'strike'}];
 assert.equal(p.filteredEntries().length,1);assert.equal(p.filteredEntries()[0].closer_nombre,'Belu');
 fields['detail-member'].value='';assert.equal(p.filteredEntries().length,2);assert.equal(p.state.entries.length,2);
});
