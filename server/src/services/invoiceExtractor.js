/**
 * Invoice/Receipt extraction service.
 *
 * Provider priority:
 *   1. Requesty.ai  — REQUESTY_API_KEY in .env (OpenAI-compatible, no extra package needed)
 *   2. Gemini direct — gemini_api_key stored in Admin → Settings table
 *
 * Supported file types: JPEG, PNG, WebP, PDF (PDF best supported via Gemini fallback)
 */

const INVOICE_PROMPT = `You are an invoice/receipt data extraction assistant.
Extract information from this receipt/bill/invoice and return ONLY a valid JSON object.
If a field is not visible or not applicable, use null.
For amount, return a number (not string). For date, use YYYY-MM-DD format.
Map category to one of: food, travel, medical, office, other.

Return this exact JSON structure:
{
  "vendor": "Store or company name",
  "amount": 1234.56,
  "date": "YYYY-MM-DD",
  "category": "food|travel|medical|office|other",
  "description": "Brief 1-line summary of the purchase",
  "items": [{ "name": "Item name", "quantity": 1, "amount": 100.00 }],
  "gstNumber": "GST number if visible or null",
  "invoiceNumber": "Invoice/bill number if visible or null",
  "currency": "INR"
}`;

// ─── Provider 1: Requesty.ai (OpenAI-compatible, uses native fetch) ───────────

async function extractWithRequesty(buffer, mimeType) {
  const base64  = buffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const response = await fetch('https://router.requesty.ai/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${process.env.REQUESTY_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model:    'google/gemini-2.0-flash',
      messages: [{
        role:    'user',
        content: [
          { type: 'text',      text:      INVOICE_PROMPT },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      }],
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => response.statusText);
    throw new Error(`Requesty API error ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}

// ─── Provider 2: Google Gemini direct (key from Settings table) ───────────────

async function extractWithGemini(buffer, mimeType, prisma) {
  const setting = await prisma.setting.findUnique({ where: { key: 'gemini_api_key' } });
  if (!setting?.value) {
    throw new Error(
      'No extraction API configured. Add REQUESTY_API_KEY to .env or set gemini_api_key in Admin → Settings.'
    );
  }

  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI  = new GoogleGenerativeAI(setting.value);
  const model  = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  let result;
  try {
    result = await model.generateContent([
      INVOICE_PROMPT,
      { inlineData: { mimeType, data: buffer.toString('base64') } },
    ]);
  } catch (aiErr) {
    if (aiErr.message?.includes('API_KEY_INVALID')) {
      throw new Error('Invalid Gemini API key. Check Admin → Settings.');
    }
    throw new Error('AI extraction failed. Please try again.');
  }

  return result.response.text();
}

// ─── JSON parser (shared) ─────────────────────────────────────────────────────

function parseExtractedJson(rawText) {
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```'))  cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```'))         cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();

  let extracted;
  try {
    extracted = JSON.parse(cleaned);
  } catch {
    throw new Error('AI returned invalid format. Please try again.');
  }

  // Normalise amount to number
  if (typeof extracted.amount === 'string') {
    extracted.amount = parseFloat(extracted.amount.replace(/[^0-9.]/g, '')) || 0;
  }

  return extracted;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extract structured data from a single invoice/receipt image or PDF.
 * @param {Buffer} buffer    - File buffer
 * @param {string} mimeType  - MIME type (image/jpeg, image/png, image/webp, application/pdf)
 * @param {object} prisma    - Prisma client (used only for Gemini fallback)
 * @returns {object}         Extracted invoice data
 */
async function extractInvoiceData(buffer, mimeType, prisma) {
  let rawText;

  if (process.env.REQUESTY_API_KEY) {
    // PDFs sent as data URLs may not render in all vision models;
    // if requesty fails for a PDF, it falls through to Gemini.
    try {
      rawText = await extractWithRequesty(buffer, mimeType);
    } catch (err) {
      if (mimeType === 'application/pdf') {
        // Gemini handles PDFs natively — try it as fallback
        rawText = await extractWithGemini(buffer, mimeType, prisma);
      } else {
        throw err;
      }
    }
  } else {
    rawText = await extractWithGemini(buffer, mimeType, prisma);
  }

  return parseExtractedJson(rawText);
}

/**
 * Extract data from multiple invoices/receipts (max 3).
 * Each file is extracted independently.
 * @param {Array<{ buffer: Buffer, mimeType: string, originalname: string }>} files
 * @param {object} prisma - Prisma client
 * @returns {Array<{ fileName: string, extracted: object|null, error: string|null }>}
 */
async function extractMultipleInvoices(files, prisma) {
  const results = [];

  for (const file of files) {
    try {
      const extracted = await extractInvoiceData(file.buffer, file.mimeType, prisma);
      results.push({ fileName: file.originalname, extracted, error: null });
    } catch (err) {
      results.push({ fileName: file.originalname, extracted: null, error: err.message });
    }
  }

  return results;
}

module.exports = { extractInvoiceData, extractMultipleInvoices };
