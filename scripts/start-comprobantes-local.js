if (process.env.NODE_ENV === 'production') throw new Error('Este arranque es exclusivamente local');
process.env.COMPROBANTES_LOCAL_DIRECT = '1';
delete process.env.COMPROBANTES_LOCAL_REAL_TEST;
require('../index');
