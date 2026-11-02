const { effectiveSetter, isNahuel } = require('./webinar-setter.service');
const key = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
function webinarAgendaCounts(rows, month) {
  const counts = new Map(), seen = new Set();
  for (const row of rows) {
    const person = effectiveSetter(row);
    if (!row.webinarSetters?.length || !person || isNahuel(person)) continue;
    if (!counts.has(key(person))) counts.set(key(person), { person, agendas: 0 });
    if (!String(row.fecha_agenda || '').startsWith(month) || key(row.agendo) !== 'agendo') continue;
    const id = row.ghlid || row.id;
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);
    counts.get(key(person)).agendas++;
  }
  return counts;
}
function webinarPct(agendas) { return agendas <= 11 ? 0.03 : 0.035; }
function buildWebinarSummary(details, agendaRows, month) {
  const people = webinarAgendaCounts(agendaRows, month);
  for (const detail of details.filter(row => row.sector === 'webinar')) {
    const personKey = key(detail.person);
    if (!people.has(personKey)) people.set(personKey, { person: detail.person, agendas: detail.counters.agendas });
    const person = people.get(personKey);
    person.cashArs = (person.cashArs || 0) + detail.baseAmount;
    person.commissionAmount = (person.commissionAmount || 0) + detail.commissionAmount;
    person.transactions = (person.transactions || 0) + 1;
    person.pending = person.pending || detail.pendingCommission;
  }
  return [...people.values()].map(person => ({ cashArs: 0, commissionAmount: 0, transactions: 0, ...person, pct: webinarPct(person.agendas) })).sort((a,b) => a.person.localeCompare(b.person,'es'));
}
module.exports = { webinarAgendaCounts, webinarPct, buildWebinarSummary };
