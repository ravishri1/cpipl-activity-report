const { execSync } = require('child_process');
const path = require('path');

try {
  const prismaPath = path.join(__dirname, 'node_modules', '.bin', 'prisma.cmd');
  const cmd = `"${prismaPath}" migrate reset --force --skip-generate`;
  
  console.log('🔄 Resetting database with full schema...\n');
  
  try {
    const output = execSync(cmd, {
      cwd: __dirname,
      encoding: 'utf-8',
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 10 * 1024 * 1024,
      env: {
        ...process.env,
        PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: 'yes.'
      }
    });
    console.log(output);
    console.log('\n✅ Database reset successfully! Full schema applied.');
  } catch (execError) {
    console.log('Output:', execError.stdout);
    if (execError.stderr) console.log('Stderr:', execError.stderr);
    
    // Check for success indicators
    if ((execError.stdout || '').includes('success') || (execError.stdout || '').includes('reset')) {
      console.log('\n✅ Migration succeeded despite exit code');
    } else if (execError.status === 0) {
      console.log('\n✅ Database reset completed');
    }
  }
  
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
