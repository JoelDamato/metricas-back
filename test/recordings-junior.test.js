const test=require('node:test'),assert=require('node:assert/strict'),express=require('express');
const {createRouter,extractRecordings}=require('../modules/recordings/router');
const catalog=require('../modules/recordings/training-recordings.json');
test('juniors only receive the 21 selected recordings and cannot access other comments or Top',async()=>{
 const sources=[{ghlid:'private',name:'Cliente privado',recordings:'https://example.com/private'}],privateId=extractRecordings(sources)[0].id;
 let commentReads=0,sourceReads=0;
 const db=async table=>{if(table==='recording_sources'){sourceReads++;return sources;}if(table==='recording_comments')commentReads++;return [];};
 const junior={email:'junior@example.com',role:'comercial',access_config:{useCustomAccess:true,homePath:'/views/entrenamiento.html',allowedPages:['entrenamiento.html','guion-meg.html','grabaciones.html']}};
 const app=express();app.use(express.json());app.use((req,res,next)=>{req.authUser=req.headers['x-senior']?{email:'matirandazzo@gmail.com',role:'total'}:junior;next();});app.use(createRouter(db));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{const base=`http://127.0.0.1:${server.address().port}`;const list=await (await fetch(base)).json();assert.equal(list.recordings.length,21);assert.equal(sourceReads,0);assert.equal(list.canCurate,false);assert.equal(list.trainingOnly,true);assert.deepEqual(list.recordings.map(r=>r.url),catalog.recordings.map(r=>r.url));
 for(const method of ['GET','POST','PATCH','DELETE']){const suffix=['PATCH','DELETE'].includes(method)?'/12345678-1234-1234-1234-123456789abc':'';const r=await fetch(`${base}/${privateId}/comments${suffix}`,{method});assert.equal(r.status,404);}
 assert.equal(commentReads,0);assert.equal((await fetch(`${base}/${list.recordings[0].id}/comments`)).status,200);
 assert.equal((await fetch(`${base}/${privateId}/top`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({selected:true})})).status,403);
 const senior=await (await fetch(base,{headers:{'x-senior':'1'}})).json();assert(senior.recordings.some(r=>r.id===privateId));assert.equal(senior.canCurate,true);
 }finally{await new Promise(r=>server.close(r));}
});
