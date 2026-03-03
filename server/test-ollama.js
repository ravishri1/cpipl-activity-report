/**
 * Ollama Integration Test
 * Run: node test-ollama.js
 */

const ollama = require('./src/services/ollama');

async function test() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   OLLAMA INTEGRATION TEST              ║');
  console.log('╚════════════════════════════════════════╝\n');

  // Test 1: Check if Ollama is available
  console.log('Test 1: Checking Ollama server availability...');
  try {
    const available = await ollama.ollamaClient.isAvailable();
    console.log(`  Status: ${available ? '✓ RUNNING' : '✗ NOT RUNNING'}\n`);
    
    if (!available) {
      console.log('  To fix: Start Ollama with: ollama serve\n');
      return;
    }
  } catch (error) {
    console.log(`  Error: ${error.message}\n`);
    return;
  }

  // Test 2: List available models
  console.log('Test 2: Checking available models...');
  try {
    const models = await ollama.ollamaClient.listModels();
    if (models.length === 0) {
      console.log('  ✗ No models found');
      console.log('  To fix: ollama pull mistral\n');
      return;
    }
    console.log(`  ✓ Found ${models.length} model(s):`);
    models.forEach(m => {
      console.log(`    - ${m.name} (${(m.size / 1024 / 1024 / 1024).toFixed(1)} GB)`);
    });
    console.log();
  } catch (error) {
    console.log(`  Error: ${error.message}\n`);
    return;
  }

  // Test 3: Generate text
  console.log('Test 3: Testing text generation...');
  console.log('  Prompt: "What is 2 + 2?"');
  try {
    console.log('  Generating... (this may take 10-30 seconds)');
    const response = await ollama.ollamaClient.generate('What is 2 + 2?', {
      temperature: 0.1,
    });
    console.log(`  ✓ Response: ${response.trim().substring(0, 100)}...\n`);
  } catch (error) {
    console.log(`  ✗ Error: ${error.message}\n`);
  }

  // Test 4: Classification
  console.log('Test 4: Testing text classification...');
  const testText = 'Paid $50 for office supplies on 2026-03-02';
  console.log(`  Text: "${testText}"`);
  console.log('  Categories: receipt, expense, invoice, other');
  try {
    console.log('  Classifying...');
    const category = await ollama.ollamaClient.classify(testText, [
      'receipt',
      'expense',
      'invoice',
      'other',
    ]);
    console.log(`  ✓ Category: ${category.trim()}\n`);
  } catch (error) {
    console.log(`  ✗ Error: ${error.message}\n`);
  }

  // Test 5: Extraction
  console.log('Test 5: Testing information extraction...');
  const invoiceText = 'Invoice #INV-001 dated 2026-03-02, Amount: $500.00, Vendor: ABC Corp';
  console.log(`  Text: "${invoiceText}"`);
  try {
    console.log('  Extracting amount and vendor...');
    const extracted = await ollama.ollamaClient.extract(
      invoiceText,
      'Extract the amount and vendor name'
    );
    console.log(`  ✓ Extracted: ${extracted.trim()}\n`);
  } catch (error) {
    console.log(`  ✗ Error: ${error.message}\n`);
  }

  console.log('╔════════════════════════════════════════╗');
  console.log('║   ALL TESTS COMPLETED                  ║');
  console.log('╚════════════════════════════════════════╝\n');
}

test().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
