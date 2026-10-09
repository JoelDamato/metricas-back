// Explicit opt-in. index.js binds this mode to loopback only.
if (process.env.NODE_ENV === 'production') throw new Error('Las cargas TEST sólo se habilitan en local');
process.env.COMPROBANTES_LOCAL_REAL_TEST = '1';
require('../index');
