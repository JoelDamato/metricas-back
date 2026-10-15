const {test}=require('node:test'),assert=require('node:assert/strict');
const access=require('../modules/auth/access'),auth=require('../modules/auth/service');
const {metricasApiGuard,metricasPageGuard}=require('../modules/auth/middleware');
const user={email:'student@example.com',role:'comercial',access_config:{useCustomAccess:true,homePath:'/views/entrenamiento.html',allowedPages:['entrenamiento.html','guion-meg.html','grabaciones.html'],allowedResources:[],allowedFeatures:{views:['GET']}}};
test('capacitación no hereda páginas operativas ni respuestas DISC',()=>{
 assert(access.isTrainingOnlyUser(user));
 const expected=user.access_config.allowedPages;
 for(const page of Object.keys(access.PAGE_ROLE_ACCESS))assert.equal(access.canAccessPageForUser(user,page),expected.includes(page),page);
 assert.deepEqual(access.getUserPermissions(user).allowedPages,expected);
 assert.equal(access.getUserPermissions(user).trainingOnly,true);
 assert.equal(access.getUserPermissions(user).canReviewDisc,false);
 for(const resource of Object.keys(access.RESOURCE_ROLE_ACCESS))assert.equal(access.canAccessResourceForUser(user,resource),false,resource);
});
test('los permisos del equipo actual se conservan',()=>{
 for(const email of ['leonardoalaniz19@gmail.com','matirandazzo@gmail.com','gaitanmauro23@gmail.com','valecalmet@gmail.com']){
 const u={email,role:email==='valecalmet@gmail.com'?'csm':'comercial'};
 assert.equal(access.isTrainingOnlyUser(u),false);assert(access.canAccessPageForUser(u,'tickets.html'));assert(access.canAccessPageForUser(u,'estado-contacto-comisiones.html'));
 }
});
test('el servidor permite grabaciones y sesión pero bloquea APIs y páginas operativas',async()=>{
 const old=auth.getActiveUserByEmail;auth.getActiveUserByEmail=async()=>user;
 try{
  for(const [path,allowed] of [['/auth/session',true],['/recordings',true],['/recordings/abc/comments',true],['/training',false],['/tickets',false],['/commercial-area',false],['/views',false],['/recordings-other',false]]){
   let status,next=false;const req={path,method:'GET',authUser:{email:user.email}};const res={status(n){status=n;return this;},json(){}};
   await metricasApiGuard(req,res,e=>{if(e)throw e;next=true;});assert.equal(next,allowed,path);if(!allowed)assert.equal(status,403,path);
  }
  for(const path of ['/metricas.html','/index.html','/dashboard.html','/views/tickets.html']){
   let destination;await metricasPageGuard({path,authUser:{email:user.email}},{redirect(p){destination=p;}},()=>assert.fail('Página operativa permitida'));
   assert.equal(destination,'/unauthorized.html',path);
  }
 }finally{auth.getActiveUserByEmail=old;}
});
