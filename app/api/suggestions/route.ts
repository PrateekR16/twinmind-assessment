import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { Suggestion } from "@/types";

const MEETING_TYPE_CONTEXT: Record<string, string> = {
  general:   "General meeting.",
  technical: "Technical discussion (engineering/architecture/debugging). Prefer FACT_CHECK and ANSWER. Ground suggestions in specific technical claims from the transcript.",
  interview: "Job interview or hiring discussion. Prefer QUESTION and TALKING_POINT. Focus on probing questions, candidate evaluation, and honest disclosure.",
  sales:     "Sales call or product demo. Prefer QUESTION and CLARIFICATION. Focus on uncovering objections, qualifying needs, and moving forward.",
  planning:  "Planning or roadmap session. Prefer TALKING_POINT and CLARIFICATION. Focus on decision criteria, scope, trade-offs, and timeline assumptions.",
  learning:  "Lecture, tutoring, or study session. Prefer ANSWER and FACT_CHECK. Focus on concept accuracy, depth, and comprehension questions.",
};

interface SuggestionsBody {
  recentTranscript: string;
  fullTranscript: string;
  previousSuggestions: Pick<Suggestion, "title" | "type">[];
  systemPrompt: string;
  meetingType?: string;
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 401 });
  }

  let body: SuggestionsBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { recentTranscript, previousSuggestions, systemPrompt, meetingType } = body;

  if (!recentTranscript?.trim()) {
    return NextResponse.json({ error: "No transcript provided" }, { status: 400 });
  }

  const groq = new Groq({ apiKey });

  const previousList =
    previousSuggestions.length > 0
      ? `\nPREVIOUS SUGGESTIONS (do not repeat these):\n${previousSuggestions
          .map((s) => `- [${s.type}] ${s.title}`)
          .join("\n")}`
      : "";

  // Groq's json_object mode requires the word "json" to appear in the messages.
  // Appending it here ensures the constraint holds even if the system prompt is empty.
  const meetingContext = MEETING_TYPE_CONTEXT[meetingType ?? "general"] ?? MEETING_TYPE_CONTEXT.general;

  const userMessage = `MEETING CONTEXT: ${meetingContext}

RECENT TRANSCRIPT (last ~2-3 minutes — focus suggestions on this):
${recentTranscript}${previousList}

Generate 3 suggestions now. Respond with valid JSON only.`;

  try {
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 1024,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      reasoning_effort: "low" as any,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: { suggestions?: Suggestion[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Model returned invalid JSON" }, { status: 500 });
    }

    if (!Array.isArray(parsed.suggestions)) {
      return NextResponse.json({ error: "Unexpected response shape" }, { status: 500 });
    }

    return NextResponse.json({ suggestions: parsed.suggestions });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Suggestions failed";
    const status = message.includes("401") || message.toLowerCase().includes("invalid api key") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
