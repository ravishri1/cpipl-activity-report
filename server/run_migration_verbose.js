const { spawn } = require('child_process');
const path = require('path');

const cwd = __dirname;
console.log(`Working directory: ${cwd}`);

const prismaProcess = spawn('npx', ['prisma', 'db', 'push', '--force-reset'], {
  cwd: cwd,
  stdio: 'inherit',
  shell: true
});

prismaProcess.on('exit', (code) => {
  console.log(`\nPrisma db push completed with exit code: ${code}`);
  process.exit(code);
});

prismaProcess.on('error', (error) => {
  console.error(`Failed to start process: ${error.message}`);
  process.exit(1);
});
