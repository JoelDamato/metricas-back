const axios=require('axios'),env=require('../metricasv2/config/env'),access=require('../auth/access');
async function list(req,res,next){try{
 if(!req.authUser||!access.canAccessPageForUser(req.authUser,'csm-cuadro.html'))return res.status(403).json({message:'Sin acceso a métricas CSM'});
 const rows=[],seen=new Set();
 for(let offset=0;;offset+=500){const {data}=await axios.get(`${env.supabaseUrl}/rest/v1/csm_diagnosticos`,{headers:{apikey:env.supabaseKey,Authorization:`Bearer ${env.supabaseKey}`},params:{select:'client_ghlid,csm_name,initial_csm:data->checkpoints->inicial->>csm',order:'updated_at.desc,id',limit:500,offset},timeout:30000});
 for(const row of data){if(!row.client_ghlid||seen.has(row.client_ghlid))continue;seen.add(row.client_ghlid);rows.push({ghlid:row.client_ghlid,ccm:String(row.initial_csm||row.csm_name||'').trim()});}
 if(data.length<500)break;
 }
 res.set('Cache-Control','no-store').json({rows});
}catch(error){next(error);}}
module.exports={list};
