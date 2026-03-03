/**
 * Ollama Client Service
 * Provides AI capabilities using Ollama (free, local inference)
 * Reduces API costs - no tokens spent, all computation is local
 */

const axios = require('axios');

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'mistral';

class OllamaClient {
  constructor() {
    this.baseURL = OLLAMA_BASE_URL;
    this.model = OLLAMA_MODEL;
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 120000, // 2 min timeout for inference
    });
  }

  /**
   * Check if Ollama server is available
   */
  async isAvailable() {
    try {
      const response = await this.client.get('/api/tags');
      return response.status === 200;
    } catch (error) {
      console.error('[Ollama] Server not available:', error.message);
      return false;
    }
  }

  /**
   * Get list of available models
   */
  async listModels() {
    try {
      const response = await this.client.get('/api/tags');
      return response.data.models || [];
    } catch (error) {
      console.error('[Ollama] Error listing models:', error.message);
      return [];
    }
  }

  /**
   * Generate text completion using Ollama
   * @param {string} prompt - The input prompt
   * @param {Object} options - Generation options
   * @returns {Promise<string>} Generated text
   */
  async generate(prompt, options = {}) {
    try {
      const isAvailable = await this.isAvailable();
      if (!isAvailable) {
        throw new Error('Ollama server is not running. Start with: ollama serve');
      }

      const response = await this.client.post('/api/generate', {
        model: this.model,
        prompt,
        stream: false,
        temperature: options.temperature || 0.7,
        top_p: options.topP || 0.9,
        top_k: options.topK || 40,
        ...options,
      });

      return response.data.response;
    } catch (error) {
      console.error('[Ollama] Generate error:', error.message);
      throw error;
    }
  }

  /**
   * Extract information from text
   * @param {string} text - Text to extract from
   * @param {string} instruction - What to extract
   * @returns {Promise<string>} Extracted information
   */
  async extract(text, instruction) {
    const prompt = `Extract the following information from the text below.
Instruction: ${instruction}

Text:
${text}

Extracted information:`;

    return this.generate(prompt, {
      temperature: 0.2, // Lower temp for more deterministic extraction
    });
  }

  /**
   * Classify text into categories
   * @param {string} text - Text to classify
   * @param {Array<string>} categories - Available categories
   * @returns {Promise<string>} Predicted category
   */
  async classify(text, categories) {
    const categoryList = categories.join(', ');
    const prompt = `Classify the following text into one of these categories: ${categoryList}

Text: ${text}

Category:`;

    return this.generate(prompt, {
      temperature: 0.1, // Very low for classification
    });
  }

  /**
   * Summarize text
   * @param {string} text - Text to summarize
   * @param {number} maxLength - Max length of summary
   * @returns {Promise<string>} Summary
   */
  async summarize(text, maxLength = 500) {
    const prompt = `Summarize the following text in ${maxLength} characters or less:

${text}

Summary:`;

    return this.generate(prompt, {
      temperature: 0.3,
    });
  }

  /**
   * Answer a question based on context
   * @param {string} question - Question to answer
   * @param {string} context - Context/document
   * @returns {Promise<string>} Answer
   */
  async answerQuestion(question, context) {
    const prompt = `Based on the following context, answer the question.

Context:
${context}

Question: ${question}

Answer:`;

    return this.generate(prompt, {
      temperature: 0.5,
    });
  }

  /**
   * Detect text language
   * @param {string} text - Text to detect language
   * @returns {Promise<string>} Language code
   */
  async detectLanguage(text) {
    const prompt = `Detect the language of this text and respond with only the language code (e.g., en, hi, es):

${text}

Language:`;

    const response = await this.generate(prompt, {
      temperature: 0.1,
    });

    return response.trim().toLowerCase();
  }
}

// Singleton instance
const ollamaClient = new OllamaClient();

module.exports = ollamaClient;
