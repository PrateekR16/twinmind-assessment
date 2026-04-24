# Assessment Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve TwinMind Live against each evaluation criterion — suggestion quality first, latency + UX second, robustness third.

**Architecture:** All changes are additive. No component is removed. State flows stay the same (hooks → page → panels). Prompt system prompt stays static for prefix caching — meeting context goes in the user message only.

**Tech Stack:** Next.js 16, TypeScript, Tailwind CSS v4, Groq SDK, React hooks, MediaRecorder API

**Evaluation priority (from brief):**
1. Quality of live suggestions
2. Quality of detailed chat answers
3. Prompt engineering
4. Full-stack engineering
5. Code quality
6. Latency
7. Overall experience

---

## Audit Findings (read before implementing)

### Criterion 1 & 3 — Suggestion + Prompt quality

**MISSING: Meeting context.** The suggestion prompt has no idea what kind of meeting is happening. A job interview and an engineering standup produce the same prompt. Adding even a simple `meetingType` field dramatically improves suggestion specificity — the prompt can calibrate which suggestion types to prefer (ANSWER for interviews, TALKING_POINT for planning, FACT_CHECK for technical reviews). This is the single highest-ROI change.

**BUG: Race condition on suggestion timer.** The suggestion interval fires every 30s from `isRecording` state change (in `page.tsx`). But transcription is async — when the interval fires, the latest audio chunk may still be in-flight. Suggestions fire with stale context (missing the most recent ~5s of transcript).

**BUG: No new-content gate.** Suggestions fire every 30s even if zero new transcript has arrived (user paused, room went quiet). This burns TPM and produces duplicate suggestions.

**MISS: 30s cold start.** No suggestions fire until the first interval tick — 30s of silence from the user's perspective. The app should trigger suggestions as soon as the first transcript chunk lands.

### Criterion 4 — Full-stack engineering

**BUG: No 429 handling.** Groq rate limit errors produce `{ status: 429 }` from the SDK but the route catches them as generic errors → returns 500 to the client. The client sees "Suggestions failed" not "Rate limit hit."

**BUG: No request timeouts.** All `fetch` calls run indefinitely. If Groq is slow or the network drops, the UI hangs with a spinner forever. No AbortController anywhere.

**BUG: No audio constraints.** `getUserMedia({ audio: true })` uses browser defaults. Explicit echo cancellation and noise suppression constraints improve Whisper accuracy noticeably, especially in noisy environments.

**BUG: Stop/start race in useAudioRecorder.** When the chunk interval fires, `current.stop()` is called and then `startNewRecorder()` immediately. But `recorder.onstop` fires asynchronously — the new recorder may start before the previous blob is processed. In practice Chrome handles this, but it's fragile.

### Criterion 6 — Latency

**BAD: 30s cold start** (same as above). Fix: trigger suggestions after first transcription completes.

**BAD: No post-transcription trigger.** Even after the first chunk, subsequent transcriptions don't trigger suggestions — only the timer does. If a user speaks in bursts (silence → burst → silence), the suggestion might fire mid-silence rather than right after the burst completes.

### Criterion 7 — Overall experience

**MISS: No countdown timer.** The suggestions panel shows "Suggestions appear automatically as you speak" but doesn't say when. A "Next in 14s" countdown makes the app feel responsive and alive — the user knows something is coming.

**MISS: VAD gate deferred.** Whisper hallucinations (`" you"`, `" ."`) on silent chunks pollute the transcript. Basic RMS amplitude check client-side before upload eliminates this. Not full VAD — just a size + energy threshold check.

**MISS: Manual flush not discoverable.** The ⚡ button in the transcript header is invisible unless you're looking for it. No label. No tooltip on mobile.

---

## Task 1: Meeting type selector + prompt injection

**Impact:** Criteria 1, 3 (highest priority). Meeting type dramatically improves suggestion specificity without breaking prefix cache — it goes in the user message, not the system prompt.

**Files:**
- Modify: `types/index.ts` — add `meetingType` to `SessionSettings`
- Modify: `lib/prompts.ts` — add `DEFAULT_MEETING_TYPE` constant
- Modify: `components/SettingsDialog.tsx` — add meeting type selector
- Modify: `app/page.tsx` — add meeting type to `INITIAL_SETTINGS`
- Modify: `app/api/suggestions/route.ts` — inject meeting type into user message
- Modify: `hooks/useSessionManager.ts` — pass meetingType to suggestions body

**Meeting types:** `general` | `technical` | `interview` | `sales` | `planning` | `learning`

- [ ] **Step 1: Add `meetingType` to types**

```typescript
// types/index.ts — add to SessionSettings
export type MeetingType =
  | "general"
  | "technical"
  | "interview"
  | "sales"
  | "planning"
  | "learning";

export interface SessionSettings {
  apiKey: string;
  meetingType: MeetingType;   // ← add this
  suggestionSystemPrompt: string;
  detailAnswerPrompt: string;
  chatSystemPrompt: string;
  suggestionContextWindow: number;
  answerContextWindow: number;
  chunkIntervalSeconds: number;
}
```

- [ ] **Step 2: Add default in prompts.ts**

```typescript
// lib/prompts.ts — at the bottom of DEFAULT_SETTINGS
export const DEFAULT_SETTINGS = {
  suggestionContextWindow: 180,
  answerContextWindow: 20000,
  chunkIntervalSeconds: 30,
  meetingType: "general" as MeetingType,  // ← add this
};
```

Also add this mapping (used in user message injection):

```typescript
// lib/prompts.ts — add after DEFAULT_SETTINGS
export const MEETING_TYPE_CONTEXT: Record<MeetingType, string> = {
  general:    "General meeting — no specific format.",
  technical:  "Technical discussion: engineering, code review, architecture, debugging. Prefer FACT_CHECK and ANSWER types. Ground suggestions in specific technical claims.",
  interview:  "Job interview (candidate or interviewer). Prefer QUESTION and TALKING_POINT types. Focus on candidate evaluation, role fit, probing questions, and honest disclosure.",
  sales:      "Sales call or demo. Prefer QUESTION and CLARIFICATION types. Focus on uncovering objections, qualifying needs, and moving the conversation forward.",
  planning:   "Planning session or roadmap review. Prefer TALKING_POINT and CLARIFICATION types. Focus on decision criteria, scope, trade-offs, and timeline assumptions.",
  learning:   "Lecture, tutoring, or study session. Prefer ANSWER and FACT_CHECK types. Focus on concept accuracy, pedagogical depth, and follow-up questions that test understanding.",
};
```

- [ ] **Step 3: Add meeting type selector to SettingsDialog**

In `SettingsDialog.tsx`, add a select field before the API key section. Import `MeetingType` from types. Add this field:

```tsx
// In SettingsDialog.tsx — add this Field before the API key Field
<Field label="Meeting Type" hint="Shapes what kinds of suggestions are prioritized.">
  <select
    value={draft.meetingType}
    onChange={(e) => update("meetingType", e.target.value as MeetingType)}
    className={inputCls + " cursor-pointer"}
  >
    <option value="general">General</option>
    <option value="technical">Technical / Engineering</option>
    <option value="interview">Interview</option>
    <option value="sales">Sales / Demo</option>
    <option value="planning">Planning / Roadmap</option>
    <option value="learning">Learning / Lecture</option>
  </select>
</Field>
```

Also add a meeting type badge in the header (page.tsx) near the title when meetingType ≠ "general":

```tsx
// page.tsx header — after the "Live Suggestions" span
{settings.meetingType !== "general" && (
  <span className="hidden sm:inline text-[10px] bg-white/[0.06] border border-white/[0.08] text-white/45 px-2 py-0.5 rounded-full capitalize">
    {settings.meetingType}
  </span>
)}
```

- [ ] **Step 4: Pass meetingType through to suggestion API call**

In `useSessionManager.ts`, update `fetchSuggestions`:

```typescript
// useSessionManager.ts — add to the JSON body in fetchSuggestions
body: JSON.stringify({
  recentTranscript,
  fullTranscript: getFullTranscript().slice(-settings.answerContextWindow),
  previousSuggestions: allPrevSuggestions,
  systemPrompt: settings.suggestionSystemPrompt,
  meetingType: settings.meetingType,  // ← add this
}),
```

Update `SuggestionsBody` interface in the route:

```typescript
// app/api/suggestions/route.ts
interface SuggestionsBody {
  recentTranscript: string;
  fullTranscript: string;
  previousSuggestions: Pick<Suggestion, "title" | "type">[];
  systemPrompt: string;
  meetingType?: string;  // ← add this (optional for back-compat)
}
```

- [ ] **Step 5: Inject meeting context into user message (NOT system prompt — preserves prefix cache)**

```typescript
// app/api/suggestions/route.ts — update userMessage construction
const { recentTranscript, previousSuggestions, systemPrompt, meetingType } = body;

// Import MEETING_TYPE_CONTEXT from a shared location or inline the mapping
const MEETING_CONTEXT: Record<string, string> = {
  general:    "General meeting.",
  technical:  "Technical discussion — engineering, code review, architecture, debugging. Prefer FACT_CHECK and ANSWER. Ground suggestions in specific technical claims.",
  interview:  "Job interview. Prefer QUESTION and TALKING_POINT. Focus on probing questions, candidate evaluation, honest disclosure.",
  sales:      "Sales call or demo. Prefer QUESTION and CLARIFICATION. Focus on uncovering objections and qualifying needs.",
  planning:   "Planning or roadmap session. Prefer TALKING_POINT and CLARIFICATION. Focus on decision criteria, scope, trade-offs.",
  learning:   "Lecture, tutoring, or study session. Prefer ANSWER and FACT_CHECK. Focus on concept accuracy and comprehension.",
};

const meetingContext = meetingType ? (MEETING_CONTEXT[meetingType] ?? "General meeting.") : "General meeting.";

const userMessage = `MEETING TYPE: ${meetingContext}

RECENT TRANSCRIPT (last ~2-3 minutes — focus suggestions on this):
${recentTranscript}${previousList}

Generate 3 suggestions now. Respond with valid JSON only.`;
```

- [ ] **Step 6: Update INITIAL_SETTINGS in page.tsx**

```typescript
// page.tsx
const INITIAL_SETTINGS: SessionSettings = {
  apiKey: "",
  meetingType: "general",  // ← add this
  suggestionSystemPrompt: DEFAULT_SUGGESTION_SYSTEM_PROMPT,
  detailAnswerPrompt: DEFAULT_DETAIL_ANSWER_PROMPT,
  chatSystemPrompt: DEFAULT_CHAT_SYSTEM_PROMPT,
  ...DEFAULT_SETTINGS,
};
```

- [ ] **Step 7: Build + verify no TypeScript errors**

```bash
cd /Users/prateek07/Workspace/twinmind-live && npm run build
```

Expected: clean build, no TS errors.

- [ ] **Step 8: Commit**

```bash
git add types/index.ts lib/prompts.ts components/SettingsDialog.tsx app/page.tsx app/api/suggestions/route.ts hooks/useSessionManager.ts
git commit -m "feat: add meeting type selector — context injected into suggestion user message"
```

---

## Task 2: Smart suggestion firing (fix cold start + race condition)

**Impact:** Criteria 1, 6, 7. Eliminates 30s cold start, fixes race condition where suggestions fire before transcription completes, adds new-content gate.

**Current behavior:** Suggestion timer fires every `chunkIntervalSeconds` from recording start. Problem: fires before first transcription lands, fires even when no new content exists.

**Target behavior:**
- Suggestions fire after first transcription chunk lands (cold start eliminated)
- Subsequent fires: only if new transcript chunks have arrived since last suggestion
- Timer still exists as a fallback (fires if content is present but user forgot to trigger)
- Transcription completion triggers suggestion check (not timer tick)

**Files:**
- Modify: `hooks/useSessionManager.ts` — expose `triggerSuggestionsIfNew()` + track last-suggested chunk count
- Modify: `app/page.tsx` — call trigger from `onChunk` callback after transcription, restructure interval

- [ ] **Step 1: Add `lastSuggestedCountRef` and `triggerSuggestionsIfNew` to useSessionManager**

In `useSessionManager.ts`, add a ref to track chunk count at last suggestion:

```typescript
// hooks/useSessionManager.ts — after isFetchingRef
const lastSuggestedChunkCountRef = useRef<number>(0);
```

Add a new exported function `triggerSuggestionsIfNew`:

```typescript
// hooks/useSessionManager.ts — add after fetchSuggestions
const triggerSuggestionsIfNew = useCallback(async () => {
  const currentCount = chunksRef.current.length;
  if (currentCount === 0) return;
  if (currentCount <= lastSuggestedChunkCountRef.current) return; // no new content
  await fetchSuggestions();
  lastSuggestedChunkCountRef.current = chunksRef.current.length;
}, [fetchSuggestions]);
```

Update the return:

```typescript
return {
  // ...existing fields...
  triggerSuggestionsIfNew,  // ← add this
};
```

Also update the interface:

```typescript
interface UseSessionManagerReturn {
  // ...existing fields...
  triggerSuggestionsIfNew: () => Promise<void>;
}
```

- [ ] **Step 2: Call triggerSuggestionsIfNew after transcription completes**

In `addTranscriptFromAudio`, after the chunk is added to state, call the trigger:

```typescript
// hooks/useSessionManager.ts — in addTranscriptFromAudio, after setTranscriptChunks
const chunk: TranscriptChunk = { id: nanoid(), text, timestamp: Date.now() };
setTranscriptChunks((prev) => {
  const updated = [...prev, chunk];
  chunksRef.current = updated;
  return updated;
});
// Trigger suggestions on every new chunk (gated internally by new-content check)
// Use setTimeout(0) to let state settle before suggestions read it
setTimeout(() => {
  triggerSuggestionsIfNew();
}, 0);
```

Wait — `triggerSuggestionsIfNew` is defined after `addTranscriptFromAudio` in the hook and would be a stale closure. Use a ref pattern:

```typescript
// hooks/useSessionManager.ts — add near the top with other refs
const triggerSuggestionsIfNewRef = useRef<() => Promise<void>>(() => Promise.resolve());
```

Then at the point where `triggerSuggestionsIfNew` is defined:

```typescript
const triggerSuggestionsIfNew = useCallback(async () => {
  const currentCount = chunksRef.current.length;
  if (currentCount === 0) return;
  if (currentCount <= lastSuggestedChunkCountRef.current) return;
  await fetchSuggestions();
  lastSuggestedChunkCountRef.current = chunksRef.current.length;
}, [fetchSuggestions]);

// Keep ref in sync so addTranscriptFromAudio can call it without stale closure
triggerSuggestionsIfNewRef.current = triggerSuggestionsIfNew;
```

Then in `addTranscriptFromAudio`:

```typescript
// After setTranscriptChunks block
setTimeout(() => {
  triggerSuggestionsIfNewRef.current();
}, 50); // 50ms lets React state settle
```

- [ ] **Step 3: Update interval in page.tsx to use triggerSuggestionsIfNew**

The current interval calls `session.fetchSuggestions()` unconditionally. Replace with `session.triggerSuggestionsIfNew()` — the timer now acts as a fallback (fires on schedule, but only if new content exists):

```typescript
// app/page.tsx — in the useEffect that manages autoRefreshRef
useEffect(() => {
  if (isRecording) {
    autoRefreshRef.current = setInterval(() => {
      session.triggerSuggestionsIfNew();  // ← was session.fetchSuggestions()
    }, settings.chunkIntervalSeconds * 1000);
  } else {
    if (autoRefreshRef.current) {
      clearInterval(autoRefreshRef.current);
      autoRefreshRef.current = null;
    }
  }
  return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current); };
}, [isRecording, settings.chunkIntervalSeconds]); // eslint-disable-line
```

Also update `onManualRefresh` to reset the count (manual flush should always fire):

```typescript
// In the TranscriptPanel's onManualRefresh — change to call fetchSuggestions directly
// (bypass the new-content gate for manual flush)
onManualRefresh={session.fetchSuggestions}  // unchanged — correct behavior
```

- [ ] **Step 4: Build and verify**

```bash
npm run build
```

Expected: no TS errors.

- [ ] **Step 5: Commit**

```bash
git add hooks/useSessionManager.ts app/page.tsx
git commit -m "feat: smart suggestion firing — trigger on transcription complete, gate on new content"
```

---

## Task 3: Countdown timer in suggestions panel

**Impact:** Criteria 7 (experience). Makes the app feel alive. User knows suggestions are coming.

**Design:** Show "Next in Xs" in the suggestions panel header while recording + when no suggestions fetched yet. Count down from `chunkIntervalSeconds`. Reset when suggestions land. Show nothing when not recording.

**Files:**
- Modify: `app/page.tsx` — track countdown state
- Modify: `components/SuggestionsPanel.tsx` — display countdown in header

- [ ] **Step 1: Add countdown state and logic to page.tsx**

```typescript
// app/page.tsx — add after autoRefreshRef
const [countdown, setCountdown] = useState<number | null>(null);
const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

// Helper to start countdown
const startCountdown = useCallback((seconds: number) => {
  setCountdown(seconds);
  if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
  countdownIntervalRef.current = setInterval(() => {
    setCountdown((prev) => {
      if (prev === null || prev <= 1) return null;
      return prev - 1;
    });
  }, 1000);
}, []);

const resetCountdown = useCallback(() => {
  startCountdown(settings.chunkIntervalSeconds);
}, [startCountdown, settings.chunkIntervalSeconds]);
```

Update the recording interval to reset countdown:

```typescript
useEffect(() => {
  if (isRecording) {
    startCountdown(settings.chunkIntervalSeconds);
    autoRefreshRef.current = setInterval(() => {
      session.triggerSuggestionsIfNew();
      resetCountdown();
    }, settings.chunkIntervalSeconds * 1000);
  } else {
    setCountdown(null);
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (autoRefreshRef.current) {
      clearInterval(autoRefreshRef.current);
      autoRefreshRef.current = null;
    }
  }
  return () => {
    if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
  };
}, [isRecording, settings.chunkIntervalSeconds]); // eslint-disable-line
```

Reset countdown when suggestions land (wrap `triggerSuggestionsIfNew` at call site):

```typescript
// In the onManualRefresh handler passed to TranscriptPanel:
onManualRefresh={() => { session.fetchSuggestions(); resetCountdown(); }}
```

And when auto-suggestion fires after transcription, reset countdown:
Actually this is complex to wire. Simpler: watch `session.suggestionBatches` length and reset when it changes.

```typescript
// app/page.tsx
const prevBatchCountRef = useRef(0);
useEffect(() => {
  const current = session.suggestionBatches.length;
  if (current > prevBatchCountRef.current && isRecording) {
    prevBatchCountRef.current = current;
    startCountdown(settings.chunkIntervalSeconds);
  }
}, [session.suggestionBatches.length, isRecording, startCountdown, settings.chunkIntervalSeconds]);
```

- [ ] **Step 2: Pass countdown to SuggestionsPanel**

```typescript
// app/page.tsx — update SuggestionsPanel JSX
const suggestionsPanel = (
  <SuggestionsPanel
    batches={session.suggestionBatches}
    isFetching={session.isFetchingSuggestions}
    onRefresh={session.fetchSuggestions}
    onSuggestionClick={handleSuggestionClick}
    countdown={countdown}             // ← add
    isRecording={isRecording}         // ← add
  />
);
```

- [ ] **Step 3: Update SuggestionsPanel to show countdown**

```typescript
// components/SuggestionsPanel.tsx — update interface
interface SuggestionsPanelProps {
  batches: SuggestionBatch[];
  isFetching: boolean;
  onRefresh: () => void;
  onSuggestionClick: (suggestion: Suggestion) => void;
  countdown: number | null;   // ← add
  isRecording: boolean;       // ← add
}
```

In the header section, after the spinner add:

```tsx
{isRecording && !isFetching && countdown !== null && (
  <span className="text-[10px] text-violet-400/40 tabular-nums ml-1">
    {countdown}s
  </span>
)}
```

Also update the empty state message:

```tsx
{batches.length === 0 ? (
  <p className="text-[13px] text-white/40 leading-relaxed mt-6 text-center">
    {isRecording
      ? countdown !== null
        ? `First suggestions in ~${countdown}s`
        : "Listening for content…"
      : "Suggestions appear automatically as you speak"}
  </p>
) : (
  // existing batch rendering
)}
```

- [ ] **Step 4: Build + commit**

```bash
npm run build
git add app/page.tsx components/SuggestionsPanel.tsx
git commit -m "feat: countdown timer in suggestions panel — shows next-suggestions ETA while recording"
```

---

## Task 4: Rate limit handling (429) + request timeouts

**Impact:** Criteria 4, 7. Prevents cryptic "Suggestions failed" on rate limit. Prevents infinite spinners on slow networks.

**Files:**
- Modify: `app/api/suggestions/route.ts` — proper 429 mapping
- Modify: `app/api/transcribe/route.ts` — proper 429 mapping
- Modify: `app/api/chat/route.ts` — proper 429 mapping
- Modify: `hooks/useSessionManager.ts` — handle 429 on client, add AbortController

- [ ] **Step 1: Fix 429 mapping in all API routes**

The Groq SDK throws errors with messages like `"Rate limit exceeded"` or with `status: 429`. Update the error handling in all three routes:

```typescript
// Shared error handler pattern — apply to all 3 routes
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : "Request failed";
  const isAuth = message.includes("401") || message.toLowerCase().includes("invalid api key");
  const isRateLimit = message.includes("429") || message.toLowerCase().includes("rate limit");
  const status = isAuth ? 401 : isRateLimit ? 429 : 500;
  return NextResponse.json({ error: message, retryAfter: isRateLimit ? 60 : undefined }, { status });
}
```

Apply this pattern to:
- `app/api/suggestions/route.ts` — replace existing catch block
- `app/api/transcribe/route.ts` — replace existing catch block
- `app/api/chat/route.ts` — replace existing catch block (uses `new Response` not `NextResponse.json`)

For chat route (uses raw Response):
```typescript
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : "Chat failed";
  const isAuth = message.includes("401") || message.toLowerCase().includes("invalid api key");
  const isRateLimit = message.includes("429") || message.toLowerCase().includes("rate limit");
  const status = isAuth ? 401 : isRateLimit ? 429 : 500;
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
```

- [ ] **Step 2: Handle 429 on client in useSessionManager**

In `fetchSuggestions` catch block:

```typescript
} catch (err) {
  const detail = err instanceof Error ? err.message : String(err);
  if (detail.includes("429") || detail.toLowerCase().includes("rate limit")) {
    showError("rateLimit"); // add this case to lib/toast.ts
  } else {
    showError("suggestions", detail);
  }
}
```

Similarly in `addTranscriptFromAudio` and `sendChatMessage`.

- [ ] **Step 3: Add rate limit toast to lib/toast.ts**

Read current lib/toast.ts first, then add:

```typescript
// lib/toast.ts — add rateLimit case
export function showError(type: "transcription" | "suggestions" | "chat" | "mic" | "rateLimit", detail?: string) {
  switch (type) {
    case "rateLimit":
      toast.error("Groq rate limit hit — suggestions paused ~60s", {
        description: "Free tier: 6,000 tokens/min. Will resume automatically.",
        duration: 8000,
      });
      break;
    // ... existing cases unchanged
  }
}
```

- [ ] **Step 4: Add AbortController with 15s timeout to transcription**

```typescript
// hooks/useSessionManager.ts — in addTranscriptFromAudio
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

try {
  const res = await fetch("/api/transcribe", {
    method: "POST",
    headers: { "x-api-key": settings.apiKey },
    body: form,
    signal: controller.signal,  // ← add
  });
  clearTimeout(timeoutId);
  // ... rest unchanged
} catch (err) {
  clearTimeout(timeoutId);
  if (err instanceof Error && err.name === "AbortError") {
    showError("transcription", "Transcription timed out — audio chunk skipped");
    return;
  }
  // ... existing error handling
}
```

Add 30s timeout to suggestion fetches similarly.

- [ ] **Step 5: Build + commit**

```bash
npm run build
git add app/api/suggestions/route.ts app/api/transcribe/route.ts app/api/chat/route.ts hooks/useSessionManager.ts lib/toast.ts
git commit -m "fix: proper 429 handling in API routes and client — rate limit toast + request timeouts"
```

---

## Task 5: Audio quality improvements + basic VAD gate

**Impact:** Criteria 1, 4, 7. Better audio → better Whisper accuracy. VAD gate eliminates hallucination transcripts from silence.

**Files:**
- Modify: `hooks/useAudioRecorder.ts` — audio constraints + blob size gate

- [ ] **Step 1: Add audio constraints to getUserMedia**

```typescript
// hooks/useAudioRecorder.ts — in start(), replace:
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
// with:
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    sampleRate: 16000,  // Whisper optimal sample rate
    channelCount: 1,    // mono — halves upload size
  },
});
```

- [ ] **Step 2: Add blob size gate (skip silent chunks)**

Whisper returns hallucinations on silent audio. A 30s silence chunk is typically very small (< 4KB for compressed audio). Gate on size:

```typescript
// hooks/useAudioRecorder.ts — in recorder.onstop handler
recorder.onstop = () => {
  if (chunks.length > 0) {
    const blob = new Blob(chunks, { type: mimeType });
    // Skip chunks below 4KB — likely silence / near-silence
    // ~4KB @ 16kbps is roughly 2s of actual speech content
    const MIN_CHUNK_BYTES = 4096;
    if (blob.size < MIN_CHUNK_BYTES) {
      console.debug(`[VAD] Skipping silent chunk (${blob.size} bytes)`);
      return;
    }
    onChunkRef.current(blob);
  }
};
```

Note in code comment: This is a crude size-based heuristic, not true VAD. It catches complete silence reliably. True VAD (WebRTC energy threshold or Silero) is the proper fix but out of scope.

- [ ] **Step 3: Fix stop/start race**

The current code calls `current.stop()` then immediately `startNewRecorder()`. The new recorder should start only after the previous onstop fires. Fix:

```typescript
// hooks/useAudioRecorder.ts — in setInterval callback
intervalRef.current = setInterval(() => {
  const current = mediaRecorderRef.current;
  if (current && current.state === "recording") {
    // Patch onstop to start new recorder after blob is delivered
    const originalOnStop = current.onstop;
    current.onstop = (event) => {
      if (originalOnStop) (originalOnStop as EventListener)(event);
      startNewRecorder();  // Start new recorder after chunk is delivered
    };
    current.stop();
  } else {
    startNewRecorder();
  }
}, chunkIntervalMs);
```

This ensures the new recorder starts after the previous chunk is processed.

- [ ] **Step 4: Build + commit**

```bash
npm run build
git add hooks/useAudioRecorder.ts
git commit -m "fix: audio quality constraints + blob size VAD gate + stop/start race condition"
```

---

## Task 6: Code quality + type safety cleanup

**Impact:** Criteria 5. Clean up the `as any` casts, fix `fullTranscriptText` stale computation, add explicit typing.

**Files:**
- Modify: `app/api/suggestions/route.ts` — remove `as any` for reasoning_effort
- Modify: `app/api/chat/route.ts` — remove `as any` for reasoning_effort
- Modify: `hooks/useSessionManager.ts` — fix fullTranscriptText staleness
- Modify: `lib/toast.ts` — read current content and verify rateLimit case from Task 4

- [ ] **Step 1: Fix reasoning_effort type casting**

The Groq SDK's types don't include `reasoning_effort` yet (it's a Groq-specific extension). Instead of `as any`, use a type assertion at the object level:

```typescript
// app/api/suggestions/route.ts — replace:
reasoning_effort: "low" as any,
// with a typed extension:
...({ reasoning_effort: "low" } as object),
```

Or better — create a shared helper type in `lib/groq-types.ts`:

```typescript
// lib/groq-types.ts (new file)
// Groq SDK extension parameters not yet in the official type definitions
export interface GroqExtendedParams {
  reasoning_effort?: "low" | "medium" | "high";
}
```

Then in both routes:

```typescript
import type { GroqExtendedParams } from "@/lib/groq-types";

const completion = await groq.chat.completions.create({
  model: "openai/gpt-oss-120b",
  messages: [...],
  temperature: 0.7,
  max_tokens: 1024,
  response_format: { type: "json_object" },
  ...(({ reasoning_effort: "low" }) as GroqExtendedParams),
} as Parameters<typeof groq.chat.completions.create>[0] & GroqExtendedParams);
```

Simpler — just suppress with a type assertion scoped to the param only:

```typescript
// In both routes — cleaner pattern:
const params = {
  model: "openai/gpt-oss-120b",
  messages: [...],
  temperature: 0.7,
  max_tokens: 1024,
  reasoning_effort: "low",
  response_format: { type: "json_object" as const },
};
const completion = await groq.chat.completions.create(params as Parameters<typeof groq.chat.completions.create>[0]);
```

This isolates the cast to one place, removes the inline `as any`.

- [ ] **Step 2: Fix fullTranscriptText staleness in useSessionManager**

Currently:
```typescript
return {
  // ...
  fullTranscriptText: getFullTranscript(), // computed once at return time from ref
};
```

`getFullTranscript()` reads `chunksRef.current` — this is always current (the ref is updated in state setter). The issue is the return value is computed once per render call. This is fine since React re-renders when `transcriptChunks` state changes. No actual bug here — just document it:

```typescript
// hooks/useSessionManager.ts
return {
  // ...
  // Note: derived from chunksRef.current (always latest). Re-computed on every render
  // triggered by transcriptChunks state updates.
  fullTranscriptText: getFullTranscript(),
};
```

- [ ] **Step 3: Remove eslint-disable comments where possible**

After the reasoning_effort fix above, the `eslint-disable-next-line` comments should be removable. Check and remove them.

- [ ] **Step 4: Build + verify clean compile**

```bash
npm run build 2>&1 | grep -E "error|warning"
```

Expected: 0 TypeScript errors, 0 `as any` lint warnings.

- [ ] **Step 5: Commit**

```bash
git add app/api/suggestions/route.ts app/api/chat/route.ts hooks/useSessionManager.ts lib/groq-types.ts
git commit -m "fix: type-safe reasoning_effort, remove as any casts, cleanup eslint suppressions"
```

---

## Task 7: UX polish — manual flush discoverability + recording status

**Impact:** Criteria 7 (experience). The manual flush button is hidden and not discoverable. Recording state gives no progress signal.

**Files:**
- Modify: `components/TranscriptPanel.tsx` — label the flush button, add recording duration

- [ ] **Step 1: Label the manual flush button**

Currently: icon only, no label visible. Add visible label on desktop:

```tsx
// components/TranscriptPanel.tsx — flush button
<button
  onClick={onManualRefresh}
  type="button"
  className="flex items-center gap-1 h-7 px-2 rounded text-white/40 hover:text-emerald-400/80 hover:bg-emerald-500/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
  title="Get suggestions now"
  aria-label="Get suggestions now"
>
  <RotateCcw className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
  <span className="text-[10px] font-medium hidden sm:inline">Suggest now</span>
</button>
```

- [ ] **Step 2: Add recording duration to recording bar**

The current recording bar shows a ping dot + "Recording". Add elapsed time:

```tsx
// components/TranscriptPanel.tsx — add recordingStartedAt prop
interface TranscriptPanelProps {
  // ...existing...
  recordingStartedAt: number | null;  // ← add
}
```

In the recording bar section:

```tsx
{isRecording && (
  <div className="flex items-center gap-2 px-4 py-2 border-t border-emerald-500/10 bg-emerald-500/[0.05] shrink-0">
    <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
    </span>
    <span className="text-[10px] text-emerald-400/60 tracking-wide font-medium">Recording</span>
    {recordingStartedAt && (
      <RecordingDuration startedAt={recordingStartedAt} />
    )}
  </div>
)}
```

Add `RecordingDuration` component (small inline component in same file):

```tsx
function RecordingDuration({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  return (
    <span className="text-[10px] text-emerald-400/40 tabular-nums ml-auto">
      {mm}:{ss}
    </span>
  );
}
```

- [ ] **Step 3: Pass recordingStartedAt from page.tsx**

```typescript
// app/page.tsx
const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null);

const handleStartRecording = useCallback(async () => {
  // ... existing logic ...
  await startRecorder();
  setIsRecording(true);
  setRecordingStartedAt(Date.now());  // ← add
}, [...]);

const handleStopRecording = useCallback(() => {
  stopRecorder();
  setIsRecording(false);
  setRecordingStartedAt(null);  // ← add
}, [...]);
```

Pass to TranscriptPanel:
```tsx
const transcriptPanel = (
  <TranscriptPanel
    // ...existing props...
    recordingStartedAt={recordingStartedAt}  // ← add
  />
);
```

- [ ] **Step 4: Build + commit**

```bash
npm run build
git add components/TranscriptPanel.tsx app/page.tsx
git commit -m "feat: recording duration timer + labeled flush button for better discoverability"
```

---

## Final verification

After all tasks:

- [ ] Full build passes: `npm run build`
- [ ] No TypeScript errors
- [ ] No console errors on page load
- [ ] Test flow: load page → set API key → set meeting type → start recording → speak → verify first suggestions fire within 5s of first transcription landing
- [ ] Test rate limit toast: temporarily set invalid API key → verify 401 shows descriptive message
- [ ] Test countdown: start recording → verify countdown counts from chunkIntervalSeconds
- [ ] Test recording duration: start recording → verify MM:SS counts up in transcript bar
- [ ] Test "Suggest now" button: visible with label on desktop, fires suggestions immediately
- [ ] Commit final state

---

## What was NOT implemented (and why)

**Meeting context in system prompt** — would break prefix cache. The user-message injection approach preserves caching while adding context.

**Full VAD (Silero, WebRTC)** — ~1MB dependency, setup complexity. Size-based gate catches complete silence, which is the primary hallucination case.

**Speaker diarization** — requires a different API (AssemblyAI, Deepgram) or local model. Out of scope.

**Multi-chunk chat history trim** — current behavior (pass last `answerContextWindow` chars) is already bounded. Not a regression.

**Split useSessionManager** — deferred. It's 267 lines but not a blocker. Adding the new `triggerSuggestionsIfNew` adds ~15 lines. Still readable.

**localStorage for API key** — explicitly rejected in ADR-007. Privacy > convenience.

---

## Handoff context for agent

The codebase uses:
- `hooks/useSessionManager.ts` — all session state (transcript, suggestions, chat). The `chunksRef`, `batchesRef`, `isFetchingRef` pattern avoids stale closures in async callbacks.
- `hooks/useAudioRecorder.ts` — MediaRecorder chunk loop. `onChunkRef` pattern prevents stale closure on the callback.
- `app/page.tsx` — orchestrates everything. Owns `isRecording` state and the suggestion interval.
- `app/api/*/route.ts` — thin API proxies. All state is client-side.
- `lib/prompts.ts` — system prompts are constants (static for prefix caching). User message is assembled in the route.

Key invariant: **system prompts must remain static across requests** (prefix cache). All per-request dynamic content (transcript, meeting type, previous suggestions) goes in the user message.

Key constraint: **6,000 TPM free tier on Groq**. Every token in the user message costs. Keep it lean. The suggestion context window (180s) is already tuned for this.
