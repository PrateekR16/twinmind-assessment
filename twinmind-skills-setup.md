# TwinMind Assignment — Claude Code Skills Setup

## Quick Install (copy-paste this entire block)

```bash
# ── Planning Pipeline ──
npx skills add obra/superpowers@brainstorming
npx skills add obra/superpowers@writing-plans
npx skills add obra/superpowers@executing-plans

# ── Prompt Engineering ──
npx skills add wshobson/agents@prompt-engineering-patterns

# ── AI SDK & Streaming ──
npx skills add vercel/ai@ai-sdk

# ── Frontend & UI ──
npx skills add vercel-labs/agent-skills@vercel-react-best-practices
npx skills add vercel-labs/next-skills@next-best-practices
npx skills add shadcn/ui@shadcn
npx skills add vercel-labs/agent-skills@web-design-guidelines

# ── Code Quality ──
npx skills add SpillwaveSolutions/mastering-typescript-skill

# ── Deployment ──
npx skills add vercel-labs/agent-skills@deploy-to-vercel

# ── Debugging ──
npx skills add obra/superpowers@systematic-debugging
```

---

## What each skill does for this assignment

### Planning Pipeline (use first, in order)

| # | Skill | What it does for TwinMind |
|---|-------|--------------------------|
| 1 | `obra/superpowers@brainstorming` | Walks you through architecture decisions: transcript chunking strategy, context window sizing, prompt design, component layout. Outputs a design spec. Enforces YAGNI (assignment says "do not over-engineer"). |
| 2 | `obra/superpowers@writing-plans` | Decomposes the spec into bite-sized tasks with exact file paths, code samples, and test commands. Maps file structure upfront. TDD workflow. |
| 3 | `obra/superpowers@executing-plans` | Executes tasks one-by-one with code review between each. Keeps context lean via subagent dispatch. |

### Prompt Engineering (highest-weight evaluation criteria)

| # | Skill | What it does for TwinMind |
|---|-------|--------------------------|
| 4 | `wshobson/agents@prompt-engineering-patterns` | Structured JSON output (exactly 3 suggestion cards), few-shot examples, chain-of-thought, context window management, prompt versioning. Covers your live suggestion prompt, detail prompt, and chat prompt. |

### AI SDK & Streaming

| # | Skill | What it does for TwinMind |
|---|-------|--------------------------|
| 5 | `vercel/ai@ai-sdk` | `streamText` for streaming chat responses, `useChat` hook for the chat panel, structured generation with `Output.object()` for suggestion cards. Patterns for API route integration with Groq. |

### Frontend & UI

| # | Skill | What it does for TwinMind |
|---|-------|--------------------------|
| 6 | `vercel-labs/agent-skills@vercel-react-best-practices` | React hooks, state management patterns. Your app has complex state: transcript chunks accumulating, suggestion batches stacking, chat messages, recording toggle, settings. |
| 7 | `vercel-labs/next-skills@next-best-practices` | Next.js App Router, API routes for proxying Groq API calls (keeps API key server-side), server/client component split. |
| 8 | `shadcn/ui@shadcn` | Pre-built components: Card (suggestion cards), ScrollArea (transcript + chat), Button (mic toggle, refresh), Input (chat input), Sheet/Dialog (settings panel), Tabs. Gets 3-column layout polished fast. |
| 9 | `vercel-labs/agent-skills@web-design-guidelines` | Accessibility, responsive layout, interaction patterns. Assignment evaluates "does it feel responsive and trustworthy during a real conversation." |

### Code Quality

| # | Skill | What it does for TwinMind |
|---|-------|--------------------------|
| 10 | `SpillwaveSolutions/mastering-typescript-skill` | Clean TypeScript: naming, error handling, Zod validation, small functions, no dead code. Assignment rubric explicitly says "clean structure, readable code, sensible abstractions, no dead code." |

### Deployment

| # | Skill | What it does for TwinMind |
|---|-------|--------------------------|
| 11 | `vercel-labs/agent-skills@deploy-to-vercel` | Auto-deploy with preview URL. Assignment requires "deployed web app URL: public, openable in a browser, working end-to-end." |

### Debugging

| # | Skill | What it does for TwinMind |
|---|-------|--------------------------|
| 12 | `obra/superpowers@systematic-debugging` | For when audio capture, Groq API calls, streaming, or real-time UI breaks. Audio + WebSocket + streaming + state = many failure points. |

---

## How these map to TwinMind's evaluation criteria

```
Criteria 1-3: Prompt & AI quality (highest weight)
  → prompt-engineering-patterns + ai-sdk

Criteria 4:   Full-stack engineering
  → vercel-react-best-practices + next-best-practices + shadcn

Criteria 5:   Code quality
  → mastering-typescript-skill

Criteria 6:   Latency
  → ai-sdk (streaming patterns)

Criteria 7:   Overall experience
  → web-design-guidelines + shadcn
```

---

## Recommended workflow

```
1. Install all 12 skills
2. Run brainstorming skill with the TwinMind PDF as context
3. Review and approve the design spec
4. Run writing-plans to generate task breakdown
5. Run executing-plans to build it task-by-task
6. Deploy with deploy-to-vercel
7. Test with your own Groq API key
8. Iterate on prompts (this is where you'll spend 70% of time)
```
