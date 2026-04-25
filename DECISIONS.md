# Engineering Decisions

Design notes on the non-obvious choices in TwinMind Live — what I picked, what I considered, and why.

---

## Groq for everything

The assignment specifies Groq, but I would have picked it anyway. Whisper Large V3 transcribes a 30-second audio chunk in under 500ms on Groq's LPU hardware — that's fast enough that the delay between the user stopping mid-sentence and the transcript updating is imperceptible. On OpenAI's Whisper API the same chunk takes 2–3 seconds, which is just long enough to feel broken. For the LLM side, GPT-OSS 120B runs at around 500 tok/s on Groq — the suggestion panel populates in roughly a second after transcription lands.

The tradeoff is single-provider dependency. If Groq has downtime, everything stops — there's no streaming fallback to OpenAI. For a take-home, that's fine. In production you'd want a fallback route.

---

## The rate limit shapes a lot of the architecture

Groq's free tier caps GPT-OSS 120B at 6,000 tokens per minute. That sounds comfortable until you realize suggestions fire every 30 seconds with a full prompt — and at that rate you get maybe 4–5 cycles before hitting the limit, depending on transcript length.

Three things mitigate this, and they compound:

**Prefix caching.** The system prompt is completely static — identical bytes on every request. Groq automatically caches the prefix, so repeated tokens are 50% cheaper *and* don't count against the TPM limit. This is why all dynamic content (recent transcript, previous suggestion titles) lives in the user message and never touches the system prompt. A single dynamic field injected into the system prompt would invalidate the cache on every request and roughly halve available capacity.

**3-minute suggestion window.** Suggestions use only the last 180 seconds of transcript, not the full session. Recency is the useful signal for in-meeting suggestions anyway — what was said five minutes ago matters less than what was just said. Shorter user message means more of the TPM budget goes to model output.

**reasoning_effort: low for suggestions.** The model's internal reasoning tokens don't appear in the output but still consume budget. Suggestion generation is a structured classification + generation task — the few-shot examples in the system prompt carry most of the reasoning load, so `low` is sufficient. I use `medium` for chat responses, where the user explicitly asked a question and depth matters more than speed.

---

## 30-second chunks over streaming ASR

The clean alternative would be WebSocket streaming ASR — continuous transcript updates with sub-second latency. The reason I didn't do it: Groq's Whisper endpoint is REST-only. Streaming ASR would require switching to Deepgram or AssemblyAI, adding a dependency and cost, and the whole point of the rate-limit architecture above breaks if we're hitting a different provider for transcription.

Thirty seconds is a real cost — cold start latency before any suggestions appear. I added the ⚡ manual flush button for cases where someone wants to trigger immediately, and the smart suggestion firing (suggestions trigger as soon as a chunk lands, not on a timer) means there's no extra wait after that first chunk.

Safari records in mp4 instead of webm. Whisper accepts both. `MediaRecorder` MIME type detection picks whichever the browser supports transparently — nothing to handle on the backend.

---

## The suggestion prompt is not the system prompt

When I started I put everything in the system prompt: transcript, instructions, examples. It made the code simple but the prompt engineering inflexible. Eventually I split it:

The **system prompt** contains only the role, rules, and few-shot examples — everything that's identical across every request. This is what gets prefix-cached.

The **user message** contains the actual transcript context, the meeting type, and a list of previous suggestion titles (for deduplication). This changes every request, which is exactly where dynamic content should be.

The detail_prompt field on each suggestion is a third layer — it encodes the full context for the click-through answer (what's already known + what's specifically needed + the stakes). When the user clicks a suggestion, that field gets sent to the chat API with full transcript context appended. The chat bubble shows the suggestion title and preview; the model receives the full detail_prompt. These are different strings — the `sendChatMessage(content, displayContent?)` split handles this cleanly without exposing prompt internals in the chat history.

---

## No persistence, no server-side auth

The API key lives in React state only. No localStorage, no server-side storage. A few reasons:

Storing the key in localStorage means any JavaScript on the page — including browser extensions — can read it. For a tool where people might paste actual work credentials, that felt like a bad tradeoff for what amounts to a reload convenience feature.

Server-side key management requires auth infrastructure (JWT, OAuth, session tokens) that's at least two weeks of work unrelated to the assignment. It also introduces a new attack surface. Both problems are real; both are out of scope for a take-home.

What this means practically: if you reload the page, you lose your session. Export-to-JSON is the persistence model — it serializes transcript, suggestions, and chat history with timestamps. Not a great production UX, but honest about what the app is.

---

## VAD: known issue, not a bug I forgot

Whisper hallucinate on silent audio. A quiet 30-second chunk comes back as `" you"` or `" ."` — real Whisper tokens for near-silence. These show up in the transcript and slightly degrade suggestion context.

The fix is a voice-activity detection gate: measure amplitude client-side before sending, skip the chunk if it's below a threshold. I didn't implement it because it doesn't change the core architecture and the impact in active meetings (where someone's always speaking) is low. The size-based heuristic in `useAudioRecorder` catches complete silence, which handles the obvious case.

Real VAD would be WebRTC's `AudioWorkletProcessor` with an RMS energy check, or Silero VAD via ONNX for ML-based accuracy at the cost of ~1MB of extra dependency. The right call for a production build; deferred here to stay tight on scope.
