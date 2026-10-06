const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const present = v => v !== null && v !== undefined && v !== '' && (!Array.isArray(v) || v.length > 0);
const TEXT_FIELDS = {
 nombre:['full_name','Nombre'], mail:['email','Mail','Mail de acceso'], telefono:['phone','Telefono'],
 acceso:['Acceso'], actividad:['Estado programa','Actividad'], bienvenida:['Bienvenida'], cashflow:['Cashflow'],
 closer:['Closer'], contrato:['Contrato'], costos_1:['Costos 1'], costos_2:['Costos 2'],
 dispo_acceso:['Dispo Acceso'], eerr_economico:['EERR Economico'], eerr_financiero:['EERR Financiero'],
 formulario:['Formulario'], onboarding:['Onboarding'], pausa:['Pausa'], productos_adquiridos:['Producto Adquirido','Productos adquiridos'],
 progreso_curso:['Progreso curso'], ultimo_producto_adquirido:['Ultimo producto adquirido'],
 modelo_negocio:['Modelo de negocio','FV - (2) ¿Cuál es tu modelo de negocio?','¿Cuál es tu modelo de negocio?'],
 insatisfecho:['Insatisfecho'], solicito_devolucion:['Solicito devolucion'], abandono:['Abandono'],
 despedida:['Despedida'], engagement:['Engagement','Engagement CSM','Engang'],
 pago_a_onbo:['Pago a onbo'],pago_a_diagnostico:['Pago a diagnostico'],diagnostico_7dias:['Diagnostico en 7 dias'],
 proximo_renovar_15d:['Proximo a renovar 15D'],proximo_renovar_30d:['Proximo a renovar 30D']
};
const DATE_FIELDS={f_onboarding:['F. Onboarding'],fecha_final:['Fecha final'],proximo_contacto_csm:['Proximo contacto CSM'],
 ultima_fecha_de_avance:['Ultima fecha de avance'],ultima_respuesta:['Ultima respuesta'],fecha_de_agendamiento:['Fecha de agendamiento'],
 f_costos_1:['F costos 1'],f_costos_2:['F costos 2'],f_eerr_economico:['F EERR Economico'],f_eerr_financiero:['F EERR Financiero'],
 f_cashflow:['F Cashflow'],f_traffiker:['F Traffiker'],f_coaching:['F Coaching'],f_acceso:['F. acceso'],f_abandono:['F. abandono'],
 f_primer_resultado:['F. primer resultado'],f_pago_con_acceso:['F. pago con acceso'],f_diagnostico:['F. diagnostico'],
 caso_de_exito:['F. Caso de extio','F. Caso de exito'],fecha_final_renovacion:['Fecha final renovacion']};
const FORMATS={f_onboarding:'f_onboarding_format',fecha_de_agendamiento:'fecha_de_agendamiento_format',f_costos_1:'costos_1_format',f_costos_2:'costos_2_format',f_eerr_economico:'eerr_eco_format',f_eerr_financiero:'eerr_fin_format',f_cashflow:'cashflow_format',f_traffiker:'traffiker_format',f_coaching:'coaching_format'};
function parseDate(value){
 if(typeof value!=='string')return null;
 const s=value.trim();if(!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(s))return null;
 const day=s.slice(0,10),base=new Date(day+'T00:00:00Z');if(!Number.isFinite(base.getTime())||base.toISOString().slice(0,10)!==day)return null;
 const d=new Date(s.length===10?s+'T00:00:00Z':s);return Number.isFinite(d.getTime())?d.toISOString():null;
}
function mapGhlCsm(payload){
 const data=payload.data&&typeof payload.data==='object'?payload.data:payload;
 const fields={...(data.contact||{}),...data,...(data.customData||{})};
 const entries=Object.entries(fields),warnings=[],patch={};
 const pick=aliases=>{for(const alias of aliases){const found=entries.find(([k,v])=>normalize(k)===normalize(alias)&&present(v)&&!(typeof v==='string'&&!v.trim()));if(found)return found;}return null;};
 for(const [column,aliases]of Object.entries(TEXT_FIELDS)){const field=pick(aliases);if(!field)continue;const [key,value]=field;
  if(['string','number','boolean'].includes(typeof value))patch[column]=String(value).trim();
  else if(Array.isArray(value)&&value.every(v=>['string','number','boolean'].includes(typeof v)))patch[column]=value.join(',');
  else warnings.push({field:key,reason:'unsupported_text_type'});
 }
 if(!patch.nombre){const name=[fields.first_name,fields.last_name].filter(v=>typeof v==='string'&&v.trim()).join(' ');if(name)patch.nombre=name;}
 const dates={...DATE_FIELDS};for(let n=1;n<=10;n++)dates['modulo_'+n]=[n<=7?`F. Inicio M${n}`:`F. Inicio MP${n-7}`];
 for(const [column,aliases]of Object.entries(dates)){const field=pick(aliases);if(!field)continue;const parsed=parseDate(field[1]);if(!parsed){warnings.push({field:field[0],reason:'invalid_date'});continue;}
  patch[column]=column==='caso_de_exito'?parsed.slice(0,10):parsed;
  const format=FORMATS[column]||(/^modulo_\d+$/.test(column)?column+'_format':null);if(format){const d=parsed.slice(0,10).split('-');patch[format]=`${d[2]}/${d[1]}/${d[0].slice(2)}`;}
 }
 for(let n=1;n<=10;n++){
  const question=entries.find(([k,v])=>{const name=normalize(k);return present(v)&&name.includes('recom')&&new RegExp(`unidad${n}(?:del|a|$)`).test(name);});
  const field=question||pick([`Nps ${n}`]);if(!field)continue;const raw=field[1];
  if((typeof raw==='number'||typeof raw==='string'&&/^\d+(\.0+)?$/.test(raw.trim()))&&Number.isInteger(Number(raw))&&Number(raw)>=0&&Number(raw)<=10)patch['nps_'+n]=Number(raw);
  else if(question)warnings.push({field:field[0],reason:'invalid_nps'});
 }
 const active=pick(['Activos']);if(active){const v=normalize(active[1]);if(['true','1','si'].includes(v))patch.activos=true;else if(['false','0','no'].includes(v))patch.activos=false;else warnings.push({field:active[0],reason:'invalid_boolean'});}
 // Notion Id / Notion Id 2 are not CSM identities; resolve CRM relation in PostgreSQL instead.
 return {patch,warnings};
}
module.exports={mapGhlCsm,parseDate};
