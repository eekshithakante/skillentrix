# AI Projects Lab — Testing Guide

Three sample AI demos, running live against real LLM APIs:

1. **Ticket Triage** — classifies support tickets (category + urgency + confidence) and routes them to a queue
2. **Action-Item Extractor** — turns meeting transcripts into structured action items (task, owner, deadline, confidence) with validation warnings
3. **Risk Classifier** — classifies documents (risk level + compliance category) with key-term explainability and a review flag

---

## 1. Run the project

Requirements: [Bun](https://bun.sh) (v1.1+) and the `z-ai-web-dev-sdk` LLM service available in your environment.

```bash
bun install          # install dependencies
bun run db:push      # create the SQLite database (db/custom.db)
bun run dev          # start the dev server on http://localhost:3000
```

Optional — populate sample data:

```bash
bun run seed         # sends 8 tickets, 2 meetings, 5 documents through the live APIs
```

---

## 2. Test in the browser (UI)

Open **http://localhost:3000**. Each demo card works the same way:

| Step | Action | Expected result |
|---|---|---|
| 1 | Click **Load sample** | Textarea fills with a realistic sample |
| 2 | Click **Run triage** / **Extract action items** / **Classify risk** | Button shows a spinner for ~1–3 s |
| 3 | Check the result box | See below |

**Demo 1 — Ticket Triage (expected result):**
- Category badge (e.g. *billing*) + confidence %
- Urgency badge (low/medium/high/critical, color-coded) + confidence %
- "Routed to: Billing Desk" (critical tickets get "— P1 Escalation" appended)
- Key indicator phrases extracted from the ticket
- If confidence < 70% → amber "Flagged for human review" note

**Demo 2 — Action-Item Extractor (expected result):**
- "N action items extracted"
- Each item: task, owner (or *unassigned*), deadline (or *no deadline*), confidence
- Validation warnings appear as amber text, e.g. "Missing owner — assign before the next sync"

**Demo 3 — Risk Classifier (expected result):**
- Risk badge (low/medium/high, color-coded) + compliance category + confidence
- One-sentence summary (italic)
- Key terms + similar documents (from previously classified docs)
- If confidence < 70% or risk is high → "Flagged for human review"

**Extra checks:** toggle dark mode (moon icon, top-right), resize to mobile width (no horizontal scroll), footer stays at the bottom.

---

## 3. Test the API directly (curl)

All responses use the envelope `{ ok: true, data }` or `{ ok: false, error }`.

### Ticket Triage

```bash
# Classify a ticket
curl -s -X POST http://localhost:3000/api/triage \
  -H 'Content-Type: application/json' \
  -d '{"text":"I was charged twice for my subscription, invoice #INV-8841, I need a refund ASAP","customer":"Dana","channel":"email"}'

# List tickets (filters: all | review | auto)
curl -s "http://localhost:3000/api/triage?filter=all"

# Human override — confirm a flagged ticket
curl -s -X PATCH http://localhost:3000/api/triage \
  -H 'Content-Type: application/json' \
  -d '{"id":"TICKET_ID","category":"account","urgency":"low"}'
```

### Action-Item Extractor

```bash
# Extract from a transcript
curl -s -X POST http://localhost:3000/api/extract \
  -H 'Content-Type: application/json' \
  -d '{"transcript":"Sarah: Miguel, can you renew the sandbox credentials by Thursday? Miguel: On it. Priya: Everyone please review the Figma by May 14th.","title":"Sprint sync"}'

# Recent extractions
curl -s http://localhost:3000/api/extract

# Toggle an item done (id = action item id)
curl -s -X PATCH http://localhost:3000/api/extract \
  -H 'Content-Type: application/json' \
  -d '{"id":"ITEM_ID","status":"done"}'
```

### Risk Classifier

```bash
# Classify a document (threshold default 0.7)
curl -s -X POST http://localhost:3000/api/compliance \
  -H 'Content-Type: application/json' \
  -d '{"text":"This Agreement includes an indemnification clause and governing law provision.","title":"MSA draft","threshold":0.7}'

# List documents (filters: all | flagged)
curl -s "http://localhost:3000/api/compliance?filter=flagged"

# Approve / override a flagged document
curl -s -X PATCH http://localhost:3000/api/compliance \
  -H 'Content-Type: application/json' \
  -d '{"id":"DOC_ID","riskLevel":"high"}'
```

### Stats

```bash
curl -s http://localhost:3000/api/stats
```

---

## 4. Edge cases worth trying

| Input | Expected behavior |
|---|---|
| Empty / tiny text (< 10 chars for tickets) | 400 error: "…at least 10 characters" |
| Gibberish ("aslkdjf qwepoiu…") | Low confidence → flagged for human review |
| Very short/vague ticket ("the thing is broken") | Low confidence → flagged |
| Duplicate action items in one transcript | Warning: "Possible duplicate of item N" |
| Transcript line with no owner | Warning: "Missing owner — assign before the next sync" |
| Same document classified twice | Second result lists the first under "Similar documents" |
| High threshold (0.95) on the risk API | Previously-confident docs get flagged for review |
| Invalid filter / bad id / bad enum | 400/404 with a clear error message |

---

## 5. Lint / type check

```bash
bun run lint        # ESLint — should pass clean
bunx tsc --noEmit   # TypeScript — should pass clean
```

---

## Notes

- The LLM calls go through `z-ai-web-dev-sdk` (server-side only). If the LLM is unreachable, **triage** and **compliance** fall back to keyword heuristics (confidence 0.55, lands in the review queue); the extractor returns a clear 500 error instead of guessing.
- Data persists in `db/custom.db` (SQLite via Prisma). To start fresh: `rm db/custom.db && bun run db:push` (restart the dev server afterwards).
- `DATABASE_URL` lives in `.env` — adjust the path if you move the project.
