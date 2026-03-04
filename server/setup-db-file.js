const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const logFile = path.join(__dirname, 'setup.log');
const log = (msg) => fs.appendFileSync(logFile, msg + '\n');

// Clear previous log
fs.writeFileSync(logFile, '');

log('=== Database Setup Started ===');
log('CWD: ' + process.cwd());
log('__dirname: ' + __dirname);

const dbPath = path.join(__dirname, 'prisma', 'dev.db');
log('DB Path: ' + dbPath);
log('DB exists: ' + fs.existsSync(dbPath));

if (fs.existsSync(dbPath)) {
  const stats = fs.statSync(dbPath);
  log('DB file size: ' + stats.size + ' bytes');
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    log('ERROR: Connection failed: ' + err.message);
    process.exit(1);
  }
  
  log('✅ Connected to database');
  
  // Create User table
  const createUserSql = `CREATE TABLE IF NOT EXISTS "User" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL UNIQUE,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "employmentStatus" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`;
  
  db.run(createUserSql, (err) => {
    if (err) {
      log('ERROR: Create table failed: ' + err.message);
      db.close();
      process.exit(1);
    }
    
    log('✅ User table created');
    
    // Insert admin
    db.run(
      `INSERT OR IGNORE INTO "User" ("name", "email", "password", "role") VALUES (?, ?, ?, ?)`,
      ['Admin', 'admin@cpipl.com', 'password123', 'admin'],
      (err) => {
        if (err) {
          log('ERROR: Insert failed: ' + err.message);
        } else {
          log('✅ Admin user created');
        }
        
        // Verify
        db.get(`SELECT COUNT(*) as count FROM "User"`, (err, row) => {
          if (err) {
            log('ERROR: Count failed: ' + err.message);
          } else {
            log('✅ User count: ' + row.count);
          }
          
          db.close(() => {
            log('✅ Setup complete');
            process.exit(0);
          });
        });
      }
    );
  });
});
