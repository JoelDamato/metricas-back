const axios = require('axios');
// Retry only transient reads. Authorization still requires a fresh DB result.
async function readUser(url, options) {
  for (let attempt=0;attempt<2;attempt++) {
    try { return await axios.get(url,{...options,timeout:8000}); }
    catch(error) {
      if(attempt || !['ECONNRESET','ETIMEDOUT','ECONNABORTED','EAI_AGAIN'].includes(error.code)) throw error;
    }
  }
}
module.exports={readUser};
