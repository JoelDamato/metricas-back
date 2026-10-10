const fail = message => { throw Object.assign(new Error(message), { statusCode: 400 }); };
const number = (value, label, max = Infinity) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max) fail(`${label}: ingresá un número entre 0 y ${max === Infinity ? 'un valor positivo' : max * 100 + '%'}.`);
};
function validateConfig(config) {
  for (const [key, value] of Object.entries(config.global || {})) {
    if (key.endsWith('Pct')) number(value, 'Porcentaje', 1);
    if (key === 'includeOnlyVerified' && typeof value !== 'boolean') fail('La verificación debe ser sí o no.');
  }
  for (const key of ['agendaScale', 'setterSalesScale', 'clubScale', 'setterClubScale']) {
    if (!(key in config)) continue;
    const rows = config[key];
    if (!Array.isArray(rows) || !rows.length) fail('Cada escala debe conservar al menos un tramo.');
    const used = new Set();
    for (const row of rows) {
      number(row.min, 'Inicio del tramo'); number(row.pct, 'Porcentaje del tramo', 1);
      if (!Number.isInteger(row.min) || used.has(row.min)) fail('Los inicios de tramo deben ser enteros y no repetirse dentro de la misma escala.');
      used.add(row.min);
      if (row.bonusUsd !== undefined) number(row.bonusUsd, 'Bono USD');
    }
  }
  for (const key of ['fixedOverrides', 'setterFixedOverrides', 'personRoles', 'personAreas', 'closerRules']) {
    if (!(key in config)) continue;
    if (!Array.isArray(config[key])) fail('La lista de personas no es válida.');
    const used = new Set();
    for (const row of config[key]) {
      const name = String(row.person || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      if (key !== 'closerRules' && (!name || used.has(name))) fail('Completá los nombres y evitá repetir una persona en la misma lista.');
      used.add(name);
      if ('pct' in row) number(row.pct, 'Porcentaje individual', 1);
      if (key === 'personRoles' && !['Closer', 'Setter', 'Ambos'].includes(row.role)) fail('Rol inválido.');
      if (key === 'personAreas' && !['Comercial', 'CSM', 'Marketing', 'Administración'].includes(row.area)) fail('Área inválida.');
    }
  }
}
module.exports = { validateConfig };
