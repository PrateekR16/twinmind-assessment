# UI Polish Design Spec — TwinMind Live

**Date:** 2026-04-19  
**Status:** Approved

---

## Goal

Polish the TwinMind Live app before deployment: add toast error notifications (replacing silent failures and alert() dialogs), and fix accessibility/UX issues surfaced by the web-design-guidelines audit on the 3 main panels.

## Approach

**B — Fix known gaps + focused audit:**  
Add the toast system first (biggest UX gap), then run the web-design-guidelines audit on the 3 main panels and SettingsDialog, fix medium/high severity findings only.

---

## Section 1: Toast System

### Component
Use shadcn's `Sonner` toast — matches the dark theme, zero config, already in the shadcn ecosystem.

### Mount point
Single `<Toaster />` in `app/layout.tsx`. One instance for the whole app.

### Error coverage

| Trigger | Message |
|---------|---------|
| Transcription fails (any error) | "Transcription failed — check your API key or try again" |
| Suggestions fail (401) | "Invalid API key — open Settings to update it" |
| Suggestions fail (429) | "Rate limit hit — suggestions will resume shortly" |
| Suggestions fail (other) | "Couldn't fetch suggestions — will retry next cycle" |
| Chat fails (401) | "Invalid API key — open Settings to update it" |
| Chat fails (other) | "Chat error — please try again" |
| Mic denied | "Microphone access denied — allow it in browser settings" |

### Files

- `app/layout.tsx` — add `<Toaster position="bottom-right" />`
- `lib/toast.ts` — new: typed `showError(type, detail?)` helper that maps error types to messages
- `hooks/useSessionManager.ts` — replace all `console.error` calls with `showError()`
- `app/page.tsx` — replace `alert()` for mic denied with `showError()`

### Toast config
- Error duration: 5000ms
- Position: bottom-right (avoids the API key nudge at bottom-center)
- Theme: dark (matches app)

---

## Section 2: Web-Design-Guidelines Audit

### Scope
Run the live Vercel web-interface-guidelines against:
- `components/TranscriptPanel.tsx`
- `components/SuggestionsPanel.tsx`
- `components/ChatPanel.tsx`
- `components/SettingsDialog.tsx`

### Fix policy
Fix **medium and high severity** findings only. Skip cosmetic/low findings to avoid over-engineering.

### Anticipated findings

| Finding | Severity | Fix |
|---------|----------|-----|
| Icon-only buttons missing `aria-label` (mic, refresh, send) | High | Add `aria-label` to each |
| `<textarea>` in ChatPanel has no `<label>` | Medium | Add `aria-label="Chat input"` |
| `type="button"` missing on suggestion card buttons | Medium | Add explicit `type="button"` |
| Low contrast on `text-white/20` helper text | Low | Skip — cosmetic |

---

## Out of Scope

- Layout changes
- New features
- Full WCAG AAA compliance
- Responsive/mobile layout (assignment targets desktop, `min-w-[900px]` already set)

---

## Success Criteria

- No silent failures — every error the user might encounter surfaces as a toast
- No `alert()` calls remain in the codebase
- Zero high/medium accessibility violations on the audited components
- Build passes clean after all changes
