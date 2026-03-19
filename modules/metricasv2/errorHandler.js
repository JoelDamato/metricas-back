function metricasV2ErrorHandler(err, req, res, next) {
  if (!req.originalUrl.startsWith('/api/metricas')) {
    return next(err);
  }

  console.error('[metricas-v2 error]', err.message);
  if (err.details) {
    console.error('[metricas-v2 details]', JSON.stringify(err.details));
  }

  return res.status(err.statusCode || 500).json({
    ok: false,
    message: err.message || 'Error interno en métricas'
  });
}

module.exports = metricasV2ErrorHandler;
