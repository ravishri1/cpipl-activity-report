const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'prisma', 'dev.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('DB Connection Error:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to database');
  
  // Create User table
  db.run(`CREATE TABLE IF NOT EXISTS User (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'member',
    department TEXT DEFAULT 'General',
    isActive BOOLEAN DEFAULT 1,
    employmentStatus TEXT DEFAULT 'active',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Create table error:', err.message);
      db.close();
      process.exit(1);
    }
    console.log('✅ User table created');
    
    // Insert admin user
    db.run(
      `INSERT OR IGNORE INTO User (name, email, password, role) VALUES (?, ?, ?, ?)`,
      ['Admin', 'admin@cpipl.com', 'password123', 'admin'],
      (err) => {
        if (err) {
          console.error('Insert error:', err.message);
        } else {
          console.log('✅ Admin user created');
        }
        db.close();
        process.exit(0);
      }
    );
  });
});
