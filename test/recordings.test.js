const test=require('node:test'),assert=require('node:assert/strict'),express=require('express');
const {createRouter,extractRecordings}=require('../modules/recordings/router');
test('links are deduplicated per client and non-web values excluded',()=>{const rows=extractRecordings([{ghlid:'a',name:'Ana',recordings:'https://example.com/video https://example.com/video javascript:alert(1)'},{ghlid:'b',name:'Beto',recordings:'https://example.com/video'}]);assert.equal(rows.length,2);assert.notEqual(rows[0].id,rows[1].id);});
test('shared comments enforce author identity, revisions and recording scope',async()=>{
 const recordings=[{ghlid:'a',name:'Ana',recordings:'https://example.com/video'}],id=extractRecordings(recordings)[0].id;let comments=[];
 const db=async(table,p,method='get',data)=>{if(table==='recording_sources')return recordings;if(method==='post'){const row={...data,id:'12345678-1234-1234-1234-123456789abc',revision:1};comments.push(row);return [row];}const matches=comments.filter(c=>Object.entries(p).every(([k,v])=>!String(v).startsWith('eq.')||String(c[k])===v.slice(3)));if(method==='patch')matches.forEach(c=>Object.assign(c,data));if(method==='delete')comments=comments.filter(c=>!matches.includes(c));return matches;};
 const app=express();app.use(express.json());app.use((req,res,next)=>{if(req.headers['x-user'])req.authUser={email:req.headers['x-user'],nombre:'Autor',role:'csm'};next();});app.use(createRouter(db));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));try{const base=`http://127.0.0.1:${server.address().port}`;const call=(path,method='GET',body,user='a@example.com')=>fetch(base+path,{method,headers:{'x-user':user,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});assert.equal((await call('/','GET',null,'')).status,401);assert.equal((await call(`/${id}/comments`,'POST',{body:'Hola',author_email:'spoof'})).status,201);assert.equal(comments[0].author_email,'a@example.com');const path=`/${id}/comments/${comments[0].id}`;assert.equal((await call(path,'PATCH',{body:'Ajeno',revision:1},'b@example.com')).status,409);assert.equal((await call(path,'DELETE',{revision:1},'b@example.com')).status,409);assert.equal((await call(path,'PATCH',{body:'Editado',revision:1})).status,200);assert.equal((await call(path,'PATCH',{body:'Viejo',revision:1})).status,409);const other=await (await call(`/${id}/comments`,'GET',null,'b@example.com')).json();assert.equal(other.comments[0].canEdit,false);assert.equal(other.comments[0].body,'Editado');assert.equal((await call('/'+'a'.repeat(64)+'/comments','POST',{body:'Inválido'})).status,404);assert.equal((await call(path,'DELETE',{revision:2})).status,200);assert.equal(comments.length,0);}finally{await new Promise(r=>server.close(r));}
});
test('only Leo, Mati and Walter curate the shared Top list',async()=>{
 const sources=[{ghlid:'a',name:'Ana',recordings:'https://example.com/video'}],id=extractRecordings(sources)[0].id;let top=[];
 const db=async(table,p,method='get',data)=>{if(table==='recording_sources')return sources;if(method==='post'){top=[{...data,selected_at:new Date().toISOString()}];return top;}if(method==='delete'){top=[];return [];}return top;};
 const app=express();app.use(express.json());app.use((req,res,next)=>{req.authUser={email:req.headers['x-user'],nombre:'Usuario',role:'total'};next();});app.use(createRouter(db));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));try{const base=`http://127.0.0.1:${server.address().port}`,call=(email,selected)=>fetch(`${base}/${id}/top`,{method:'PUT',headers:{'Content-Type':'application/json','x-user':email},body:JSON.stringify({selected})});assert.equal((await call('otro@example.com',true)).status,403);assert.equal((await call('leonardoalaniz19@gmail.com',true)).status,200);const list=await (await fetch(base,{headers:{'x-user':'otro@example.com'}})).json();assert.equal(list.canCurate,false);assert(list.recordings[0].top);assert.equal((await call('matirandazzo@gmail.com',false)).status,200);assert.equal(top.length,0);assert.equal((await call('walteralegre56@gmail.com',true)).status,200);const walterList=await (await fetch(base,{headers:{'x-user':'walteralegre56@gmail.com'}})).json();assert.equal(walterList.canCurate,true);assert.equal(top[0].selected_by,'walteralegre56@gmail.com');assert.equal((await call('walteralegre56@gmail.com',false)).status,200);assert.equal(top.length,0);}finally{await new Promise(r=>server.close(r));}
});
test('call dates remain calendar dates, reject invalid values and preserve comment identity',()=>{
 const source={ghlid:'a',name:'Ana',recordings:'https://example.com/video'};
 const original=extractRecordings([source])[0];
 const row=extractRecordings([{...source,closer:' Carlos Tu ',call_date:'2026-10-09'}])[0];
 assert.equal(row.id,original.id);assert.equal(row.closer,'Carlos Tu');assert.equal(row.callDate,'2026-10-09');
 for(const call_date of ['2026-02-30','09/10/2026','',null])assert.equal(extractRecordings([{...source,call_date}])[0].callDate,null);
 assert.equal(extractRecordings([{...source,call_date:'2026-10-09T00:00:00Z'}])[0].callDate,'2026-10-09');
 const rows=extractRecordings([{...source,ghlid:'old',call_date:'2026-01-01'},{...source,ghlid:'new',call_date:'2026-10-09'},source]);
 assert.deepEqual(rows.map(r=>r.ghlid),['new','old','a']);
});
test('GHL recording metadata is backfilled and stays synchronized without changing recording IDs',async()=>{
 const {PGlite}=require('@electric-sql/pglite'),fs=require('fs');const db=new PGlite();
 try{
  await db.exec("create role anon;create role authenticated;create role service_role;create table csm_ghl_contacts(ghlid text,fields jsonb);insert into csm_ghl_contacts values('a','{\"full_name\":\"Ana\",\"Closer\":\"Carlos Tu\",\"Fecha de llamada\":\"2026-10-09\",\"Grabacion de llamadas\":\"https://example.com/video\"}');");
  await db.exec(fs.readFileSync('supabase/migrations/20261008121000_recording_sources.sql','utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/20261009153000_recording_call_metadata.sql','utf8'));
  let row=(await db.query('select * from recording_sources')).rows[0];assert.equal(row.call_date,'2026-10-09');assert.equal(row.closer,'Carlos Tu');
  await db.exec(`update csm_ghl_contacts set fields=fields || '{"Fecha de llamada":"2026-10-10"}'::jsonb;`);
  row=(await db.query('select * from recording_sources')).rows[0];assert.equal(row.call_date,'2026-10-10');assert.equal(row.closer,'Carlos Tu');
 }finally{await db.close();}
});
