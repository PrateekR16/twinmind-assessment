"use client";

import { useEffect, useRef } from "react";
import { Mic, MicOff, RotateCcw, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TranscriptChunk } from "@/types";

interface TranscriptPanelProps {
  chunks: TranscriptChunk[];
  isRecording: boolean;
  isTranscribing: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onManualRefresh: () => void;
}

export function TranscriptPanel({
  chunks,
  isRecording,
  isTranscribing,
  onStartRecording,
  onStopRecording,
  onManualRefresh,
}: TranscriptPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chunks]);

  return (
    <div className="flex flex-col h-full">
      {/* Column header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/70 shrink-0" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-emerald-300/60 truncate">
            Transcript
          </span>
          {isTranscribing && (
            <Loader2 className="w-2.5 h-2.5 text-emerald-400/40 animate-spin shrink-0" aria-hidden="true" />
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isRecording && (
            <button
              onClick={onManualRefresh}
              type="button"
              className="w-6 h-6 flex items-center justify-center rounded text-white/25 hover:text-emerald-400/60 hover:bg-emerald-500/10 transition-all"
              title="Flush chunk & refresh suggestions"
              aria-label="Flush chunk and refresh suggestions"
            >
              <RotateCcw className="w-3 h-3" strokeWidth={2} />
            </button>
          )}
          <button
            onClick={isRecording ? onStopRecording : onStartRecording}
            type="button"
            className={[
              "w-6 h-6 flex items-center justify-center rounded transition-all",
              isRecording
                ? "text-red-400/70 hover:text-red-400 hover:bg-red-500/10"
                : "text-white/25 hover:text-emerald-400/70 hover:bg-emerald-500/10",
            ].join(" ")}
            title={isRecording ? "Stop recording" : "Start recording"}
            aria-label={isRecording ? "Stop recording" : "Start recording"}
          >
            {isRecording
              ? <MicOff className="w-3.5 h-3.5" strokeWidth={2} />
              : <Mic className="w-3.5 h-3.5" strokeWidth={2} />}
          </button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-4 py-4">
          {chunks.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 mt-16">
              <button
                onClick={isRecording ? onStopRecording : onStartRecording}
                type="button"
                className={[
                  "w-12 h-12 rounded-full flex items-center justify-center transition-all",
                  isRecording
                    ? "bg-red-500/15 text-red-400 hover:bg-red-500/25 ring-2 ring-red-500/20"
                    : "bg-emerald-500/10 text-emerald-400/50 hover:bg-emerald-500/20 hover:text-emerald-400 ring-1 ring-emerald-500/20",
                ].join(" ")}
                aria-label={isRecording ? "Stop recording" : "Start recording"}
              >
                {isRecording
                  ? <MicOff className="w-5 h-5" strokeWidth={1.5} />
                  : <Mic className="w-5 h-5" strokeWidth={1.5} />}
              </button>
              <p className="text-[12px] text-white/20 text-center leading-relaxed whitespace-pre-line">
                {isRecording
                  ? "Listening…\ntranscript appears every ~30s"
                  : "Tap to start recording"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {chunks.map((chunk) => (
                <div key={chunk.id}>
                  <p className="text-[10px] text-white/20 mb-1 tabular-nums">
                    {new Date(chunk.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </p>
                  <p className="text-[13px] text-white/70 leading-relaxed">{chunk.text}</p>
                </div>
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Recording bar */}
      {isRecording && (
        <div className="flex items-center gap-2 px-4 py-2 border-t border-emerald-500/10 bg-emerald-500/[0.04] shrink-0">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
          <span className="text-[10px] text-emerald-400/40 tracking-wide">Recording</span>
        </div>
      )}
    </div>
  );
}
