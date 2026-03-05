/**
 * Invoice/Receipt extraction service.
 *
 * Uses the central AI router (aiRouter.js) which:
 *   - Selects the cheapest vision-capable model automatically
 *   - Auto-falls back through cost-ordered alternatives on any error
 *   - Falls back to Gemini direct SDK if REQUESTY_API_KEY is absent
 *
 * Supported file types: JPEG, PNG, WebP, PDF
 */

const { callAIVision } = require('./aiRouter');

// ─── Extraction prompt ────────────────────────────────────────────────────────

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
 *
 * @param {Buffer} buffer    - File buffer
 * @param {string} mimeType  - MIME type (image/jpeg, image/png, image/webp, application/pdf)
 * @param {object} prisma    - Prisma client (used for Gemini-direct fallback key lookup)
 * @returns {object}           Extracted invoice data
 */
async function extractInvoiceData(buffer, mimeType, prisma) {
  const rawText = await callAIVision(INVOICE_PROMPT, buffer, mimeType, { prisma });
  return parseExtractedJson(rawText);
}

/**
 * Extract data from multiple invoices/receipts (max 3).
 * Each file is extracted independently.
 *
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
