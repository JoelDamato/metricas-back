const test=require('node:test'),assert=require('node:assert/strict'),axios=require('axios');
const {listContactReceipts}=require('../modules/metricasv2/services/comprobantes-contacto.service');
const controller=require('../controllers/contactStatus');
test('incluye venta histórica a partir de cobranza directa, sus cobranzas y devoluciones sin duplicar',async()=>{
 const direct={id:'direct',ghlid:'client',tipo:'Cobranza',venta_relacionada:'old-sale'};
 const rows=await listContactReceipts('client',[],{url:'https://example.invalid',key:'test',request:async(url,{params})=>{
  if(params.ghlid)return{data:[direct]};
  if(params.id)return{data:[{id:'old-sale',tipo:'Venta'}]};
  if(params.venta_relacionada)return{data:[direct,{id:'legacy-collection',tipo:'Cobranza'},{id:'refund',tipo:'Devolución'}]};
  throw Error('Consulta inesperada');
 }});
 assert.deepEqual(rows.map(r=>r.id).sort(),['direct','legacy-collection','old-sale','refund']);
});
test('contacto con comprobantes directos sin ficha comercial ni CSM sigue visible',async()=>{
 const get=axios.get;const oldUrl=process.env.SUPABASE_URL,oldKey=process.env.SUPABASE_SERVICE_ROLE_KEY;process.env.SUPABASE_URL='https://example.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='test';
 axios.get=async url=>({data:url.endsWith('/comprobantes')?[{id:'receipt',ghlid:'client',cliente_format:'Cliente nuevo',tipo:'Cobranza',estado:'No conciliado',cash_collected:150,mail:'cliente@example.invalid'}]:[]});
 try{const contact=await controller._test.fetchContactByGhlId('client');assert.equal(contact.nombre,'Cliente nuevo');assert.equal(contact.comprobantes.length,1);assert.equal(contact.receiptTotals.pendiente,150);assert.equal(contact.cashCollectedTotal,0);}finally{axios.get=get;if(oldUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=oldUrl;if(oldKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=oldKey;}
});
test('contacto sin datos en ninguna tabla no genera una ficha vacía',async()=>{
 const get=axios.get;const oldUrl=process.env.SUPABASE_URL,oldKey=process.env.SUPABASE_SERVICE_ROLE_KEY;process.env.SUPABASE_URL='https://example.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='test';axios.get=async()=>({data:[]});
 try{assert.equal(await controller._test.fetchContactByGhlId('missing'),null);}finally{axios.get=get;if(oldUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=oldUrl;if(oldKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=oldKey;}
});
