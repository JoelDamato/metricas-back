const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {progress}=require('../modules/csm/contact-summary');
function ui(){
 const source=fs.readFileSync('public/contacto-estado/app.js','utf8');
 const context=vm.createContext({document:{addEventListener(){}},window:{addEventListener(){}},Intl,URLSearchParams});
 vm.runInContext(source.replace(/setupForm\(\);\s*loadContact\(\);\s*$/,''),context);
 return context;
}
test('ficha muestra NPS por unidad: cero válido, ausente sin respuesta y promedio no redondeado a entero',()=>{
 const html=ui().renderNps(progress({nps_1:0,nps_2:9,nps_3:10,nps_4:null}).nps);
 assert.match(html,/Promedio: 6,33 \/ 10/);
 assert.match(html,/3 respuestas registradas/);
 assert.match(html,/Unidad 1<\/b><span>0 \/ 10/);
 assert.match(html,/Unidad 4<\/b><span>Sin respuesta/);
 assert.match(ui().renderNps(progress({}).nps),/Promedio: Sin respuestas/);
});
test('comprobante muestra cuotas pactadas guardadas y no cuenta cobros como cuotas',()=>{
 const html=ui().renderReceipts({comprobantes:[{id:'venta',tipo:'Venta',cantidad_de_pagos:'6'},{id:'cobro',tipo:'Cobranza'},{id:'escape',cantidad_de_pagos:'<script>'}]});
 assert.match(html,/<th>Cuotas pactadas<\/th>/);
 assert.match(html,/<td>6<\/td>/);
 assert.match(html,/<td>Sin registrar<\/td>/);
 assert.match(html,/&lt;script&gt;/);
 assert.doesNotMatch(html,/<script>/);
});
test('deudor tiene fondo rojo sólido y contraste AA para su texto blanco',()=>{
 const css=fs.readFileSync('public/contacto-estado/styles.css','utf8');
 assert.match(css,/\.contact-card\.is-debtor \.card-hero\s*\{[^}]*background: #7f1d1d/);
 const linear=x=>{x/=255;return x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4;};
 const luminance=0.2126*linear(127)+0.7152*linear(29)+0.0722*linear(29);
 assert.ok(1.05/(luminance+0.05)>4.5);
});
