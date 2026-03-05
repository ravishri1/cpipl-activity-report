/**
 * AI Router — centralized, cost-ordered model selection with auto-fallback.
 *
 * Provider priority:
 *   1. Requesty.ai  (REQUESTY_API_KEY in .env)
 *      → OpenAI-compatible gateway to 433+ models.
 *      → Models are tried cheapest-first per task type.
 *      → Falls back to the next model on any error.
 *   2. Gemini direct (gemini_api_key stored in Admin → Settings table)
 *      → Last resort when Requesty is not configured or all models fail.
 *      → Requires `prisma` to be passed in opts.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   const { callAI, callAIText, callAIVision } = require('./aiRouter');
 *
 *   // Text-only task
 *   const text = await callAIText('text_extraction', prompt, { prisma });
 *
 *   // Vision task (image or PDF buffer)
 *   const text = await callAIVision(prompt, buffer, mimeType, { prisma });
 *
 *   // Full control (OpenAI-format messages)
 *   const text = await callAI('classification', [
 *     { role: 'user', content: 'Classify this ticket: ...' }
 *   ], { prisma });
 *
 * All functions return: raw text string (caller handles JSON parsing, etc.)
 */

const REQUESTY_BASE = 'https://router.requesty.ai/v1/chat/completions';

// ─── Task → cost-ordered model list ──────────────────────────────────────────
//
// Each array lists models cheapest-first.
// The router tries them in sequence and stops at the first success.
// Add, remove, or reorder entries here to tune cost vs. quality per task.
//
// Model naming on Requesty: "provider/model-id"  (e.g. google/gemini-2.0-flash-001)
// All models in the list must support the capabilities required by the task type.

// ─── Image editing model list ─────────────────────────────────────────────────
//
// Models that can accept an image input and return a modified image as output.
// Used for profile photo processing (background removal, cleanup, inpainting).
// Tried in order; if no image is returned the caller falls back to sharp-only.
//
const IMAGE_EDIT_MODELS = [
  'google/gemini-2.0-flash-exp',           // Gemini experimental — supports image output
  'google/gemini-2.0-flash-001',           // standard multimodal fallback
];

const TASK_MODELS = {
  /**
   * vision_extraction — reading images / PDFs for structured data.
   * Examples: invoices, receipts, ID cards, payslips, certificates.
   * ⚠ All models in this list MUST support multimodal (image) input.
   */
  vision_extraction: [
    'google/gemini-2.0-flash-001',   // ✅ confirmed working — very cheap (~$0.000134/call)
    'google/gemini-2.5-flash-lite',  // lightweight Gemini 2.5 — likely cheapest
    'google/gemini-2.5-flash',       // mid-tier multimodal
    'openai/gpt-4o-mini',            // cheap OpenAI with vision support
    'openai/gpt-4.1-mini',           // OpenAI 4.1 mini — vision capable
    'google/gemini-2.5-pro',         // expensive; highest quality fallback
    'openai/gpt-4o',                 // last resort — expensive but reliable
  ],

  /**
   * text_extraction — parsing long text into structured data.
   * Examples: resumes, bios, policy documents, job descriptions.
   * Text-only; any model is capable.
   */
  text_extraction: [
    'google/gemini-2.5-flash-lite',  // cheapest capable Gemini
    'google/gemini-2.0-flash-001',   // ✅ confirmed working
    'openai/gpt-4.1-nano',           // ultra-cheap OpenAI
    'openai/gpt-4.1-mini',           // cheap OpenAI mid-tier
    'anthropic/claude-haiku-4-5',    // cheap Claude — good at structured extraction
    'google/gemini-2.5-flash',       // mid-tier fallback
    'anthropic/claude-sonnet-4',     // high-quality fallback
  ],

  /**
   * text_generation — writing / drafting new content.
   * Examples: HR letters, announcements, survey questions, ticket replies, wiki articles.
   */
  text_generation: [
    'google/gemini-2.5-flash-lite',
    'google/gemini-2.0-flash-001',   // ✅ confirmed working
    'openai/gpt-4.1-nano',
    'openai/gpt-4.1-mini',
    'anthropic/claude-haiku-4-5',
    'google/gemini-2.5-flash',
    'anthropic/claude-sonnet-4',     // best quality for complex generation
    'openai/gpt-4o',
  ],

  /**
   * classification — categorising, routing, labelling, sentiment.
   * Examples: ticket triage, expense categories, attendance anomaly tagging.
   * Cheap models handle classification very well.
   */
  classification: [
    'google/gemini-2.5-flash-lite',
    'google/gemini-2.0-flash-001',   // ✅ confirmed working
    'openai/gpt-4.1-nano',
    'openai/gpt-4.1-mini',
    'anthropic/claude-haiku-4-5',
    'google/gemini-2.5-flash',
  ],

  /**
   * summarization — condensing long documents into shorter form.
   * Examples: policy summaries, training content, report digests.
   */
  summarization: [
    'google/gemini-2.5-flash-lite',
    'google/gemini-2.0-flash-001',   // ✅ confirmed working
    'openai/gpt-4.1-nano',
    'openai/gpt-4.1-mini',
    'anthropic/claude-haiku-4-5',
    'google/gemini-2.5-flash',
    'anthropic/claude-sonnet-4',
  ],

  /**
   * code_analysis — code review, debugging, refactoring suggestions.
   * Uses specialised coding-optimised checkpoints where available,
   * then falls back to general high-quality models.
   */
  code_analysis: [
    'coding/gemini-2.5-flash',         // specialised coding checkpoint
    'coding/gemini-2.5-pro',           // high-quality coding checkpoint
    'coding/claude-sonnet-4-20250514', // Claude coding checkpoint
    'google/gemini-2.5-flash',         // general fallback
    'openai/gpt-4.1-mini',
    'anthropic/claude-haiku-4-5',
    'google/gemini-2.5-pro',
    'anthropic/claude-sonnet-4',
  ],
};

// ─── Requesty.ai call ─────────────────────────────────────────────────────────

async function callRequesty(model, messages) {
  const response = await fetch(REQUESTY_BASE, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${process.env.REQUESTY_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ model, messages }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => response.statusText);
    throw new Error(`[requesty/${model}] HTTP ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`[requesty/${model}] Empty response`);
  return text;
}

// ─── Gemini direct SDK call (last resort) ─────────────────────────────────────

/**
 * Convert OpenAI-format messages → Gemini SDK parts array.
 * Handles: plain text strings, text content parts, base64 image_url parts.
 */
function messagesToGeminiParts(messages) {
  const parts = [];
  for (const msg of messages) {
    const content = msg.content;
    if (typeof content === 'string') {
      parts.push(content);
    } else if (Array.isArray(content)) {
      for (const part of content) {
        if (part.type === 'text') {
          parts.push(part.text);
        } else if (part.type === 'image_url') {
          const url = part.image_url?.url ?? '';
          if (url.startsWith('data:')) {
            // data:<mimeType>;base64,<data>
            const [header, data] = url.split(',');
            const mimeType = header.replace('data:', '').replace(';base64', '');
            parts.push({ inlineData: { mimeType, data } });
          }
          // External URLs (https://) are not supported by the SDK without fetching;
          // skip silently — requesty handles them fine as image_url.
        }
      }
    }
  }
  return parts;
}

async function callGeminiDirect(messages, prisma) {
  const setting = await prisma.setting.findUnique({ where: { key: 'gemini_api_key' } });
  if (!setting?.value) {
    throw new Error(
      'No AI provider configured. ' +
      'Add REQUESTY_API_KEY to .env or set gemini_api_key in Admin → Settings.'
    );
  }

  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI  = new GoogleGenerativeAI(setting.value);
  const model  = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const parts  = messagesToGeminiParts(messages);

  let result;
  try {
    result = await model.generateContent(parts);
  } catch (err) {
    if (err.message?.includes('API_KEY_INVALID')) {
      throw new Error('Invalid Gemini API key. Check Admin → Settings.');
    }
    throw new Error('AI request failed. Please try again.');
  }

  return result.response.text();
}

// ─── Image response extractor ─────────────────────────────────────────────────

/**
 * Parse an OpenAI-compatible chat completion response and extract image data.
 * Handles multiple possible formats returned by different model providers.
 *
 * @param {object} data  - Parsed JSON response from /v1/chat/completions
 * @returns {{ buffer: Buffer, mimeType: string } | null}
 */
function extractImageFromResponse(data) {
  const message = data.choices?.[0]?.message;
  if (!message) return null;

  // Format 1: content is an array of parts (OpenAI-style multimodal output)
  if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (part.type === 'image_url' && part.image_url?.url?.startsWith('data:')) {
        const url = part.image_url.url;
        const comma = url.indexOf(',');
        const header = url.slice(0, comma);
        const b64 = url.slice(comma + 1);
        const mimeType = header.replace('data:', '').replace(';base64', '');
        return { buffer: Buffer.from(b64, 'base64'), mimeType };
      }
      // Gemini inline_data format via OpenAI-compat wrapper
      if (part.type === 'image' && part.source?.data) {
        return {
          buffer: Buffer.from(part.source.data, 'base64'),
          mimeType: part.source.media_type || 'image/png',
        };
      }
    }
  }

  // Format 2: Gemini native parts wrapper
  if (Array.isArray(message.parts)) {
    for (const part of message.parts) {
      if (part.inlineData?.data) {
        return {
          buffer: Buffer.from(part.inlineData.data, 'base64'),
          mimeType: part.inlineData.mimeType || 'image/png',
        };
      }
    }
  }

  return null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Call AI with automatic cost-ordered model selection and fallback.
 *
 * @param {string}  taskType          - One of the keys in TASK_MODELS above.
 * @param {Array}   messages          - OpenAI-format messages array.
 * @param {object}  [opts]
 * @param {object}  [opts.prisma]     - Prisma client (required for Gemini-direct fallback).
 * @param {boolean} [opts.silent]     - Suppress console logs (default: false).
 * @returns {Promise<string>}           Raw text response from the model.
 */
async function callAI(taskType, messages, { prisma, silent } = {}) {
  const models = TASK_MODELS[taskType];
  if (!models) {
    throw new Error(`aiRouter: unknown task type "${taskType}". ` +
      `Valid types: ${Object.keys(TASK_MODELS).join(', ')}`);
  }

  // ── Provider 1: Requesty.ai (cost-ordered, auto-fallback) ────────────────
  if (process.env.REQUESTY_API_KEY) {
    let lastError;
    for (const model of models) {
      try {
        const result = await callRequesty(model, messages);
        if (!silent) console.log(`[aiRouter] ✓ ${taskType} → ${model}`);
        return result;
      } catch (err) {
        if (!silent) console.warn(`[aiRouter] ✗ ${model}: ${err.message}`);
        lastError = err;
        // Continue to next model in list
      }
    }
    if (!silent) {
      console.warn(`[aiRouter] All ${models.length} requesty models failed for "${taskType}". ` +
        (prisma ? 'Trying Gemini direct…' : 'No Gemini fallback (prisma not provided).'));
    }
  }

  // ── Provider 2: Gemini direct SDK (last resort) ───────────────────────────
  if (prisma) {
    const result = await callGeminiDirect(messages, prisma);
    if (!silent) console.log(`[aiRouter] ✓ ${taskType} → gemini-direct (fallback)`);
    return result;
  }

  throw new Error(
    'No AI provider available. ' +
    'Add REQUESTY_API_KEY to .env or set gemini_api_key in Admin → Settings.'
  );
}

/**
 * Convenience wrapper: text-only AI call.
 *
 * @param {string} taskType  - Task type key (see TASK_MODELS).
 * @param {string} prompt    - Single user prompt string.
 * @param {object} [opts]    - Same options as callAI().
 * @returns {Promise<string>}
 */
async function callAIText(taskType, prompt, opts = {}) {
  return callAI(taskType, [{ role: 'user', content: prompt }], opts);
}

/**
 * Like callAI() but also returns the model name that succeeded.
 * Useful when callers need to record which model was used (e.g. error-report attribution).
 *
 * @param {string}  taskType          - One of the keys in TASK_MODELS above.
 * @param {Array}   messages          - OpenAI-format messages array.
 * @param {object}  [opts]
 * @param {object}  [opts.prisma]     - Prisma client (required for Gemini-direct fallback).
 * @param {boolean} [opts.silent]     - Suppress console logs (default: false).
 * @returns {Promise<{ text: string, model: string }>}
 */
async function callAIWithModel(taskType, messages, { prisma, silent } = {}) {
  const models = TASK_MODELS[taskType];
  if (!models) {
    throw new Error(`aiRouter: unknown task type "${taskType}". ` +
      `Valid types: ${Object.keys(TASK_MODELS).join(', ')}`);
  }

  // ── Provider 1: Requesty.ai (cost-ordered, auto-fallback) ────────────────
  if (process.env.REQUESTY_API_KEY) {
    let lastError;
    for (const model of models) {
      try {
        const text = await callRequesty(model, messages);
        if (!silent) console.log(`[aiRouter] ✓ ${taskType} → ${model}`);
        return { text, model };
      } catch (err) {
        if (!silent) console.warn(`[aiRouter] ✗ ${model}: ${err.message}`);
        lastError = err;
      }
    }
    if (!silent) {
      console.warn(`[aiRouter] All ${models.length} requesty models failed for "${taskType}". ` +
        (prisma ? 'Trying Gemini direct…' : 'No Gemini fallback (prisma not provided).'));
    }
  }

  // ── Provider 2: Gemini direct SDK (last resort) ───────────────────────────
  if (prisma) {
    const text = await callGeminiDirect(messages, prisma);
    if (!silent) console.log(`[aiRouter] ✓ ${taskType} → gemini-direct (fallback)`);
    return { text, model: 'gemini-direct' };
  }

  throw new Error(
    'No AI provider available. ' +
    'Add REQUESTY_API_KEY to .env or set gemini_api_key in Admin → Settings.'
  );
}

/**
 * Convenience wrapper: text-only AI call that also returns the model name.
 *
 * @param {string} taskType  - Task type key (see TASK_MODELS).
 * @param {string} prompt    - Single user prompt string.
 * @param {object} [opts]    - Same options as callAIWithModel().
 * @returns {Promise<{ text: string, model: string }>}
 */
async function callAITextWithModel(taskType, prompt, opts = {}) {
  return callAIWithModel(taskType, [{ role: 'user', content: prompt }], opts);
}

/**
 * Convenience wrapper: vision (image or PDF) AI call.
 * Automatically uses the 'vision_extraction' task type and cheapest vision-capable model.
 *
 * @param {string} prompt    - Instruction / question about the image.
 * @param {Buffer} buffer    - File buffer (image or PDF).
 * @param {string} mimeType  - MIME type (image/jpeg, image/png, image/webp, application/pdf).
 * @param {object} [opts]    - Same options as callAI().
 * @returns {Promise<string>}
 */
async function callAIVision(prompt, buffer, mimeType, opts = {}) {
  const base64  = buffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64}`;
  return callAI('vision_extraction', [{
    role:    'user',
    content: [
      { type: 'text',      text:      prompt },
      { type: 'image_url', image_url: { url: dataUrl } },
    ],
  }], opts);
}

/**
 * Convenience wrapper: image-editing AI call.
 * Sends an image + text prompt; expects the model to return a modified image.
 *
 * Only uses Requesty (REQUESTY_API_KEY required) — no Gemini-direct fallback
 * because the SDK doesn't expose image-output capability via a simple path.
 *
 * @param {string} prompt    - Editing instructions.
 * @param {Buffer} buffer    - Input image buffer.
 * @param {string} mimeType  - MIME type of input image.
 * @param {object} [opts]
 * @param {boolean} [opts.silent] - Suppress console logs.
 * @returns {Promise<{ buffer: Buffer, mimeType: string }>}
 * @throws {Error} if no model returned an image (caller should fall back)
 */
async function callAIImageEdit(prompt, buffer, mimeType, { silent } = {}) {
  if (!process.env.REQUESTY_API_KEY) {
    throw new Error('REQUESTY_API_KEY required for AI image editing.');
  }

  const base64  = buffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64}`;

  let lastError;
  for (const model of IMAGE_EDIT_MODELS) {
    try {
      const response = await fetch(REQUESTY_BASE, {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${process.env.REQUESTY_API_KEY}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [{
            role:    'user',
            content: [
              { type: 'text',      text:      prompt },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          }],
          // Request image output modality (Gemini image-gen models)
          modalities: ['text', 'image'],
        }),
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => response.statusText);
        throw new Error(`HTTP ${response.status}: ${errBody}`);
      }

      const data        = await response.json();
      const imageResult = extractImageFromResponse(data);

      if (!imageResult) {
        throw new Error('Model returned no image in response');
      }

      if (!silent) console.log(`[aiRouter] ✓ image_edit → ${model}`);
      return imageResult;

    } catch (err) {
      if (!silent) console.warn(`[aiRouter] ✗ image_edit ${model}: ${err.message}`);
      lastError = err;
    }
  }

  throw new Error(`AI image editing failed: ${lastError?.message ?? 'all models failed'}`);
}

/**
 * Return the model list for a given task type (for admin UI / inspection).
 * @param {string} taskType
 * @returns {string[]}
 */
function getTaskModels(taskType) {
  return TASK_MODELS[taskType] ? [...TASK_MODELS[taskType]] : [];
}

/**
 * Return all task types and their model lists (for admin UI / inspection).
 * @returns {Object}
 */
function getAllTaskModels() {
  return Object.fromEntries(
    Object.entries(TASK_MODELS).map(([k, v]) => [k, [...v]])
  );
}

module.exports = { callAI, callAIText, callAIVision, callAIImageEdit, callAIWithModel, callAITextWithModel, getTaskModels, getAllTaskModels };
