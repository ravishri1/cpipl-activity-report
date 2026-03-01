const cron = require('node-cron');
const { runFirstReminder, runEscalation } = require('./reminderService');
const { fetchAndStoreEmailActivity } = require('./googleWorkspace');

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
}

module.exports = { initCronJobs };
