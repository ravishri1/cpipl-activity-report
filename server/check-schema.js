const sqlite3 = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'prisma', 'dev.db');
const logFile = path.join(__dirname, 'check-schema.log');

function log(msg) {
  console.log(msg);
  fs.appendFileSync(logFile, msg + '\n');
}

fs.writeFileSync(logFile, '');
log('[SCHEMA] Checking database schema...\n');

try {
  // Use better-sqlite3 if available, otherwise show error
  log('[SCHEMA] Attempting to open database with better-sqlite3...\n');
  const db = new sqlite3(dbPath);
  
  log('[SCHEMA] Getting User table schema:');
  const pragma = db.prepare('PRAGMA table_info(User)').all();
  
  pragma.forEach(col => {
    log(`  ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}${col.pk ? ' PRIMARY KEY' : ''}`);
  });
  
  log(`\n[SCHEMA] Total columns: ${pragma.length}`);
  
  // Get row count
  const count = db.prepare('SELECT COUNT(*) as count FROM User').get();
  log(`[SCHEMA] User records: ${count.count}`);
  
  db.close();
  log('\n[SCHEMA] ✅ Schema check complete');
  
} catch (error) {
  log(`[SCHEMA] ❌ Error: ${error.message}`);
  log('[SCHEMA] Note: better-sqlite3 may not be installed. Trying with Prisma instead...');
  
  // Try with Prisma
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  
  (async () => {
    try {
      const count = await prisma.user.count();
      log(`[SCHEMA] ✅ Prisma can connect. User count: ${count}`);
    } catch (err) {
      log(`[SCHEMA] Prisma error: ${err.message}`);
    } finally {
      await prisma.$disconnect();
    }
  })();
}
