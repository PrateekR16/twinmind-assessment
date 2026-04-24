# TwinMind Live

Real-time meeting copilot: records mic audio → transcribes via Groq Whisper Large V3 → surfaces 3 context-aware suggestions → streams detailed answers in chat.

**[Live demo →](https://twinmind-live-nine.vercel.app)**

---

## What it does

TwinMind listens to your meeting and surfaces three specific, actionable suggestions every 30 seconds — not topic labels, but the actual insight or question to ask next. Click any suggestion to stream a detailed answer with full conversation context. Ask anything in the chat panel.

Pipeline: mic audio chunks → Groq Whisper Large V3 transcription → GPT-OSS 120B suggestion generation (JSON mode) → GPT-OSS 120B streaming chat.

## Quick start

**Prerequisites:** Node.js 18+, [Groq API key](https://console.groq.com) (free)

```bash
git clone <repo>
cd twinmind-live
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → gear icon → paste Groq API key → mic button → speak.

Suggestions appear after the first 30-second chunk completes. Use ⚡ in the transcript panel to flush immediately.

## Architecture

```
Browser                         Next.js Routes              Groq
  Mic → MediaRecorder
    → 30s chunk (webm/mp4)  →  POST /api/transcribe   →  whisper-large-v3
    ← transcript text       ←

  recent transcript         →  POST /api/suggestions  →  gpt-oss-120b
    ← 3 suggestions (JSON)  ←  reasoning_effort: low

  message / suggestion      →  POST /api/chat         →  gpt-oss-120b
    ← streamed tokens       ←  reasoning_effort: medium
```

Key decisions: [why Groq → ADR-001](./DECISIONS.md#adr-001-groq-over-openaitogether) · [why 30s chunks → ADR-003](./DECISIONS.md#adr-003-30-second-chunk-architecture) · [why static system prompt → ADR-002](./DECISIONS.md#adr-002-static-system-prompt-for-prefix-caching) — full rationale in [DECISIONS.md](./DECISIONS.md).

**API key flow:** User pastes key in Settings → React state only → `x-api-key` header to API routes → forwarded to Groq. Never stored server-side or logged.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 App Router + TypeScript | API routes as Groq proxy; zero-config Vercel deploy |
| UI | shadcn/ui + Tailwind CSS v4 | Production components; dark theme tokens built-in |
| Transcription | Groq Whisper Large V3 | 216× real-time on LPU; accepts webm/mp4 directly |
| LLM | Groq `openai/gpt-oss-120b` | 131K context, ~500 tok/s, JSON mode + streaming |
| Audio | Browser `MediaRecorder` API | Native chunks — no server-side format conversion |
| Toasts | Sonner | Contextual errors: rate limit vs auth vs mic denied |
| Deploy | Vercel | Zero-config Next.js |

Full rationale for each non-obvious choice in [DECISIONS.md](./DECISIONS.md).

## Prompt engineering

Suggestions are insight-first, not topic labels. The prompt uses a hybrid pattern (role-based identity + few-shot calibration + silent chain-of-thought) with per-type format rules across 5 suggestion types and a specificity self-test that catches generic outputs before they reach the UI.

Full breakdown — pattern classification, RULE ZERO framing, few-shot design rationale, safety architecture, cost and token strategy — in [PROMPTS.md](./PROMPTS.md).

## Tradeoffs

**Rate limits:** 6,000 TPM on GPT-OSS 120B is the binding constraint on the free tier. Mitigated by: (1) 3-minute suggestion window instead of full transcript, (2) prefix caching on the static system prompt — cached tokens are 50% cheaper and don't count toward TPM, (3) `reasoning_effort: low` reduces output tokens per suggestion cycle.

**No persistence:** By design. No login, no server-side storage. Session state lives in React. Export button serialises transcript + suggestions + chat as JSON before the tab closes.

**Whisper hallucination on silence:** Whisper Large V3 returns filler tokens (`" you"`, `" ."`) on silent audio chunks. Fix: voice-activity detection gate before sending. Not implemented — see below.

**Safari audio:** Chrome/Firefox record `webm`; Safari records `mp4`. `MediaRecorder` MIME type detection picks the best available format. Whisper accepts both.

## What I'd build next

- **VAD gate** — silence detection before sending chunk to Whisper eliminates hallucination filler tokens without changing the 30s architecture
- **Multi-speaker diarization** — attribute transcript lines to speaker A/B; suggestions become speaker-aware ("You said X, they said Y")
- **Persistent sessions** — IndexedDB for in-browser persistence + export to Notion/Markdown/PDF
- **Custom suggestion types** — user-defined prompt templates per meeting type (sales call vs eng standup vs 1:1)
- **Meeting summary** — end-of-session digest: key decisions, open questions, action items with owners

## Features

- Live mic recording with 30s chunk transcription and auto-scroll
- Manual flush button (⚡) — sends current chunk immediately, refreshes suggestions
- Auto-refresh suggestions every chunk interval while recording
- 5 suggestion types with per-type color coding: Question · Talking Point · Answer · Fact Check · Clarification
- Click suggestion → detailed answer streamed with full transcript context
- Direct chat with streaming responses and multi-turn history
- All prompts editable in Settings — defaults tuned for quality/speed balance
- Export full session as JSON
- Mobile-responsive: tabbed on small screens, 3-column on desktop
- Keyboard accessible: all interactive elements have `focus-visible` rings
