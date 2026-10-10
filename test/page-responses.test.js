const test=require('node:test'),assert=require('node:assert/strict'),express=require('express'),path=require('node:path');
const auth=require('../modules/auth/service'),{metricasPageGuard}=require('../modules/auth/middleware');
const {notFound,trainingRedirect}=require('../modules/auth/page-responses');
const {privateRouter}=require('../modules/training/router');

test('branded missing pages and training aliases preserve authorization and API responses',async()=>{
 const original=auth.getActiveUserByEmail;auth.getActiveUserByEmail=async email=>({email,role:'total'});
 const app=express();app.use((req,_res,next)=>{if(req.get('x-user'))req.authUser={email:req.get('x-user'),role:'total'};next();});
 app.get('/entrenamiento.html',trainingRedirect);
 app.get('/unauthorized.html',(_req,res)=>res.status(403).sendFile(path.resolve('public/metricas-v2/unauthorized.html')));
 app.use('/api/metricas/training',privateRouter(async()=>[]));
 app.use(metricasPageGuard,express.static(path.resolve('public/metricas-v2'),{index:false,redirect:false}));app.use(notFound);
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});const base='http://127.0.0.1:'+server.address().port;
 const get=(url,email)=>fetch(base+url,{headers:email?{'x-user':email}:{},redirect:'manual'});
 try{
  const alias=await get('/entrenamiento.html?from=dashboard');assert.equal(alias.status,302);assert.equal(alias.headers.get('location'),'/views/entrenamiento.html?from=dashboard');
  for(const email of ['matirandazzo@gmail.com','leonardoalaniz19@gmail.com']){assert.equal((await get('/views/entrenamiento.html',email)).status,200);assert.equal((await get('/api/metricas/training',email)).status,200);}
  assert.equal((await get('/views/entrenamiento.html')).headers.get('location'),'/login.html');
  assert.equal((await get('/views/entrenamiento.html','walteralegre56@gmail.com')).headers.get('location'),'/unauthorized.html');
  assert.equal((await get('/api/metricas/training','walteralegre56@gmail.com')).status,403);
  assert.equal((await get('/api/metricas/training')).status,401);
  const denied=await get('/unauthorized.html');assert.equal(denied.status,403);assert.match(await denied.text(),/Cambiar de cuenta/);
  for(const route of ['/pagina-inexistente','/views/no-existe.html']){const missing=await get(route);assert.equal(missing.status,404);assert.match(await missing.text(),/No encontramos esta página/);}
  const api=await get('/api/no-existe');assert.equal(api.status,404);assert.match(api.headers.get('content-type'),/json/);
  const asset=await get('/js/no-existe.js');assert.equal(asset.status,404);assert.match(asset.headers.get('content-type'),/text\/plain/);
 }finally{auth.getActiveUserByEmail=original;await new Promise(r=>server.close(r));}
});
