const express=require('express'),ledger=require('./service'),auth=require('../auth/service');
const commissions=require('../metricasv2/services/commissions.service'),supabase=require('../metricasv2/services/supabase.service');
const loader=require('../metricasv2/services/comprobantes-loader.service');
const report=require('../../public/metricas-v2/js/agenda-monthly-report');
const {commissionRecipients}=require('./recipients');
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next);
async function users(dashboard){return commissionRecipients(await auth.listUsers(),dashboard).map(u=>({email:ledger.email(u),nombre:u.nombre,role:u.role,raw:u}));}
function personForName(all,name){return all.find(u=>norm(loader.getResponsibleNameForUser(u.raw))===norm(name)||norm(u.nombre)===norm(name)||loader.getComprobantesSetterNames(u.raw).some(n=>norm(n)===norm(name)));}
async function candidates(month,dashboard,all){
 const [year,m]=month.split('-').map(Number),from=month+'-01',to=month+'-'+new Date(Date.UTC(year,m,0)).getUTCDate();
 const [cashRows,rules,prize]=await Promise.all([supabase.listAllRows('comprobantes',{from,to,dateField:'f_acreditacion',limit:1000,select:'responsable_venta,creado_por,producto_format,f_acreditacion,cash_collected_neto,cash_collected,estado'}),supabase.getAgendaBonusRules({anio:year,mes:m}),supabase.getReportesPremioConfig()]);
 const calculated=report.buildCashAndBonus(cashRows,rules,year,m);const result=[];
 function add(name,source,concept,amount,currency='USD'){const u=personForName(all,name);if(!u||!(amount>0))return;result.push({person_email:u.email,person_name:u.nombre||name,source_key:source,concept,amount:Math.round(amount*100)/100,currency});}
 for(const r of calculated.distributions)add(r.name,'sistema-agendas','Bono Sistema de Agendas',r.bonus);
 const byPerson=new Map();for(const r of cashRows){if(norm(r.estado)!=='conciliado'||norm(r.producto_format).includes('club'))continue;const name=r.responsable_venta||r.creado_por;if(!name||['sin closer','nahuel','shirlet','shirley'].some(term=>norm(name).includes(term)))continue;const key=norm(name);const total=byPerson.get(key)||{name,amount:0};total.amount+=Math.max(0,Number(r.cash_collected_neto??r.cash_collected??0))*Number(prize.cash_collected_premio_pct||0)/100;byPerson.set(key,total);}
 for(const r of byPerson.values())add(r.name,'reportes-cash','Premio Cash Collected · Reportes',r.amount);
 for(const r of dashboard.bonusCandidates||[])add(r.person,'agendas-setter:'+r.id,r.sourceRule||'Bono por agendas',r.bonusUsd||r.commissionAmount,r.bonusUsd?'USD':'ARS');
 return result.map(r=>({...r,movement:dashboard.movementRows.find(e=>e.person_email===r.person_email&&e.source_key===r.source_key)||null}));
}
const router=express.Router();router.use((req,res,next)=>{res.set('Cache-Control','no-store');if(!req.authUser)return res.status(401).json({message:'Sesión requerida'});next();});
router.get('/',wrap(async(req,res)=>{
 const month=ledger.month(req.query.month),manage=ledger.canManage(req.authUser),approve=ledger.canApprove(req.authUser);
 const dashboard=await commissions.buildCommissionDashboard(month,{includeSourceRows:true});const all=await users(dashboard);
 const selected=manage?all:all.filter(u=>u.email===ledger.email(req.authUser));
 const rows=selected.map(u=>{const personal=commissions.buildUserCommercialArea(dashboard,u.raw);return {email:u.email,name:u.nombre,...ledger.calculate(personal,dashboard.movementRows.filter(e=>e.person_email===u.email))};});
 res.json({month,locked:dashboard.locked,canManage:manage,canApprove:approve,rows,candidates:approve?await candidates(month,dashboard,all):[]});
}));
router.post('/',wrap(async(req,res)=>{
 if(!ledger.canManage(req.authUser))return res.status(403).json({message:'Sólo Nadia o Mati cargan retiros y adelantos'});
 const b=req.body,month=ledger.month(b.month),dashboard=await commissions.buildCommissionDashboard(month),all=await users(dashboard),u=all.find(u=>u.email===String(b.email||'').trim().toLowerCase());
 const amount=Number(b.amount),tc=b.currency==='ARS'?1:Number(b.exchangeRate);
 if(!u||!['retiro','adelanto'].includes(b.kind)||!['ARS','USD'].includes(b.currency)||!Number.isFinite(amount)||amount<=0||!Number.isFinite(tc)||tc<=0||!/^\d{4}-\d{2}-\d{2}$/.test(b.date||'')||!String(b.concept||'').trim()||String(b.concept).length>500)return res.status(400).json({message:'Completá persona, importe, moneda, TC, fecha y concepto válidos'});
 res.json(await ledger.write('create',req.authUser,{request_key:b.requestKey,month_key:month,person_email:u.email,person_name:u.nombre||u.email,kind:b.kind,amount,currency:b.currency,exchange_rate:tc,effective_date:b.date,concept:String(b.concept).trim()}));
}));
router.post('/approve',wrap(async(req,res)=>{
 if(!ledger.canApprove(req.authUser))return res.status(403).json({message:'Sólo Leo o Mati aprueban bonos'});
 const b=req.body,month=ledger.month(b.month),dashboard=await commissions.buildCommissionDashboard(month),all=await users(dashboard);
 const candidate=(await candidates(month,dashboard,all)).find(c=>c.person_email===b.email&&c.source_key===b.sourceKey);
 if(!candidate)return res.status(409).json({message:'El bono ya no es calculable. Actualizá los datos.'});
 if(Math.abs(Number(b.expectedAmount)-candidate.amount)>0.005||!Number.isFinite(Number(b.expectedAmount)))return res.status(409).json({message:'El importe del bono cambió. Actualizá y revisalo antes de aprobar.'});
 if(candidate.movement)return res.status(409).json({message:'Este bono ya fue registrado. Revisá su historial.'});
 const tc=candidate.currency==='ARS'?1:Number(b.exchangeRate);if(!(tc>0)||!Number.isFinite(tc))return res.status(400).json({message:'Indicá un tipo de cambio válido'});
 res.json(await ledger.write('create',req.authUser,{...candidate,movement:undefined,request_key:b.requestKey,month_key:month,kind:'bono',exchange_rate:tc,effective_date:new Date().toISOString().slice(0,10)}));
}));
router.post('/:id/void',wrap(async(req,res)=>{res.json(await ledger.write('void',req.authUser,{id:req.params.id,reason:req.body.reason}));}));
module.exports=router;
module.exports._test={users,candidates,personForName};
