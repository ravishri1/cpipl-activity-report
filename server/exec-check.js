const { execSync } = require('child_process');
const path = require('path');

const serverDir = __dirname;
console.log('Working directory:', serverDir);

try {
  const cmd = `node check-db.js`;
  console.log('Running:', cmd);
  
  const result = execSync(cmd, {
    cwd: serverDir,
    encoding: 'utf-8',
    stdio: 'inherit',
    shell: true
  });
  
  console.log('Result:', result);
} catch (error) {
  console.error('Error code:', error.status);
  console.error('Error:', error.message);
}
