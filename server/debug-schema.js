const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

console.log('CWD:', process.cwd());
const dbPath = path.join(__dirname, 'prisma', 'dev.db');
const sqlPath = path.join(__dirname, 'create-schema.sql');

console.log('DB Path:', dbPath);
console.log('SQL Path:', sqlPath);
console.log('DB exists:', fs.existsSync(dbPath));
console.log('SQL exists:', fs.existsSync(sqlPath));

if (fs.existsSync(dbPath)) {
  const stats = fs.statSync(dbPath);
  console.log('DB file size:', stats.size, 'bytes');
}

// Read SQL file
const sql = fs.readFileSync(sqlPath, 'utf8');
console.log('SQL content length:', sql.length, 'characters');
console.log('First 100 chars:', sql.substring(0, 100));

// Connect to database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Connection error:', err);
    process.exit(1);
  }
  console.log('Connected to database');
  
  // Execute SQL with proper error handling
  const statements = sql.split(';').filter(s => s.trim());
  console.log('Found', statements.length, 'SQL statements');
  
  let count = 0;
  const executeNext = () => {
    if (count >= statements.length) {
      console.log('All statements executed');
      db.close();
      process.exit(0);
      return;
    }
    
    const stmt = statements[count] + ';';
    console.log('Executing statement', count + 1, ':', stmt.substring(0, 50) + '...');
    
    db.run(stmt, (err) => {
      if (err) {
        console.error('Error on statement', count + 1, ':', err.message);
        // Continue despite errors
      } else {
        console.log('Statement', count + 1, 'OK');
      }
      count++;
      executeNext();
    });
  };
  
  executeNext();
});
