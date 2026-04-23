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
  sendChatMessage: (content: string, displayContent?: string) => Promise<void>;
  clearSession: () => void;
  fullTranscriptText: string;
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
        setTranscriptChunks((prev) => {
          const updated = [...prev, chunk];
          chunksRef.current = updated;
          return updated;
        });
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
    sendChatMessage,
    clearSession,
    fullTranscriptText: getFullTranscript(),
  };
}
