const crypto = require('crypto');
const appointmentDiscordService = require('../modules/ghl/appointment-discord.service');

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function getProvidedSecret(req) {
  const authorization = String(req.headers.authorization || '');
  const bearer = authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : '';
  return req.headers['x-webhook-secret'] || bearer || req.query.secret || '';
}

async function handleAppointmentBooked(req, res, next) {
  try {
    const config = appointmentDiscordService.getConfig();
    if (!config.webhookSecret) {
      return res.status(503).json({
        ok: false,
        message: 'GHL_APPOINTMENT_WEBHOOK_SECRET no está configurado'
      });
    }

    if (!safeEqual(getProvidedSecret(req), config.webhookSecret)) {
      return res.status(401).json({ ok: false, message: 'Webhook no autorizado' });
    }

    const result = await appointmentDiscordService.processAppointmentWebhook(req.body, { config });
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getProvidedSecret,
  handleAppointmentBooked,
  safeEqual
};
