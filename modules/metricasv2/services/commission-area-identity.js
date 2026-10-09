const AREA_BY_EMAIL = Object.freeze({
  'belenherrera.gestion@gmail.com': 'CSM',
  'walteralegre56@gmail.com': 'Marketing',
  'leonardoalaniz19@gmail.com': 'Comercial'
});
function commissionAreaForUser(user) {
  return AREA_BY_EMAIL[String(user?.email || '').trim().toLowerCase()] || null;
}
module.exports = {commissionAreaForUser};
