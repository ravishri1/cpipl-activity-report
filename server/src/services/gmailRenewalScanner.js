/**
 * Gmail Renewal Scanner
 * Scans ALL mail (not just inbox) for renewal/subscription emails,
 * extracts data via Gemini AI, and saves pending scans for admin review.
 * Spam and Trash are always skipped.
 */

const { google } = require('googleapis');

// ─── Gmail OAuth2 client ──────────────────────────────────────────────────────

async function getGmailClient(prisma, userId) {
  const token = await prisma.googleToken.findUnique({ where: { userId } });
  if (!token) {
    throw new Error('No Google token found for this user. Please reconnect via Settings → Google Integration.');
  }

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
  oauth2.setCredentials({
    access_token:  token.accessToken,
    refresh_token: token.refreshToken,
  });

  return google.gmail({ version: 'v1', auth: oauth2 });
}

// ─── Email body extraction ────────────────────────────────────────────────────

function getHeader(headers, name) {
  const h = (headers || []).find(h => h.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : '';
}

function decodeBase64(data) {
  if (!data) return '';
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

function extractBody(payload) {
  if (!payload) return '';

  // Plain text preferred
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64(payload.body.data);
  }

  // HTML fallback
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return decodeBase64(payload.body.data).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  }

  // Multipart — recurse into parts
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractBody(part);
      if (text) return text;
    }
  }

  return '';
}

// ─── Gemini extraction ────────────────────────────────────────────────────────

async function extractRenewalDataWithGemini(subject, sender, body, prisma) {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: 'google_generative_ai_api_key' },
    });
    if (!setting?.value) return { isRenewal: false, reason: 'No Gemini API key configured' };

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(setting.value);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `Analyze this email and determine if it is related to a software subscription, service renewal, domain renewal, invoice, billing notice, or payment confirmation.

Subject: ${subject}
From: ${sender}
Body (first 2000 chars): ${body.slice(0, 2000)}

Respond ONLY with a JSON object (no markdown, no explanation):
{
  "isRenewal": true or false,
  "vendor": "company/service name or null",
  "itemName": "specific product/service name or null",
  "amount": number or null,
  "currency": "INR" or "USD" or null,
  "renewalDate": "YYYY-MM-DD" or null,
  "billingCycle": "monthly" or "yearly" or "quarterly" or "one_time" or null,
  "confidence": 0 to 100
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim().replace(/```json|```/g, '').trim();

    const parsed = JSON.parse(text);
    return parsed;
  } catch (err) {
    console.error('[GmailScanner] Gemini extraction error:', err.message);
    return { isRenewal: false, reason: err.message };
  }
}

// ─── Main scanner ─────────────────────────────────────────────────────────────

async function scanAllMailForRenewals(prisma, adminUserId) {
  const results = { scanned: 0, newFound: 0, alreadyProcessed: 0, errors: [] };

  let gmail;
  try {
    gmail = await getGmailClient(prisma, adminUserId);
  } catch (err) {
    throw err; // Surface to route handler
  }

  // Search for renewal-related emails in last 60 days
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const afterDate = sixtyDaysAgo.toISOString().slice(0, 10).replace(/-/g, '/');

  // Search ALL mail (no labelIds = all folders: Primary, Promotions, Updates, Forwarded, etc.)
  // -in:spam -in:trash skips junk — everything else is fair game
  const searchQuery = `(renewal OR subscription OR invoice OR billing OR "payment due" OR "expires" OR "auto-renew" OR "renewal notice") after:${afterDate} -in:spam -in:trash`;

  let messages = [];
  try {
    // Paginate through all results — maxResults 500 per page (Gmail API limit)
    let pageToken = undefined;
    do {
      const res = await gmail.users.messages.list({
        userId:           'me',
        q:                searchQuery,
        maxResults:       500,
        includeSpamTrash: false, // belt-and-suspenders: explicit exclusion
        ...(pageToken ? { pageToken } : {}),
      });
      messages = messages.concat(res.data.messages || []);
      pageToken = res.data.nextPageToken;
    } while (pageToken);
  } catch (err) {
    console.error('[GmailScanner] Gmail list error:', err.message);
    results.errors.push(`Gmail API error: ${err.message}`);
    return results;
  }

  for (const msg of messages) {
    results.scanned++;
    try {
      // Check if already processed
      const existing = await prisma.emailRenewalScan.findUnique({
        where: { gmailMessageId: msg.id },
      });
      if (existing) {
        results.alreadyProcessed++;
        continue;
      }

      // Fetch full message
      const full = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full',
      });

      const headers    = full.data.payload?.headers || [];
      const subject    = getHeader(headers, 'Subject') || '(no subject)';
      const sender     = getHeader(headers, 'From') || '';
      const body       = extractBody(full.data.payload);
      const receivedAt = new Date(parseInt(full.data.internalDate));

      // Extract renewal data via Gemini
      const extracted = await extractRenewalDataWithGemini(subject, sender, body, prisma);

      // Only save if it looks like a renewal/billing email
      if (!extracted.isRenewal) continue;

      await prisma.emailRenewalScan.create({
        data: {
          gmailMessageId: msg.id,
          subject,
          sender,
          receivedAt,
          extractedData:  JSON.stringify(extracted),
          status:         'pending',
        },
      });
      results.newFound++;

    } catch (err) {
      console.error(`[GmailScanner] Error processing message ${msg.id}:`, err.message);
      results.errors.push(`Message ${msg.id}: ${err.message}`);
    }
  }

  console.log(`[GmailScanner] Scan complete:`, results);
  return results;
}

module.exports = { scanAllMailForRenewals };
