const { parseDate: parseIso } = require('../csm/ghl-csm-mapper');
const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const present = value => value !== null && value !== undefined && !(typeof value === 'string' && !value.trim()) && !(Array.isArray(value) && !value.length);
const TEXT = {
 nombre:['full_name','name','Nombre'], mail:['email','Mail'], telefono:['phone','Telefono'], dni:['Dni','Cuit','Dni/cuit'],
 instagram:['Instagram'], usuario_ig:['Usuario IG'], cc_whatsapp:['CC WP','cc_whatsapp'],
 origen:['Origen','contact_source'], origen_actual:['Origen Actual'], primer_origen:['Primer origen'], ultimo_origen:['Ultimo origen'],
 temperatura:['Temperatura'], calidad_lead:['Calidad del lead'], modelo_negocio:['Modelo de negocio','FV - (2) ¿Cuál es tu modelo de negocio?'],
 responsable:['Responsable'], responsable_id:['ID responsable','assignedTo'], setter:['Setter'], closer:['Closer'],
 aplica:['Aplica'], recuperado:['Recuperado'], agendo:['Agendo'], respondio_apertura:['Respondio apertura'],
 confirmo_mensaje:['Confirmo mensaje','Confirmo'], llamada_meg:['Llamada MEG'], call_confirm:['Call confirm','Call Confirmer'], llamada_cc:['Llamada CC'],
 facturacion:['Facturacion'], inversion:['Inversion'], estrategia_a:['Estrategia apertura','Estrategia aperturas'], seguimiento:['Seguimiento','Seguimiento Closing'],
 seguimiento_setting:['Seguimiento Setting','Seguimientos Setting'], nuevo_seguidor:['Nuevo Seguidor'], recurso_ig:['Recurso IG'], recurso_tt:['Recurso TT'],
 calendario_agendado:['Calendario agendado'], producto_de_interes:['Producto de interes'], embudo_meg:['Embudo MEG'], embudo_club:['Embudo CLUB'],
 producto_adq:['Producto adquirido','Productos adquiridos'], u_product_adquirido:['Ultimo producto adquirido'],
 ...Object.fromEntries(['utm_source','utm_medium','utm_campaign','utm_content','utm_term','adname','adset','campaign'].map(k=>[k,[k]]))
};
const DATES={fecha_llamada:['Fecha de llamada'],fecha_agenda:['Fecha de agendamiento'],fecha_cancelada:['Fecha cancelada'],fecha_rt:['Fecha RT'],
 fecha_creada:['date_created','date_added','dateAdded','createdAt','Fecha creada'],fecha_venta:['Ult fecha de venta'],f_venta_meg:['F.venta MEG']};
const BOOLEAN={lista_negra:['Lista negra'],cliente_viejo:['Cliente viejo']};
const ALLOWED_COLUMNS=[...Object.keys(TEXT),...Object.keys(DATES),...Object.keys(BOOLEAN),'score'];

// SQL's legacy date columns are Argentina wall time (timestamp WITHOUT time zone).
// Calendar-only inputs retain their calendar day; instants are converted exactly once.
function dateValue(value) {
 if(typeof value!=='string')return null;
 let s=value.trim();
 if(/^\d{2}\/\d{2}\/\d{4}$/.test(s)){const [d,m,y]=s.split('/');s=`${y}-${m}-${d}`;}
 const iso=parseIso(s);if(!iso)return null;
 return s.length===10?s:new Date(new Date(iso).getTime()-10800000).toISOString().slice(0,19);
}
function sourceTime(value){if(typeof value!=='string'||!value.includes('T'))return null;return parseIso(value);}
function fieldType(value){return value===null?'null':Array.isArray(value)?'array':typeof value==='string'&&parseIso(value)?'date':typeof value;}
function collectFields(payload){
 const data=object(payload.data)?payload.data:payload, bag=new Map(), entries=[];
 const add=(key,value,aliases=[])=>{if(value===undefined)return;const item={key,label:key,value,type:fieldType(value),aliases};bag.set(key,item);entries.push(item);};
 // Prefer custom field names over similarly named generic metadata. Retain all raw data separately.
 const sources=[object(data.customData)?data.customData:{},data,object(data.contact)?data.contact:{}];
 const contact=object(data.contact)?data.contact:data;
 if(typeof contact.source==='string'&&!['ghl','gohighlevel','highlevel'].includes(contact.source.toLowerCase())&&!present(data.contact_source))add('contact_source',contact.source);
 for(const source of sources){
  for(const [key,value]of Object.entries(source)){
   if(['customData','contact','customFields','custom_fields'].includes(key))continue;
   if(!bag.has(key))add(key,value);
  }
  const custom=source.customFields||source.custom_fields;
  if(Array.isArray(custom))for(const f of custom){if(!object(f))continue;const key=f.id?`custom:${f.id}`:f.fieldKey||f.key||f.name;if(!key)continue;
   add(key,f.value,[f.name,f.fieldKey,f.key].filter(Boolean));const item=bag.get(key);item.label=f.name||f.fieldKey||key;item.declaredType=f.dataType||null;
  }
  else if(object(custom))for(const [key,value]of Object.entries(custom))if(!bag.has(key))add(key,value);
 }
 return [...bag.values()];
}
function mapGhlLead(payload,definitions={}){
 const fields=collectFields(payload),patch={},warnings=[];
 // For id-only customFields arrays, use previously observed catalog names if available.
 for(const f of fields){const def=definitions[f.key];if(def){f.aliases.push(def.label,def.key||'');f.label=def.label;f.declaredType=def.type||f.declaredType;}}
 const pick=aliases=>{for(const alias of aliases){const n=normalize(alias);const matches=fields.filter(f=>[f.key,...f.aliases].some(k=>normalize(String(k).replace(/^contact\./,''))===n)&&present(f.value));if(matches.length>1&&new Set(matches.map(f=>JSON.stringify(f.value))).size>1){warnings.push({field:alias,reason:'ambiguous_field_preserved'});return null;}if(matches.length)return matches[0];}return null;};
 for(const [col,aliases]of Object.entries(TEXT)){const f=pick([col,...aliases]);if(!f)continue;
  let v=f.value;if(typeof v==='string'&&v.trim().startsWith('[')){try{const parsed=JSON.parse(v);if(Array.isArray(parsed)&&parsed.every(x=>['string','number','boolean'].includes(typeof x)))v=parsed;}catch{}}
  if(['string','number','boolean'].includes(typeof v))patch[col]=String(v).trim();
  else if(Array.isArray(v)&&v.every(x=>['string','number','boolean'].includes(typeof x)))patch[col]=v.join(', ');
  else warnings.push({field:f.key,reason:'invalid_text'});
 }
 if(!patch.nombre){const first=pick(['first_name','firstName']),last=pick(['last_name','lastName']);const name=[first?.value,last?.value].filter(v=>typeof v==='string'&&v.trim()).join(' ');if(name && first && last)patch.nombre=name;}
 for(const [col,aliases]of Object.entries(DATES)){const f=pick([col,...aliases]);if(!f)continue;const parsed=dateValue(f.value);if(parsed)patch[col]=parsed;else warnings.push({field:f.key,reason:'invalid_date',value:f.value});}
 for(const [col,aliases]of Object.entries(BOOLEAN)){const f=pick([col,...aliases]);if(!f)continue;const v=normalize(f.value);
  if(['true','1','si','yes'].includes(v))patch[col]=true;else if(['false','0','no'].includes(v))patch[col]=false;else warnings.push({field:f.key,reason:'invalid_boolean'});
 }
 const score=pick(['Score']);if(score){const v=score.value;if((typeof v==='number'&&Number.isFinite(v))||(typeof v==='string'&&/^[+-]?\d+(?:[.,]\d+)?$/.test(v.trim())))patch.score=Number(String(v).replace(',','.'));else warnings.push({field:score.key,reason:'invalid_number'});}
 const changed=pick(['date_updated','dateUpdated','updatedAt']);const sourceUpdatedAt=changed?sourceTime(changed.value):null;
 if(changed&&!sourceUpdatedAt)warnings.push({field:changed.key,reason:'invalid_source_timestamp'});
 for(const f of fields)if(f.key.startsWith('custom:')&&!f.aliases.length)warnings.push({field:f.key,reason:'unmapped_custom_id_preserved'});
 return {patch,warnings,sourceUpdatedAt,fields:Object.fromEntries(fields.map(f=>[f.key,{value:f.value,type:f.type,label:f.label,...(f.declaredType?{declaredType:f.declaredType}:{})}]))};
}
module.exports={mapGhlLead,dateValue,ALLOWED_COLUMNS};
