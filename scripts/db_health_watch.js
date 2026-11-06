// Chequeo de salud de Supabase para correr cada 5 minutos desde un programador externo (cron/systemd/launchd).
// Avisa cuando la base falla 2 veces seguidas y cuando se recupera. Para avisar ejecuta ALERT_CMD con el texto como argumento.
// Uso: ALERT_CMD="wpp joel" node scripts/db_health_watch.js
require('dotenv').config({quiet: true});
const fs = require('fs'), os = require('os'), path = require('path'), {execFileSync} = require('child_process');
const {SUPABASE_URL, SUPABASE_ACCESS_TOKEN, SUPABASE_SERVICE_ROLE_KEY, ALERT_CMD} = process.env;
const STATE = process.env.HEALTH_STATE_FILE || path.join(os.tmpdir(), 'metricas-db-health.json');
const FAILS_TO_ALERT = 2;
async function check() {
  const ref = new URL(SUPABASE_URL).hostname.split('.')[0];
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/csm?select=id&limit=1`, {headers: {apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`}, signal: AbortSignal.timeout(8000)});
    if (r.ok) return {ok: true};
    return {ok: false, why: `la base respondió HTTP ${r.status}`};
  } catch (e) {
    let why = 'no responde (timeout)';
    try {
      const h = await (await fetch(`https://api.supabase.com/v1/projects/${ref}/health?services=db&services=rest&services=auth`, {headers: {Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`}, signal: AbortSignal.timeout(15000)})).json();
      why = 'no responde: ' + h.map(x => `${x.name} ${x.status}`).join(', ');
    } catch (_) {}
    return {ok: false, why};
  }
}
function alert(text) {
  console.log(text);
  if (ALERT_CMD) { const [cmd, ...args] = ALERT_CMD.split(' '); execFileSync(cmd, [...args, text], {stdio: 'inherit'}); }
}
(async () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  let state = {fails: 0, alerted: false};
  try { state = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch (_) {}
  const result = await check();
  if (result.ok) {
    if (state.alerted) alert('La base de Matías Randazzo volvió a responder.');
    state = {fails: 0, alerted: false};
  } else {
    state.fails += 1;
    if (state.fails >= FAILS_TO_ALERT && !state.alerted) { alert(`Base de datos de Matías Randazzo caída: ${result.why}. Puede fallar el login de la central.`); state.alerted = true; }
  }
  fs.writeFileSync(STATE, JSON.stringify(state));
})().catch(e => { console.error(e.message); process.exitCode = 1; });
