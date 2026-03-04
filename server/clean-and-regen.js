const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const rimraf = require('rimraf');

try {
  const prismaDir = path.join(__dirname, 'node_modules', '.prisma');
  
  console.log('🧹 Cleaning Prisma cache...');
  
  if (fs.existsSync(prismaDir)) {
    try {
      // Try native rimraf if available
      if (rimraf.sync) {
        rimraf.sync(prismaDir);
      } else {
        // Fallback: use recursive deletion
        fs.rmSync(prismaDir, { recursive: true, force: true });
      }
      console.log('✓ Cache cleaned');
    } catch (e) {
      console.log('⚠️  Could not delete cache:', e.message);
    }
  }
  
  // Give it a moment
  console.log('⏳ Waiting for file locks to release...');
  execSync('timeout /t 2', { shell: true, stdio: 'pipe' });
  
  // Now regenerate
  const prismaPath = path.join(__dirname, 'node_modules', '.bin', 'prisma.cmd');
  const cmd = `"${prismaPath}" generate`;
  
  console.log('🔄 Regenerating Prisma client...');
  
  const output = execSync(cmd, {
    cwd: __dirname,
    encoding: 'utf-8',
    shell: true,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  console.log(output);
  console.log('\n✅ Prisma client regenerated successfully!');
  
} catch (error) {
  console.error('Output:', error.stdout);
  console.error('Error:', error.message);
  process.exit(1);
}
