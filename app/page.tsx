"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Download } from "lucide-react";
import { TranscriptPanel } from "@/components/TranscriptPanel";
import { SuggestionsPanel } from "@/components/SuggestionsPanel";
import { ChatPanel } from "@/components/ChatPanel";
import { SettingsDialog } from "@/components/SettingsDialog";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useSessionManager } from "@/hooks/useSessionManager";
import {
  DEFAULT_SUGGESTION_SYSTEM_PROMPT,
  DEFAULT_DETAIL_ANSWER_PROMPT,
  DEFAULT_CHAT_SYSTEM_PROMPT,
  DEFAULT_SETTINGS,
} from "@/lib/prompts";
import { exportSession } from "@/lib/export";
import { SessionSettings, Suggestion } from "@/types";
import { toast } from "sonner";
import { showError } from "@/lib/toast";

const INITIAL_SETTINGS: SessionSettings = {
  apiKey: "",
  suggestionSystemPrompt: DEFAULT_SUGGESTION_SYSTEM_PROMPT,
  detailAnswerPrompt: DEFAULT_DETAIL_ANSWER_PROMPT,
  chatSystemPrompt: DEFAULT_CHAT_SYSTEM_PROMPT,
  ...DEFAULT_SETTINGS,
};

export default function Home() {
  const [settings, setSettings] = useState<SessionSettings>(INITIAL_SETTINGS);
  const [isRecording, setIsRecording] = useState(false);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const session = useSessionManager(settings);

  const { start: startRecorder, stop: stopRecorder } = useAudioRecorder({
    chunkIntervalMs: settings.chunkIntervalSeconds * 1000,
    onChunk: (blob) => { session.addTranscriptFromAudio(blob); },
  });

  useEffect(() => {
    if (isRecording) {
      autoRefreshRef.current = setInterval(() => {
        session.fetchSuggestions();
      }, settings.chunkIntervalSeconds * 1000);
    } else {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
    }
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current); };
  }, [isRecording, settings.chunkIntervalSeconds]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStartRecording = useCallback(async () => {
    if (!settings.apiKey) {
      toast.info("Open Settings (gear icon) and paste your Groq API key first.", { duration: 5000 });
      return;
    }
    try {
      await startRecorder();
      setIsRecording(true);
    } catch {
      showError("mic");
    }
  }, [settings.apiKey, startRecorder]);

  const handleStopRecording = useCallback(() => {
    stopRecorder();
    setIsRecording(false);
  }, [stopRecorder]);

  const handleSuggestionClick = useCallback(
    (suggestion: Suggestion) => {
      const prompt = settings.detailAnswerPrompt
        .replace("{full_transcript}", session.fullTranscriptText.slice(-settings.answerContextWindow))
        .replace("{suggestion_title}", suggestion.title)
        .replace("{suggestion_preview}", suggestion.preview)
        .replace("{detail_prompt}", suggestion.detail_prompt);

      session.sendChatMessage(
        `**${suggestion.title}**\n\n${suggestion.preview}\n\n---\n${prompt}`
      );
    },
    [settings, session]
  );

  const hasContent =
    session.transcriptChunks.length > 0 || session.chatMessages.length > 0;

  return (
    <div className="flex flex-col h-screen min-w-[900px] bg-[#0a0a0c] text-white overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-5 h-12 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="text-[14px] font-semibold tracking-tight text-white/90">TwinMind</span>
          <span className="w-px h-3.5 bg-white/10" />
          <span className="text-[12px] text-white/30 font-medium">Live Suggestions</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() =>
              exportSession({
                exportedAt: new Date().toISOString(),
                transcript: session.transcriptChunks,
                suggestionBatches: session.suggestionBatches,
                chatHistory: session.chatMessages,
              })
            }
            disabled={!hasContent}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-medium text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all disabled:opacity-20 disabled:pointer-events-none"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
          <SettingsDialog settings={settings} onSave={setSettings} />
        </div>
      </header>

      {/* 3-column layout */}
      <main className="flex flex-1 overflow-hidden">
        <div className="w-[28%] border-r border-white/[0.06] overflow-hidden flex flex-col">
          <TranscriptPanel
            chunks={session.transcriptChunks}
            isRecording={isRecording}
            isTranscribing={session.isTranscribing}
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
            onManualRefresh={session.fetchSuggestions}
          />
        </div>

        <div className="w-[36%] border-r border-white/[0.06] overflow-hidden flex flex-col">
          <SuggestionsPanel
            batches={session.suggestionBatches}
            isFetching={session.isFetchingSuggestions}
            onRefresh={session.fetchSuggestions}
            onSuggestionClick={handleSuggestionClick}
          />
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          <ChatPanel
            messages={session.chatMessages}
            isStreaming={session.isChatStreaming}
            onSendMessage={session.sendChatMessage}
          />
        </div>
      </main>

      {/* API key nudge */}
      {!settings.apiKey && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-[#18181d] border border-white/[0.1] text-white/50 text-[11px] px-4 py-2 rounded-full shadow-xl">
          No API key — open <strong className="text-white/70">Settings</strong> to add your Groq key
        </div>
      )}
    </div>
  );
}
