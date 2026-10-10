const path = require('node:path');
const publicRoot = path.join(__dirname, '../../public/metricas-v2');

function notFound(req, res) {
  res.status(404);
  res.set('Cache-Control', 'no-store');
  if (/^\/api(?:\/|$)/.test(req.path)) {
    return res.json({ ok: false, message: 'Ruta no encontrada' });
  }
  const extension = path.extname(req.path);
  if ((extension && extension !== '.html') || !req.accepts('html')) {
    return res.type('text').send('Recurso no encontrado');
  }
  return res.sendFile(path.join(publicRoot, '404.html'));
}

function trainingRedirect(req, res) {
  const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
  res.redirect('/views/entrenamiento.html' + query);
}
module.exports = { notFound, trainingRedirect };
