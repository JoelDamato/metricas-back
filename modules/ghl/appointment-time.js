const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';
function appointmentTimestamp(value, timeZone = DEFAULT_TIMEZONE) {
  if (value == null || value === '') return NaN;
  const text = String(value).trim();
  const local = text.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(\.\d{1,3})?)?$/);
  if (!local) return new Date(value).getTime(); // Explicit offsets / UTC remain authoritative.
  const [,year,month,day,hour,minute,second='0',fraction='0'] = local;
  const wall = Date.UTC(+year,+month-1,+day,+hour,+minute,+second,Math.round(Number(fraction)*1000));
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'
  });
  let instant=wall;
  for(let i=0;i<3;i++) {
    const parts=Object.fromEntries(formatter.formatToParts(new Date(instant)).map(p=>[p.type,p.value]));
    const represented=Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute,+parts.second);
    const offset=represented-Math.floor(instant/1000)*1000;
    const next=wall-offset;
    if(next===instant) break;
    instant=next;
  }
  return instant;
}
module.exports={appointmentTimestamp,DEFAULT_TIMEZONE};
