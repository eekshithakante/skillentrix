// LLM helper — SERVER-SIDE ONLY (used by API routes).
// Wraps z-ai-web-dev-sdk with a cached singleton, robust JSON extraction,
// and a single automatic retry when a call fails or returns unparseable JSON.
import ZAI from "z-ai-web-dev-sdk";

type ZAIInstance = Awaited<ReturnType<typeof ZAI.create>>;

interface ChatCompletionLike {
  choices?: Array<{ message?: { content?: string } }>;
}

let zaiPromise: Promise<ZAIInstance> | null = null;

/** Cached ZAI singleton; resets on failure so the next request can retry. */
export async function getZAI(): Promise<ZAIInstance> {
  if (!zaiPromise) {
    zaiPromise = ZAI.create().catch((err: unknown) => {
      zaiPromise = null;
      throw err;
    });
  }
  return zaiPromise;
}

/**
 * Robustly extract a JSON object or array from an LLM response:
 * strips ```json fences and surrounding prose, then parses the outermost
 * JSON value. Returns null when no valid JSON can be recovered.
 */
export function extractJson<T>(content: string): T | null {
  if (!content || typeof content !== "string") return null;
  const raw = content.trim();
  if (!raw) return null;

  const candidates: string[] = [raw];

  // Prefer the inside of a fenced code block when present.
  const fence = raw.match(/```(?:json|JSON)?\s*([\s\S]*?)\s*```/);
  if (fence?.[1]) candidates.push(fence[1].trim());

  // Outermost object span.
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(raw.slice(firstBrace, lastBrace + 1));
  }

  // Outermost array span.
  const firstBracket = raw.indexOf("[");
  const lastBracket = raw.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    candidates.push(raw.slice(firstBracket, lastBracket + 1));
  }

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

/**
 * Call the LLM and parse the reply as JSON. Retries once when the call
 * throws or the content is empty / unparseable. Returns null on failure.
 */
export async function callLlmJson<T>(
  systemPrompt: string,
  userContent: string
): Promise<T | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const zai = await getZAI();
      const completion = (await zai.chat.completions.create({
        messages: [
          { role: "assistant", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        thinking: { type: "disabled" },
      })) as ChatCompletionLike;
      const content = completion.choices?.[0]?.message?.content ?? "";
      if (!content || !content.trim()) continue;
      const parsed = extractJson<T>(content);
      if (parsed !== null) return parsed;
    } catch {
      // fall through to the retry
    }
  }
  return null;
}
