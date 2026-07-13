require('dotenv').config();

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const MODEL_PRICING_PER_1M = {
  'gpt-5.5': { input: 5.00, output: 30.00 },
  'gpt-5.5-pro': { input: 30.00, output: 180.00 },
  'gpt-5.4': { input: 2.50, output: 15.00 },
  'gpt-4.1': { input: 2.00, output: 8.00 },
  'gpt-4.1-2025-04-14': { input: 2.00, output: 8.00 },
  'gpt-4.1-mini': { input: 0.40, output: 1.60 },
  'gpt-4.1-mini-2025-04-14': { input: 0.40, output: 1.60 },
  'gpt-4.1-nano': { input: 0.10, output: 0.40 },
  'gpt-4.1-nano-2025-04-14': { input: 0.10, output: 0.40 }
};

function parseArgs(argv) {
  const options = {
    model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_REPORT_MODEL || 'gpt-4.1-mini',
    detail: process.env.OPENAI_VISION_DETAIL || 'high',
    files: []
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--model') {
      options.model = argv[index + 1] || options.model;
      index += 1;
      continue;
    }
    if (arg === '--detail') {
      options.detail = argv[index + 1] || options.detail;
      index += 1;
      continue;
    }
    options.files.push(arg);
  }

  return options;
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

function imageToDataUrl(filePath) {
  const bytes = fs.readFileSync(filePath);
  return `data:${getMimeType(filePath)};base64,${bytes.toString('base64')}`;
}

function extractResponseText(responseData) {
  if (typeof responseData?.output_text === 'string' && responseData.output_text.trim()) {
    return responseData.output_text.trim();
  }

  const outputs = Array.isArray(responseData?.output) ? responseData.output : [];
  for (const item of outputs) {
    const contents = Array.isArray(item?.content) ? item.content : [];
    for (const content of contents) {
      if (typeof content?.text === 'string' && content.text.trim()) {
        return content.text.trim();
      }
    }
  }

  return '';
}

function estimateCost(model, usage = {}) {
  const pricing = MODEL_PRICING_PER_1M[model];
  if (!pricing) return null;

  const inputTokens = Number(usage.input_tokens || 0);
  const outputTokens = Number(usage.output_tokens || 0);
  return {
    input_usd: (inputTokens / 1_000_000) * pricing.input,
    output_usd: (outputTokens / 1_000_000) * pricing.output,
    total_usd: ((inputTokens / 1_000_000) * pricing.input) + ((outputTokens / 1_000_000) * pricing.output)
  };
}

async function analyzeImage(filePath, options) {
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['operation_code', 'confidence', 'needs_manual_review', 'candidates', 'payment_platform', 'visible_text_summary', 'notes'],
    properties: {
      operation_code: {
        type: 'string',
        description: 'Codigo numerico de operacion encontrado. Usar string vacio si no aparece.'
      },
      confidence: {
        type: 'string',
        enum: ['high', 'medium', 'low', 'none']
      },
      needs_manual_review: {
        type: 'boolean',
        description: 'true si algun digito esta borroso, cortado, ambiguo o si podria haber falsos positivos.'
      },
      candidates: {
        type: 'array',
        maxItems: 5,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['value', 'where_seen', 'confidence'],
          properties: {
            value: { type: 'string' },
            where_seen: { type: 'string' },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] }
          }
        }
      },
      payment_platform: {
        type: 'string',
        enum: ['mercado_pago', 'other', 'unknown']
      },
      visible_text_summary: { type: 'string' },
      notes: { type: 'string' }
    }
  };

  const payload = {
    model: options.model,
    temperature: 0,
    instructions: [
      'Extrae el codigo de operacion de comprobantes de pago o suscripcion.',
      'El codigo suele aparecer como "Operacion 123..." u "Operación 123...".',
      'No confundas el codigo de operacion con ultimos digitos de tarjeta, importe, fecha, telefono, ID de contacto, numero de cuota o codigo de producto.',
      'Si hay varios numeros, elegi el que este rotulado como operacion.',
      'No inventes ni completes digitos borrosos: si algun digito no se ve claramente, usa confidence "low" o "medium", needs_manual_review true, y agrega candidatos alternativos.',
      'Usa confidence "high" solo si todos los digitos del codigo son nitidos y legibles.',
      'Responde solo con JSON valido segun el schema.'
    ].join(' '),
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: 'Analiza esta imagen y devolve el codigo de operacion si existe.'
          },
          {
            type: 'input_image',
            image_url: imageToDataUrl(filePath),
            detail: options.detail
          }
        ]
      }
    ],
    max_output_tokens: 500,
    text: {
      format: {
        type: 'json_schema',
        name: 'comprobante_operation_code',
        strict: true,
        schema
      }
    }
  };

  const startedAt = Date.now();
  const response = await axios.post('https://api.openai.com/v1/responses', payload, {
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    timeout: 60000
  });

  const rawText = extractResponseText(response.data);
  const parsed = rawText ? JSON.parse(rawText) : null;
  const usage = response.data?.usage || {};

  return {
    file: filePath,
    model: options.model,
    detail: options.detail,
    elapsed_ms: Date.now() - startedAt,
    result: parsed,
    usage,
    estimated_cost_usd: estimateCost(options.model, usage)
  };
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Falta OPENAI_API_KEY en el entorno.');
  }

  const options = parseArgs(process.argv.slice(2));
  if (!options.files.length) {
    console.error('Uso: node scripts/test_openai_comprobante_ocr.js [--model gpt-4.1-mini] [--detail high|low|auto] imagen1.jpg imagen2.png');
    process.exit(1);
  }

  const results = [];
  for (const file of options.files) {
    const filePath = path.resolve(file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`No existe el archivo: ${filePath}`);
    }
    results.push(await analyzeImage(filePath, options));
  }

  console.log(JSON.stringify({
    ok: true,
    count: results.length,
    totals: results.reduce((acc, item) => {
      acc.input_tokens += Number(item.usage?.input_tokens || 0);
      acc.output_tokens += Number(item.usage?.output_tokens || 0);
      acc.total_tokens += Number(item.usage?.total_tokens || 0);
      acc.estimated_cost_usd += Number(item.estimated_cost_usd?.total_usd || 0);
      return acc;
    }, {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      estimated_cost_usd: 0
    }),
    results
  }, null, 2));
}

main().catch((error) => {
  const apiMessage = error?.response?.data?.error?.message || error.message;
  console.error(JSON.stringify({
    ok: false,
    message: apiMessage
  }, null, 2));
  process.exit(1);
});
