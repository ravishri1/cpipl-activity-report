#!/usr/bin/env node

// Change to the server directory
process.chdir('D:\\Activity Report Software\\server');

console.log('Current working directory:', process.cwd());
console.log('Executing repair endpoints test suite...\n');

// Now require and run the test file
require('./tests/repair-endpoints.test.js');
