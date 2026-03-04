const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'prisma', 'dev.db');
const sqlPath = path.join(__dirname, 'create-schema.sql');

// Read SQL file
const sql = fs.readFileSync(sqlPath, 'utf8');

// Connect to database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to database at', dbPath);
  
  // Execute SQL
  db.exec(sql, (err) => {
    if (err) {
      console.error('❌ SQL execution error:', err.message);
      db.close();
      process.exit(1);
    }
    console.log('✅ Database schema created successfully');
    
    // Verify User table
    db.all("SELECT COUNT(*) as count FROM User", (err, rows) => {
      if (err) {
        console.error('❌ Verification error:', err.message);
      } else {
        console.log('✅ User table contains', rows[0].count, 'records');
      }
      
      db.close(() => {
        console.log('✅ Database setup complete');
        process.exit(0);
      });
    });
  });
});
