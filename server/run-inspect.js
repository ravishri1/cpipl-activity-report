const { execSync } = require('child_process');
const path = require('path');

try {
  const result = execSync('node inspect-schema.js', {
    cwd: __dirname,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
  console.log(result);
} catch (error) {
  console.error('STDOUT:', error.stdout);
  console.error('STDERR:', error.stderr);
  console.error('Error:', error.message);
}
