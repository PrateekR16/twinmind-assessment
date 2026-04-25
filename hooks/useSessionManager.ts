"use client";

import { useState, useCallback, useRef } from "react";
import { showError } from "@/lib/toast";
import { nanoid } from "nanoid";
import {
  TranscriptChunk,
  SuggestionBatch,
  Suggestion,
  ChatMessage,
  SessionSettings,
  MeetingType,
} from "@/types";

interface UseSessionManagerReturn {
  transcriptChunks: TranscriptChunk[];
  suggestionBatches: SuggestionBatch[];
  chatMessages: ChatMessage[];
  isFetchingSuggestions: boolean;
  isTranscribing: boolean;
  isChatStreaming: boolean;
  addTranscriptFromAudio: (blob: Blob) => Promise<void>;
  fetchSuggestions: () => Promise<void>;
  triggerSuggestionsIfNew: () => Promise<void>;
  sendChatMessage: (content: string, displayContent?: string) => Promise<void>;
  clearSession: () => void;
  fullTranscriptText: string;
  detectedMeetingType: MeetingType;
}

export function useSessionManager(settings: SessionSettings): UseSessionManagerReturn {
  const [transcriptChunks, setTranscriptChunks] = useState<TranscriptChunk[]>([]);
  const [suggestionBatches, setSuggestionBatches] = useState<SuggestionBatch[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isChatStreaming, setIsChatStreaming] = useState(false);

  // Refs for latest state — avoids stale closures in async callbacks
  const chunksRef = useRef<TranscriptChunk[]>([]);
  const batchesRef = useRef<SuggestionBatch[]>([]);
  const isFetchingRef = useRef(false);
  const lastSuggestedChunkCountRef = useRef<number>(0);
  const triggerSuggestionsIfNewRef = useRef<() => Promise<void>>(() => Promise.resolve());

  // Meeting type classification — detected after chunk 2, fires once per session
  const [detectedMeetingType, setDetectedMeetingType] = useState<MeetingType>("general");
  const detectedMeetingTypeRef = useRef<MeetingType>("general");
  const hasClassifiedRef = useRef(false);

  const getFullTranscript = useCallback(() => {
    return chunksRef.current.map((c) => c.text).join(" ");
  }, []);

  const getRecentTranscript = useCallback(() => {
    const cutoff = Date.now() - settings.suggestionContextWindow * 1000;
    const recent = chunksRef.current.filter((c) => c.timestamp >= cutoff);
    // Fall back to last few chunks if nothing is recent enough
    const source = recent.length > 0 ? recent : chunksRef.current.slice(-6);
    return source.map((c) => c.text).join(" ");
  }, [settings.suggestionContextWindow]);

  const classifyMeeting = useCallback(async () => {
    if (hasClassifiedRef.current || !settings.apiKey) return;
    hasClassifiedRef.current = true; // fire once per session

    const excerpt = chunksRef.current.slice(0, 2).map((c) => c.text).join(" ");
    if (!excerpt.trim()) return;

    try {
      const res = await fetch("/api/classify-meeting", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": settings.apiKey,
        },
        body: JSON.stringify({ transcript: excerpt }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.type) {
        detectedMeetingTypeRef.current = data.type as MeetingType;
        setDetectedMeetingType(data.type as MeetingType);
      }
    } catch {
      // Non-fatal — stays "general"
    }
  }, [settings.apiKey]);

  // Ref wrapper so addTranscriptFromAudio doesn't need classifyMeeting in its deps
  const classifyMeetingRef = useRef<() => Promise<void>>(() => Promise.resolve());
  classifyMeetingRef.current = classifyMeeting;

  const addTranscriptFromAudio = useCallback(
    async (blob: Blob) => {
      if (!settings.apiKey) return;
      setIsTranscribing(true);

      const prevText = chunksRef.current.slice(-1)[0]?.text ?? "";
      const form = new FormData();
      form.append("audio", blob, "audio.webm");
      form.append("prev_text", prevText);

      try {
        const res = await fetch("/api/transcribe", {
          method: "POST",
          headers: { "x-api-key": settings.apiKey },
          body: form,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        const text: string = data.text?.trim();
        if (!text) return;

        const chunk: TranscriptChunk = { id: nanoid(), text, timestamp: Date.now() };
        let shouldClassify = false;
        setTranscriptChunks((prev) => {
          const updated = [...prev, chunk];
          chunksRef.current = updated;
          if (updated.length === 2) shouldClassify = true;
          return updated;
        });
        if (shouldClassify) classifyMeetingRef.current(); // fire-and-forget — non-blocking
        // Trigger suggestions after each new chunk — gated by new-content check
        setTimeout(() => {
          triggerSuggestionsIfNewRef.current();
        }, 50); // 50ms lets React state settle
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        showError("transcription", detail);
      } finally {
        setIsTranscribing(false);
      }
    },
    [settings.apiKey]
  );

  const fetchSuggestions = useCallback(async () => {
    if (!settings.apiKey || isFetchingRef.current) return;
    const recentTranscript = getRecentTranscript();
    if (!recentTranscript.trim()) return;

    isFetchingRef.current = true;
    setIsFetchingSuggestions(true);

    const allPrevSuggestions = batchesRef.current
      .flatMap((b) => b.suggestions)
      .map((s) => ({ title: s.title, type: s.type }))
      .slice(-9); // last 3 batches worth

    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": settings.apiKey,
        },
        body: JSON.stringify({
          recentTranscript,
          fullTranscript: getFullTranscript().slice(-settings.answerContextWindow),
          previousSuggestions: allPrevSuggestions,
          systemPrompt: settings.suggestionSystemPrompt,
          meetingType: detectedMeetingTypeRef.current,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const suggestions: Suggestion[] = (data.suggestions ?? []).map(
        (s: Omit<Suggestion, "id">) => ({ ...s, id: nanoid() })
      );

      if (suggestions.length > 0) {
        const batch: SuggestionBatch = {
          id: nanoid(),
          timestamp: Date.now(),
          suggestions,
        };
        setSuggestionBatches((prev) => {
          const updated = [batch, ...prev];
          batchesRef.current = updated;
          return updated;
        });
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      showError("suggestions", detail);
    } finally {
      isFetchingRef.current = false;
      setIsFetchingSuggestions(false);
    }
  }, [
    settings.apiKey,
    settings.suggestionSystemPrompt,
    settings.answerContextWindow,
    getRecentTranscript,
    getFullTranscript,
  ]);

  const triggerSuggestionsIfNew = useCallback(async () => {
    const currentCount = chunksRef.current.length;
    if (currentCount === 0) return;
    if (currentCount <= lastSuggestedChunkCountRef.current) return; // no new content since last batch
    await fetchSuggestions();
    lastSuggestedChunkCountRef.current = chunksRef.current.length;
  }, [fetchSuggestions]);

  // Keep ref in sync to avoid stale closures when called from addTranscriptFromAudio
  triggerSuggestionsIfNewRef.current = triggerSuggestionsIfNew;

  const sendChatMessage = useCallback(
    async (content: string, displayContent?: string) => {
      if (!settings.apiKey || isChatStreaming) return;

      // displayContent = what appears in the chat bubble (e.g. suggestion title)
      // content        = what's sent to the API (may be a rich detail prompt)
      const userMsg: ChatMessage = {
        id: nanoid(),
        role: "user",
        content: displayContent ?? content,
        timestamp: Date.now(),
      };

      setChatMessages((prev) => [...prev, userMsg]);
      setIsChatStreaming(true);

      const assistantId = nanoid();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      };
      setChatMessages((prev) => [...prev, assistantMsg]);

      const transcript = getFullTranscript().slice(-settings.answerContextWindow);
      // Build history: previous messages use stored display content;
      // current user message sends the full API content for context richness
      const history = [...chatMessages, { role: "user" as const, content }].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": settings.apiKey,
          },
          body: JSON.stringify({
            messages: history,
            transcript,
            systemPrompt: settings.chatSystemPrompt,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          setChatMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: accumulated } : m
            )
          );
        }
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        showError("chat", detail);
        setChatMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: "Sorry, there was an error. Please try again." }
              : m
          )
        );
      } finally {
        setIsChatStreaming(false);
      }
    },
    [
      settings.apiKey,
      settings.chatSystemPrompt,
      settings.answerContextWindow,
      isChatStreaming,
      chatMessages,
      getFullTranscript,
    ]
  );

  const clearSession = useCallback(() => {
    setTranscriptChunks([]);
    setSuggestionBatches([]);
    setChatMessages([]);
    chunksRef.current = [];
    batchesRef.current = [];
    lastSuggestedChunkCountRef.current = 0;
    setDetectedMeetingType("general");
    detectedMeetingTypeRef.current = "general";
    hasClassifiedRef.current = false;
  }, []);

  return {
    transcriptChunks,
    suggestionBatches,
    chatMessages,
    isFetchingSuggestions,
    isTranscribing,
    isChatStreaming,
    addTranscriptFromAudio,
    fetchSuggestions,
    triggerSuggestionsIfNew,
    sendChatMessage,
    clearSession,
    fullTranscriptText: getFullTranscript(),
    detectedMeetingType,
  };
}
