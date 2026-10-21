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
