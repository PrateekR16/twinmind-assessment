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
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-emerald-300/80 truncate">
            Transcript
          </span>
          {isTranscribing && (
            <Loader2 className="w-3.5 h-3.5 text-emerald-400/70 animate-spin shrink-0" aria-hidden="true" strokeWidth={2} />
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isRecording && (
            <button
              onClick={onManualRefresh}
              type="button"
              className="w-7 h-7 flex items-center justify-center rounded text-white/40 hover:text-emerald-400/80 hover:bg-emerald-500/10 transition-colors"
              title="Flush chunk & refresh suggestions"
              aria-label="Flush chunk and refresh suggestions"
            >
              <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          )}
          <button
            onClick={isRecording ? onStopRecording : onStartRecording}
            type="button"
            className={[
              "w-7 h-7 flex items-center justify-center rounded transition-colors",
              isRecording
                ? "text-red-400/90 hover:text-red-400 hover:bg-red-500/10"
                : "text-white/40 hover:text-emerald-400/80 hover:bg-emerald-500/10",
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
                  "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
                  isRecording
                    ? "bg-red-500/15 text-red-400 hover:bg-red-500/25 ring-2 ring-red-500/30"
                    : "bg-emerald-500/10 text-emerald-400/70 hover:bg-emerald-500/20 hover:text-emerald-400 ring-1 ring-emerald-500/30",
                ].join(" ")}
                aria-label={isRecording ? "Stop recording" : "Start recording"}
              >
                {isRecording
                  ? <MicOff className="w-5 h-5" strokeWidth={1.75} />
                  : <Mic className="w-5 h-5" strokeWidth={1.75} />}
              </button>
              <p className="text-[12px] text-white/40 text-center leading-relaxed whitespace-pre-line">
                {isRecording
                  ? "Listening…\ntranscript appears every ~30s"
                  : "Tap to start recording"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {chunks.map((chunk) => (
                <div key={chunk.id}>
                  <p className="text-[10px] text-white/35 mb-1 tabular-nums">
                    {new Date(chunk.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </p>
                  <p className="text-[13px] text-white/80 leading-relaxed">{chunk.text}</p>
                </div>
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Recording bar */}
      {isRecording && (
        <div className="flex items-center gap-2 px-4 py-2 border-t border-emerald-500/10 bg-emerald-500/[0.05] shrink-0">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
          <span className="text-[10px] text-emerald-400/60 tracking-wide font-medium">Recording</span>
        </div>
      )}
    </div>
  );
}
