function getEnv(name, fallback = null) {
  const value = process.env[name];
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  return value;
}

module.exports = {
  supabaseUrl: getEnv('SUPABASE_URL'),
  supabaseKey: getEnv('SUPABASE_SERVICE_ROLE_KEY'),
  tables: {
    clientes: getEnv('SUPABASE_TABLE_CLIENTES', 'clientes'),
    metricas: getEnv('SUPABASE_TABLE_METRICAS', 'metricas'),
    objetivos: getEnv('SUPABASE_TABLE_OBJETIVOS', 'objetivos')
  }
};
