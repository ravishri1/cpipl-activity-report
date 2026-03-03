/**
 * Ollama Initialization
 * Checks Ollama availability on server startup
 */

const ollamaClient = require('./ollamaClient');
const config = require('./config');

async function initializeOllama() {
  console.log('\n[Ollama] Initializing...');
  console.log(`[Ollama] Server: ${config.server.baseURL}`);
  console.log(`[Ollama] Model: ${config.models.default}`);

  try {
    const isAvailable = await ollamaClient.isAvailable();

    if (!isAvailable) {
      console.warn('\n⚠️  [Ollama] Server not responding');
      console.warn('[Ollama] Start Ollama with: ollama serve');
      console.warn('[Ollama] Pull model with: ollama pull mistral');
      return false;
    }

    const models = await ollamaClient.listModels();
    console.log(`[Ollama] Available models: ${models.length}`);

    if (models.length === 0) {
      console.warn('[Ollama] No models found. Pull one:');
      console.warn('  ollama pull mistral');
      return false;
    }

    const hasDefaultModel = models.some(m => m.name.startsWith(config.models.default));
    if (!hasDefaultModel) {
      console.warn(`[Ollama] Default model "${config.models.default}" not found`);
      console.warn(`[Ollama] Available: ${models.map(m => m.name).join(', ')}`);
    }

    console.log('[Ollama] ✓ Initialization complete\n');
    return true;
  } catch (error) {
    console.error('[Ollama] Initialization failed:', error.message);
    console.log('[Ollama] AI features will be disabled');
    return false;
  }
}

module.exports = { initializeOllama };
