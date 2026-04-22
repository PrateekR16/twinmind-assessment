"use client";

import { useRef, useState, useCallback } from "react";

export type RecorderState = "idle" | "recording" | "stopping";

interface UseAudioRecorderOptions {
  chunkIntervalMs: number;
  onChunk: (blob: Blob) => void;
}

export function useAudioRecorder({ chunkIntervalMs, onChunk }: UseAudioRecorderOptions) {
  const [state, setState] = useState<RecorderState>("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onChunkRef = useRef(onChunk);
  onChunkRef.current = onChunk;

  const start = useCallback(async () => {
    if (state !== "idle") return;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    // Prefer webm (Chrome/Firefox), fall back to mp4 (Safari), then ogg
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : MediaRecorder.isTypeSupported("audio/mp4")
      ? "audio/mp4"
      : "audio/ogg";

    const startNewRecorder = () => {
      if (!streamRef.current) return;
      const recorder = new MediaRecorder(streamRef.current, { mimeType });
      mediaRecorderRef.current = recorder;

      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: mimeType });
          onChunkRef.current(blob);
        }
      };

      recorder.start();
    };

    startNewRecorder();
    setState("recording");

    intervalRef.current = setInterval(() => {
      // Stop current recorder to flush the chunk, then start a new one
      const current = mediaRecorderRef.current;
      if (current && current.state === "recording") {
        current.stop();
      }
      startNewRecorder();
    }, chunkIntervalMs);
  }, [state, chunkIntervalMs]);

  const stop = useCallback(() => {
    if (state !== "recording") return;
    setState("stopping");

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const current = mediaRecorderRef.current;
    if (current && current.state === "recording") {
      current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    setState("idle");
  }, [state]);

  return { state, start, stop };
}
