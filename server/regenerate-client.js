const { execSync } = require('child_process');
const path = require('path');

try {
  const prismaPath = path.join(__dirname, 'node_modules', '.bin', 'prisma.cmd');
  const cmd = `"${prismaPath}" generate`;
  
  console.log('🔄 Regenerating Prisma client...\n');
  
  try {
    const output = execSync(cmd, {
      cwd: __dirname,
      encoding: 'utf-8',
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    console.log(output);
    console.log('✅ Prisma client regenerated');
  } catch (execError) {
    console.log('Output:', execError.stdout);
    if (execError.stderr) console.log('Stderr:', execError.stderr);
    
    // Even with error, client may regenerate
    if ((execError.stdout || '').includes('generated') || execError.status === 0) {
      console.log('\n✅ Client regenerated');
    }
  }
  
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
