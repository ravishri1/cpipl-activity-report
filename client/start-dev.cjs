process.chdir(__dirname);
process.argv.push('--port', process.env.PORT || '3000', '--host');
import('./node_modules/vite/bin/vite.js');
