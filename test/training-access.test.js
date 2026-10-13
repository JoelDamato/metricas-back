const {test}=require('node:test'),assert=require('node:assert/strict'),access=require('../modules/auth/access'),{canRead}=require('../modules/training/router');
test('Capacitaciones y guion para todos los usuarios; DISC privado sólo Leo/Mati',()=>{
 for(const user of [{email:'matirandazzo@gmail.com',role:'total'},{email:'leonardoalaniz19@gmail.com',role:'comercial'},{email:'walteralegre56@gmail.com',role:'comercial'},{email:'iascinahuel@gmail.com',role:'comercial'},{email:'valecalmet@gmail.com',role:'csm'},{email:'sofiangallardod@gmail.com',role:'csm'},{email:'juanma@romsconsultora.com',role:'comercial'},{email:'nadia.cavallini@gmail.com',role:'total'}]){
  const permissions=access.getUserPermissions(user);
  for(const page of ['entrenamiento.html','guion-meg.html']){assert.equal(access.canAccessPageForUser(user,page),true,user.email);if(permissions.allowedPages)assert(permissions.allowedPages.includes(page),user.email+' '+page);}
  const review=['matirandazzo@gmail.com','leonardoalaniz19@gmail.com'].includes(user.email);assert.equal(access.canAccessPageForUser(user,'entrenamiento-disc.html'),review);assert.equal(permissions.canReviewDisc,review);assert.equal(canRead(user),review);
 }
 for(const page of ['entrenamiento.html','guion-meg.html','entrenamiento-disc.html'])assert.equal(access.canAccessPageForUser(null,page),false);
});
