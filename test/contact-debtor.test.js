const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {mapFields,isDebtor,fetchContactMaterials}=require('../modules/csm/contact-materials');

test('Deudor depende del Estado de pago de GHL, no de un saldo o texto parecido',()=>{
  for(const value of ['Deudor',' deudoR ']) {
    assert.equal(isDebtor(mapFields({customFields:[{id:'0hjtUW5o2FzZodVWjJQd',value}]})),true);
  }
  for(const value of ['Situacion normal','Apurar','No deudor','',null,false]) {
    assert.equal(isDebtor({paymentStatus:value}),false);
  }
  assert.equal(isDebtor({}),false);
});

test('conserva Estado de pago aunque falle la carga de citas',async()=>{
  const result=await fetchContactMaterials('test',{key:'test',locationId:'location',request:async url=>{
    if(url.endsWith('/appointments'))throw Error('unavailable');
    return {data:{contact:{locationId:'location',customFields:[{id:'0hjtUW5o2FzZodVWjJQd',value:'Deudor'}]}}};
  }});
  assert.equal(isDebtor(result.fields),true);
});

test('la ficha muestra Deudor en rojo y quita la marca al normalizar el estado',()=>{
  const container={innerHTML:''};
  const source=fs.readFileSync('public/contacto-estado/app.js','utf8');
  const context=vm.createContext({document:{getElementById:()=>container,addEventListener(){}},window:{addEventListener(){}},Intl,URLSearchParams,renderSessions:()=>''});
  vm.runInContext(source.replace(/setupForm\(\);\s*loadContact\(\);\s*$/, ''),context);
  const contact={nombre:'Prueba',estado:'MEG',deudor:true};
  context.renderContact(contact);
  assert.match(container.innerHTML,/contact-card is-debtor/);
  assert.match(container.innerHTML,/tone-debtor">Deudor</);
  context.renderContact({...contact,deudor:false});
  assert.doesNotMatch(container.innerHTML,/is-debtor|tone-debtor/);
  assert.match(container.innerHTML,/tone-meg">MEG</);
});

test('Apurar depende del Estado de pago de GHL y no se confunde con Deudor',()=>{
  const {isApurar}=require('../modules/csm/contact-materials');
  for(const value of ['Apurar',' apuraR ']) assert.equal(isApurar(mapFields({customFields:[{id:'0hjtUW5o2FzZodVWjJQd',value}]})),true);
  for(const value of ['Deudor','Situacion normal','',null]) assert.equal(isApurar({paymentStatus:value}),false);
});

test('la ficha muestra Apurar en amarillo; Deudor sigue en rojo y gana si vinieran los dos',()=>{
  const container={innerHTML:''};
  const source=fs.readFileSync('public/contacto-estado/app.js','utf8');
  const context=vm.createContext({document:{getElementById:()=>container,addEventListener(){}},window:{addEventListener(){}},Intl,URLSearchParams,renderSessions:()=>''});
  vm.runInContext(source.replace(/setupForm\(\);\s*loadContact\(\);\s*$/, ''),context);
  const contact={nombre:'Prueba',estado:'MEG',apurar:true};
  context.renderContact(contact);
  assert.match(container.innerHTML,/contact-card is-apurar/);
  assert.match(container.innerHTML,/tone-apurar">Apurar</);
  context.renderContact({...contact,deudor:true});
  assert.match(container.innerHTML,/tone-debtor">Deudor</);
  assert.doesNotMatch(container.innerHTML,/is-apurar|tone-apurar/);
  context.renderContact({...contact,apurar:false});
  assert.match(container.innerHTML,/tone-meg">MEG</);
});

test('el CSS tiene el amarillo de Apurar',()=>{
  const css=fs.readFileSync('public/contacto-estado/styles.css','utf8');
  assert.match(css,/\.status-pill\.tone-apurar\s*{[^}]*#fde047/);
});
