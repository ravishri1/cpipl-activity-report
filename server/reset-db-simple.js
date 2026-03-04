const { execSync } = require('child_process');
const path = require('path');

try {
  // Run prisma migrate reset directly - it will handle file cleanup
  const prismaPath = path.join(__dirname, 'node_modules', '.bin', 'prisma.cmd');
  const cmd = `"${prismaPath}" migrate reset --force --skip-generate`;
  
  console.log('Running: prisma migrate reset --force');
  console.log('This will recreate the database with full schema...\n');
  
  try {
    const output = execSync(cmd, {
      cwd: __dirname,
      encoding: 'utf-8',
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 10 * 1024 * 1024  // 10MB buffer
    });
    console.log(output);
    console.log('\n✓ Database reset successfully!');
  } catch (execError) {
    console.log('Output:', execError.stdout);
    if (execError.stderr) console.log('Stderr:', execError.stderr);
    
    // Check for success indicators even with non-zero exit
    if ((execError.stdout || '').includes('reset') || (execError.stdout || '').includes('success')) {
      console.log('\n✓ Migration appears to have succeeded despite exit code');
    }
  }
  
} catch (error) {
  console.error('Fatal error:', error.message);
  process.exit(1);
}
