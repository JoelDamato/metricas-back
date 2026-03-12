// Wrapper para ejecutar el script de migración desde la raíz del proyecto
// Carga .env y reexporta el script que ejecuta el SQL
require('dotenv').config();
require('./scripts/run_add_csm_columns.js');
