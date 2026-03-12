const { google } = require('googleapis');
const { getAuthedClientForUser } = require('./googleAuth');

// Fetch today's calendar events for a user
async function fetchTodayCalendarEvents(userId, prisma) {
  const authClient = await getAuthedClientForUser(userId, prisma);
  const calendar = google.calendar({ version: 'v3', auth: authClient });

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 50,
  });

  return (response.data.items || []).map((event) => ({
    id: event.id,
    title: event.summary || '(No title)',
    startTime: event.start?.dateTime || event.start?.date || '',
    endTime: event.end?.dateTime || event.end?.date || '',
    status: event.status,
    location: event.location || '',
  }));
}

// Fetch today's tasks for a user
async function fetchTodayTasks(userId, prisma) {
  const authClient = await getAuthedClientForUser(userId, prisma);
  const tasks = google.tasks({ version: 'v1', auth: authClient });

  const allTasks = [];

  try {
    const taskLists = await tasks.tasklists.list({ maxResults: 10 });

    for (const list of taskLists.data.items || []) {
      try {
        const response = await tasks.tasks.list({
          tasklist: list.id,
          showCompleted: true,
          showHidden: false,
          maxResults: 50,
        });

        const items = (response.data.items || [])
          .filter((t) => t.title && t.title.trim()) // skip empty tasks
          .map((t) => ({
            id: t.id,
            title: t.title,
            completed: t.status === 'completed',
            notes: t.notes || '',
            due: t.due || '',
            listName: list.title,
          }));

        allTasks.push(...items);
      } catch (e) {
        // Skip inaccessible task lists
      }
    }
  } catch (err) {
    console.error('Fetch tasks error:', err.message);
  }

  return allTasks;
}

// ─── Google Tasks Write (Upsert by threadId) ───

// Find an existing task that has this threadId in its notes
async function findExistingTask(oauth2Client, threadId) {
  const tasks = google.tasks({ version: 'v1', auth: oauth2Client });

  try {
    const taskLists = await tasks.tasklists.list({ maxResults: 10 });
    for (const list of taskLists.data.items || []) {
      try {
        const response = await tasks.tasks.list({
          tasklist: list.id,
          showCompleted: false,
          showHidden: false,
          maxResults: 100,
        });
        const match = (response.data.items || []).find(
          t => t.notes && t.notes.includes(`threadId:${threadId}`)
        );
        if (match) return { task: match, tasklistId: list.id };
      } catch { /* skip inaccessible list */ }
    }
  } catch { /* ignore */ }

  return null;
}

// Create or update a Google Task for an unreplied email thread
async function upsertGoogleTask(oauth2Client, { category, company, threadId, subject, emailCount, sentCount, receivedCount }) {
  const tasks = google.tasks({ version: 'v1', auth: oauth2Client });

  const categoryLabel = category === 'internal' ? 'Internal'
    : category === 'vendor' ? 'Vendor'
    : category === 'government' ? 'Government'
    : 'External';

  const title = `[${categoryLabel}] ${company} — Reply: ${subject}`;
  const notes = [
    `threadId:${threadId}`,
    `Subject: ${subject}`,
    `Emails: ${emailCount} (${receivedCount} received, ${sentCount} sent)`,
    `Created by EOD Report System`,
  ].join('\n');

  // Check if task already exists for this thread
  const existing = await findExistingTask(oauth2Client, threadId);

  if (existing) {
    // Update existing task
    const updated = await tasks.tasks.update({
      tasklist: existing.tasklistId,
      task: existing.task.id,
      requestBody: {
        ...existing.task,
        title,
        notes,
        status: 'needsAction', // Reset status if it was completed
      },
    });
    return { action: 'updated', task: updated.data };
  }

  // Create new task in default list
  const created = await tasks.tasks.insert({
    tasklist: '@default',
    requestBody: { title, notes, status: 'needsAction' },
  });
  return { action: 'created', task: created.data };
}

module.exports = {
  fetchTodayCalendarEvents,
  fetchTodayTasks,
  findExistingTask,
  upsertGoogleTask,
};
