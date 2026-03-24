const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const OUTPUT_DIR = path.join(process.cwd(), 'public', 'carrusel-studio', 'generated');
const PUBLIC_PREFIX = '/carrusel-studio/generated';

function timestampTag() {
  const now = new Date();
  return now.toISOString().replace(/[-:T]/g, '').slice(0, 12);
}

function normalizeAspect(aspect) {
  if (aspect === 'square') return { size: '1024x1024', label: '1:1' };
  if (aspect === 'portrait') return { size: '1024x1536', label: '4:5' };
  return { size: '1536x1024', label: '3:2' };
}

function buildSlidePrompts(userPrompt, options = {}) {
  const brand = String(options.brand || '').trim();
  const audience = String(options.audience || '').trim();
  const visualStyle = String(options.visualStyle || '').trim();
  const cta = String(options.cta || '').trim();
  const slides = Math.max(1, Math.min(Number(options.slides || 4), 8));

  const shared = [
    'Editorial advertising image for a social media carousel.',
    userPrompt,
    brand ? `Brand context: ${brand}.` : '',
    audience ? `Target audience: ${audience}.` : '',
    visualStyle ? `Visual direction: ${visualStyle}.` : '',
    'No text overlay, no watermark, no logo lockup, no UI screenshot.',
    'High contrast composition, clean focal point, premium art direction.',
    'Keep the same campaign universe and visual consistency across all slides.'
  ].filter(Boolean).join(' ');

  const beats = [
    'Slide 1: hook image, striking hero composition that stops the scroll.',
    'Slide 2: problem tension, show the pain point or conflict in a visual way.',
    'Slide 3: transformation, show momentum, relief, progress or solution.',
    cta
      ? `Slide 4: conversion frame inspired by this CTA: ${cta}. Make it aspirational and action-oriented without text overlay.`
      : 'Slide 4: conversion frame, aspirational outcome and strong buying energy without text overlay.',
    'Slide 5: social proof atmosphere, believable success and confidence.',
    'Slide 6: objection handling frame, clarity, trust and simplicity.',
    'Slide 7: urgency frame, decisive momentum and sharp visual contrast.',
    'Slide 8: closing frame, premium final image with memorable brand energy.'
  ];

  return Array.from({ length: slides }, (_, index) => ({
    index: index + 1,
    prompt: `${shared} ${beats[index] || beats[beats.length - 1]}`
  }));
}

function buildAssistantAnswer(userPrompt, prompts, options = {}) {
  const aspect = normalizeAspect(options.aspect);
  return [
    `Te armé ${prompts.length} prompts de carrusel en formato ${aspect.label}.`,
    'La lógica que usé fue: hook, tensión, transformación y cierre comercial.',
    'Podés editar cada slide antes de generar si querés empujar más lujo, más urgencia o más claridad visual.'
  ].join(' ');
}

async function ensureOutputDir() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

async function saveBase64Image(base64, filename) {
  await ensureOutputDir();
  const filePath = path.join(OUTPUT_DIR, filename);
  await fs.writeFile(filePath, Buffer.from(base64, 'base64'));
  return `${PUBLIC_PREFIX}/${filename}`;
}

async function generateImageWithOpenAI(prompt, options = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error('Falta OPENAI_API_KEY para generar imágenes.');
    error.statusCode = 400;
    throw error;
  }

  const aspect = normalizeAspect(options.aspect);
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
      prompt,
      size: aspect.size,
      quality: 'high'
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || `OpenAI Images API error ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }

  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) {
    const error = new Error('La API no devolvió imagen en base64.');
    error.statusCode = 502;
    throw error;
  }

  const filename = `slide-${timestampTag()}-${crypto.randomUUID().slice(0, 8)}.png`;
  const url = await saveBase64Image(b64, filename);
  return { url, filename };
}

async function generateCarousel(userPrompt, options = {}) {
  const promptOverrides = Array.isArray(options.promptOverrides) ? options.promptOverrides : null;
  const prompts = promptOverrides && promptOverrides.length
    ? promptOverrides.map((item, index) => ({ index: Number(item.index || index + 1), prompt: String(item.prompt || '').trim() })).filter((item) => item.prompt)
    : buildSlidePrompts(userPrompt, options);

  const images = [];
  for (const item of prompts) {
    const image = await generateImageWithOpenAI(item.prompt, options);
    images.push({ slide: item.index, prompt: item.prompt, ...image });
  }

  return { prompts, images };
}

module.exports = {
  buildSlidePrompts,
  buildAssistantAnswer,
  generateCarousel
};
