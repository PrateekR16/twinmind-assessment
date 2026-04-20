import { toast } from "sonner";

type ErrorContext =
  | "transcription"
  | "suggestions"
  | "chat"
  | "mic";

const MESSAGES: Record<ErrorContext, (detail?: string) => string> = {
  transcription: () => "Transcription failed — check your API key or try again",
  suggestions: (detail) => {
    if (detail?.includes("401")) return "Invalid API key — open Settings to update it";
    if (detail?.includes("429")) return "Rate limit hit — suggestions will resume shortly";
    return "Couldn't fetch suggestions — will retry next cycle";
  },
  chat: (detail) => {
    if (detail?.includes("401")) return "Invalid API key — open Settings to update it";
    return "Chat error — please try again";
  },
  mic: () => "Microphone access denied — allow it in browser settings and reload",
};

export function showError(context: ErrorContext, detail?: string): void {
  toast.error(MESSAGES[context](detail), { duration: 5000 });
}
