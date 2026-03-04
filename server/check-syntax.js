const fs = require('fs');
const path = require('path');

console.log('Checking syntax of test files...');

const testFiles = [
  'test-procurement-correct.js',
  'simple-test.js'
];

testFiles.forEach(file => {
  try {
    const filePath = path.join(__dirname, file);
    const code = fs.readFileSync(filePath, 'utf-8');
    new Function(code); // Try to compile the code
    console.log(`✅ ${file} - Syntax OK`);
  } catch (e) {
    console.log(`❌ ${file} - Syntax Error: ${e.message}`);
  }
});

console.log('Done!');
