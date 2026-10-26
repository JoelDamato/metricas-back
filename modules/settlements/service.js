const axios=require('axios'),env=require('../metricasv2/config/env');
const email=u=>String(u?.email||'').trim().toLowerCase();
const canManage=u=>['nadia.cavallini@gmail.com','matirandazzo@gmail.com'].includes(email(u));
const canApprove=u=>['leonardoalaniz19@gmail.com','matirandazzo@gmail.com'].includes(email(u));
const headers=()=>({apikey:env.supabaseKey,Authorization:'Bearer '+env.supabaseKey});
function month(value){if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(value||''))throw Object.assign(Error('Seleccioná un mes válido'),{statusCode:400});return value;}
async function list(monthKey,personEmail){month(monthKey);const rows=[];for(let offset=0;;offset+=1000){const {data}=await axios.get(env.supabaseUrl+'/rest/v1/commission_movements',{headers:headers(),params:{month_key:'eq.'+monthKey,...(personEmail?{person_email:'eq.'+personEmail}:{}),order:'created_at.asc,id.asc',limit:1000,offset},timeout:20000});rows.push(...data);if(data.length<1000)return rows;}}
async function write(action,user,data){try{return(await axios.post(env.supabaseUrl+'/rest/v1/rpc/commission_movement_write',{p_action:action,p_actor:email(user),p_data:data},{headers:headers(),timeout:20000})).data;}catch(e){throw Object.assign(Error(e.response?.data?.message||'No se pudo guardar el movimiento'),{statusCode:409});}}
function calculate(personal,entries,openingBalance=0){const sum=rows=>rows.reduce((n,r)=>n+Number(r.amount_ars||0),0);const active=entries.filter(r=>r.status==='approved');const existingBonuses=(personal.details||[]).filter(d=>d.isBonus).reduce((n,d)=>n+Number(d.commissionAmount||0),0);const commission=Number(personal.summary?.totalCommission||0)-existingBonuses;const bonuses=sum(active.filter(r=>r.kind==='bono'));const withdrawals=sum(active.filter(r=>r.kind!=='bono'));const round=n=>Math.round((n+Number.EPSILON)*100)/100;return {openingBalance:round(openingBalance),commission:round(commission),bonuses:round(bonuses),withdrawals:round(withdrawals),total:round(round(openingBalance)+round(commission)+round(bonuses)-round(withdrawals)),entries};}
function approvedBonusDetails(entries){return entries.filter(r=>r.kind==='bono'&&r.status==='approved').map(r=>({id:r.id,transactionId:null,person:r.person_name,personEmail:r.person_email,area:'Comercial',role:r.source_key?.startsWith('agendas-setter:')?'Setter':'Closer',category:'Bono',tipo:'Bono',product:r.concept,clientName:'Bono aprobado',date:r.effective_date,commissionAmount:Number(r.amount_ars),bonusArs:Number(r.amount_ars),bonusUsd:r.currency==='USD'?Number(r.amount):0,baseAmount:0,cashArs:0,cashUsd:0,facturacionUsd:0,isBonus:true,tc:Number(r.exchange_rate),sourceRule:'Aprobado por '+r.created_by,counters:{}}));}
module.exports={email,canManage,canApprove,month,list,write,calculate,approvedBonusDetails};

// Only debt carries forward. A positive monthly amount is payable in that month.
async function firstWithdrawalMonth(beforeMonth, personEmail) {
 const {data}=await axios.get(env.supabaseUrl+'/rest/v1/commission_movements',{headers:headers(),params:{select:'month_key',month_key:'lt.'+month(beforeMonth),status:'eq.approved',kind:'in.(retiro,adelanto)',...(personEmail?{person_email:'eq.'+personEmail}:{}),order:'month_key.asc',limit:1},timeout:20000});
 return data[0]?.month_key || null;
}
async function openingBalances(targetMonth, people, firstMonth, loadDashboard, personalFor) {
 const balances=Object.fromEntries(people.map(p=>[p.email,0]));
 for(let key=firstMonth;key && key<targetMonth;) {
  const dashboard=await loadDashboard(key);
  for(const person of people) {
   const result=calculate(personalFor(dashboard,person.raw),dashboard.movementRows.filter(r=>r.person_email===person.email),balances[person.email]);
   balances[person.email]=Math.min(0,result.total);
  }
  const [year,m]=key.split('-').map(Number);
  key=m===12?`${year+1}-01`:`${year}-${String(m+1).padStart(2,'0')}`;
 }
 return balances;
}
module.exports.firstWithdrawalMonth=firstWithdrawalMonth;
module.exports.openingBalances=openingBalances;
