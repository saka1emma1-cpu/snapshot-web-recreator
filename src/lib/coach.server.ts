import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

const RUN_ID = "X-Lovable-AIG-Run-ID";

const INSTRUCTIONS = `You are a friendly ludo coach for the game YARA LUDO ONDO.
Rules: a 6 is needed to leave base; a 6, a capture, or reaching home gives an extra turn; pieces on star (safe) squares and start squares cannot be captured; exact roll needed to finish (step 57).
Steps: 0 = in base, 1-51 = main track (counted from the player's own start), 52-56 = home stretch (safe), 57 = finished.
Given the position, give 2-4 short, concrete tactical options for the player to move, each with a one-line reason (capture chances, danger from opponents within 1-6 squares behind, safe squares, racing home). If a dice value is given, rank the legal moves for it. Keep it under 150 words, plain language, no markdown tables.`;

export async function askCoach(position: string, question: string): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI coach is not configured.");
  let runId: string | undefined;
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      if (runId) headers.set(RUN_ID, runId);
      const res = await fetch(input, { ...init, headers });
      runId ??= res.headers.get(RUN_ID) ?? undefined;
      return res;
    },
  });
  let failure: unknown;
  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    system: INSTRUCTIONS,
    prompt: `${position}\n\nPlayer's question: ${question || "What are my best options?"}`,
    providerOptions: {
      openai: { forceReasoning: true, reasoningEffort: "low", store: false, include: ["reasoning.encrypted_content"] },
    },
    onError: ({ error }) => { failure = error; },
  });
  let text = "";
  try { text = await result.text; } catch (e) { failure ??= e; }
  if (failure || !text.trim()) {
    const status = (failure as { statusCode?: number })?.statusCode;
    console.error("coach error", status, failure);
    if (status === 429) throw new Error("The coach is busy — try again in a moment.");
    if (status === 402 || status === 403) throw new Error("The AI coach is unavailable right now (usage limit reached).");
    throw new Error("The coach couldn't answer. Please try again.");
  }
  return text.trim();
}
