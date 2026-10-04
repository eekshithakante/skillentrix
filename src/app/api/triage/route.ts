// /api/triage — AI Customer Support Ticket Triage
// POST: LLM classification (keyword-heuristic fallback) → queue + review flag → persisted Ticket
// GET ?filter=all|review|auto: latest 30 tickets
// PATCH { id, category?, urgency? }: mark reviewed, apply overrides
import { db } from "@/lib/db";
import { callLlmJson } from "@/lib/llm";
import {
  REVIEW_CONFIDENCE_THRESHOLD,
  TICKET_CATEGORIES,
  TICKET_URGENCIES,
  type Ticket,
  type TicketCategory,
  type TicketUrgency,
} from "@/lib/types";
import type { Ticket as TicketRow } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QUEUE_BY_CATEGORY: Record<TicketCategory, string> = {
  billing: "Billing Desk",
  technical: "Technical Support L2",
  account: "Account Services",
  product: "Product Feedback Team",
};

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

function mapTicket(row: TicketRow): Ticket {
  return {
    id: row.id,
    text: row.text,
    customer: row.customer,
    channel: row.channel,
    category: row.category as TicketCategory,
    categoryConfidence: row.categoryConfidence,
    urgency: row.urgency as TicketUrgency,
    urgencyConfidence: row.urgencyConfidence,
    queue: row.queue,
    keyIndicators: parseJsonArray(row.keyIndicators),
    needsReview: row.needsReview,
    reviewed: row.reviewed,
    createdAt: row.createdAt.toISOString(),
  };
}

function clampConfidence(value: unknown, fallback = 0.5): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

function sanitizeIndicators(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim().slice(0, 120))
    .filter((s) => s.length > 0)
    .slice(0, 6);
}

function deriveQueue(category: TicketCategory, urgency: TicketUrgency): string {
  const base = QUEUE_BY_CATEGORY[category];
  return urgency === "critical" ? `${base} — P1 Escalation` : base;
}

/** Keyword heuristic used when the LLM is unavailable. */
function heuristicTriage(text: string): {
  category: TicketCategory;
  urgency: TicketUrgency;
} {
  let category: TicketCategory = "product";
  if (/charged|invoice|refund|billing|payment|subscription/i.test(text)) {
    category = "billing";
  } else if (/error|crash|500|bug|login|api|timed out/i.test(text)) {
    category = "technical";
  } else if (/password|account|email change|sign in/i.test(text)) {
    category = "account";
  } else if (/feature|suggestion|love|would be nice/i.test(text)) {
    category = "product";
  }

  let urgency: TicketUrgency = "medium";
  if (/urgent|asap|immediately|production|outage/i.test(text)) {
    urgency = "critical";
  } else if (/frustrated|twice|as soon as possible|losing/i.test(text)) {
    urgency = "high";
  } else if (
    category === "product" &&
    /love|suggestion|would be nice/i.test(text)
  ) {
    urgency = "low";
  }
  return { category, urgency };
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
  const { text, customer, channel } = (body ?? {}) as Record<string, unknown>;

  if (typeof text !== "string" || text.trim().length < 10) {
    return badRequest("Ticket text must be a string of at least 10 characters");
  }
  if (text.trim().length > 8000) {
    return badRequest("Ticket text must be at most 8000 characters");
  }
  const customerStr =
    typeof customer === "string" && customer.trim() ? customer.trim() : null;
  const channelStr =
    typeof channel === "string" && channel.trim() ? channel.trim() : null;

  const systemPrompt = [
    "You are a customer support ticket triage assistant.",
    'Classify the ticket and respond with JSON only: {"category":"billing|technical|account|product","categoryConfidence":0.0-1.0,"urgency":"low|medium|high|critical","urgencyConfidence":0.0-1.0,"keyIndicators":["short phrase", ...]}',
    "keyIndicators: 3-6 short phrases quoted from or grounded in the ticket that drove your decision.",
    "Respond with valid JSON only. No markdown, no extra text.",
  ].join("\n");

  const userContent = [
    `Ticket text: ${text.trim()}`,
    customerStr ? `Customer: ${customerStr}` : null,
    channelStr ? `Channel: ${channelStr}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  interface TriageResult {
    category?: unknown;
    categoryConfidence?: unknown;
    urgency?: unknown;
    urgencyConfidence?: unknown;
    keyIndicators?: unknown;
  }

  let result: TriageResult | null = null;
  try {
    result = await callLlmJson<TriageResult>(systemPrompt, userContent);
  } catch {
    result = null;
  }

  let category: TicketCategory;
  let urgency: TicketUrgency;
  let categoryConfidence: number;
  let urgencyConfidence: number;
  let keyIndicators: string[];

  if (result) {
    category = TICKET_CATEGORIES.includes(result.category as TicketCategory)
      ? (result.category as TicketCategory)
      : "product";
    urgency = TICKET_URGENCIES.includes(result.urgency as TicketUrgency)
      ? (result.urgency as TicketUrgency)
      : "medium";
    categoryConfidence = clampConfidence(result.categoryConfidence, 0.5);
    urgencyConfidence = clampConfidence(result.urgencyConfidence, 0.5);
    keyIndicators = sanitizeIndicators(result.keyIndicators);
  } else {
    // Fallback: keyword heuristic — lands in the review queue (conf 0.55 < 0.7)
    const heuristic = heuristicTriage(text);
    category = heuristic.category;
    urgency = heuristic.urgency;
    categoryConfidence = 0.55;
    urgencyConfidence = 0.55;
    keyIndicators = ["heuristic fallback — LLM unavailable"];
  }

  const queue = deriveQueue(category, urgency);
  const needsReview =
    categoryConfidence < REVIEW_CONFIDENCE_THRESHOLD ||
    urgencyConfidence < REVIEW_CONFIDENCE_THRESHOLD;

  try {
    const created = await db.ticket.create({
      data: {
        text: text.trim(),
        customer: customerStr,
        channel: channelStr,
        category,
        categoryConfidence,
        urgency,
        urgencyConfidence,
        queue,
        keyIndicators: JSON.stringify(keyIndicators),
        needsReview,
      },
    });
    return Response.json({ ok: true, data: mapTicket(created) });
  } catch {
    return Response.json(
      { ok: false, error: "Failed to save ticket" },
      { status: 500 }
    );
  }
}

// ---------- GET ----------

export async function GET(request: Request) {
  const filter = new URL(request.url).searchParams.get("filter") || "all";
  if (filter !== "all" && filter !== "review" && filter !== "auto") {
    return badRequest("Invalid filter — use all, review, or auto");
  }
  const where =
    filter === "review"
      ? { needsReview: true, reviewed: false }
      : filter === "auto"
        ? { OR: [{ needsReview: false }, { reviewed: true }] }
        : undefined;

  try {
    const rows = await db.ticket.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    return Response.json({ ok: true, data: rows.map(mapTicket) });
  } catch {
    return Response.json(
      { ok: false, error: "Failed to load tickets" },
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
  const { id, category, urgency } = (body ?? {}) as Record<string, unknown>;

  if (typeof id !== "string" || !id.trim()) {
    return badRequest("Ticket id is required");
  }
  if (
    category !== undefined &&
    !TICKET_CATEGORIES.includes(category as TicketCategory)
  ) {
    return badRequest(
      "Invalid category — use billing, technical, account, or product"
    );
  }
  if (
    urgency !== undefined &&
    !TICKET_URGENCIES.includes(urgency as TicketUrgency)
  ) {
    return badRequest("Invalid urgency — use low, medium, high, or critical");
  }

  try {
    const existing = await db.ticket.findUnique({ where: { id } });
    if (!existing) {
      return Response.json(
        { ok: false, error: "Ticket not found" },
        { status: 404 }
      );
    }

    const nextCategory = (
      typeof category === "string" ? category : existing.category
    ) as TicketCategory;
    const nextUrgency = (
      typeof urgency === "string" ? urgency : existing.urgency
    ) as TicketUrgency;
    const overridesQueue = category !== undefined || urgency !== undefined;

    const updated = await db.ticket.update({
      where: { id },
      data: {
        reviewed: true,
        ...(typeof category === "string" ? { category } : {}),
        ...(typeof urgency === "string" ? { urgency } : {}),
        ...(overridesQueue
          ? { queue: deriveQueue(nextCategory, nextUrgency) }
          : {}),
      },
    });
    return Response.json({ ok: true, data: mapTicket(updated) });
  } catch {
    return Response.json(
      { ok: false, error: "Failed to update ticket" },
      { status: 500 }
    );
  }
}
