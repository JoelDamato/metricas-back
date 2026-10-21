const axios=require('axios');
const fail=(message,statusCode=400)=>{throw Object.assign(Error(message),{statusCode});};
function text(value,label,max=200,required=false){
  if(value!==undefined&&value!==null&&typeof value!=='string')fail(`${label}: formato inválido`);
  const result=String(value||'').trim();
  if(result.length>max || required&&!result)fail(`${label}: ${required?'completá el campo; ':''}máximo ${max} caracteres`);
  return result;
}
function day(value,label){
  if(!value)return null;
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)fail(`${label}: fecha inválida`);
  return value;
}
function webUrl(value,required=false){
  const raw=text(value,'Enlace',2000,required);if(!raw)return '';
  try{const url=new URL(raw);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)fail('Enlace inválido');return url.href;}catch{fail('Ingresá un enlace http o https válido');}
}
function validate(kind,body){
  if(!body||typeof body!=='object'||Array.isArray(body))fail('Datos inválidos');
  if(kind==='tutorials')return {title:text(body.title,'Título',160,true),area:text(body.area,'Área',100,true),description:text(body.description,'Descripción',4000),url:webUrl(body.url,true)};
  if(kind!=='team')fail('Sección no encontrada',404);
  const birthday=day(body.birthday,'Nacimiento'),startDate=day(body.startDate,'Ingreso');
  const today=new Date().toISOString().slice(0,10);
  if(birthday&&birthday>today)fail('La fecha de nacimiento no puede ser futura');
  if(birthday&&startDate&&birthday>=startDate)fail('El ingreso debe ser posterior al nacimiento');
  const email=text(body.email,'Email',254);
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('Email inválido');
  const allowance=body.vacationAllowance===''||body.vacationAllowance==null?null:Number(body.vacationAllowance);
  if(allowance!==null&&(!Number.isInteger(allowance)||allowance<0||allowance>366))fail('Días asignados: ingresá un entero de 0 a 366');
  const year=Number(body.vacationYear||new Date().getFullYear());if(!Number.isInteger(year)||year<2000||year>2100)fail('Año de vacaciones inválido');
  if(!Array.isArray(body.vacations)||body.vacations.length>100)fail('Vacaciones: máximo 100 períodos');
  const vacations=body.vacations.map(v=>{if(!v||typeof v!=='object')fail('Período inválido');const from=day(v.from,'Inicio de vacaciones'),to=day(v.to,'Fin de vacaciones');if(!from||!to||to<from)fail('Revisá las fechas de vacaciones');return {from,to,note:text(v.note,'Nota de vacaciones',300)};}).sort((a,b)=>a.from.localeCompare(b.from));
  for(let i=1;i<vacations.length;i++)if(vacations[i].from<=vacations[i-1].to)fail('Los períodos de vacaciones no pueden superponerse');
  return {name:text(body.name,'Nombre',160,true),area:text(body.area,'Área',100,true),position:text(body.position,'Cargo',160,true),email,birthday,startDate,vacationAllowance:allowance,vacationYear:year,vacations,notes:text(body.notes,'Notas',4000),fileUrl:webUrl(body.fileUrl)};
}
function createStore(request=axios){
  const config=()=>{if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)fail('Falta configuración de almacenamiento',503);return{url:`${process.env.SUPABASE_URL}/rest/v1/administration_resources`,headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,Prefer:'return=representation'}};};
  return {
    async list(kind){const {url,headers}=config(),rows=[];for(let offset=0;;offset+=500){const {data}=await request.get(url,{headers,params:{select:'*',kind:`eq.${kind}`,order:'id.asc',limit:500,offset},timeout:15000});rows.push(...data);if(data.length<500)return rows;}},
    async save(kind,id,body,user){
      if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))fail('ID inválido');
      if(!Number.isInteger(body.version)||body.version<0)fail('Versión inválida');
      if(typeof body.archived!=='boolean')fail('Estado inválido');
      const data=validate(kind,body.data),{url,headers}=config();
      const row={data,archived:body.archived,version:body.version+1,updated_at:new Date().toISOString(),updated_by:user.email};
      try {
        if(body.version===0){const result=await request.post(url,{...row,id,kind},{headers,timeout:15000});return result.data[0];}
        const result=await request.patch(url,row,{headers,params:{id:`eq.${id}`,kind:`eq.${kind}`,version:`eq.${body.version}`},timeout:15000});
        if(!result.data.length)fail('La ficha cambió en otra ventana. Actualizá antes de guardar.',409);return result.data[0];
      }catch(error){if(error.response?.status===409)fail('Este registro ya existe. Actualizá la lista.',409);throw error;}
    }
  };
}
module.exports={validate,createStore};
