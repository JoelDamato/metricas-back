const axios = require('axios');
const env = require('../metricasv2/config/env');
const access = require('../auth/access');
const RECEIPT_FIELDS = 'id,ghlid,cliente_format,responsable_venta,creado_por,tipo,producto_format,f_venta,f_acreditacion,estado,rebotar_pago,facturacion,cash_collected,cash_collected_neto,cash_collected_total,cash_collected_neto_total';
async function readAll(table, params = {}) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const {data} = await axios.get(`${env.supabaseUrl}/rest/v1/${table}`, {
      headers: {apikey:env.supabaseKey,Authorization:`Bearer ${env.supabaseKey}`},
      params: {select:'*',order:'id',...params,limit:1000,offset},timeout:20000
    });
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}
async function load() {
  const [csmRows, comprobanteRows, programs] = await Promise.all([
    readAll('csm'), readAll('comprobantes',{select:RECEIPT_FIELDS}),
    readAll('csm_followup_profiles',{select:'ghlid,rubro,support_active,support',order:'ghlid'})
  ]);
  const leadRows=[];
  const quote=value=>JSON.stringify(String(value));
  const ids=[...new Set(csmRows.map(r=>r.ghlid).filter(Boolean))];
  for(let i=0;i<ids.length;i+=400){
    const chunks=[ids.slice(i,i+200),ids.slice(i+200,i+400)].filter(c=>c.length);
    const pages=await Promise.all(chunks.map(chunk=>readAll('leads_raw',{
      select:'id,ghlid,nombre,closer',ghlid:`in.(${chunk.map(quote).join(',')})`
    })));
    pages.forEach(page=>leadRows.push(...page));
  }
  const named=value=>value && !['anonymous','anonimo','anónimo'].includes(String(value).trim().toLowerCase());
  const known=new Set([...csmRows,...comprobanteRows,...leadRows].filter(r=>named(r.closer||r.responsable_venta||r.creado_por)).map(r=>r.ghlid).filter(Boolean));
  const names=[...new Set(csmRows.filter(r=>!known.has(r.ghlid)).map(r=>r.nombre).filter(Boolean))];
  for(let i=0;i<names.length;i+=100) leadRows.push(...await readAll('leads_raw',{
    select:'id,ghlid,nombre,closer',nombre:`in.(${names.slice(i,i+100).map(quote).join(',')})`
  }));
  return {csmRows:csmRows.map(row=>Object.fromEntries(['id','ghlid','nombre','closer','fecha_final','fecha_final_renovacion','productos_adquiridos','ultimo_producto_adquirido'].map(key=>[key,row[key]]))),comprobanteRows,leadRows:[...new Map(leadRows.map(row=>[row.id,row])).values()],programs};
}
async function list(req,res,next){
  try{
    if(!req.authUser || !access.canAccessPageForUser(req.authUser,'csm-renovaciones.html') ||
      !['csm','comprobantes','leads_raw'].every(resource=>access.canAccessResourceForUser(req.authUser,resource)))
      return res.status(403).json({message:'Sin acceso a Renovaciones'});
    res.set('Cache-Control','no-store').json(await load());
  }catch(error){next(error);}
}
module.exports={list,load};
