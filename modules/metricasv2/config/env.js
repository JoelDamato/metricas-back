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
  assistantProvider: getEnv('METRICAS_ASSISTANT_PROVIDER', 'ollama'),
  ollamaBaseUrl: getEnv('OLLAMA_BASE_URL', getEnv('OLLAMA_HOST', 'http://localhost:11434/api')),
  ollamaModel: getEnv('OLLAMA_MODEL', 'gemma3'),
  openRouterApiKey: getEnv('OPENROUTER_API_KEY'),
  openRouterModel: getEnv('OPENROUTER_MODEL', 'openrouter/free'),
  tables: {
    clientes: getEnv('SUPABASE_TABLE_CLIENTES', 'clientes'),
    metricas: getEnv('SUPABASE_TABLE_METRICAS', 'metricas'),
    objetivos: getEnv('SUPABASE_TABLE_OBJETIVOS', 'objetivos')
  }
};
