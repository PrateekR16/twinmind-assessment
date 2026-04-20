# TwinMind Assignment — Model Capabilities & API Reference

## Models Required by Assignment

The assignment mandates **Groq for everything** — same models for all candidates so they're comparing prompt quality, not model choice.

| Role | Model | Model ID |
|------|-------|----------|
| Transcription | Whisper Large V3 | `whisper-large-v3` |
| Suggestions + Chat | GPT-OSS 120B | `openai/gpt-oss-120b` |

---

## 1. Whisper Large V3 (Transcription)

### What it is
OpenAI's most accurate speech recognition model. 1,550M parameters, transformer encoder-decoder architecture. On Groq's LPU hardware it runs at **164–217x real-time** (a 10-minute audio file transcribes in ~3.7 seconds).

### Key specs

| Spec | Value |
|------|-------|
| Architecture | Transformer encoder-decoder, 1550M params |
| Word Error Rate | 8.4% (short-form), 10.0% (long-form) |
| Languages | 99+ |
| Max file size | 25 MB (use URL param for larger) |
| Audio downsampled to | 16kHz mono |
| Supported formats | flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, **webm** |
| Speed on Groq | 164-217x real-time |
| Pricing | $0.111/hour of audio |

### API endpoint

```
POST https://api.groq.com/openai/v1/audio/transcriptions
```

### JavaScript example (for your Next.js API route)

```javascript
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: GROQ_API_KEY });

const transcription = await groq.audio.transcriptions.create({
  file: audioFile,           // File object or ReadStream
  model: "whisper-large-v3",
  response_format: "json",   // or "verbose_json" for timestamps
  language: "en",             // improves accuracy + latency
  temperature: 0.0,           // deterministic output
  prompt: "Meeting transcript" // guide style/spelling (max 224 tokens)
});

console.log(transcription.text);
```

### What matters for TwinMind
- **Format**: Your browser records audio as **webm** (via MediaRecorder API) — Whisper accepts this directly, no conversion needed.
- **Chunking**: Record ~30-second chunks from the mic, send each as a separate transcription request. Groq transcribes each in <1 second.
- **Prompt parameter**: Use this to maintain consistency across chunks. Pass the last few words of the previous chunk as the prompt to improve continuity.
- **Language hint**: Always pass `language: "en"` — it significantly improves both accuracy and latency.

---

## 2. GPT-OSS 120B (Suggestions + Chat)

### What it is
OpenAI's flagship open-weight model. Mixture-of-Experts architecture with 120B total parameters but only **5.1B active per forward pass** (efficient). Matches or surpasses OpenAI o4-mini on many benchmarks. Apache 2.0 license.

### Key specs

| Spec | Value |
|------|-------|
| Architecture | MoE, 120B total params, 5.1B active per token |
| Layers | 36 layers, 128 experts, Top-4 routing |
| Context window | **131K tokens** |
| Reasoning modes | `low`, `medium` (default), `high` |
| Structured output | Yes (JSON mode) |
| Function/tool calling | Yes |
| Streaming | Yes |
| Speed on Groq | ~500 tokens/second |
| Input pricing | $0.15 / 1M tokens |
| Output pricing | $0.60 / 1M tokens |
| Prompt caching | 50% off cached prefix tokens (automatic) |

### API endpoint

```
POST https://api.groq.com/openai/v1/chat/completions
```

### JavaScript example

```javascript
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: GROQ_API_KEY });

// Non-streaming (for suggestions)
const completion = await groq.chat.completions.create({
  model: "openai/gpt-oss-120b",
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: transcriptContext }
  ],
  temperature: 0.7,
  max_tokens: 1024,
  response_format: { type: "json_object" }  // Force JSON output
});

// Streaming (for chat answers)
const stream = await groq.chat.completions.create({
  model: "openai/gpt-oss-120b",
  messages: chatMessages,
  stream: true
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content || "";
  process.stdout.write(content);
}
```

### What matters for TwinMind

**For live suggestions (every ~30 seconds):**
- Use `response_format: { type: "json_object" }` to force structured output — guarantees parseable JSON for your 3 suggestion cards.
- Use `reasoning_effort: "low"` to minimize latency. Suggestions need to be fast, not deeply reasoned.
- **Prompt caching is automatic**: Your system prompt is identical every request, so the prefix gets cached at 50% off and lower latency. This is free performance.
- Context window is 131K tokens — plenty to pass the full transcript so far. But be strategic: send the full transcript for context awareness, but instruct the model to focus on the **last 2-3 minutes** for suggestion relevance.

**For chat/detailed answers (on click):**
- Use `stream: true` for first-token-fast UX (assignment evaluates "chat sent to first token" latency).
- Use `reasoning_effort: "medium"` or `"high"` — the user clicked, they're willing to wait for quality.
- Pass the **full transcript** + the clicked suggestion as context for a comprehensive answer.

**Reasoning effort parameter:**
```javascript
// For suggestions — fast
{ reasoning_effort: "low" }

// For detailed answers — quality
{ reasoning_effort: "medium" }
```

---

## API Compatibility

Groq's API is **OpenAI-compatible**. This means:
- You can use the `openai` npm package with `baseURL: "https://api.groq.com/openai/v1"`
- Or use the official `groq-sdk` npm package
- Same request/response format as OpenAI's Chat Completions API
- Streaming uses the same SSE format

```javascript
// Option A: groq-sdk (recommended)
import Groq from "groq-sdk";
const client = new Groq({ apiKey });

// Option B: openai sdk with Groq base URL
import OpenAI from "openai";
const client = new OpenAI({
  apiKey,
  baseURL: "https://api.groq.com/openai/v1"
});
```

---

## Rate Limits (Free Tier)

| Model | Requests/min | Tokens/min | Requests/day |
|-------|-------------|------------|-------------|
| GPT-OSS 120B | 30 | 6,000 | 14,400 |
| Whisper Large V3 | 20 | — | 2,000 |

**Implications for TwinMind:**
- 30 RPM on GPT-OSS = 1 request every 2 seconds. Fine for ~30-second suggestion cycles.
- 6,000 TPM is the real bottleneck — a long transcript as context can eat this fast.
- 20 RPM on Whisper = 1 transcription every 3 seconds. Fine for 30-second audio chunks.
- **Developer tier** (add credit card, no subscription): ~10x higher limits + 25% token discount.
- **Prompt caching**: Cached tokens don't count toward rate limits. Big win for repeated system prompts.

---

## Architecture Decision: Server-Side Proxy

The assignment says: "Settings screen where the user pastes their own Groq API key. Do not hard-code or ship a key."

**Recommended approach**: Next.js API routes as a proxy.
- User pastes API key in settings → stored in React state (client-side only, no persistence needed).
- API key sent in request headers to your Next.js API route.
- API route calls Groq with the user's key.
- This keeps the Groq SDK server-side (no exposing SDK internals to the browser).

```
Browser → Next.js API Route → Groq API
  (mic audio)  (proxy + key)   (transcribe/complete)
```
