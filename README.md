# TwinMind — Live Suggestions

A real-time meeting copilot that listens to your mic, transcribes speech every ~30 seconds, and surfaces 3 context-aware suggestions using Groq AI. Click any suggestion to get a detailed answer in the chat panel.

## Live Demo

[Deploy URL here after `vercel deploy`]

## Setup

**Prerequisites**: Node.js 18+, a [Groq API key](https://console.groq.com)

```bash
git clone <repo>
cd twinmind-live
npm install
npm run dev
# Open http://localhost:3000
# Click the gear icon → paste your Groq API key → Save
# Click Start → speak → watch suggestions appear
```

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14+ (App Router, TypeScript) | API routes for server-side Groq proxy; Vercel-native |
| UI | shadcn/ui + Tailwind CSS | Production-quality components without UI exploration time |
| Transcription | Groq Whisper Large V3 | 164-217x real-time on LPU; accepts webm directly |
| LLM | Groq GPT-OSS 120B | 131K context, ~500 tok/s, JSON mode, streaming |
| Audio | Browser `MediaRecorder` API | 30s webm chunks — no format conversion |
| Deployment | Vercel | Zero-config Next.js |

## Architecture

```
Browser                     Next.js API Routes          Groq
  Mic → MediaRecorder
    → 30s webm blob   →    /api/transcribe    →   whisper-large-v3
    ← transcript text ←

  transcript state   →    /api/suggestions   →   gpt-oss-120b
    ← 3 suggestions  ←    (JSON mode, low reasoning)

  user clicks/types  →    /api/chat          →   gpt-oss-120b
    ← SSE stream     ←    (streaming, medium reasoning)
```

**API key flow**: User pastes key in Settings → stored in React state only → sent via `x-api-key` header to Next.js routes → routes call Groq. Key never stored server-side.

## Prompt Strategy

### Why this prompt design wins

**Live suggestions** use a static system prompt (identical every request) so Groq's automatic prefix cache kicks in — cached tokens are 50% cheaper and don't count against the 6,000 TPM rate limit. All dynamic context (recent transcript + previous suggestion titles) goes in the user message.

**Suggestion selection logic** encoded in the prompt:
- If a question was just asked → one suggestion **must** be `ANSWER` (high-value, instant)
- If a factual claim was made → one suggestion **should** be `FACT_CHECK`
- If the topic is shifting → include a `TALKING_POINT` for the new direction
- Each of the 3 suggestions must be a **different type** — forces diversity
- The `preview` field (10-15 words) must deliver **standalone value** — useful even if never clicked

**Context window strategy**:
- Suggestions: last 3 minutes of transcript (`suggestionContextWindow = 180s`) — recent enough to be relevant, small enough to stay under 6K TPM
- Detail answers: up to 20K characters of full transcript — comprehensive context for quality answers
- `previous_suggestions` list passed with every request to prevent repetition across batches

**Chat**: Full transcript injected into system prompt so the model references specific conversation moments.

### Reasoning effort

| Use case | `reasoning_effort` | Why |
|---|---|---|
| Suggestions (every 30s) | `"low"` | Speed > depth; suggestions need to be fast |
| Chat answers (on click) | `"medium"` | User clicked → willing to wait for quality |

## Tradeoffs

**Rate limits (free tier)**: 6,000 TPM on GPT-OSS 120B is the real constraint. Mitigated by: (1) 3-minute suggestion context window instead of full transcript, (2) prompt caching on static system prompt, (3) `reasoning_effort: "low"` for suggestions reduces output tokens.

**Browser compatibility**: Chrome/Firefox record as `webm` (Whisper accepts it directly). The `MediaRecorder` mimeType detection handles format selection gracefully.

**No persistence**: By design — the assignment says "no login, no data persistence when reloading." The Export button saves the full session as JSON before closing.

## Features

- Start/Stop mic with live recording indicator
- Transcript appends every ~30s with timestamps, auto-scrolls
- Manual refresh button flushes the current audio chunk and fetches fresh suggestions
- Suggestions auto-refresh every chunk interval while recording
- 5 suggestion types with color-coded badges (Question, Talking Point, Answer, Fact Check, Clarification)
- New suggestion batches prepend at top; old batches remain visible below
- Click suggestion → detailed answer streamed into chat with full transcript context
- Type any question directly in chat
- Export full session (transcript + all suggestion batches + chat) as JSON
- All prompts and settings editable in-app; defaults are tuned optimal values
