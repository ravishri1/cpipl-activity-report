/**
 * Invoice/Receipt extraction service using Gemini 2.0 Flash Vision API.
 * Supports images (JPEG, PNG, WebP) and PDFs.
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

/**
 * Extract structured data from a single invoice/receipt image or PDF.
 * @param {Buffer} buffer - File buffer
 * @param {string} mimeType - MIME type (image/jpeg, image/png, image/webp, application/pdf)
 * @param {object} prisma - Prisma client
 * @returns {object} Extracted invoice data
 */
async function extractInvoiceData(buffer, mimeType, prisma) {
  const setting = await prisma.setting.findUnique({ where: { key: 'gemini_api_key' } });
  if (!setting?.value) {
    throw new Error('Gemini API key not configured. Go to Admin → Settings to add it.');
  }

  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(setting.value);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  let result;
  try {
    result = await model.generateContent([
      INVOICE_PROMPT,
      { inlineData: { mimeType, data: buffer.toString('base64') } },
    ]);
  } catch (aiErr) {
    if (aiErr.message?.includes('API_KEY_INVALID')) {
      throw new Error('Invalid Gemini API key. Check Settings.');
    }
    throw new Error('AI extraction failed. Please try again.');
  }

  // Parse JSON from response (handle markdown code blocks)
  let cleaned = result.response.text().trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();

  let extracted;
  try {
    extracted = JSON.parse(cleaned);
  } catch {
    throw new Error('AI returned invalid format. Please try again.');
  }

  // Normalize amount to number
  if (typeof extracted.amount === 'string') {
    extracted.amount = parseFloat(extracted.amount.replace(/[^0-9.]/g, '')) || 0;
  }

  return extracted;
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
