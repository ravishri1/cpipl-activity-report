/**
 * Profile Photo Processing Service
 *
 * Pipeline:
 *   1. AI image editing  — background removal, cleanup, optional glasses/cap removal for males
 *   2. Sharp post-processing — resize to 600×800, flatten to white bg, JPEG compression
 *
 * If AI editing fails for any reason the pipeline still runs sharp post-processing
 * on the original image, so the caller always gets a cleaned/resized result.
 */

const { callAIImageEdit } = require('./aiRouter');

// ─── AI prompt builder ────────────────────────────────────────────────────────

function buildEditingPrompt(gender) {
  let prompt =
    'You are a professional headshot photo editor. Edit this photo to:\n' +
    '1. Remove the background and replace it with a solid plain white background.\n' +
    '2. Frame the subject as a professional portrait headshot (head and shoulders, 3:4 aspect ratio).\n' +
    '3. Gently enhance the image: improve brightness, contrast, and sharpness.\n' +
    '4. Keep the person\'s face, skin tone, and natural appearance exactly intact.\n';

  if (gender === 'male') {
    prompt +=
      '5. Remove any glasses or sunglasses from the person\'s face — inpaint the eyes naturally.\n' +
      '6. Remove any cap, hat, or headwear — reveal the natural hair/head beneath.\n';
  }

  prompt +=
    'Return ONLY the edited image with no text, explanation, or watermark.';

  return prompt;
}

// ─── Sharp fallback processor ─────────────────────────────────────────────────

async function sharpProcess(buffer) {
  const sharp = require('sharp');
  return sharp(buffer)
    .rotate()                                              // auto-fix EXIF orientation
    .resize(600, 800, { fit: 'cover', position: 'top' })  // crop to headshot 3:4
    .flatten({ background: { r: 255, g: 255, b: 255 } }) // transparent → white
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Process a profile photo through the AI edit → sharp pipeline.
 *
 * @param {Buffer} buffer    - Raw image buffer (any format sharp supports)
 * @param {string} mimeType  - Source MIME type (image/jpeg, image/png, image/webp, …)
 * @param {object} [opts]
 * @param {string|null} [opts.gender]  - 'male' | 'female' | null — drives AI prompt
 * @returns {Promise<{ buffer: Buffer, mimeType: 'image/jpeg' }>}
 */
async function processProfilePhoto(buffer, mimeType, { gender = null } = {}) {
  let workBuffer = buffer;

  // ── Step 1: AI image editing (best-effort) ────────────────────────────────
  try {
    const prompt = buildEditingPrompt(gender);
    const result = await callAIImageEdit(prompt, buffer, mimeType);
    workBuffer = result.buffer;
    console.log('[photoProcessor] AI editing succeeded');
  } catch (err) {
    console.warn('[photoProcessor] AI editing skipped (fallback to sharp):', err.message);
    // workBuffer stays as original — sharp will still clean/resize it
  }

  // ── Step 2: Sharp post-processing (always runs) ───────────────────────────
  try {
    const processed = await sharpProcess(workBuffer);
    return { buffer: processed, mimeType: 'image/jpeg' };
  } catch (sharpErr) {
    console.warn('[photoProcessor] sharp processing failed:', sharpErr.message);
    // Absolute last resort: return original untouched
    return { buffer, mimeType };
  }
}

module.exports = { processProfilePhoto };
