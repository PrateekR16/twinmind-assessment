import { toast } from "sonner";

type ErrorContext =
  | "transcription"
  | "suggestions"
  | "chat"
  | "mic";

export function showError(context: ErrorContext, detail?: string): void {
  const is401 = detail?.includes("401");
  const is429 = detail?.includes("429");

  if (is429) {
    toast.warning("Rate limit hit — will resume shortly", { duration: 6000 });
    return;
  }

  switch (context) {
    case "transcription":
      toast.error(
        is401
          ? "Invalid API key — open Settings to update it"
          : "Transcription failed — check your API key or try again",
        { duration: 5000 }
      );
      break;
    case "suggestions":
      toast.error(
        is401
          ? "Invalid API key — open Settings to update it"
          : "Couldn't fetch suggestions — will retry next cycle",
        { duration: 5000 }
      );
      break;
    case "chat":
      toast.error(
        is401
          ? "Invalid API key — open Settings to update it"
          : "Chat error — please try again",
        { duration: 5000 }
      );
      break;
    case "mic":
      toast.error(
        "Microphone access denied — allow it in browser settings and reload",
        { duration: 7000 }
      );
      break;
  }
}
