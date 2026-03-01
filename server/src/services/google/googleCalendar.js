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

module.exports = {
  fetchTodayCalendarEvents,
  fetchTodayTasks,
};
