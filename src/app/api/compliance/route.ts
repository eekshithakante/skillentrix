// /api/compliance — AI Document Risk & Compliance Classifier
// POST: LLM classification (keyword-heuristic fallback) + keyTerm-overlap similarity → persisted DocumentAnalysis
// GET ?filter=all|flagged: latest 30 (never returns full text — only excerpt)
// PATCH { id, riskLevel? }: mark reviewed, apply override
import { db } from "@/lib/db";
import { callLlmJson } from "@/lib/llm";
import {
  COMPLIANCE_CATEGORIES,
  RISK_LEVELS,
  type DocumentAnalysis,
  type RiskLevel,
} from "@/lib/types";
import type { DocumentAnalysis as DocumentRow } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXCERPT_LENGTH = 160;

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

function makeExcerpt(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= EXCERPT_LENGTH) return trimmed;
  return `${trimmed.slice(0, EXCERPT_LENGTH)}…`;
}

function mapDocument(row: DocumentRow): DocumentAnalysis {
  return {
    id: row.id,
    title: row.title,
    excerpt: makeExcerpt(row.text),
    riskLevel: row.riskLevel as RiskLevel,
    category: row.category,
    confidence: row.confidence,
    summary: row.summary,
    keyTerms: parseJsonArray(row.keyTerms),
    similarDocuments: parseJsonArray(row.similarDocuments),
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

function sanitizeKeyTerms(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const x of value) {
    if (typeof x !== "string") continue;
    const t = x.trim().slice(0, 80);
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    terms.push(t);
    if (terms.length >= 8) break;
  }
  return terms;
}

function jaccardSets(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Keyword heuristic used when the LLM is unavailable. */
function heuristicCompliance(text: string): {
  riskLevel: RiskLevel;
  category: string;
  keyTerms: string[];
  summary: string;
} {
  let category = "General Business";
  let riskLevel: RiskLevel = "low";
  if (/indemnif|liability|governing law|termination/i.test(text)) {
    category = "Legal & Contracts";
    riskLevel = "high";
  } else if (
    /confidential|termination of employment|monitor|disciplinary/i.test(text)
  ) {
    category = "HR & Policy";
    riskLevel = "medium";
  } else if (/personal data|gdpr|encryption|security breach/i.test(text)) {
    category = "Data Privacy & Security";
    riskLevel = "high";
  } else if (/invoice|payment|fees|reimbursement/i.test(text)) {
    category = "Financial";
    riskLevel = "medium";
  }

  // keyTerms: top capitalized / long words heuristic
  const stop = new Set([
    "about", "above", "after", "again", "against", "before", "being",
    "between", "because", "been", "could", "during", "each", "every",
    "from", "have", "into", "more", "other", "over", "shall", "should",
    "some", "such", "their", "there", "these", "those", "under", "until",
    "when", "where", "which", "while", "with", "within", "would", "your",
    "this", "that", "they", "them", "then", "than", "will", "must", "made",
    "many", "most", "only", "also", "upon", "here", "upon",
  ]);
  const words = text.match(/[A-Za-z][A-Za-z&'-]{4,}/g) ?? [];
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const w of words) {
    const lw = w.toLowerCase();
    if (stop.has(lw) || seen.has(lw)) continue;
    seen.add(lw);
    unique.push(w);
  }
  unique.sort((a, b) => {
    const capDiff = Number(/^[A-Z]/.test(b)) - Number(/^[A-Z]/.test(a));
    if (capDiff !== 0) return capDiff;
    return b.length - a.length;
  });

  return {
    riskLevel,
    category,
    keyTerms: unique.slice(0, 8),
    summary: "Heuristic classification — LLM unavailable.",
  };
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
  const { text, title, threshold } = (body ?? {}) as Record<string, unknown>;

  if (typeof text !== "string" || text.trim().length < 30) {
    return badRequest("Document text must be a string of at least 30 characters");
  }
  if (text.trim().length > 20000) {
    return badRequest("Document text must be at most 20000 characters");
  }
  const titleStr =
    typeof title === "string" && title.trim()
      ? title.trim()
      : "Untitled document";
  if (threshold !== undefined && (typeof threshold !== "number" || !Number.isFinite(threshold))) {
    return badRequest("threshold must be a number");
  }
  const thresholdValue = Math.min(0.99, Math.max(0.1, (threshold as number) ?? 0.7));

  const systemPrompt = [
    "You are a document risk and compliance classifier.",
    'Respond with JSON only: {"riskLevel":"low|medium|high","category":"Financial|Legal & Contracts|HR & Policy|Data Privacy & Security|Vendor & Procurement|General Business","confidence":0.0-1.0,"keyTerms":["term", ...],"summary":"one sentence"}',
    "keyTerms: 5-8 domain-relevant terms from the document. summary: exactly one sentence describing the document.",
    "Respond with valid JSON only. No markdown, no extra text.",
  ].join("\n");

  interface ComplianceResult {
    riskLevel?: unknown;
    category?: unknown;
    confidence?: unknown;
    keyTerms?: unknown;
    summary?: unknown;
  }

  let result: ComplianceResult | null = null;
  try {
    result = await callLlmJson<ComplianceResult>(systemPrompt, text.trim());
  } catch {
    result = null;
  }

  let riskLevel: RiskLevel;
  let category: string;
  let confidence: number;
  let keyTerms: string[];
  let summary: string;

  if (result) {
    riskLevel = RISK_LEVELS.includes(result.riskLevel as RiskLevel)
      ? (result.riskLevel as RiskLevel)
      : "medium";
    category = (COMPLIANCE_CATEGORIES as readonly string[]).includes(
      result.category as string
    )
      ? (result.category as string)
      : "General Business";
    confidence = clampConfidence(result.confidence, 0.5);
    keyTerms = sanitizeKeyTerms(result.keyTerms);
    summary =
      typeof result.summary === "string" ? result.summary.trim().slice(0, 500) : "";
  } else {
    const heuristic = heuristicCompliance(text);
    riskLevel = heuristic.riskLevel;
    category = heuristic.category;
    confidence = 0.55; // below default threshold → lands in review queue
    keyTerms = heuristic.keyTerms;
    summary = heuristic.summary;
  }

  const needsReview = confidence < thresholdValue || riskLevel === "high";

  try {
    // Similarity vs. the latest 20 prior documents (keyTerm Jaccard overlap).
    const priorDocs = await db.documentAnalysis.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { title: true, keyTerms: true },
    });
    const currentTerms = new Set(keyTerms.map((t) => t.toLowerCase()));
    const similarDocuments = priorDocs
      .map((doc) => ({
        title: doc.title,
        overlap: jaccardSets(
          currentTerms,
          new Set(
            parseJsonArray(doc.keyTerms).map((t) => t.toLowerCase())
          )
        ),
      }))
      .filter((s) => s.overlap > 0.15)
      .sort((a, b) => b.overlap - a.overlap)
      .slice(0, 3)
      .map((s) => s.title);

    const created = await db.documentAnalysis.create({
      data: {
        title: titleStr,
        text: text.trim(),
        riskLevel,
        category,
        confidence,
        summary,
        keyTerms: JSON.stringify(keyTerms),
        similarDocuments: JSON.stringify(similarDocuments),
        needsReview,
      },
    });
    return Response.json({ ok: true, data: mapDocument(created) });
  } catch {
    return Response.json(
      { ok: false, error: "Failed to save document analysis" },
      { status: 500 }
    );
  }
}

// ---------- GET ----------

export async function GET(request: Request) {
  const filter = new URL(request.url).searchParams.get("filter") || "all";
  if (filter !== "all" && filter !== "flagged") {
    return badRequest("Invalid filter — use all or flagged");
  }
  const where =
    filter === "flagged" ? { needsReview: true, reviewed: false } : undefined;

  try {
    const rows = await db.documentAnalysis.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    return Response.json({ ok: true, data: rows.map(mapDocument) });
  } catch {
    return Response.json(
      { ok: false, error: "Failed to load documents" },
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
  const { id, riskLevel } = (body ?? {}) as Record<string, unknown>;

  if (typeof id !== "string" || !id.trim()) {
    return badRequest("Document id is required");
  }
  if (
    riskLevel !== undefined &&
    !RISK_LEVELS.includes(riskLevel as RiskLevel)
  ) {
    return badRequest("Invalid riskLevel — use low, medium, or high");
  }

  try {
    const existing = await db.documentAnalysis.findUnique({ where: { id } });
    if (!existing) {
      return Response.json(
        { ok: false, error: "Document not found" },
        { status: 404 }
      );
    }
    const updated = await db.documentAnalysis.update({
      where: { id },
      data: {
        reviewed: true,
        ...(typeof riskLevel === "string" ? { riskLevel } : {}),
      },
    });
    return Response.json({ ok: true, data: mapDocument(updated) });
  } catch {
    return Response.json(
      { ok: false, error: "Failed to update document" },
      { status: 500 }
    );
  }
}
