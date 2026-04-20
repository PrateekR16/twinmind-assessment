import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { Suggestion } from "@/types";

interface SuggestionsBody {
  recentTranscript: string;
  fullTranscript: string;
  previousSuggestions: Pick<Suggestion, "title" | "type">[];
  systemPrompt: string;
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

  const { recentTranscript, previousSuggestions, systemPrompt } = body;

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
  const userMessage = `RECENT TRANSCRIPT (last ~2-3 minutes — focus suggestions on this):
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
