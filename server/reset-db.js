const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

try {
  // First, delete the database file
  const dbPath = path.join(__dirname, 'prisma', 'dev.db');
  if (fs.existsSync(dbPath)) {
    console.log('Deleting old database:', dbPath);
    fs.unlinkSync(dbPath);
    console.log('✓ Database deleted');
  }
  
  // Now run prisma migrate reset
  const prismaPath = path.join(__dirname, 'node_modules', '.bin', 'prisma.cmd');
  const cmd = `"${prismaPath}" migrate reset --force --skip-generate`;
  
  console.log('\nRunning Prisma migrate reset...');
  console.log('Command:', cmd);
  console.log('---');
  
  try {
    const output = execSync(cmd, {
      cwd: __dirname,
      encoding: 'utf-8',
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    console.log(output);
  } catch (execError) {
    // Even if exit code is non-zero, check if database was created
    console.log('Command output:', execError.stdout);
    if (execError.stderr) console.log('Stderr:', execError.stderr);
    
    // Check if database was created despite error
    if (fs.existsSync(dbPath)) {
      const size = fs.statSync(dbPath).size;
      console.log(`\n✓ Database recreated! Size: ${size} bytes`);
    }
  }
  
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
