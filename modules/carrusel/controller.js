const service = require('./service');

function health(req, res) {
  res.json({ ok: true, service: 'carrusel-studio' });
}

function parseOptions(body = {}) {
  return {
    slides: body.slides,
    brand: body.brand,
    audience: body.audience,
    visualStyle: body.visualStyle,
    cta: body.cta,
    aspect: body.aspect,
    promptOverrides: body.promptOverrides
  };
}

async function chat(req, res, next) {
  try {
    const userPrompt = String(req.body?.prompt || '').trim();
    if (!userPrompt) {
      return res.status(400).json({ ok: false, message: 'Mandame un prompt para arrancar.' });
    }

    const options = parseOptions(req.body || {});
    const prompts = service.buildSlidePrompts(userPrompt, options);
    const answer = service.buildAssistantAnswer(userPrompt, prompts, options);

    res.json({ ok: true, answer, prompts });
  } catch (error) {
    next(error);
  }
}

async function generate(req, res, next) {
  try {
    const userPrompt = String(req.body?.prompt || '').trim();
    if (!userPrompt) {
      return res.status(400).json({ ok: false, message: 'Mandame un prompt antes de generar.' });
    }

    const result = await service.generateCarousel(userPrompt, parseOptions(req.body || {}));
    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  health,
  chat,
  generate
};
