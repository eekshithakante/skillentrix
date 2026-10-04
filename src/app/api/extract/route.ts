// /api/extract — AI Meeting Action-Item Extractor
// POST: LLM extraction of action items + deterministic server-side validation warnings
// GET: latest 10 extractions with their items
// PATCH { id, status }: toggle an action item open/done
import { db } from "@/lib/db";
import { callLlmJson } from "@/lib/llm";
import type { ActionItem, ActionItemStatus, Extraction } from "@/lib/types";
import type {
  ActionItem as ActionItemRow,
  MeetingExtraction as MeetingRow,
} from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ITEMS = 12;
const MAX_TRANSCRIPT_LENGTH = 20000;

// ---------- local helpers ----------

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === "string");
    }
  } catch {
    // fall through
  }
  return [];
}

function mapActionItem(row: ActionItemRow): ActionItem {
  return {
    id: row.id,
    extractionId: row.extractionId,
    task: row.task,
    owner: row.owner,
    deadline: row.deadline,
    confidence: row.confidence,
    status: row.status as ActionItemStatus,
    warnings: parseJsonArray(row.warnings),
  };
}

function mapExtraction(row: MeetingRow & { items: ActionItemRow[] }): Extraction {
  const items = [...row.items].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );
  return {
    id: row.id,
    title: row.title,
    itemCount: items.length,
    createdAt: row.createdAt.toISOString(),
    actionItems: items.map(mapActionItem),
  };
}

function clampConfidence(value: unknown, fallback = 0.5): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

/** Deadline is "normalizable" if it's an ISO/parseable date, weekday, or relative phrase. */
function isParseableDeadline(deadline: string): boolean {
  const d = deadline.trim();
  if (!d) return false;
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return true; // ISO date (or datetime)
  if (!Number.isNaN(Date.parse(d))) return true; // e.g. "May 14", "2025/05/14"
  if (
    /\b(mon|tues?|weds?|thur?s?|fri|sat|sun)(day|nesday|rsday|urday)?\b/i.test(d)
  ) {
    return true; // weekday
  }
  if (
    /\b(today|tonight|tomorrow|yesterday|asap|eod|eow|eom|q[1-4])\b/i.test(d) ||
    /\b(next|this|by|before|end of the|end of)\s+\w+/i.test(d) ||
    /\b\w+\s+\d{1,2}(st|nd|rd|th)\b/i.test(d)
  ) {
    return true; // relative phrase like "next Friday", "end of month", "May 14th"
  }
  return false;
}

/** Lowercase, strip punctuation → token list (for duplicate detection). */
function normalizeTokens(task: string): string[] {
  return task
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const t of setA) if (setB.has(t)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

interface CleanItem {
  task: string;
  owner: string | null;
  deadline: string | null;
  confidence: number;
  warnings: string[];
}

/** Deterministic, server-side validation warnings (never trusted to the LLM). */
function buildWarnings(items: Omit<CleanItem, "warnings">[]): CleanItem[] {
  const tokenSets: string[][] = [];
  return items.map((item, index) => {
    const warnings: string[] = [];

    if (!item.owner) {
      warnings.push("Missing owner — assign before the next sync");
    }
    if (!item.deadline) {
      warnings.push("No deadline detected");
    } else if (!isParseableDeadline(item.deadline)) {
      warnings.push("Deadline could not be normalized");
    }

    const tokens = normalizeTokens(item.task);
    for (let i = 0; i < index; i++) {
      if (jaccard(tokens, tokenSets[i]) >= 0.7) {
        warnings.push(`Possible duplicate of item ${i + 1}`);
        break;
      }
    }
    tokenSets.push(tokens);

    return { ...item, warnings };
  });
}

/** LLMs sometimes emit "null"/"none"/"tbd" as literal strings — coerce to real null. */
function sanitizeOptionalString(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v || /^(null|none|n\/a|unknown|tbd|-|—)$/i.test(v)) return null;
  return v.slice(0, maxLen);
}

function badRequest(error: string): Response {
  return Response.json({ ok: false, error }, { status: 400 });
}

// ---------- POST ----------

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const { transcript, title } = (body ?? {}) as Record<string, unknown>;

  if (
    typeof transcript !== "string" ||
    transcript.trim().length < 30
  ) {
    return badRequest(
      "Transcript must be a string of at least 30 characters"
    );
  }
  if (transcript.trim().length > MAX_TRANSCRIPT_LENGTH) {
    return badRequest("Transcript must be at most 20000 characters");
  }
  const titleStr =
    typeof title === "string" && title.trim() ? title.trim() : "Untitled meeting";

  const systemPrompt = [
    "You are a meeting analyst. Extract the action items (real commitments and assignments) from the meeting transcript.",
    'Respond with JSON only: {"actionItems":[{"task":"imperative, specific task","owner":"name or null","deadline":"YYYY-MM-DD when derivable, else the raw phrase like \\"Thursday\\", or null","confidence":0.0-1.0}]}',
    `At most ${MAX_ITEMS} items. Skip small talk and vague statements. Task text must be imperative and specific (e.g. "Renew sandbox credentials").`,
    "Respond with valid JSON only. No markdown, no extra text.",
  ].join("\n");

  interface ExtractResult {
    actionItems?: unknown;
  }

  let result: ExtractResult | null = null;
  try {
    result = await callLlmJson<ExtractResult>(systemPrompt, transcript.trim());
  } catch {
    result = null;
  }
  if (!result) {
    return Response.json(
      { ok: false, error: "Failed to extract action items — LLM unavailable" },
      { status: 500 }
    );
  }

  const cleaned = (Array.isArray(result.actionItems) ? result.actionItems : [])
    .filter(
      (it): it is Record<string, unknown> =>
        typeof it === "object" && it !== null
    )
    .map((it) => ({
      task: typeof it.task === "string" ? it.task.trim().slice(0, 500) : "",
      owner: sanitizeOptionalString(it.owner, 120),
      deadline: sanitizeOptionalString(it.deadline, 120),
      confidence: clampConfidence(it.confidence, 0.5),
    }))
    .filter((it) => it.task.length > 0)
    .slice(0, MAX_ITEMS);

  const items = buildWarnings(cleaned);

  try {
    const created = await db.meetingExtraction.create({
      data: {
        title: titleStr,
        transcript: transcript.trim(),
        items: {
          create: items.map((item) => ({
            task: item.task,
            owner: item.owner,
            deadline: item.deadline,
            confidence: item.confidence,
            status: "open",
            warnings: JSON.stringify(item.warnings),
          })),
        },
      },
      include: { items: true },
    });
    return Response.json({ ok: true, data: mapExtraction(created) });
  } catch {
    return Response.json(
      { ok: false, error: "Failed to save meeting extraction" },
      { status: 500 }
    );
  }
}

// ---------- GET ----------

export async function GET() {
  try {
    const rows = await db.meetingExtraction.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { items: { orderBy: { createdAt: "asc" } } },
    });
    return Response.json({ ok: true, data: rows.map(mapExtraction) });
  } catch {
    return Response.json(
      { ok: false, error: "Failed to load extractions" },
      { status: 500 }
    );
  }
}

// ---------- PATCH ----------

export async function PATCH(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const { id, status } = (body ?? {}) as Record<string, unknown>;

  if (typeof id !== "string" || !id.trim()) {
    return badRequest("Action item id is required");
  }
  if (status !== "open" && status !== "done") {
    return badRequest("status must be 'open' or 'done'");
  }

  try {
    const existing = await db.actionItem.findUnique({ where: { id } });
    if (!existing) {
      return Response.json(
        { ok: false, error: "Action item not found" },
        { status: 404 }
      );
    }
    const updated = await db.actionItem.update({
      where: { id },
      data: { status },
    });
    return Response.json({ ok: true, data: mapActionItem(updated) });
  } catch {
    return Response.json(
      { ok: false, error: "Failed to update action item" },
      { status: 500 }
    );
  }
}
