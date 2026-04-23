# TwinMind Live — Agent Handoff

## Project

Real-time meeting copilot. Records mic in 30s chunks → transcribes via Groq Whisper Large V3 → surfaces 3 live suggestions via GPT-OSS 120B → streams chat answers.

**Repo:** `/Users/prateek07/Workspace/twinmind-live`  
**Production URL:** https://twinmind-live-nine.vercel.app  
**Stack:** Next.js 16 App Router · TypeScript · Tailwind CSS v4 · shadcn/ui · Groq API  
**Auth:** User pastes Groq API key in Settings → stored in React state → sent as `x-api-key` header

---

## Current State (fully shipped)

All changes committed and deployed to production. Build passes clean (`npm run build` — 0 errors, 0 warnings).

---

## What's Been Done

### Bug Fixes
- **Suggestion click leaked full prompt into chat bubble** — `sendChatMessage` now accepts optional `displayContent`. UI shows `**title**\n_preview_`, API receives full detail prompt invisibly. (`app/page.tsx`, `hooks/useSessionManager.ts`)
- **Invalid API key returned HTTP 500 instead of 401** — all 3 routes detect "401" in Groq error and re-surface correct status code.
- **Safari audio dead** — `audio/mp4` MIME type fallback added in `useAudioRecorder.ts`.
- **`fetchSuggestions` stale closure** — replaced `isFetchingSuggestions` state in deps with `isFetchingRef`.
- **Chat rendered raw markdown** — replaced `<p>` with full `ReactMarkdown` component in `ChatPanel.tsx`.

### Prompt Rewrites (`lib/prompts.ts`)
Full v2 rewrite of all 3 prompts. Backup at `lib/prompts.backup.ts` — rollback: `cp lib/prompts.backup.ts lib/prompts.ts` then redeploy.

**Suggestion prompt (biggest change):**
- RULE ZERO block: "deliver the insight, not the topic label" — bad→good pairs calibrate model before rules
- Step 1 reframed: extract most specific noun/number/claim in last 30s — ground every suggestion in it
- Title expanded 3–6 → 5–10 words (room to carry substance)
- Per-type explicit rules: each type (ANSWER/QUESTION/TALKING_POINT/FACT_CHECK/CLARIFICATION) has format rules + bad→good pairs
- Step 4 specificity self-test: "could this appear word-for-word in a different meeting?" → rewrite
- 4 few-shot examples: tech debugging · interview · build-vs-buy planning · academic/study — all 5 types covered

**Detail answer prompt:** sentence 1 = direct answer (no setup), specificity rule (real numbers/tool names), concrete specific closing action.

**Chat prompt:** "be opinionated when evidence supports it", specific > vague, "it depends" only when genuinely undetermined.

### UI / Accessibility
- `focus-visible` rings on all interactive elements (color-matched per panel)
- `aria-hidden` on decorative animations
- `disabled:opacity-30` normalized
- Wider Settings dialog on desktop
- Responsive breakpoints throughout
- `active:` states on cards and buttons
- **Older suggestion batches fade** — opacity-100 / 50 / 25 with `transition-opacity duration-500` as new batches arrive (`components/SuggestionsPanel.tsx`)

### Toast Colors (`components/ui/sonner.tsx`, `lib/toast.ts`)
- 🔴 Red — errors (API failures, invalid key, transcription, chat)
- 🟠 Orange — rate limit 429 (fires `toast.warning` not `toast.error`)
- 🟢 Green — success (wired, ready for use)
- 🔵 Blue — info nudges (no API key set)

### API Testing
23-test suite run. Full results in `api-test-report.pdf`.

| Section | Pass | Warn |
|---|---|---|
| Transcription (T1–T8) | 6 | 2 |
| Suggestions (S1–S8) | 7 | 1 |
| Chat (C1–C7) | 7 | 0 |

---

## Known Issues / Out of Scope

1. **Whisper hallucination on silence** — returns `" you"` filler token on silent audio. Fix: add VAD gate client-side before sending chunk. Noted as out-of-scope in README.
2. **No git remote** — repo has no `origin`. Vercel deploys done via CLI directly.
3. **Suggestions appear after 30s** — one full chunk must complete. Manual flush button (⚡ in transcript panel) forces immediate chunk + suggestions. Consider tooltip explaining this.

---

## Key Files

| File | Purpose |
|---|---|
| `lib/prompts.ts` | All 3 system prompts + default settings |
| `lib/prompts.backup.ts` | Pre-v2 prompt backup — rollback source |
| `lib/toast.ts` | `showError()` helper — colored toasts by context |
| `hooks/useSessionManager.ts` | Core state: transcript, suggestions, chat; `sendChatMessage(content, displayContent?)` |
| `hooks/useAudioRecorder.ts` | MediaRecorder with 30s chunking, Safari mp4 fallback |
| `app/page.tsx` | Root layout, `handleSuggestionClick` wiring |
| `app/api/transcribe/route.ts` | Whisper proxy — 401 pass-through fixed |
| `app/api/suggestions/route.ts` | GPT-OSS 120B JSON mode proxy — 401 pass-through fixed |
| `app/api/chat/route.ts` | GPT-OSS 120B streaming proxy — 401 pass-through fixed |
| `components/ChatPanel.tsx` | Chat UI with ReactMarkdown |
| `components/SuggestionsPanel.tsx` | Suggestion cards, type color coding, batch opacity fade |
| `components/ui/sonner.tsx` | Toaster with accent colors per toast type |
| `api-test-report.pdf` | Full API test results |

---

## Groq API Notes
- Models: `whisper-large-v3` (transcription), `openai/gpt-oss-120b` (suggestions + chat)
- Suggestions: `reasoning_effort: "low"`, `response_format: json_object`, `max_tokens: 1024`
- Chat: `reasoning_effort: "medium"`, streaming, `max_tokens: 2048`
- JSON mode requires word "json" in messages — hardened with `"Respond with valid JSON only."` appended to user message
- Static system prompt = Groq prefix cache (50% cheaper, doesn't count toward 6K TPM rate limit)
- 6K TPM is the binding rate limit on free tier — suggestions every 30s is designed around this

---

## Deploy
```bash
cd /Users/prateek07/Workspace/twinmind-live && npm run build && vercel deploy --prod --yes
```

## Prompt Rollback
```bash
cp /Users/prateek07/Workspace/twinmind-live/lib/prompts.backup.ts \
   /Users/prateek07/Workspace/twinmind-live/lib/prompts.ts
# then redeploy
```
