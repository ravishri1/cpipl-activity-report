require('dotenv').config();
const app = require('./app');
const { PrismaClient } = require('@prisma/client');
const { initCronJobs } = require('./services/cronJobs');

const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

// Start server (local dev only)
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  initCronJobs(prisma);
  console.log('Cron jobs initialized');
});
