/**
 * Ollama Configuration
 * Centralized settings for Ollama integration
 */

module.exports = {
  // Server settings
  server: {
    baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    timeout: 120000, // 2 minutes
    retries: 3,
    retryDelay: 1000,
  },

  // Model selection
  models: {
    default: process.env.OLLAMA_MODEL || 'mistral',
    coding: process.env.OLLAMA_CODING_MODEL || 'mistral',
    extraction: process.env.OLLAMA_EXTRACTION_MODEL || 'mistral',
  },

  // Generation parameters
  generation: {
    temperature: {
      creative: 0.8,
      balanced: 0.7,
      deterministic: 0.2,
      extraction: 0.1,
    },
    topP: 0.9,
    topK: 40,
    numPredict: 500,
  },

  // Feature flags
  features: {
    enabled: process.env.OLLAMA_ENABLED !== 'false',
    fallbackToGemini: process.env.OLLAMA_FALLBACK_TO_GEMINI === 'true',
    logging: process.env.OLLAMA_DEBUG === 'true',
  },

  // Specific use cases
  tasks: {
    receiptExtraction: {
      model: process.env.OLLAMA_MODEL || 'mistral',
      temperature: 0.3,
      maxTokens: 500,
    },
    textSummarization: {
      model: process.env.OLLAMA_MODEL || 'mistral',
      temperature: 0.3,
      maxTokens: 300,
    },
    classification: {
      model: process.env.OLLAMA_MODEL || 'mistral',
      temperature: 0.1,
      maxTokens: 50,
    },
    codeAnalysis: {
      model: process.env.OLLAMA_CODING_MODEL || 'mistral',
      temperature: 0.2,
      maxTokens: 1000,
    },
  },

  // Supported models
  supportedModels: [
    'mistral',           // Fast, good for general tasks
    'neural-chat',       // Optimized for conversations
    'codeqwen',         // Specialized for coding
    'llama2',           // Versatile, good quality
    'phi',              // Smaller, fast
    'dolphin-mixtral',  // Powerful, for complex tasks
  ],

  // Performance thresholds
  performance: {
    warningTimeMs: 30000, // Log warning if inference > 30s
    errorTimeMs: 120000,  // Error if inference > 2 min
  },
};
