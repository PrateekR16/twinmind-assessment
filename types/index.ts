export type SuggestionType =
  | "QUESTION"
  | "TALKING_POINT"
  | "ANSWER"
  | "FACT_CHECK"
  | "CLARIFICATION";

export interface Suggestion {
  id: string;
  type: SuggestionType;
  title: string;
  preview: string;
  detail_prompt: string;
}

export interface SuggestionBatch {
  id: string;
  timestamp: number;
  suggestions: Suggestion[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface SessionSettings {
  apiKey: string;
  suggestionSystemPrompt: string;
  detailAnswerPrompt: string;
  chatSystemPrompt: string;
  suggestionContextWindow: number; // seconds of recent transcript for suggestions
  answerContextWindow: number;     // max chars of transcript for detail answers
  chunkIntervalSeconds: number;
}

export interface TranscriptChunk {
  id: string;
  text: string;
  timestamp: number;
}

export interface ExportData {
  exportedAt: string;
  transcript: TranscriptChunk[];
  suggestionBatches: SuggestionBatch[];
  chatHistory: ChatMessage[];
}
