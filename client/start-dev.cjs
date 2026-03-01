process.chdir(__dirname);
process.argv.push('--port', '3000', '--host');
import('./node_modules/vite/bin/vite.js');
