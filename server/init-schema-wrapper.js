const fs = require('fs');
const path = require('path');

// Redirect console to file
const logFile = path.join(__dirname, 'init-schema.log');
const logStream = fs.createWriteStream(logFile);

// Override console methods
const originalLog = console.log;
const originalError = console.error;

console.log = function(...args) {
  const msg = args.join(' ');
  logStream.write(msg + '\n');
  originalLog.apply(console, args);
};

console.error = function(...args) {
  const msg = args.join(' ');
  logStream.write('ERROR: ' + msg + '\n');
  originalError.apply(console, args);
};

// Now run the init script
require('./init-schema.js');
