# Skillentrix — Practical AI Projects Lab

Three production-ready **medium-level AI projects** built with Next.js 16 (App Router), TypeScript, Prisma (SQLite), Tailwind CSS 4 + shadcn/ui, and LLM inference via `z-ai-web-dev-sdk`.

| # | Project | What it does | Endpoint |
|---|---------|--------------|----------|
| 1 | **AI Customer Support Ticket Triage** | Reads incoming support tickets, predicts **category** (billing / technical / account / product) and **urgency** (low → critical), routes to the right **support queue**, and flags **low-confidence predictions for human review** | `POST/GET/PATCH /api/triage` |
| 2 | **AI Meeting Action-Item Extractor** | Converts meeting transcripts into structured action items — **task, owner, deadline, confidence** — with server-side validation (missing owners, unparseable dates, duplicate detection) | `POST/GET/PATCH /api/extract` |
| 3 | **AI Document Risk & Compliance Classifier** | Classifies business documents into **risk levels** (low/medium/high) and **policy categories**, extracts **key terms** (explainability), finds **similar documents**, and sends uncertain cases to a **manual-review dashboard** | `POST/GET/PATCH /api/compliance` |

A single-page dashboard (`/`) lets you run all three projects end-to-end with sample data.

---

## 1 · AI Customer Support Ticket Triage

**Pipeline:** ticket text → LLM classification (JSON mode) → queue routing → review flag → SQLite persistence.

- **Labels:** `billing | technical | account | product`, urgency `low | medium | high | critical`
- **Two models in one call:** category classifier + separate urgency prediction, each with its own confidence score
- **Queue routing:** category → desk (Billing Desk, Technical Support L2, …); `critical` urgency adds a **P1 Escalation**
- **Human-in-the-loop:** any prediction below the confidence threshold (default `0.7`) is flagged `needsReview` and shown in the **Review queue**; a reviewer can override category/urgency via `PATCH` (the queue re-derives automatically)
- **Explainability:** `keyIndicators` — phrases quoted from the ticket that drove the decision
- **Graceful fallback:** keyword-heuristic classifier when the LLM is unavailable (auto-flags for review)

```bash
curl -X POST http://localhost:3000/api/triage \
  -H "Content-Type: application/json" \
  -d '{"text":"I was charged twice on my invoice and need an urgent refund","customer":"Ravi K","channel":"email"}'
```

## 2 · AI Meeting Action-Item Extractor

**Pipeline:** transcript → LLM information extraction → deterministic validation → persistence.

- **Structured output schema:** `{ task, owner, deadline, confidence, status }`
- **Validation rules (never trusted to the LLM, computed server-side):**
  - Missing owner → warning
  - No deadline / unparseable date → warning (accepts ISO dates, weekdays, and relative phrases like "next Friday", "EOD")
  - Duplicate tasks → Jaccard similarity ≥ `0.7` flags "Possible duplicate of item N"
- **Upload-to-results interface:** paste a transcript (or load a sample), get a table of items with warnings, toggle items `open ↔ done`
- Sanitizes LLM noise (`"null"`, `"TBD"` strings coerced to real `null`)

```bash
curl -X POST http://localhost:3000/api/extract \
  -H "Content-Type: application/json" \
  -d '{"title":"Sprint Planning","transcript":"Sarah: Mike, send the revised API docs to the client by Friday. Mike: Yes, I will send it by 2026-10-10."}'
```

## 3 · AI Document Risk & Compliance Classifier

**Pipeline:** document text → LLM classification + key-term extraction → similarity search → review flag → persistence.

- **Risk levels:** `low | medium | high`; **categories:** Financial, Legal & Contracts, HR & Policy, Data Privacy & Security, Vendor & Procurement, General Business
- **Explainability:** `keyTerms` (domain terms from the document) and `similarDocuments` (nearest prior documents via key-term Jaccard overlap)
- **Confidence threshold → manual review:** caller-configurable (`threshold`, default `0.7`); anything below it — **or any `high`-risk document** — is flagged for manual review
- **Review dashboard:** filter `?filter=flagged`, override risk level via `PATCH`
- API never returns full document text, only a short excerpt

```bash
curl -X POST http://localhost:3000/api/compliance \
  -H "Content-Type: application/json" \
  -d '{"title":"MSA - Acme Corp","text":"MASTER SERVICES AGREEMENT. This agreement includes indemnification clauses..."}'
```

---

## Getting started

```bash
bun install
bun run db:push      # create SQLite schema
bun run seed         # optional: load sample tickets/meetings/documents
bun run dev          # http://localhost:3000
```

### Project structure

```
src/
  app/
    page.tsx                  # single-page dashboard for all 3 projects
    api/triage/route.ts       # Project 1 — POST classify, GET list, PATCH review
    api/extract/route.ts      # Project 2 — POST extract, GET list, PATCH toggle
    api/compliance/route.ts  # Project 3 — POST classify, GET list, PATCH review
    api/stats/route.ts        # aggregate stats for the dashboard
  lib/
    llm.ts                    # z-ai-web-dev-sdk wrapper (JSON mode + retries)
    types.ts                  # shared types, labels, thresholds
prisma/schema.prisma          # Ticket, MeetingExtraction, ActionItem, DocumentAnalysis
```

## Notes

- All AI inference runs **server-side only** (API routes, Node runtime)
- Every LLM response is schema-validated and clamped; there is always a deterministic fallback path
- Design decisions & implementation history are in `TESTING.md` and the work log

## License

MIT
