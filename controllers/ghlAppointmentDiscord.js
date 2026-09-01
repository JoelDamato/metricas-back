const appointmentDiscordService = require('../modules/ghl/appointment-discord.service');

async function handleAppointmentBooked(req, res, next) {
  try {
    const result = await appointmentDiscordService.processAppointmentWebhook(req.body);
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  handleAppointmentBooked
};
