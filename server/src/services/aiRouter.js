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

module.exports = { callAI, callAIText, callAIVision, getTaskModels, getAllTaskModels };
