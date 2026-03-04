const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'prisma', 'dev.db');
const logFile = path.join(__dirname, 'full-init.log');

function log(msg) {
  console.log(msg);
  fs.appendFileSync(logFile, msg + '\n');
}

// Clear log
fs.writeFileSync(logFile, '');

log('[FULL-INIT] Starting complete database initialization...\n');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    log('[FULL-INIT] ❌ Error opening database: ' + err.message);
    process.exit(1);
  }
  
  log('[FULL-INIT] ✅ Database connection established');
  initializeDatabase();
});

function initializeDatabase() {
  db.serialize(() => {
    // Create User table with all fields
    const userTableSQL = `
    CREATE TABLE IF NOT EXISTS User (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      department TEXT DEFAULT 'General',
      isActive BOOLEAN DEFAULT 1,
      employmentStatus TEXT DEFAULT 'active',
      isHibernated BOOLEAN DEFAULT 0,
      lastActivityAt TEXT,
      selfReactivationCount INTEGER DEFAULT 0,
      selfReactivationMonth TEXT,
      googleId TEXT UNIQUE,
      importedFromGoogle BOOLEAN DEFAULT 0,
      totalPoints INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      employeeId TEXT UNIQUE,
      designation TEXT,
      dateOfJoining TEXT,
      dateOfBirth TEXT,
      employmentType TEXT DEFAULT 'full_time',
      phone TEXT,
      phoneVerified BOOLEAN DEFAULT 0,
      personalEmail TEXT,
      address TEXT,
      emergencyContact TEXT,
      emergencyContact2 TEXT,
      gender TEXT,
      bloodGroup TEXT,
      profilePhotoUrl TEXT,
      driveProfilePhotoUrl TEXT,
      driveFolderId TEXT,
      reportingManagerId INTEGER,
      maritalStatus TEXT,
      nationality TEXT DEFAULT 'Indian',
      fatherName TEXT,
      spouseName TEXT,
      religion TEXT,
      placeOfBirth TEXT,
      permanentAddress TEXT,
      aadhaarNumber TEXT,
      panNumber TEXT,
      passportNumber TEXT,
      passportExpiry TEXT,
      drivingLicense TEXT,
      uanNumber TEXT,
      bankName TEXT,
      bankAccountNumber TEXT,
      bankBranch TEXT,
      bankIfscCode TEXT,
      confirmationDate TEXT,
      probationEndDate TEXT,
      noticePeriodDays INTEGER DEFAULT 30,
      previousExperience REAL DEFAULT 0,
      location TEXT,
      grade TEXT,
      shift TEXT DEFAULT 'General',
      shiftId INTEGER,
      companyId INTEGER
    );
    `;
    
    db.run(userTableSQL, (err) => {
      if (err) {
        log('[FULL-INIT] ⚠️  User table issue: ' + err.message);
      } else {
        log('[FULL-INIT] ✅ User table created/verified');
      }
    });
    
    // Create Company table
    const companyTableSQL = `
    CREATE TABLE IF NOT EXISTS Company (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      gstin TEXT,
      companyRegistrationNumber TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
    `;
    
    db.run(companyTableSQL, (err) => {
      if (err) {
        log('[FULL-INIT] ⚠️  Company table issue: ' + err.message);
      } else {
        log('[FULL-INIT] ✅ Company table created/verified');
      }
    });
    
    // Insert default admin user
    const insertUserSQL = `
    INSERT OR IGNORE INTO User (
      name, email, password, role, department, employmentStatus,
      isActive, googleId, importedFromGoogle, createdAt, updatedAt
    ) VALUES (
      'Admin User', 'admin@cpipl.com', 'password123', 'admin', 'General', 'active',
      1, NULL, 0, datetime('now'), datetime('now')
    );
    `;
    
    db.run(insertUserSQL, function(err) {
      if (err) {
        log('[FULL-INIT] ⚠️  Insert user issue: ' + err.message);
      } else {
        log('[FULL-INIT] ✅ Admin user created/verified');
      }
    });
    
    // Verify data
    db.get('SELECT COUNT(*) as count FROM User;', (err, row) => {
      if (err) {
        log('[FULL-INIT] ❌ Count query failed: ' + err.message);
      } else {
        log(`[FULL-INIT] ✅ User table has ${row.count} records`);
      }
      
      log('\n[FULL-INIT] ✅ Database initialization complete!');
      db.close(() => {
        log('[FULL-INIT] ✅ Database connection closed');
        process.exit(0);
      });
    });
  });
}
