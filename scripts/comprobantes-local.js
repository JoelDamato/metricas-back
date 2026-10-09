// Isolated interactive harness: no credentials, HTTP repository or Notion calls.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const multer = require('multer');
const entry = process.env.PGLITE_PACKAGE_PATH || '@electric-sql/pglite';
const { PGlite } = require(entry);
const { pgcrypto } = require(path.join(path.dirname(entry), 'contrib/pgcrypto.cjs'));
const fixtures = require('./validate_comprobantes_direct_local');
const service = require('../modules/metricasv2/services/comprobantes-direct.service');
const loader = require('../modules/metricasv2/services/comprobantes-loader.service');
const commissions = require('../modules/metricasv2/services/commissions.service');
const root = path.join(__dirname, '../public/metricas-v2');
async function main() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.waitReady;
  const config = { products: service._test.DEFAULT_PRODUCTS, paymentMethods: service._test.DEFAULT_PAYMENT_METHODS, responsiblePeople: service._test.DEFAULT_RESPONSIBLE_PEOPLE, rules: service._test.DEFAULT_RULES };
  const sample = service._test.buildRows({ normalized: loader._test.normalizePayload(fixtures.salePayload(), fixtures.MATI, {allowMissingAttachments:false}), config, lead: fixtures.LEAD, user: fixtures.MATI, idFactory: crypto.randomUUID, now: new Date() });
  await fixtures.bootstrapDatabase(db, sample.rows[0]);
  const repository = fixtures.createRepository(db);
  const opts = { repository, bypassSafety: true, allowOperationalUser: true };
  const app = express();
  app.use(express.json());
  // Only loopback requests; never expose this test identity on a shared server.
  app.use((req,res,next) => {
    if (!/^localhost(?::\d+)?$|^127\.0\.0\.1(?::\d+)?$/.test(req.headers.host || '')) return res.sendStatus(403);
    if (req.headers.origin && !/^http:\/\/(localhost|127\.0\.0\.1):3102$/.test(req.headers.origin)) return res.sendStatus(403);
    next();
  });
  const route = fn => async (req,res,next) => {try {res.json({ok:true,...await fn(req)});} catch(e){next(e);}};
  const api = '/api/metricas/comprobantes-loader';
  app.get(api+'/bootstrap', route(async()=>({bootstrap:await service.getBootstrap(fixtures.MATI,opts)})));
  app.get(api+'/cliente',route(async req=>({client:await service.lookupClient(req.query.ghlId,fixtures.MATI,opts)})));
  app.get(api+'/venta-relacionada',route(async req=>({sale:await service.lookupRelatedSale(req.query.saleId,req.query,fixtures.MATI,opts)})));
  app.post(api,multer({limits:{fileSize:20*1024*1024,files:6}}).array('attachmentFiles'),route(async req=>{
    const payload=JSON.parse(req.body.payload||'{}');
    payload.attachmentFiles=(req.files||[]).map(f=>({name:f.originalname,type:f.mimetype,size:f.size,base64:f.buffer.toString('base64')}));
    return service.create(payload,fixtures.MATI,{...opts,allowMissingAttachments:false});
  }));
  app.post('/local/reconcile/:id',route(async req=>service.updateReconciliation(req.params.id,req.body.state,fixtures.MATI,opts)));
  app.get('/local/impact',route(async()=>{
    const rows=(await db.query('select * from public.comprobantes order by fecha_creado, operation_index')).rows.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,v instanceof Date?v.toISOString():v])));
    const months=[...new Set(rows.map(r=>String(r.f_acreditacion||'').slice(0,7)).filter(Boolean))];
    const commissionDetails=months.flatMap(monthKey=>commissions._test.buildTransactionDetails({monthKey,config:commissions.normalizeConfig(commissions.DEFAULT_CONFIG),comprobantesRows:rows,settersRows:[],agendaRows:[]}));
    return {rows,commissionDetails,files:(await db.query('select comprobante_id,original_name,size_bytes from public.comprobantes_archivos')).rows};
  }));
  app.get('/',(req,res)=>res.redirect('/views/carga-comprobantes.html'));
  app.get('/views/carga-comprobantes.html',(req,res)=>{
    let html=fs.readFileSync(path.join(root,'views/carga-comprobantes.html'),'utf8').replace(/<script[^>]+auth-shell[^>]*><\/script>/,'');
    html=html.replace('y dejar listo el flujo que después replica a Supabase.','y consultar su impacto en esta prueba local.');
    html=html.replace('<body class="carga-comprobantes-page">','<body class="carga-comprobantes-page"><aside style="padding:16px;background:#fff3cd;color:#222">Prueba local aislada · GHL ID de prueba: <b>local-lead-001</b> · <a href="/impacto" target="_blank">Ver impacto de las cargas</a>. Los datos se borran al detener este servidor.</aside>');res.type('html').send(html);
  });
  app.get('/impacto',(req,res)=>res.send(String.raw`<!doctype html><html lang="es"><meta charset="utf-8"><title>Impacto de comprobantes</title><style>body{font:16px system-ui;margin:32px;background:#f6f8fb;color:#172335}table{border-collapse:collapse;background:white;width:100%;margin:20px 0}td,th{padding:10px;border:1px solid #ddd;text-align:left}button{padding:8px;cursor:pointer}pre{white-space:pre-wrap}</style><h1>Impacto de las cargas locales</h1><p>Solo comprobantes nuevos de prueba. No escribe en Notion ni en Supabase compartido.</p><p>Comisiones calculadas con las reglas predeterminadas del código y sin histórico del equipo. CSM y ARCA aún no se ejecutan en este circuito.</p><button onclick="load()">Actualizar</button><main id="out"></main><script>const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));async function reconcile(id){await fetch('/local/reconcile/'+id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({state:'conciliated'})});load()}async function load(){const d=await(await fetch('/local/impact')).json();if(!d.ok){out.textContent=d.message;return}out.innerHTML='<h2>Ventas, cobranzas y saldos</h2><table><tr><th>Tipo</th><th>Producto</th><th>Pesos</th><th>USD</th><th>Facturación USD</th><th>Cobrado venta USD</th><th>Saldo venta USD</th><th>Estado</th></tr>'+d.rows.map(r=>'<tr><td>'+esc(r.tipo)+'</td><td>'+esc(r.producto_format)+'</td><td>'+esc(r.cash_ar)+'</td><td>'+esc(r.cash_collected)+'</td><td>'+esc(r.facturacion)+'</td><td>'+esc(r.cash_collected_total)+'</td><td>'+(r.tipo==='Venta'?esc(Number(r.facturacion||0)-Number(r.cash_collected_total||0)):'—')+'</td><td>'+esc(r.estado)+' <button onclick="reconcile(\''+esc(r.id)+'\')">Conciliar</button></td></tr>').join('')+'</table><h2>Comisiones</h2><pre>'+esc(JSON.stringify(d.commissionDetails,null,2))+'</pre><h2>Adjuntos guardados</h2><pre>'+esc(JSON.stringify(d.files,null,2))+'</pre>'}load();</script></html>`));
  app.use(express.static(root));
  app.use((err,req,res,next)=>res.status(err.statusCode||500).json({ok:false,message:err.message}));
  app.listen(3102,'127.0.0.1',()=>console.log('Carga aislada: http://localhost:3102 — cliente: local-lead-001'));
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
