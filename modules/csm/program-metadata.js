const axios = require('axios');
const env = require('../metricasv2/config/env');
const access = require('../auth/access');
async function list(req, res, next) {
  try {
    const canReadPrograms = req.authUser && ['csm-cuadro.html', 'csm-renovaciones.html']
      .some(page => access.canAccessPageForUser(req.authUser, page));
    if (!canReadPrograms) return res.status(403).json({message:'Sin acceso a CSM'});
    const rows = [];
    for (let offset = 0; ; offset += 500) {
      const {data} = await axios.get(`${env.supabaseUrl}/rest/v1/csm_followup_profiles`, {
        headers:{apikey:env.supabaseKey, Authorization:`Bearer ${env.supabaseKey}`},
        params:{select:'ghlid,rubro,support_active,support',order:'ghlid',limit:500,offset},timeout:30000
      });
      rows.push(...data);
      if (data.length < 500) break;
    }
    res.set('Cache-Control','no-store').json({rows});
  } catch (error) { next(error); }
}
module.exports = {list};
