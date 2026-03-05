# Ollama Integration - Quick Start

## 🎯 Goal
Use **Ollama** for free, local AI inference instead of paying for Claude/Gemini API tokens.

---

## ⚡ Setup (5 minutes)

### Step 1: Start Ollama Service
```bash
ollama serve
```
Or use the setup script:
```bash
C:\Users\91992\setup-ollama.ps1
```

### Step 2: Pull a Model (one-time)
```bash
ollama pull mistral
```

### Step 3: Verify Installation
```bash
ollama list
```

---

## ✅ Test the Integration

Run the test script:
```bash
cd "D:\Activity Report Software\server"
node test-ollama.js
```

Expected output:
```
╔════════════════════════════════════════╗
║   OLLAMA INTEGRATION TEST              ║
╚════════════════════════════════════════╝

Test 1: Checking Ollama server availability...
  Status: ✓ RUNNING

Test 2: Checking available models...
  ✓ Found 1 model(s):
    - mistral (4.1 GB)

Test 3: Testing text generation...
  ✓ Response: 2 + 2 = 4...

Test 4: Testing text classification...
  ✓ Category: expense

Test 5: Testing information extraction...
  ✓ Extracted: Amount: $500, Vendor: ABC Corp
```

---

## 🚀 Start Development

### Backend
```bash
cd "D:\Activity Report Software\server"
npm run dev
```

### Frontend
```bash
cd "D:\Activity Report Software\client"
npm run dev
```

---

## 📊 Configuration

Edit `.env` to customize:
```env
OLLAMA_ENABLED=true                      # Enable/disable
OLLAMA_BASE_URL=http://localhost:11434   # Server URL
OLLAMA_MODEL=mistral                     # Model to use
OLLAMA_FALLBACK_TO_GEMINI=true          # Fallback if Ollama fails
OLLAMA_DEBUG=false                       # Enable debug logs
```

---

## 🔍 Monitor Ollama Status

Check `/api/health` endpoint:
```bash
curl http://localhost:5000/api/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-03-03T10:30:00.000Z",
  "clerkConfigured": true,
  "dbConfigured": true,
  "ollamaConfigured": true,
  "ollamaAvailable": true
}
```

---

## 💡 Usage Examples

### In Your Code
```javascript
const ollama = require('./src/services/ollama');

// Generate text
const response = await ollama.generate('Summarize this: ...');

// Extract info
const data = await ollama.extract(text, 'Extract amount and date');

// Classify
const category = await ollama.classify(text, ['receipt', 'invoice', 'other']);

// Answer question
const answer = await ollama.answerQuestion('What is total?', context);
```

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| "Server not responding" | Run: `ollama serve` |
| "No models found" | Run: `ollama pull mistral` |
| Slow inference | Use smaller model: `ollama pull phi` |
| Port 11434 in use | Ollama already running (OK!) |

---

## 📈 Performance Tips

| Model | Speed | Quality | Size |
|-------|-------|---------|------|
| phi | ⚡⚡⚡ | ⭐⭐ | 2.7B |
| mistral | ⚡⚡ | ⭐⭐⭐ | 7B |
| llama2 | ⚡ | ⭐⭐⭐⭐ | 7-13B |
| neural-chat | ⚡⚡ | ⭐⭐⭐ | 7B |

**Recommendation:** Start with `mistral` (good balance)

---

## 💰 Cost Savings

- **Before:** Claude API costs ~$0.003 per 1K tokens
- **After:** Ollama costs **$0.00** (local, free)

Saving per 1M tokens: **$3.00** ✓

---

## Next Steps

1. ✅ Start Ollama: `ollama serve`
2. ✅ Pull model: `ollama pull mistral`
3. ✅ Run test: `node test-ollama.js`
4. ✅ Start backend: `npm run dev`
5. ✅ Use in app!

---

## 📚 Documentation

- Full guide: `OLLAMA_SETUP.md`
- Service code: `server/src/services/ollama/`
- Test script: `server/test-ollama.js`

---

**Need help?** Check Ollama docs: https://ollama.ai
