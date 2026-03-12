const { google } = require('googleapis');
const { getAuthedClientForUser } = require('./googleAuth');

// ─── Vendor Domain Patterns ───
const VENDOR_DOMAINS = [
  'amazon', 'shiprocket', 'bombino', 'dtdc', 'bluedart', 'delhivery',
  'ecom', 'flipkart', 'meesho', 'indiamart', 'justdial', 'razorpay',
  'paytm', 'phonepe', 'instamojo', 'zoho', 'freshworks', 'swiggy',
  'zomato', 'dunzo', 'shadowfax', 'xpressbees', 'ekart',
];

// ─── Government Domain Patterns ───
const GOV_DOMAINS = ['.gov.in', '.nic.in', 'gst.gov.in', 'incometax.gov.in', 'epfindia.gov.in'];

// ─── Friendly Company Names (domain fragment → display name) ───
const COMPANY_NAMES = {
  amazon: 'Amazon', shiprocket: 'Shiprocket', bombino: 'Bombino Express',
  dtdc: 'DTDC', bluedart: 'Blue Dart', delhivery: 'Delhivery',
  flipkart: 'Flipkart', meesho: 'Meesho', indiamart: 'IndiaMart',
  justdial: 'JustDial', razorpay: 'Razorpay', paytm: 'Paytm',
  phonepe: 'PhonePe', instamojo: 'Instamojo', zoho: 'Zoho',
  freshworks: 'Freshworks', swiggy: 'Swiggy', zomato: 'Zomato',
  dunzo: 'Dunzo', shadowfax: 'Shadowfax', xpressbees: 'XpressBees',
  ekart: 'Ekart', ecom: 'Ecom Express',
  'gst.gov': 'GST Portal', incometax: 'Income Tax Portal',
  epfindia: 'EPFO Portal',
};

// ─── Helper: extract email address from "Name <email>" format ───
function extractEmail(headerValue) {
  if (!headerValue) return '';
  const match = headerValue.match(/<([^>]+)>/);
  return (match ? match[1] : headerValue).trim().toLowerCase();
}

// ─── Helper: extract sender name from "Name <email>" format ───
function extractName(headerValue) {
  if (!headerValue) return '';
  const match = headerValue.match(/^([^<]+)</);
  return match ? match[1].trim().replace(/"/g, '') : '';
}

// ─── Helper: get domain from email address ───
function getDomain(email) {
  const parts = email.split('@');
  return parts.length > 1 ? parts[1].toLowerCase() : '';
}

// ─── Categorize an email address ───
function categorizeEmail(emailAddress, workspaceDomain) {
  const domain = getDomain(emailAddress);
  if (!domain) return 'other';

  // Internal: same workspace domain
  if (domain === workspaceDomain) return 'internal';

  // Government
  if (GOV_DOMAINS.some(g => domain.includes(g.replace(/^\./, '')))) return 'government';

  // Vendor
  if (VENDOR_DOMAINS.some(v => domain.includes(v))) return 'vendor';

  return 'other';
}

// ─── Extract human-readable company name from email ───
function extractCompanyName(emailAddress, senderName, category) {
  const domain = getDomain(emailAddress);

  // Internal: use sender's first name
  if (category === 'internal') {
    if (senderName) {
      const firstName = senderName.split(' ')[0];
      return firstName.charAt(0).toUpperCase() + firstName.slice(1);
    }
    return emailAddress.split('@')[0];
  }

  // Known vendor/gov
  for (const [fragment, name] of Object.entries(COMPANY_NAMES)) {
    if (domain.includes(fragment)) return name;
  }

  // Government fallback
  if (category === 'government') {
    // e.g. gst.gov.in → "GST Gov"
    const sub = domain.split('.')[0];
    return sub.toUpperCase() + ' Gov';
  }

  // Other: capitalize first part of domain
  const domainName = domain.split('.')[0];
  return domainName.charAt(0).toUpperCase() + domainName.slice(1);
}

// ─── Fetch today's emails (sent + received) via Gmail API ───
async function fetchTodayEmails(oauth2Client, userEmail, targetDate) {
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Build date range: targetDate 00:00 → targetDate+1 00:00
  const afterDate = targetDate.replace(/-/g, '/');
  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);
  const beforeDate = nextDay.toISOString().split('T')[0].replace(/-/g, '/');

  // Fetch sent + received in parallel
  const [sentRes, receivedRes] = await Promise.all([
    gmail.users.messages.list({
      userId: 'me',
      q: `in:sent after:${afterDate} before:${beforeDate}`,
      maxResults: 100,
    }),
    gmail.users.messages.list({
      userId: 'me',
      q: `in:inbox after:${afterDate} before:${beforeDate}`,
      maxResults: 100,
    }),
  ]);

  const sentIds = (sentRes.data.messages || []).map(m => m.id);
  const receivedIds = (receivedRes.data.messages || []).map(m => m.id);

  // Deduplicate message IDs (a message can appear in both sent and inbox)
  const allIds = [...new Set([...sentIds, ...receivedIds])];
  if (allIds.length === 0) return [];

  // Batch fetch message metadata (headers only — no body)
  const messages = await Promise.all(
    allIds.map(id =>
      gmail.users.messages.get({
        userId: 'me',
        id,
        format: 'metadata',
        metadataHeaders: ['From', 'To', 'Subject', 'Date'],
      }).then(res => res.data)
    )
  );

  const sentIdSet = new Set(sentIds);
  const userEmailLower = userEmail.toLowerCase();

  return messages.map(msg => {
    const headers = {};
    (msg.payload?.headers || []).forEach(h => {
      headers[h.name.toLowerCase()] = h.value;
    });

    const fromEmail = extractEmail(headers.from || '');
    const fromName = extractName(headers.from || '');
    const toEmail = extractEmail(headers.to || '');
    const isSent = sentIdSet.has(msg.id) || fromEmail === userEmailLower;

    // Determine the "other party" email (the one that isn't the user)
    const otherEmail = isSent ? toEmail : fromEmail;
    const otherName = isSent ? '' : fromName;

    return {
      id: msg.id,
      threadId: msg.threadId,
      subject: headers.subject || '(no subject)',
      from: fromEmail,
      fromName,
      to: toEmail,
      otherEmail,
      otherName,
      date: headers.date || '',
      isSent,
      timestamp: parseInt(msg.internalDate || '0', 10),
    };
  });
}

// ─── Group emails by company domain, then by thread ───
function groupByCompanyAndThread(emails, userEmail, workspaceDomain) {
  const userEmailLower = userEmail.toLowerCase();
  const domain = workspaceDomain || process.env.GOOGLE_WORKSPACE_DOMAIN?.trim() || 'colorpapers.in';

  // Step 1: Group by threadId
  const threadMap = new Map(); // threadId → { emails[], subject, ... }
  for (const email of emails) {
    if (!threadMap.has(email.threadId)) {
      threadMap.set(email.threadId, {
        threadId: email.threadId,
        subject: email.subject,
        emails: [],
        sentCount: 0,
        receivedCount: 0,
        replied: false,
        latestTimestamp: 0,
        otherEmail: email.otherEmail,
        otherName: email.otherName,
      });
    }
    const thread = threadMap.get(email.threadId);
    thread.emails.push(email);

    if (email.isSent) {
      thread.sentCount++;
      thread.replied = true; // User sent at least one message in this thread
    } else {
      thread.receivedCount++;
    }

    if (email.timestamp > thread.latestTimestamp) {
      thread.latestTimestamp = email.timestamp;
      // Update subject to latest if different
      if (email.subject && email.subject !== '(no subject)') {
        thread.subject = email.subject;
      }
    }

    // Track the non-user email for categorization
    if (email.otherEmail && email.otherEmail !== userEmailLower) {
      thread.otherEmail = email.otherEmail;
      if (email.otherName) thread.otherName = email.otherName;
    }
  }

  // Step 2: Group threads by company domain
  const companyMap = new Map(); // domain → { company, threads[], ... }
  for (const thread of threadMap.values()) {
    const otherDomain = getDomain(thread.otherEmail);
    const category = categorizeEmail(thread.otherEmail, domain);
    const companyName = extractCompanyName(thread.otherEmail, thread.otherName, category);

    // Key = domain for external, or email for internal (each person is a "company")
    const groupKey = category === 'internal' ? thread.otherEmail : otherDomain;

    if (!companyMap.has(groupKey)) {
      companyMap.set(groupKey, {
        company: companyName,
        domain: otherDomain,
        category,
        totalEmails: 0,
        threads: [],
      });
    }
    const group = companyMap.get(groupKey);
    group.threads.push({
      threadId: thread.threadId,
      subject: cleanSubject(thread.subject),
      emailCount: thread.emails.length,
      sentCount: thread.sentCount,
      receivedCount: thread.receivedCount,
      replied: thread.replied,
      latestTimestamp: thread.latestTimestamp,
    });
    group.totalEmails += thread.emails.length;
  }

  // Sort: most emails first, then alphabetically
  const companies = Array.from(companyMap.values())
    .sort((a, b) => b.totalEmails - a.totalEmails || a.company.localeCompare(b.company));

  // Sort threads within each company: unreplied first, then by timestamp desc
  for (const company of companies) {
    company.threads.sort((a, b) => {
      if (a.replied !== b.replied) return a.replied ? 1 : -1; // unreplied first
      return b.latestTimestamp - a.latestTimestamp;
    });
  }

  return companies;
}

// ─── Clean up email subject (remove Re:, Fwd:, etc.) ───
function cleanSubject(subject) {
  return (subject || '(no subject)')
    .replace(/^(re|fwd|fw):\s*/gi, '')
    .replace(/^(re|fwd|fw):\s*/gi, '') // handle double Re: Re:
    .trim() || '(no subject)';
}

// ─── Build complete email summary for a user ───
async function buildEmailSummary(userId, prisma, targetDate) {
  const { getAuthedClientForUser } = require('./googleAuth');
  const oauth2Client = await getAuthedClientForUser(userId, prisma);
  const domain = process.env.GOOGLE_WORKSPACE_DOMAIN?.trim() || 'colorpapers.in';

  // Get user email
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) throw new Error('User not found');

  const emails = await fetchTodayEmails(oauth2Client, user.email, targetDate);
  if (emails.length === 0) {
    return {
      companies: [],
      unrepliedThreads: [],
      stats: {
        totalSent: 0, totalReceived: 0, totalThreads: 0, totalUnreplied: 0,
        byCategory: { internal: 0, vendor: 0, government: 0, other: 0 },
        uniqueCompanies: 0,
      },
    };
  }

  const companies = groupByCompanyAndThread(emails, user.email, domain);

  // Build flat unreplied list
  const unrepliedThreads = [];
  const stats = {
    totalSent: 0, totalReceived: 0, totalThreads: 0, totalUnreplied: 0,
    byCategory: { internal: 0, vendor: 0, government: 0, other: 0 },
    uniqueCompanies: companies.length,
  };

  for (const company of companies) {
    stats.byCategory[company.category] = (stats.byCategory[company.category] || 0) + company.threads.length;

    for (const thread of company.threads) {
      stats.totalSent += thread.sentCount;
      stats.totalReceived += thread.receivedCount;
      stats.totalThreads++;

      if (!thread.replied) {
        stats.totalUnreplied++;
        unrepliedThreads.push({
          ...thread,
          company: company.company,
          category: company.category,
          domain: company.domain,
        });
      }
    }
  }

  // Cap subjects per company to 5 for payload optimization
  for (const company of companies) {
    if (company.threads.length > 5) {
      company.hiddenCount = company.threads.length - 5;
      company.threads = company.threads.slice(0, 5);
    }
  }

  return { companies, unrepliedThreads, stats };
}

// ─── Filter out handled threads from email summary ───
function filterHandledThreads(emailSummary, handledThreadIds) {
  if (!emailSummary || !handledThreadIds || handledThreadIds.size === 0) return emailSummary;

  // Filter threads from companies
  const companies = emailSummary.companies
    .map(company => ({
      ...company,
      threads: company.threads.filter(t => !handledThreadIds.has(t.threadId)),
    }))
    .map(company => ({
      ...company,
      totalEmails: company.threads.reduce((sum, t) => sum + t.emailCount, 0),
    }))
    .filter(company => company.threads.length > 0);

  // Filter unreplied threads
  const unrepliedThreads = emailSummary.unrepliedThreads.filter(
    t => !handledThreadIds.has(t.threadId)
  );

  // Recalculate stats
  const stats = {
    totalSent: 0, totalReceived: 0, totalThreads: 0, totalUnreplied: 0,
    byCategory: { internal: 0, vendor: 0, government: 0, other: 0 },
    uniqueCompanies: companies.length,
  };

  for (const company of companies) {
    stats.byCategory[company.category] = (stats.byCategory[company.category] || 0) + company.threads.length;
    for (const thread of company.threads) {
      stats.totalSent += thread.sentCount;
      stats.totalReceived += thread.receivedCount;
      stats.totalThreads++;
      if (!thread.replied) stats.totalUnreplied++;
    }
  }

  return { companies, unrepliedThreads, stats };
}

module.exports = {
  fetchTodayEmails,
  groupByCompanyAndThread,
  buildEmailSummary,
  filterHandledThreads,
  categorizeEmail,
  extractCompanyName,
  cleanSubject,
};
