"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SessionSettings } from "@/types";

interface SettingsDialogProps {
  settings: SessionSettings;
  onSave: (settings: SessionSettings) => void;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[10px] font-semibold uppercase tracking-widest text-white/30">
        {label}
      </label>
      {hint && <p className="text-[11px] text-white/20 leading-relaxed">{hint}</p>}
      {children}
    </div>
  );
}

const inputCls =
  "w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-white/75 placeholder:text-white/20 outline-none focus:border-white/20 focus:bg-white/[0.07] transition-colors";

const textareaCls =
  "w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2.5 text-[11.5px] text-white/60 font-mono placeholder:text-white/20 outline-none focus:border-white/20 transition-colors resize-y leading-[1.7]";

export function SettingsDialog({ settings, onSave }: SettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SessionSettings>(settings);

  const handleOpen = (v: boolean) => {
    if (v) setDraft(settings);
    setOpen(v);
  };

  const update = <K extends keyof SessionSettings>(key: K, value: SessionSettings[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger
        aria-label="Open settings"
        className="w-8 h-8 flex items-center justify-center rounded-lg text-white/45 hover:text-white/75 hover:bg-white/[0.07] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
      >
        <SlidersHorizontal className="w-4 h-4" strokeWidth={2} />
      </DialogTrigger>

      <DialogContent className="w-[95vw] sm:max-w-xl md:max-w-2xl lg:max-w-3xl bg-[#111115] border border-white/[0.08] text-white shadow-2xl max-h-[85vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-[14px] font-semibold text-white/70 tracking-tight">Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-1">
          <Field label="Groq API Key" hint="Stored in memory only — never persisted or sent anywhere except Groq.">
            <input
              type="password"
              placeholder="gsk_…"
              value={draft.apiKey}
              onChange={(e) => update("apiKey", e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Chunk interval (s)">
              <input type="number" min={10} max={120} value={draft.chunkIntervalSeconds}
                onChange={(e) => update("chunkIntervalSeconds", Number(e.target.value))}
                className={inputCls} />
            </Field>
            <Field label="Suggestion context (s)">
              <input type="number" min={30} max={600} value={draft.suggestionContextWindow}
                onChange={(e) => update("suggestionContextWindow", Number(e.target.value))}
                className={inputCls} />
            </Field>
            <Field label="Answer context (chars)">
              <input type="number" min={1000} max={80000} value={draft.answerContextWindow}
                onChange={(e) => update("answerContextWindow", Number(e.target.value))}
                className={inputCls} />
            </Field>
          </div>

          <div className="h-px bg-white/[0.06]" />

          <Field label="Live Suggestions Prompt">
            <textarea rows={9} value={draft.suggestionSystemPrompt}
              onChange={(e) => update("suggestionSystemPrompt", e.target.value)}
              className={textareaCls} />
          </Field>

          <Field label="Detail Answer Prompt"
            hint="Variables: {full_transcript} · {suggestion_title} · {suggestion_preview} · {detail_prompt}">
            <textarea rows={7} value={draft.detailAnswerPrompt}
              onChange={(e) => update("detailAnswerPrompt", e.target.value)}
              className={textareaCls} />
          </Field>

          <Field label="Chat System Prompt" hint="Variable: {transcript}">
            <textarea rows={5} value={draft.chatSystemPrompt}
              onChange={(e) => update("chatSystemPrompt", e.target.value)}
              className={textareaCls} />
          </Field>

          <button
            type="button"
            onClick={() => { onSave(draft); setOpen(false); }}
            className="w-full h-9 rounded-lg bg-white/[0.07] border border-white/[0.08] text-white/60 hover:bg-white/[0.12] hover:text-white/80 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            Save Settings
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
