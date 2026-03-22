# KIE.AI Integration - Setup Complete ✅

## Overview

The Shadow User Agent now supports **KIE.AI** as an AI provider for Claude Sonnet models. KIE.AI uses an **asynchronous task-based API** pattern, which differs from Anthropic's synchronous API.

**API Documentation:** https://docs.kie.ai/

---

## ✅ What Has Been Implemented

### 1. KIE.AI Provider (`src/ai/claudeClient.ts`)

**Anthropic Messages API format via KIE.AI proxy:**

- POST to `https://api.kie.ai/claude/v1/messages` with Anthropic-style request body
- Returns Anthropic-style response with `content` array containing text blocks

**Features:**

- ✅ Synchronous request/response (no polling needed)
- ✅ Same retry logic as other providers
- ✅ Credit-based error handling (402 responses)
- ✅ Authentication error handling (401 responses)
- ✅ Error object detection in response body

### 2. Environment Variables

```bash
# KIE.AI Configuration
KIE_AI_API_KEY=
KIE_MODEL=
```

### 3. API Endpoints Used

| Endpoint                                 | Purpose                        |
| ---------------------------------------- | ------------------------------ |
| `https://api.kie.ai/claude/v1/messages`  | Claude models (Messages API)   |

### 4. Test Coverage

Comprehensive tests in `src/ai/__tests__/claudeClient.test.ts`:

- ✅ Task creation and polling
- ✅ Task failure handling
- ✅ Authentication errors
- ✅ Credit errors (402)
- ✅ Missing task_id handling

---

## 🔧 How It Works

### Request Flow

```
┌─────────────────┐
│ Shadow Agent    │
└────────┬────────┘
         │
         │ POST /claude/v1/messages
         │ { model, system, messages, max_tokens, stream: false }
         ▼
┌─────────────────┐
│ KIE.AI API      │
│ Returns:        │
│ { type: "message",    │
│   content: [{         │
│     type: "text",     │
│     text: "..."       │
│   }] }                │
└────────┬────────┘
         │
         │ Extract text from content[0]
         ▼
┌─────────────────┐
│ Bug Report      │
│ Generated       │
└─────────────────┘
```

---

## 📝 Configuration

### Your Current Setup (`.env`)

```bash
KIE_AI_API_KEY=
KIE_MODEL=
```

**Priority:** KIE.AI is now the **active provider** (checked first)

### Provider Detection Order

1. **KIE.AI** - If `KIE_AI_API_KEY` is set
2. **OpenRouter** - If `OPENROUTER_API_KEY` is set
3. **Anthropic** - If `ANTHROPIC_API_KEY` is set

---

## 🧪 Testing the Integration

### 1. Start Services

```bash
npm run dev
```

### 2. Verify Health Endpoint

```bash
curl http://localhost:4000/health
```

**Expected Response:**

```json
{
  "status": "ok",
  "db": "connected",
  "redis": "connected",
  "ai_provider": "kie",
  "version": "1.0.0"
}
```

### 3. Create a Test Run

1. Open frontend: http://localhost:3000
2. Click "New Run"
3. Enter URL: `https://demo.playwright.dev/todomvc`
4. Select persona: "New User"
5. Click "Start Agent"

### 4. Monitor Logs

Watch for these log messages in the worker:

```
[INFO] Starting AI analysis
[INFO] KIE.AI task created, polling for results  taskId: "task_abc123"
[INFO] AI analysis completed
```

---

## 📊 KIE.AI API Details

### Available Models (Chat)

| Provider   | Models                                                           |
| ---------- | ---------------------------------------------------------------- |
| **Claude** | Claude Haiku 4.5, Claude Opus 4.5/4.6, **Claude Sonnet 4.5/4.6** |
| **GPT**    | GPT 5.2, GPT 5.4                                                 |
| **Gemini** | Gemini 2.5/3/3.1 Pro, Gemini 2.5/3 Flash                         |
| **Codex**  | GPT Codex                                                        |

### Authentication

- **Header:** `Authorization: Bearer YOUR_API_KEY`
- **Get API Key:** https://kie.ai/api-key

### Rate Limits

| Limit               | Value             |
| ------------------- | ----------------- |
| Generation requests | 20 per 10 seconds |
| Concurrent tasks    | 100+              |
| Exceeded response   | HTTP 429          |

### Pricing

- **30%–80% lower** than official provider APIs
- Full pricing: https://kie.ai/pricing

### Data Retention

| Data Type       | Retention |
| --------------- | --------- |
| Generated media | 14 days   |
| Logs/metadata   | 2 months  |

---

## 🐛 Troubleshooting

### Error: "KIE.AI API error: 401 - Invalid API key"

**Cause:** API key is invalid or expired

**Fix:**

1. Verify key at https://kie.ai/api-key
2. Regenerate if needed
3. Update `KIE_AI_API_KEY` in `.env`

### Error: "KIE.AI API error: 402"

**Cause:** Insufficient credits in your KIE.AI account

**Fix:**

1. Add credits at https://kie.ai/pricing
2. Or reduce `max_tokens` in the request

### Error: "KIE.AI task failed: ..."

**Cause:** Task execution failed (model unavailable, etc.)

**Fix:**

1. Check model name is valid
2. Verify model is available in KIE.AI marketplace
3. Try a different model (e.g., `claude-sonnet-4.5`)

### Error: "KIE.AI task polling timeout"

**Cause:** Task took longer than 60 seconds to complete

**Fix:**

1. Increase `maxPollingAttempts` in `pollKieTask()`
2. Or increase `pollingIntervalMs`
3. Check KIE.AI service status

### Error: "KIE.AI did not return a task_id"

**Cause:** Unexpected API response format

**Fix:**

1. Check KIE.AI API documentation for changes
2. Verify API endpoint is correct
3. Contact KIE.AI support

---

## 🆘 Support Resources

| Resource               | URL                         |
| ---------------------- | --------------------------- |
| **Documentation**      | https://docs.kie.ai/        |
| **API Keys**           | https://kie.ai/api-key      |
| **Models/Marketplace** | https://kie.ai/market       |
| **Pricing**            | https://kie.ai/pricing      |
| **Logs**               | https://kie.ai/logs         |
| **Support Email**      | support@kie.ai              |
| **Discord/Telegram**   | Via dashboard (bottom-left) |

**Support Hours:** UTC 21:00 – UTC 17:00 (next day)

---

## 🔑 Key Differences from Other Providers

| Feature              | Anthropic        | OpenRouter       | KIE.AI                    |
| -------------------- | ---------------- | ---------------- | ------------------------- |
| **API Pattern**      | Synchronous      | Synchronous      | **Synchronous**           |
| **API Format**       | Messages API     | OpenAI-compat    | **Messages API (proxy)**  |
| **Endpoint**         | Single           | Single           | **Single**                |
| **Polling Required** | No               | No               | **No**                    |

---

## ✅ Verification Checklist

- [ ] Health endpoint shows `"ai_provider": "kie"`
- [ ] Test run completes without errors
- [ ] Bug report generated successfully
- [ ] Worker logs show task creation and polling
- [ ] No 401/402/404 errors in logs
- [ ] AI analysis completes within 60 seconds

---

**Last Updated:** 2026-03-22  
**Status:** ✅ Implementation complete and ready for testing
