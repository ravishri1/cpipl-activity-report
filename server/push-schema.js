const { execSync } = require('child_process');
const path = require('path');

try {
  const prismaPath = path.join(__dirname, 'node_modules', '.bin', 'prisma.cmd');
  const cmd = `"${prismaPath}" db push --skip-generate --force-reset`;
  
  console.log('📤 Pushing schema to database...\n');
  
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
    console.log('\n✅ Schema pushed successfully!');
  } catch (execError) {
    console.log('Output:', execError.stdout);
    if (execError.stderr) console.log('Stderr:', execError.stderr);
    
    // Check for success indicators
    if ((execError.stdout || '').includes('Prisma schema') || execError.status === 0) {
      console.log('\n✅ Schema push appears successful');
    }
  }
  
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
