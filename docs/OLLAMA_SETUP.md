# Ollama Integration Guide

## Overview
This project now supports **Ollama** for free, local AI inference. Ollama eliminates API costs by running LLMs locally on your machine.

### Benefits
✅ **Zero API Costs** - All inference runs locally  
✅ **Privacy** - Data never leaves your machine  
✅ **Fast** - No network latency  
✅ **Works Offline** - No internet required after model download  

---

## Setup (One-Time)

### 1. Verify Ollama is Installed
Ollama should already be installed. Check:
```bash
ollama --version
```

### 2. Start Ollama Service
Keep this running while you develop:
```bash
ollama serve
```

**Windows:** Ollama usually runs as a background service. You can also start it via:
- System Tray → Ollama → Start
- Or run the PowerShell script: `C:\Users\91992\setup-ollama.ps1`

### 3. Pull a Model
Download a coding model (required once):
```bash
ollama pull mistral
```

**Model Options:**
- `mistral` (7B, recommended) - Fast, good for general tasks
- `neural-chat` (7B) - Optimized for conversations
- `codeqwen` (7B) - Specialized for code
- `llama2` (7B/13B) - Versatile, higher quality
- `phi` (2.7B) - Smallest, fastest

To pull additional models:
```bash
ollama pull llama2
ollama pull codeqwen
```

### 4. Verify Setup
Check available models:
```bash
ollama list
```

Test Ollama API:
```bash
curl http://localhost:11434/api/tags
```

---

## Usage in Code

### Example 1: Basic Text Generation
```javascript
const ollama = require('./src/services/ollama');

const response = await ollama.generate(
  'Summarize this document: ...',
  { temperature: 0.7 }
);
console.log(response);
```

### Example 2: Information Extraction
```javascript
const ollama = require('./src/services/ollama');

const extracted = await ollama.extract(
  'Invoice details: Amount $500, Date 2026-03-02',
  'Extract amount and date'
);
```

### Example 3: Text Classification
```javascript
const ollama = require('./src/services/ollama');

const category = await ollama.classify(
  'Received payment for March services',
  ['receipt', 'invoice', 'expense', 'other']
);
```

### Example 4: Question Answering
```javascript
const ollama = require('./src/services/ollama');

const answer = await ollama.answerQuestion(
  'What is the total amount?',
  'Invoice: Amount $500, Tax $50, Total $550'
);
```

---

## Integration Points

### Receipt Extraction (Expenses)
- **File:** `server/src/routes/files.js` (POST `/extract-receipt`)
- **Current:** Uses Google Gemini Vision (paid)
- **Future:** Can use Ollama for text extraction from receipt images

### Activity Report Summarization
- **File:** `server/src/routes/reports.js`
- **Potential:** Summarize daily reports using Ollama

### File Classification
- **File:** `server/src/routes/files.js`
- **Potential:** Auto-detect file category (receipt, ID, document, etc.)

---

## Environment Variables

Edit `.env` file:

```env
# Ollama Settings
OLLAMA_ENABLED=true                           # Enable/disable Ollama
OLLAMA_BASE_URL=http://localhost:11434        # Ollama server URL
OLLAMA_MODEL=mistral                          # Default model
OLLAMA_CODING_MODEL=mistral                   # For code tasks
OLLAMA_EXTRACTION_MODEL=mistral               # For extraction tasks
OLLAMA_FALLBACK_TO_GEMINI=true               # Fallback if Ollama fails
OLLAMA_DEBUG=false                            # Enable debug logging
```

---

## Troubleshooting

### "Ollama server not responding"
**Solution:** Start Ollama service
```bash
ollama serve
```

### "Model not found: mistral"
**Solution:** Pull the model
```bash
ollama pull mistral
```

### Slow inference (>30 seconds)
**Possible causes:**
- System is low on RAM
- Model is too large
- GPU not being used

**Solutions:**
- Use smaller model: `ollama pull phi`
- Increase system RAM
- Check GPU support: `ollama show mistral`

### "Port 11434 already in use"
**Solution:** Ollama is already running. Check processes:
```bash
netstat -ano | findstr :11434
```

---

## Performance Notes

### Inference Time (approx, on typical machine)
- Mistral 7B: 5-30 seconds per request
- Phi 2.7B: 2-10 seconds per request
- Llama2 13B: 10-60 seconds per request

### Optimization Tips
1. Use smaller models for faster responses
2. Keep context short (extract only needed info)
3. Lower temperature for deterministic tasks (0.1-0.3)
4. Use GPU if available (NVIDIA CUDA)

---

## Fallback to Gemini

If Ollama is unavailable and `OLLAMA_FALLBACK_TO_GEMINI=true`:
- System automatically falls back to Google Gemini API
- Requires: `GOOGLE_GENERATIVE_AI_KEY` in .env
- No code changes needed

---

## Integration Checklist

- [x] Ollama client service created
- [x] Configuration file added
- [x] Environment variables configured
- [ ] Initialize Ollama on app startup
- [ ] Test receipt extraction with Ollama
- [ ] Test activity report summarization
- [ ] Add fallback error handling

---

## Next Steps

1. Start Ollama service: `ollama serve`
2. Pull model: `ollama pull mistral`
3. Start backend: `cd server && npm run dev`
4. Check server logs for `[Ollama] ✓ Initialization complete`
5. Test in the app!

---

## Quick Reference Commands

```bash
# Start Ollama
ollama serve

# Pull models
ollama pull mistral
ollama pull llama2
ollama pull codeqwen

# List available models
ollama list

# Remove a model
ollama rm mistral

# Show model details
ollama show mistral

# Test API
curl http://localhost:11434/api/tags
```

---

## Cost Comparison

| Method | Cost | Speed | Privacy |
|--------|------|-------|---------|
| **Ollama** | $0 | Medium | ✓✓✓ |
| Google Gemini API | $0.50-2.00 per 1M tokens | Fast | ✗ |
| Claude API | $3.00-15.00 per 1M tokens | Fast | ✗ |

---

Questions? Check the Ollama docs: https://ollama.ai
