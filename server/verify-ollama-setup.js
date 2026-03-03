/**
 * Ollama Setup Verification Script
 * Checks that all files are in place and properly configured
 */

const fs = require('fs');
const path = require('path');

console.log('\n╔═══════════════════════════════════════════════════════════════╗');
console.log('║              OLLAMA SETUP VERIFICATION                        ║');
console.log('╚═══════════════════════════════════════════════════════════════╝\n');

const checks = [];

// Check 1: Ollama service files exist
console.log('Checking Ollama service files...');
const ollamaDir = path.join(__dirname, 'src/services/ollama');
const requiredFiles = [
  'ollamaClient.js',
  'config.js',
  'init.js',
  'index.js'
];

requiredFiles.forEach(file => {
  const filePath = path.join(ollamaDir, file);
  if (fs.existsSync(filePath)) {
    const size = fs.statSync(filePath).size;
    console.log(`  ✓ ${file} (${size} bytes)`);
    checks.push({ name: file, status: 'pass' });
  } else {
    console.log(`  ✗ ${file} - NOT FOUND`);
    checks.push({ name: file, status: 'fail' });
  }
});

// Check 2: app.js has Ollama import
console.log('\nChecking app.js modifications...');
const appJsPath = path.join(__dirname, 'src/app.js');
const appJs = fs.readFileSync(appJsPath, 'utf8');
if (appJs.includes("require('./services/ollama/init')")) {
  console.log('  ✓ app.js imports Ollama init');
  checks.push({ name: 'app.js import', status: 'pass' });
} else {
  console.log('  ✗ app.js missing Ollama import');
  checks.push({ name: 'app.js import', status: 'fail' });
}

if (appJs.includes('initializeOllama()')) {
  console.log('  ✓ app.js calls initializeOllama()');
  checks.push({ name: 'app.js initialization', status: 'pass' });
} else {
  console.log('  ✗ app.js missing initializeOllama() call');
  checks.push({ name: 'app.js initialization', status: 'fail' });
}

if (appJs.includes('ollamaAvailable')) {
  console.log('  ✓ app.js health endpoint includes Ollama status');
  checks.push({ name: 'health endpoint', status: 'pass' });
} else {
  console.log('  ✗ app.js health endpoint missing Ollama status');
  checks.push({ name: 'health endpoint', status: 'fail' });
}

// Check 3: .env has Ollama config
console.log('\nChecking .env configuration...');
const envPath = path.join(__dirname, '.env');
const env = fs.readFileSync(envPath, 'utf8');
const ollamaVars = [
  'OLLAMA_ENABLED',
  'OLLAMA_BASE_URL',
  'OLLAMA_MODEL'
];

ollamaVars.forEach(varName => {
  if (env.includes(varName)) {
    console.log(`  ✓ ${varName} configured`);
    checks.push({ name: varName, status: 'pass' });
  } else {
    console.log(`  ✗ ${varName} missing`);
    checks.push({ name: varName, status: 'fail' });
  }
});

// Check 4: Test script exists
console.log('\nChecking test script...');
const testPath = path.join(__dirname, 'test-ollama.js');
if (fs.existsSync(testPath)) {
  const size = fs.statSync(testPath).size;
  console.log(`  ✓ test-ollama.js exists (${size} bytes)`);
  checks.push({ name: 'test-ollama.js', status: 'pass' });
} else {
  console.log('  ✗ test-ollama.js not found');
  checks.push({ name: 'test-ollama.js', status: 'fail' });
}

// Check 5: Documentation exists
console.log('\nChecking documentation...');
const docsRequired = [
  'OLLAMA_QUICKSTART.md',
  'OLLAMA_SETUP.md',
  'OLLAMA_IMPLEMENTATION_COMPLETE.md'
];

const projectRoot = path.join(__dirname, '..');
docsRequired.forEach(doc => {
  const docPath = path.join(projectRoot, doc);
  if (fs.existsSync(docPath)) {
    console.log(`  ✓ ${doc}`);
    checks.push({ name: doc, status: 'pass' });
  } else {
    console.log(`  ✗ ${doc} not found`);
    checks.push({ name: doc, status: 'fail' });
  }
});

// Summary
console.log('\n╔═══════════════════════════════════════════════════════════════╗');
const passed = checks.filter(c => c.status === 'pass').length;
const total = checks.length;
const percentage = Math.round((passed / total) * 100);

console.log(`║  RESULT: ${passed}/${total} checks passed (${percentage}%)`.padEnd(62) + '║');
console.log('╚═══════════════════════════════════════════════════════════════╝\n');

if (passed === total) {
  console.log('✓ All checks passed! Ollama integration is ready.');
  console.log('\nNext steps:');
  console.log('  1. Start Ollama: ollama serve');
  console.log('  2. Pull model: ollama pull mistral');
  console.log('  3. Run tests: node test-ollama.js');
  console.log('  4. Start backend: npm run dev\n');
  process.exit(0);
} else {
  console.log('✗ Some checks failed. Review the output above.\n');
  process.exit(1);
}
