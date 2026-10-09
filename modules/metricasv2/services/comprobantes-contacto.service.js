const axios=require('axios');
const COLUMNS='id,ghlid,cliente,cliente_format,mail,telefono,tipo,producto_format,medios_de_pago_format,estado,rebotar_pago,f_venta,f_acreditacion,fecha_creado,facturacion,cash_collected,cash_ar,cash_collected_ar,cash_collected_ars,iva,tc,comisiones,venta_relacionada';
const quote=value=>'"'+String(value).replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"';
async function listContactReceipts(ghlid,clientIds=[],options={}) {
 const request=options.request||axios.get;
 const url=(options.url||process.env.SUPABASE_URL)+'/rest/v1/comprobantes';
 const key=options.key||process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!String(ghlid||'').trim())throw Error('Falta el GHL ID del contacto');
 clientIds=[...new Set(clientIds.filter(Boolean))];
 const rows=new Map();
 async function pages(filter){let last='';while(true){
  const response=await request(url,{timeout:30000,headers:{apikey:key,Authorization:`Bearer ${key}`},params:{select:COLUMNS,order:'id.asc',limit:500,...filter,...(last?{id:`gt.${last}`}:{})}});
  const page=response.data||[];for(const row of page)rows.set(row.id,row);
  if(page.length<500)break;const next=page.at(-1)?.id;if(!next||next===last)throw Error('No pude completar el historial de comprobantes');last=next;
 }}
 await pages({ghlid:`eq.${ghlid}`});
 for(let i=0;i<clientIds.length;i+=50)await pages({cliente:`in.(${clientIds.slice(i,i+50).map(quote).join(',')})`});
 // A direct collection can reference an older sale that has no GHL ID or client relation.
 const parents=[...new Set([...rows.values()].map(r=>r.venta_relacionada).filter(id=>id&&!rows.has(id)))];
 for(let i=0;i<parents.length;i+=50)await pages({id:`in.(${parents.slice(i,i+50).map(quote).join(',')})`});
 // Some older collections only carry the sale relation, without a GHL ID.
 const sales=[...rows.values()].filter(r=>r.tipo==='Venta').map(r=>r.id);
 for(let i=0;i<sales.length;i+=50)await pages({venta_relacionada:`in.(${sales.slice(i,i+50).map(quote).join(',')})`});
 return [...rows.values()].sort((a,b)=>String(b.f_acreditacion||b.fecha_creado||b.f_venta||'').localeCompare(String(a.f_acreditacion||a.fecha_creado||a.f_venta||''))||String(b.id).localeCompare(String(a.id)));
}
function cashWithoutIva(row) {
 const cash=Number(row.cash_collected||0),iva=Number(row.iva||0);
 if(!iva || !cash)return cash;
 const ars=Number(row.cash_ar??row.cash_collected_ar??row.cash_collected_ars??0);
 const tc=Number(row.tc)>0?Number(row.tc):(ars>0&&cash>0?ars/cash:0);
 if(!tc)throw Error('Un comprobante tiene IVA pero no un tipo de cambio válido para calcular el saldo sin IVA.');
 return Math.max(0,cash-iva/tc);
}
function totals(rows){const result={facturacion:0,cobrado:0,pendiente:0,rebotado:0};for(const r of rows){const refunded=/^Devoluci[oó]n$/i.test(r.tipo),sign=refunded?-1:1;const bounced=String(r.estado).toLowerCase()==='rebotado'||String(r.rebotar_pago)==='true';const effective=!bounced&&String(r.estado).toLowerCase()==='conciliado';if(r.tipo==='Venta')result.facturacion+=Number(r.facturacion||0);else if(refunded&&effective)result.facturacion-=Number(r.facturacion||0);result[bounced?'rebotado':effective?'cobrado':'pendiente']+=sign*cashWithoutIva(r);}for(const key of Object.keys(result))result[key]=Math.round((result[key]+Number.EPSILON)*100)/100;result.saldo=Math.round((result.facturacion-result.cobrado)*100)/100;return result;}
module.exports={listContactReceipts,totals,cashWithoutIva};
