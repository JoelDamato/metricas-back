const {test}=require('node:test'),assert=require('node:assert/strict');
const {buildWorld,mapPerson,agendaFor,programFor}=require('../modules/mati-world/model');
const access=require('../modules/auth/access');
const now=new Date('2026-11-03T15:00:00Z');
const sale={id:'sale',tipo:'Venta',estado:'Conciliado',product:'MEG',saleDate:'2026-11-01',createdAt:'2026-11-01T10:00:00Z'};
const active={id:'person',ghlid:'real',name:'Ana',csm_id:'csm',acceso:'Acceso',support_active:'Vigente',fecha_final:'2026-12-01',contrato:'Realizado',onboarding:'Realizado',receipts:[sale]};
test('el mapa conserva una identidad y muestra pendientes administrativos aunque el cliente esté activo',()=>{
 const row={...active,receipts:[sale,{id:'payment',tipo:'Cobranza',estado:null,createdAt:'2026-11-02T13:00:00Z'}]};
 const world=buildWorld([row,row],now);assert.equal(world.people.length,1);const p=world.people[0];assert.equal(p.zone,'administracion');assert.equal(p.program.current,true);assert.equal(p.payment.waitingSince,'2026-11-02T13:00:00.000Z');assert.equal(p.owner,null);assert.equal(p.profileUrl,'/contacto-estado/real');
 assert.equal(mapPerson(active,now).zone,'csm');assert.equal(mapPerson({...active,contrato:'Pendiente'},now).zone,'ingreso');
});
test('venta y conciliación no implican acceso, contrato ni ingreso al programa',()=>{
 const p=mapPerson({id:'sale',name:'Ana',receipts:[sale]},now);assert.equal(p.zone,'ventas');assert.equal(p.program.current,false);assert.equal(p.contract.status,'Sin información');assert.equal(p.contract.signature,'Sin información de firma verificable');
 const bounced=mapPerson({...active,receipts:[{...sale,rebotar_pago:'true'}]},now);assert.equal(bounced.zone,'administracion');assert.equal(bounced.payment.conciliated,0);
});
test('CSM conserva las condiciones reales de acceso, soporte, fecha, pausa y abandono',()=>{
 assert(programFor(active,now).current);
 for(const patch of [{acceso:null},{support_active:null},{fecha_final:null},{fecha_final:'2026-01-01'},{pausa:'En Pausa'},{abandono:'Abandono'},{despedida:'Sí'}])assert.equal(programFor({...active,...patch},now).current,false);
});
test('agenda usa estados explícitos, no deduce asistencia ni hora y excluye sesiones CSM',()=>{
 assert.equal(agendaFor({fecha_llamada:'2026-11-02',llamada_meg:'No show'},now).status,'Ausente');
 assert.equal(agendaFor({fecha_llamada:'2026-11-02',llamada_meg:'Efectuada'},now).status,'Realizada');
 assert.equal(agendaFor({fecha_llamada:'2026-11-02'},now).status,'Estado sin informar');
 assert.equal(agendaFor({fecha_llamada:'2026-11-04'},now).start,null);
 assert.equal(agendaFor({fecha_llamada:'2026-11-04',calendar_name:'Sesión de costos'},now),null);
 assert.equal(agendaFor({appointment_start:'2026-11-04T09:00:00',appointment_timezone:'America/Argentina/Buenos_Aires'},now).start,'2026-11-04T12:00:00.000Z');
});
test('sin actividad relevante queda fuera; datos vacíos no inventan personas y cambios reales mueven zonas',()=>{
 assert.equal(mapPerson({id:'empty',name:'Sin actividad'},now),null);assert.equal(buildWorld([],now).people.length,0);
 assert.equal(mapPerson({id:'old',receipts:[{...sale,saleDate:'2025-01-01'}]},now),null);
 const row={...active,receipts:[{...sale,estado:null,createdAt:null}]};assert.equal(mapPerson(row,now).payment.waitingSince,null);
 assert.equal(mapPerson(row,now).zone,'administracion');assert.equal(mapPerson({...row,receipts:[sale]},now).zone,'csm');
});
test('la página exige acceso total a las tres áreas, nunca acceso público o permiso comercial aislado',()=>{
 assert.equal(access.canAccessPageForUser(null,'mati-world.html'),false);
 assert.equal(access.canAccessPageForUser({role:'comercial',email:'a@example.com'},'mati-world.html'),false);
 assert.equal(access.canAccessPageForUser({role:'csm',email:'a@example.com'},'mati-world.html'),false);
 assert.equal(access.canAccessPageForUser({role:'total',email:'matirandazzo@gmail.com'},'mati-world.html'),true);
 assert.equal(access.canAccessPageForUser({role:'total',email:'a@example.com',access_config:{useCustomAccess:true,allowedPages:['mati-world.html']}},'mati-world.html'),false);
});
test('API rechaza anónimos, permisos parciales y escrituras; el payload no filtra datos sensibles',async()=>{
 const express=require('express'),{createRouter}=require('../modules/mati-world/router');let user=null,calls=0;const app=express();app.use((req,res,next)=>{req.authUser=user;next();});app.use('/world',createRouter(async()=>{calls++;return [{...active,mail:'secret',cash:9000,phone:'123',receipts:[{...sale,cash_collected:999}]}];}));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const url=`http://127.0.0.1:${server.address().port}/world`;
 try{assert.equal((await fetch(url)).status,401);user={role:'comercial'};assert.equal((await fetch(url)).status,403);user={role:'total',email:'matirandazzo@gmail.com'};assert.equal((await fetch(url,{method:'POST'})).status,405);
 const response=await fetch(url);assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);const result=await response.text();assert(!result.includes('secret'));assert(!result.includes('cash_collected'));assert(!result.includes('999'));await fetch(url);assert.equal(calls,1);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
