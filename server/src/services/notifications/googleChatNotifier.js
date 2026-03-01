/**
 * Google Chat Notification Service
 * Sends reminders and summaries to a Google Chat space via webhook.
 *
 * Setup: Create an incoming webhook in a Google Chat space,
 * then set GOOGLE_CHAT_WEBHOOK_URL in .env
 */

const WEBHOOK_URL = process.env.GOOGLE_CHAT_WEBHOOK_URL;

async function sendChatMessage(text) {
  if (!WEBHOOK_URL) return;

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) {
      console.error(`[CHAT] Webhook failed: ${response.status} ${response.statusText}`);
    }
  } catch (err) {
    console.error('[CHAT] Webhook error:', err.message);
  }
}

/**
 * Send reminder notification to Google Chat space
 */
async function sendChatReminder(nonReporters, date) {
  if (!WEBHOOK_URL || nonReporters.length === 0) return;

  const names = nonReporters.map((m) => m.name).join(', ');
  const text =
    `📋 *EOD Report Reminder* (${date})\n\n` +
    `${nonReporters.length} member(s) haven't submitted their report yet:\n` +
    `${names}\n\n` +
    `Please submit your daily report as soon as possible.`;

  await sendChatMessage(text);
}

/**
 * Send escalation notification to Google Chat space
 */
async function sendChatEscalation(stillPending, date) {
  if (!WEBHOOK_URL || stillPending.length === 0) return;

  const names = stillPending.map((r) => r.user?.name || r.name || 'Unknown').join(', ');
  const text =
    `⚠️ *Escalation Alert* (${date})\n\n` +
    `${stillPending.length} member(s) ignored yesterday's reminder and still haven't submitted:\n` +
    `${names}\n\n` +
    `This has been escalated to the team lead.`;

  await sendChatMessage(text);
}

/**
 * Send daily summary to Google Chat space
 */
async function sendChatSummary(date, summary) {
  if (!WEBHOOK_URL) return;

  const text =
    `📊 *Daily Report Summary* (${date})\n\n` +
    `✅ Reported: ${summary.totalReported}\n` +
    `❌ Not Reported: ${summary.totalNotReported}\n` +
    `⚠️ Ignored Reminder: ${summary.totalIgnored}\n\n` +
    (summary.reported.length > 0
      ? `*Submitted:* ${summary.reported.map((r) => r.name).join(', ')}\n`
      : '') +
    (summary.notReported.length > 0
      ? `*Pending:* ${summary.notReported.map((r) => r.name).join(', ')}\n`
      : '') +
    (summary.ignoredReminder.length > 0
      ? `*Escalated:* ${summary.ignoredReminder.map((r) => r.name).join(', ')}\n`
      : '');

  await sendChatMessage(text);
}

module.exports = {
  sendChatMessage,
  sendChatReminder,
  sendChatEscalation,
  sendChatSummary,
};
