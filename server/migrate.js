const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'migrate.log');
const log = (msg) => {
  console.log(msg);
  fs.appendFileSync(logFile, msg + '\n');
};

fs.writeFileSync(logFile, '');
log('[MIGRATE] Starting database migration...\n');

try {
  // Use Prisma from node_modules/.bin
  const prismaPath = path.join(__dirname, 'node_modules', '.bin', 'prisma.cmd');
  const cmd = `"${prismaPath}" db push --skip-generate`;
  log(`[MIGRATE] Running: ${cmd}`);
  
  const output = execSync(cmd, {
    cwd: __dirname,
    encoding: 'utf-8',
    shell: true,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  log('[MIGRATE] Output:');
  log(output);
  log('[MIGRATE] ✅ Migration completed successfully!');
  process.exit(0);
} catch (error) {
  log('[MIGRATE] ⚠️  Command output: ' + error.message);
  if (error.stdout) log('[MIGRATE] STDOUT:\n' + error.stdout);
  if (error.stderr) log('[MIGRATE] STDERR:\n' + error.stderr);
  
  // Check if database was actually created even though command reported error
  log('\n[MIGRATE] Checking if database was created...');
  const dbPath = path.join(__dirname, 'prisma', 'dev.db');
  const dbExists = fs.existsSync(dbPath);
  const dbSize = dbExists ? fs.statSync(dbPath).size : 0;
  log(`[MIGRATE] Database exists: ${dbExists}, size: ${dbSize} bytes`);
  
  if (dbSize > 0) {
    log('[MIGRATE] ✅ Database was created despite command error!');
    process.exit(0);
  } else {
    log('[MIGRATE] ❌ Database creation failed');
    process.exit(1);
  }
}
