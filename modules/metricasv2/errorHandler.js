function metricasV2ErrorHandler(err, req, res, next) {
  if (!req.originalUrl.startsWith('/api/metricas')) {
    return next(err);
  }

  console.error('[metricas-v2 error]', err.message);
  if (err.details) {
    console.error('[metricas-v2 details]', JSON.stringify(err.details));
  }

  const isPayloadTooLarge = err.type === 'entity.too.large' || err.status === 413 || err.statusCode === 413;
  return res.status(isPayloadTooLarge ? 413 : (err.statusCode || 500)).json({
    ok: false,
    message: isPayloadTooLarge
      ? 'Los archivos superan el tamaño máximo de la carga. Reducilos a 30 MB en total e intentá de nuevo.'
      : (err.message || 'Error interno en métricas')
  });
}

module.exports = metricasV2ErrorHandler;
