const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../public/diagnostico/diagnostico-core');
test('diferencias en pp, incluidas bajas, cero y datos faltantes', () => {
 const data = core.emptyData(); const metric=core.ROUTE_METRICS[0];
 data.checkpoints.inicial.areas.resultados.nums.margenContribucion='30%';
 data.checkpoints.medio.areas.resultados.nums.margenContribucion='25%';
 assert.deepEqual(core.routeMetricChanges(data,metric).map(x=>x.value),['-5 pp','Pendiente','Pendiente']);
 data.checkpoints.final.areas.resultados.nums.margenContribucion='30%';
 assert.deepEqual(core.routeMetricChanges(data,metric).map(x=>x.value),['-5 pp','+5 pp','0 pp']);
 data.checkpoints.inicial.areas.resultados.nums.margenContribucion='0%';
 assert.equal(core.routeMetricChanges(data,metric)[0].value,'+25 pp');
});
test('no convierte importes monetarios en porcentajes ni inventa diferencias', () => {
 const data=core.emptyData();const metric=core.ROUTE_METRICS.find(x=>x.key==='facturacionPromedio');
 assert.equal(core.routeMetricChanges(data,metric)[0].value,'Pendiente');
 data.checkpoints.inicial.areas.resultados.nums.facturacionPromedio='1.000';
 data.checkpoints.medio.areas.resultados.nums.facturacionPromedio='1.500';
 assert.equal(core.routeMetricChanges(data,metric)[0].value,'+$ 500');
});
