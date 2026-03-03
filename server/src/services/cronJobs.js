const cron = require('node-cron');
const { runFirstReminder, runEscalation } = require('./notifications/reminderService');
const { fetchAndStoreEmailActivity } = require('./google/googleWorkspace');
const { fetchAndStoreChatActivity } = require('./google/googleChat');
const { runHibernationCheck } = require('./hibernation');

function initCronJobs(prisma) {
  const reminderHour = process.env.REMINDER_TIME_HOUR || 21;
  const reminderMinute = process.env.REMINDER_TIME_MINUTE || 0;
  const escalationHour = process.env.ESCALATION_TIME_HOUR || 11;
  const escalationMinute = process.env.ESCALATION_TIME_MINUTE || 0;

  // First reminder: 9:00 PM daily (Mon-Sat)
  const reminderCron = `${reminderMinute} ${reminderHour} * * 1-6`;
  cron.schedule(reminderCron, async () => {
    console.log(`[CRON] First reminder triggered at ${new Date().toLocaleString()}`);
    try {
      await runFirstReminder(prisma);
    } catch (err) {
      console.error('[CRON] First reminder failed:', err);
    }
  });
  console.log(`  -> First reminder scheduled: ${reminderCron} (${reminderHour}:${String(reminderMinute).padStart(2, '0')} Mon-Sat)`);

  // Escalation: 11:00 AM next morning (Mon-Sat)
  const escalationCron = `${escalationMinute} ${escalationHour} * * 1-6`;
  cron.schedule(escalationCron, async () => {
    console.log(`[CRON] Escalation triggered at ${new Date().toLocaleString()}`);
    try {
      await runEscalation(prisma);
    } catch (err) {
      console.error('[CRON] Escalation failed:', err);
    }
  });
  console.log(`  -> Escalation scheduled: ${escalationCron} (${escalationHour}:${String(escalationMinute).padStart(2, '0')} Mon-Sat)`);

  // Email activity fetch: 6:00 AM daily (Mon-Sat)
  // Reports API has 2-day delay, so we fetch for date = today - 2
  cron.schedule('0 6 * * 1-6', async () => {
    console.log(`[CRON] Email activity fetch triggered at ${new Date().toLocaleString()}`);
    try {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const date = twoDaysAgo.toISOString().split('T')[0];
      await fetchAndStoreEmailActivity(prisma, date);
    } catch (err) {
      console.error('[CRON] Email activity fetch failed:', err);
    }
  });
  console.log('  -> Email activity fetch scheduled: 0 6 * * 1-6 (06:00 Mon-Sat)');

  // Chat activity fetch: 6:05 AM daily (Mon-Sat)
  // Reports API has 2-day delay, same as email
  cron.schedule('5 6 * * 1-6', async () => {
    console.log(`[CRON] Chat activity fetch triggered at ${new Date().toLocaleString()}`);
    try {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const date = twoDaysAgo.toISOString().split('T')[0];
      await fetchAndStoreChatActivity(prisma, date);
    } catch (err) {
      console.error('[CRON] Chat activity fetch failed:', err);
    }
  });
  console.log('  -> Chat activity fetch scheduled: 5 6 * * 1-6 (06:05 Mon-Sat)');

  // Auto-hibernation check: 2:00 AM daily
  // Hibernates accounts with 3+ consecutive inactive days (excluding leave/holidays)
  cron.schedule('0 2 * * *', async () => {
    console.log(`[CRON] Hibernation check triggered at ${new Date().toLocaleString()}`);
    try {
      const count = await runHibernationCheck(prisma);
      console.log(`[CRON] Hibernation check complete: ${count} user(s) hibernated.`);
    } catch (err) {
      console.error('[CRON] Hibernation check failed:', err);
    }
  });
  console.log('  -> Hibernation check scheduled: 0 2 * * * (02:00 daily)');
}

module.exports = { initCronJobs };
