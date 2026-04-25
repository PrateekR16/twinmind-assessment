# TwinMind Live

Real-time meeting copilot. Records mic audio, transcribes via Groq Whisper Large V3, and surfaces 3 context-aware suggestions every 30 seconds. Click a suggestion to stream a detailed answer in the chat panel.

**[Live demo](https://twinmind-live-nine.vercel.app)**

---

## What it does

TwinMind listens to your meeting and surfaces specific, actionable suggestions: not topic labels, but the actual insight, the exact question to ask next, or the fact-check on what was just said. Click any suggestion to get a detailed answer with full conversation context. The chat panel handles direct questions too.

Pipeline: mic -> Groq Whisper Large V3 (transcription) -> GPT-OSS 120B (suggestions in JSON mode) -> GPT-OSS 120B streaming (chat).

## Quick start

Node.js 18+ and a [Groq API key](https://console.groq.com) (free tier works).

```bash
git clone <repo>
cd twinmind-live
npm install
npm run dev
```

Open [localhost:3000](http://localhost:3000), click the gear icon, paste your API key, hit the mic button, and speak.

Suggestions appear after the first 30-second chunk. Use the lightning bolt button in the transcript panel to flush immediately.

## Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js App Router + TypeScript | API routes as Groq proxy; one-command Vercel deploy |
| UI | shadcn/ui + Tailwind CSS v4 | Dark theme tokens, accessible components out of the box |
| Transcription | Groq Whisper Large V3 | Sub-500ms per chunk; accepts webm and mp4 directly |
| LLM | Groq openai/gpt-oss-120b | 131K context, ~500 tok/s, JSON mode and streaming |
| Audio | Browser MediaRecorder | Native chunking, no server-side format conversion |
| Toasts | Sonner | Rate limit vs auth vs mic-denied errors look visually distinct |

## Architecture

```
Browser                           Next.js routes            Groq
  Mic -> MediaRecorder
    -> 30s chunk (webm/mp4)  ->  POST /api/transcribe  ->  whisper-large-v3
    <- transcript text       <-

  recent transcript          ->  POST /api/suggestions ->  gpt-oss-120b
    <- 3 suggestions (JSON)  <-  reasoning_effort: low

  message / suggestion       ->  POST /api/chat        ->  gpt-oss-120b
    <- streamed tokens       <-  reasoning_effort: medium
```

API key flow: user pastes key in Settings, it stays in React state only, gets sent as `x-api-key` header to API routes, and is forwarded to Groq from there. Never stored server-side.

## Prompt design

The suggestion prompt went through two iterations. The first framing ("find relevant topics") produced category names that are useful for an agenda but useless mid-meeting. The current version reframes around delivering the insight itself. Titles carry the actual fact or verbatim question to say out loud. Previews are the insight, not a description of it.

Technically it is a hybrid pattern: role-based identity, bad/good calibration pairs before the rules (not after), and silent chain-of-thought for signal extraction and specificity self-test. The full reasoning is in [PROMPTS.md](./PROMPTS.md).

## Tradeoffs

**Rate limits** are the binding constraint on the free tier (6,000 TPM on GPT-OSS 120B). Three mitigations compound: prefix caching on the static system prompt (cached tokens do not count toward TPM), a 3-minute suggestion window instead of the full transcript, and `reasoning_effort: low` for suggestion cycles. Together they make normal meeting usage sustainable without hitting the cap.

**No persistence** is a deliberate choice. Storing the API key in localStorage exposes it to any JavaScript on the page. Server-side key management requires auth infrastructure that is out of scope. The export button serializes transcript, suggestions, and chat as JSON, which is good enough for evaluation and honest about what the app is.

**Whisper hallucination on silence.** Silent chunks return filler tokens that pollute the transcript. A VAD gate (amplitude check before upload) would fix this cleanly and nothing in the architecture would need to change. Not implemented for this version. More detail in [DECISIONS.md](./DECISIONS.md).

## Features

- Live mic recording with 30s chunk transcription and auto-scroll
- Manual flush button to send current chunk immediately
- Smart suggestion firing: triggers on transcription complete rather than a fixed timer, gated on new content so it does not fire twice on the same transcript
- Auto-detected meeting type (technical, interview, sales, planning, learning, general) injected into suggestion context after chunk 2
- 5 suggestion types with per-type color coding: Question, Talking Point, Answer, Fact Check, Clarification
- Click any suggestion to stream a detailed answer with full transcript context
- Direct chat with streaming responses and multi-turn history
- All prompts editable in Settings, with defaults tuned for quality and speed on the free tier
- Export full session as JSON with timestamps
- Mobile-responsive: tabbed on small screens, 3-column on desktop

## What I would build next

**VAD gate.** An amplitude check before sending a chunk to Whisper would eliminate hallucination transcripts. The architecture does not need to change, just the upload gate in `useAudioRecorder`.

**Multi-speaker diarization.** Attribute transcript lines to speaker A or B. Suggestions become speaker-aware and "you said X, they said Y" is more useful than an unlabeled transcript.

**Persistent sessions.** IndexedDB for in-browser history with optional export to Notion or Markdown. The stateless architecture makes this an additive change.

**Custom suggestion templates per meeting type.** User-defined prompt overlays for specific recurring contexts like weekly 1:1s, incident retrospectives, or board prep.
