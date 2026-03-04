const { spawn } = require('child_process');
const path = require('path');

const serverDir = path.join(__dirname, 'server');

console.log(`Starting server from: ${serverDir}`);
console.log('Running: npm run dev\n');

const proc = spawn('npm', ['run', 'dev'], {
  cwd: serverDir,
  stdio: 'inherit',
  shell: true
});

proc.on('error', (err) => {
  console.error(`Error starting server: ${err.message}`);
  process.exit(1);
});

proc.on('exit', (code) => {
  console.log(`Server exited with code ${code}`);
  process.exit(code);
});
