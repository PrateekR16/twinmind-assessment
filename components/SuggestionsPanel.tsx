"use client";

import { RotateCcw, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SuggestionBatch, Suggestion, SuggestionType } from "@/types";

const TYPE_CONFIG: Record<SuggestionType, { label: string; dot: string; border: string; hover: string }> = {
  QUESTION:      { label: "Question",      dot: "bg-blue-400",    border: "border-l-blue-400/50",    hover: "hover:border-blue-400/40 hover:bg-blue-500/[0.06]" },
  TALKING_POINT: { label: "Talking Point", dot: "bg-violet-400",  border: "border-l-violet-400/50",  hover: "hover:border-violet-400/40 hover:bg-violet-500/[0.06]" },
  ANSWER:        { label: "Answer",        dot: "bg-emerald-400", border: "border-l-emerald-400/50", hover: "hover:border-emerald-400/40 hover:bg-emerald-500/[0.06]" },
  FACT_CHECK:    { label: "Fact Check",    dot: "bg-amber-400",   border: "border-l-amber-400/50",   hover: "hover:border-amber-400/40 hover:bg-amber-500/[0.06]" },
  CLARIFICATION: { label: "Clarification", dot: "bg-sky-400",     border: "border-l-sky-400/50",     hover: "hover:border-sky-400/40 hover:bg-sky-500/[0.06]" },
};

interface SuggestionsPanelProps {
  batches: SuggestionBatch[];
  isFetching: boolean;
  onRefresh: () => void;
  onSuggestionClick: (suggestion: Suggestion) => void;
}

export function SuggestionsPanel({
  batches,
  isFetching,
  onRefresh,
  onSuggestionClick,
}: SuggestionsPanelProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Column header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400/70 shrink-0" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-violet-300/60">
            Suggestions
          </span>
          {isFetching && <Loader2 className="w-3 h-3 text-violet-400/50 animate-spin" aria-hidden="true" />}
        </div>
        <button
          onClick={onRefresh}
          type="button"
          disabled={isFetching}
          className="w-6 h-6 flex items-center justify-center rounded text-white/25 hover:text-violet-400/60 hover:bg-violet-500/10 transition-all disabled:opacity-30 disabled:pointer-events-none"
          title="Refresh suggestions"
          aria-label="Refresh suggestions"
        >
          <RotateCcw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} strokeWidth={2} />
        </button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="px-3 py-4">
          {batches.length === 0 ? (
            <p className="text-white/20 text-[13px] leading-relaxed mt-6 text-center">
              Suggestions appear automatically as you speak
            </p>
          ) : (
            <div className="space-y-5">
              {batches.map((batch, batchIndex) => (
                <div key={batch.id}>
                  {batchIndex > 0 && <div className="h-px bg-white/[0.05] mb-5" />}
                  <p className="text-[10px] text-white/20 mb-2 px-1 tabular-nums">
                    {new Date(batch.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <div className="space-y-2">
                    {batch.suggestions.map((s) => {
                      const cfg = TYPE_CONFIG[s.type] ?? TYPE_CONFIG.CLARIFICATION;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => onSuggestionClick(s)}
                          className={[
                            "w-full text-left rounded-lg bg-white/[0.03] border border-white/[0.07]",
                            "border-l-2 pl-3.5 pr-3.5 py-3",
                            cfg.border,
                            cfg.hover,
                            "transition-colors duration-150",
                          ].join(" ")}
                        >
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/25">
                              {cfg.label}
                            </span>
                          </div>
                          <p className="text-[13px] font-medium text-white/75 leading-snug mb-1">
                            {s.title}
                          </p>
                          <p className="text-[12px] text-white/35 leading-relaxed">
                            {s.preview}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
