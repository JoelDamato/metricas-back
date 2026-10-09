(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.marketingCohort=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 const combined='VSL + rt';
 const text=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
 function group(value){let raw=String(value||'').trim();try{raw=decodeURIComponent(raw);}catch{}if(/^postulacion meg - /i.test(text(raw))){const part=raw.split(' - ')[1]||'';if(text(part).includes('vsl'))return 'vsl';if(text(part).includes('org'))return 'org';if(text(part).includes('apset'))return 'apset';return text(part);}return text(raw);}
 function isClientSession(value){let raw=String(value||'');try{raw=decodeURIComponent(raw);}catch{}return text(raw).startsWith('sesion');}
 function matches(row,selected){const current=group(row?.origen_actual);if(isClientSession(row?.origen_actual)||!current)return false;if(selected===combined)return current==='rt'&&group(row?.primer_origen)==='vsl';return !selected||current===group(selected);}
 function csv(rows,filters){const columns=[['GHL ID','ghlid'],['ID registro','id'],['Nombre','nombre'],['Email','mail'],['Teléfono','telefono'],['Fecha agenda','fecha_agenda'],['Agendó','agendo'],['Origen actual','origen_actual'],['Primer origen','primer_origen'],['Closer','closer'],['Setter','setter'],['Aplica','aplica'],['Call confirmer','call_confirm'],['Llamada CC','llamada_cc'],['CC WhatsApp','cc_whatsapp'],['Llamada MEG','llamada_meg'],['Campaña','campaign'],['Adset','adset'],['Anuncio','adname'],['Última actualización','last_edited_time']];
 const cell=v=>'"'+String(v??'').replace(/^[\s]*[=+@-]/,m=>"'"+m).replace(/"/g,'""')+'"';
 const header=[...columns.map(([label])=>label),'Link GHL','Filtro origen','Desde','Hasta'];
 return '\uFEFF'+[header,...rows.map(row=>[...columns.map(([,key])=>row[key]),row.ghlid?`https://app.gohighlevel.com/v2/location/WU2z8kl23Dr3IyBW1hv5/contacts/detail/${encodeURIComponent(row.ghlid)}`:'',filters.origen||'Todos',filters.from,filters.to])].map(row=>row.map(cell).join(';')).join('\r\n');
 }
 return {combined,group,matches,csv,isClientSession};
});
