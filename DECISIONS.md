# Architecture Decision Records

Engineering decisions made during TwinMind Live. Format: [ADR](https://adr.github.io/) — Context → Decision → Alternatives considered → Consequences.

---

## ADR-001: Groq over OpenAI/Together

**Status:** Accepted

**Context:** Need fast transcription + LLM inference for a real-time meeting use case. OpenAI is the default choice but costs more and has higher latency. The target is a free-tier developer tool where speed matters for UX.

**Decision:** Use Groq for both transcription (`whisper-large-v3`) and LLM (`openai/gpt-oss-120b`).

**Alternatives considered:**
- *OpenAI* — Whisper API + GPT-4o: higher cost, ~2–3s transcription latency vs Groq's sub-500ms. Rejected on latency and cost.
- *Together AI* — good inference speed, larger model selection, but less predictable uptime and no Whisper equivalent. Rejected.
- *Local models* — Whisper.cpp for transcription, Ollama for LLM: no API cost, but too slow for real-time (CPU-bound transcription, no GPU assumed). Rejected.

**Consequences:** Groq LPU delivers 216× real-time transcription and ~500 tok/s generation — fast enough that suggestions feel responsive, not batched. The free tier's 6,000 TPM rate limit on GPT-OSS 120B becomes the primary design constraint that shapes the chunk interval, context window, and prompt caching strategy. No streaming fallback if Groq has downtime.

---

## ADR-002: Static system prompt for prefix caching

**Status:** Accepted

**Context:** Suggestion requests fire every 30 seconds while recording. Each fires a full GPT-OSS 120B inference, consuming TPM from the 6,000 TPM free-tier limit. At 30s intervals, this allows ~12 suggestion cycles before the rate limit resets (assuming ~500 tokens/request).

**Decision:** Keep the system prompt completely static — identical bytes on every request. All dynamic content (recent transcript, previous suggestion titles for deduplication) goes in the user message.

**Alternatives considered:**
- *Dynamic system prompt with injected context* — simpler code structure, but breaks the prefix cache on every request. Rejected.
- *No optimization* — just send everything and handle 429s. Rejected: would hit rate limit within 3–4 minutes of active use.
- *Compress transcript in system prompt* — inject a rolling summary. Adds complexity, breaks cache. Rejected.

**Consequences:** Groq's prefix cache activates on the static system prompt. Cached tokens are 50% cheaper AND do not count toward the 6,000 TPM rate limit — effectively doubling available capacity for dynamic content. Trade-off: the system prompt cannot be personalized per-user without breaking the cache. This is acceptable since prompt personalization is out of scope.

---

## ADR-003: 30-second chunk architecture

**Status:** Accepted

**Context:** Mic audio needs to reach Whisper for transcription. Two approaches: streaming ASR (WebSocket, continuous tokens) or periodic chunk upload (REST, batch).

**Decision:** `MediaRecorder` records 30-second `webm` (or `mp4` on Safari) chunks, uploaded via `POST /api/transcribe`.

**Alternatives considered:**
- *Streaming ASR via WebSocket* — lowest latency, but Groq Whisper doesn't support streaming. Would require Deepgram or AssemblyAI, adding a dependency and cost. Rejected.
- *Sub-10s chunks* — more real-time feel, but 3–6× more API requests pushing harder against the rate limit. At 10s intervals: 6 transcription requests/min vs 2 at 30s. Rejected.
- *Continuous recording, manual upload* — poor UX (user must trigger transcription). Rejected.

**Consequences:** 30 seconds is the minimum latency before any suggestions appear on a fresh session. The ⚡ manual flush button mitigates this for cases where the user wants immediate suggestions. Safari requires `mp4` MIME type — `MediaRecorder` MIME type detection handles this transparently. Chunk boundaries occasionally split sentences; this is acceptable since suggestion context uses the last 180 seconds, not just the current chunk.

---

## ADR-004: reasoning_effort split — low for suggestions, medium for chat

**Status:** Accepted

**Context:** Two LLM endpoints with different latency budgets. Suggestions fire automatically every 30s — the user didn't ask, so latency matters more than depth. Chat fires on explicit user action — the user is waiting, quality matters.

**Decision:** `reasoning_effort: "low"` for `/api/suggestions`, `"medium"` for `/api/chat`.

**Alternatives considered:**
- *Both low* — faster suggestions and chat, but chat quality degrades noticeably on multi-part questions. Rejected.
- *Both medium* — better quality throughout, but suggestions now take ~2s longer each cycle and consume more output tokens against the TPM limit. Rejected.
- *High for chat* — tested: marginal quality improvement over medium for conversational questions. Not worth the token cost or latency. Rejected.

**Consequences:** Suggestions optimize for speed at the cost of some reasoning depth. This is acceptable: 3 diverse suggestions at good quality beats 3 perfect suggestions with 2× latency. Chat answers are the user's explicit ask — medium reasoning noticeably improves multi-step technical answers. Output token reduction from `low` reasoning directly reduces TPM consumption for suggestion cycles.

---

## ADR-005: Insight-first prompt design (RULE ZERO)

**Status:** Accepted

**Context:** v1 suggestion prompt was framed as "find relevant topics in the transcript." Output: topic labels — "API performance issues", "Team capacity questions". Useful for an agenda; useless as in-meeting suggestions. The hiring signal of a better prompt is significant for this role.

**Decision:** Reframe entirely as "deliver the insight, not the pointer to it." Added RULE ZERO block with bad→good calibration pairs before the model reads any rules. Expanded title length from 3–6 to 5–10 words. Added per-type format rules with bad→good pairs for all 5 suggestion types. Added specificity self-test (Step 4, silent).

**Alternatives considered:**
- *Topic label approach (v1)* — produces category names, not actionable content. Rejected.
- *Question-only suggestions* — simpler, but misses fact-check, talking-point, and clarification opportunities. Rejected.
- *Increase temperature/sampling* — produces more varied labels, not more specific insights. Root cause is framing, not sampling. Rejected.

**Consequences:** Suggestions carry standalone value before clicking — title contains the key fact or frames the exact question; preview is the insight, not a description of it. Per-type format rules prevent regression as transcript content varies. Specificity self-test ("could this appear word-for-word in a different meeting?") catches generic outputs before they surface. Prompt is ~12,000 chars — fully offset by prefix caching (ADR-002). See PROMPTS.md for the full breakdown.

---

## ADR-006: sendChatMessage(content, displayContent?) API split

**Status:** Accepted

**Context:** When the user clicks a suggestion, the app needs to send a full `detail_prompt` to the LLM — the prompt encodes known context + specific need + stakes and runs to ~800 chars. But displaying that raw prompt in the chat bubble exposes prompt internals and confuses the user.

**Decision:** `sendChatMessage(content: string, displayContent?: string)` — the API receives `content` (full prompt), the chat bubble renders `displayContent` (suggestion title + preview in markdown). When `displayContent` is omitted, both are the same.

**Alternatives considered:**
- *Send truncated prompt to API* — loses the encoded context, degrades answer quality. Rejected.
- *Show full prompt in chat bubble* — confusing, exposes internals, clutters conversation history. Rejected.
- *Two separate functions* (sendChat / sendSuggestionChat) — inconsistent API surface, duplication in call sites. Rejected.

**Consequences:** Chat history is readable — suggestion clicks show `**title**\n_preview_` not raw prompts. The LLM receives full context. Pattern generalizes: any feature where display content ≠ API content uses the optional second param without new abstractions. The fix caught a real UX bug that was shipped for several sessions before being noticed.

---

## ADR-007: No persistence, no server-side auth

**Status:** Accepted

**Context:** The app uses a user-supplied Groq API key for all inference. Options: store key server-side (requires auth), store in localStorage (persists across sessions but stores key in browser storage), keep in React state (ephemeral, most private).

**Decision:** Zero server-side state. API key in React state only. No database. No user accounts. Export-to-JSON is the persistence model.

**Alternatives considered:**
- *Supabase/Postgres for session storage* — enables history, cross-device sync, but requires user accounts or anonymous session IDs, adds infrastructure cost and complexity. Out of scope for assessment. Rejected.
- *localStorage for API key* — simpler UX (key persists on reload), but key stored in browser storage is accessible to any JS on the page and to extensions. Security tradeoff not worth it at this scope. Rejected.
- *Server-side key management* — eliminates client-side key exposure, but requires auth infrastructure (JWT, OAuth). Adds 2–3 weeks of scope. Rejected.

**Consequences:** Zero privacy risk — no user data touches the server beyond the proxied API calls. Zero infrastructure cost beyond Vercel hosting. Simple deploy with no env vars beyond build-time keys. Acceptable for take-home scope. Real product would need persistence; IndexedDB + optional cloud sync is the obvious next step (see README).

---

## ADR-008: VAD gate deferred

**Status:** Deferred

**Context:** Whisper Large V3 hallucinations on silent audio chunks — returns filler tokens (`" you"`, `" ."`) that pollute the transcript with noise. This degrades suggestion quality when the room goes quiet.

**Decision:** Defer voice-activity detection (VAD) gate. Document as known issue in README.

**Alternatives considered:**
- *WebRTC VAD* — browser-native, low latency, no extra API call. `AudioWorkletProcessor` + energy threshold. Best option when implemented.
- *Silence energy threshold* — measure RMS amplitude client-side before sending; skip chunk if below threshold. Simple but misses quiet speech. Could work as a first pass.
- *Silero VAD* — ML-based, high accuracy, runs in-browser via ONNX. Adds ~1MB dependency and setup complexity.
- *Skip-if-duplicate* — compare transcript text; if chunk returns the same text as previous (hallucination pattern), discard. Cheap heuristic, catches the common case.

**Consequences:** Silent chunks produce garbage transcript lines that may slightly degrade suggestion context. Accepted for assessment scope — the fix is well-understood (gate the fetch), the architecture doesn't change, and the impact is low in active meetings where someone is always speaking. Not deferred due to difficulty; deferred to keep scope tight and ship faster.
