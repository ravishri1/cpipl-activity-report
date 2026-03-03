/**
 * Ollama Service Exports
 */

const ollamaClient = require('./ollamaClient');
const config = require('./config');
const { initializeOllama } = require('./init');

module.exports = {
  ollamaClient,
  config,
  initializeOllama,

  /**
   * Check if Ollama is enabled and available
   */
  isEnabled: () => config.features.enabled && ollamaClient.isAvailable(),

  /**
   * Generate text using Ollama
   */
  generate: (prompt, options) => ollamaClient.generate(prompt, options),

  /**
   * Extract information from text
   */
  extract: (text, instruction) => ollamaClient.extract(text, instruction),

  /**
   * Classify text
   */
  classify: (text, categories) => ollamaClient.classify(text, categories),

  /**
   * Summarize text
   */
  summarize: (text, maxLength) => ollamaClient.summarize(text, maxLength),

  /**
   * Answer questions based on context
   */
  answerQuestion: (question, context) => ollamaClient.answerQuestion(question, context),

  /**
   * Detect language
   */
  detectLanguage: (text) => ollamaClient.detectLanguage(text),
};
