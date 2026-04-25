import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { MeetingType } from "@/types";
import { MEETING_CLASSIFICATION_PROMPT } from "@/lib/prompts";

const VALID_TYPES = new Set<MeetingType>([
  "general", "technical", "interview", "sales", "planning", "learning",
]);

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 401 });
  }

  let body: { transcript: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { transcript } = body;
  if (!transcript?.trim()) {
    return NextResponse.json({ type: "general" as MeetingType });
  }

  const groq = new Groq({ apiKey });

  try {
    const completionParams = {
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system" as const, content: MEETING_CLASSIFICATION_PROMPT },
        { role: "user" as const, content: `Transcript excerpt:\n${transcript.slice(0, 300)}` },
      ],
      temperature: 0.0,
      max_tokens: 32,
      response_format: { type: "json_object" as const },
    };

    // Cast params to non-streaming overload — response_format + no stream = ChatCompletion
    const completion = await (groq.chat.completions.create(
      completionParams as Parameters<typeof groq.chat.completions.create>[0]
    ) as Promise<{ choices: Array<{ message: { content: string | null } }> }>);

    const raw = completion.choices[0]?.message?.content ?? '{"type":"general"}';
    const parsed = JSON.parse(raw) as { type?: string };
    const detected = (parsed.type ?? "general") as MeetingType;
    const safe: MeetingType = VALID_TYPES.has(detected) ? detected : "general";

    return NextResponse.json({ type: safe });
  } catch {
    // Classification failure is non-fatal — fall back to general
    return NextResponse.json({ type: "general" as MeetingType });
  }
}
