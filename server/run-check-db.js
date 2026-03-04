const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

try {
  // Use node from node_modules/.bin if available
  const nodePath = path.join(__dirname, 'node_modules', '.bin', 'node.cmd');
  const checkPath = path.join(__dirname, 'check-db.js');
  
  let cmd;
  if (fs.existsSync(nodePath)) {
    cmd = `"${nodePath}" "${checkPath}"`;
  } else {
    // Fallback to direct node
    cmd = `node "${checkPath}"`;
  }
  
  console.log('Executing:', cmd);
  console.log('Working directory:', __dirname);
  console.log('---');
  
  const output = execSync(cmd, {
    cwd: __dirname,
    encoding: 'utf-8',
    shell: true,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  console.log(output);
} catch (error) {
  console.error('Exit code:', error.status);
  console.error('Output:', error.stdout);
  console.error('Errors:', error.stderr);
}
