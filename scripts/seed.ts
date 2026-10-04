/**
 * Seed script — populates the AI Projects Lab with curated sample data
 * by calling the real HTTP APIs (so every record is produced by the live
 * LLM pipeline — this doubles as an end-to-end test).
 *
 * Usage:
 *   1. Start the dev server:  bun run dev
 *   2. In another terminal:  bun run seed:ts scripts/seed.ts
 *      (or simply: bun scripts/seed.ts)
 *
 * Optional: reset the database first for a clean slate:
 *   rm db/custom.db && bun run db:push   (restart the dev server afterwards)
 */

const BASE = process.env.SEED_BASE_URL ?? "http://127.0.0.1:3000";

interface TicketSample {
  customer: string;
  channel: string;
  text: string;
}

const TICKETS: TicketSample[] = [
  {
    customer: "Dana Whitfield",
    channel: "email",
    text: "Hi, I was charged twice for my subscription this month — the $49 charge appeared two times on my card statement on March 3rd. I need a refund for the duplicate charge as soon as possible, this is really frustrating. The invoice number is #INV-8841.",
  },
  {
    customer: "Marcus Chen",
    channel: "chat",
    text: "URGENT: Our production dashboard has been returning 500 errors since the latest update went out. None of my team members can log in and the API calls are timing out. We are losing sales every minute this stays down!",
  },
  {
    customer: "Priya Natarajan",
    channel: "web",
    text: "I can't reset my password — the reset email never arrives no matter how many times I request it. I've tried three times over the last hour. I also want to change the email address on my account since I left my previous company.",
  },
  {
    customer: "Sam Okafor",
    channel: "web",
    text: "Just wanted to say I love the new export feature! Would it be possible to add CSV export in addition to PDF? Also a dark mode for the reports page would be great. Keep up the good work!",
  },
  {
    customer: "Anonymous",
    channel: "phone",
    text: "Hey, so the thing isn't working again. It did this last week too. Can someone look at it? Not sure what page, maybe the one I always use.",
  },
  {
    customer: "Elena Ruiz",
    channel: "email",
    text: "My subscription was cancelled without my request and now I see a partial charge of $19.99 on my statement. I never asked for a cancellation. Invoice #INV-2210. Can someone explain what happened and refund the charge?",
  },
  {
    customer: "Tom Becker",
    channel: "chat",
    text: "The mobile app crashes every time I try to upload a photo on the reports page. Android 14, app version 3.2.1. Happens on both wifi and cellular, already reinstalled twice. Really need a fix for this.",
  },
  {
    customer: "Grace Liu",
    channel: "web",
    text: "I think someone else is logged into my account — the security page shows active sessions from another country. Please help me secure my account immediately. I already changed my password but I'm worried about my data.",
  },
];

const MEETINGS: { title: string; transcript: string }[] = [
  {
    title: "Sprint sync — payments & design",
    transcript: `Sarah (PM): Alright, let's kick off. Quick recap — we shipped the pricing page redesign last Tuesday and conversions are up 4%.

Miguel (Engineering): Nice. One blocker: the payment gateway sandbox credentials expire on Friday. Someone needs to renew them before then, or all CI tests will start failing.

Sarah: Good catch. Miguel, can you own that? Please have it done by Thursday end of day and post an update in the payments channel.

Miguel: On it.

Priya (Design): I finished the onboarding flow mockups. I need feedback from the team before I can hand anything off to engineering. Could everyone review the Figma file by next Monday?

Sarah: Let's make it Wednesday instead, to keep the sprint on track.

Priya: Fine — Figma review deadline is Wednesday, May 14th.

Sarah: Also, legal still hasn't seen the updated terms of service. John, you mentioned you'd loop in the legal team?

John (Legal): Yes, I'll send the draft to outside counsel by tomorrow and expect comments back within a week. If they don't respond by the 20th, I'll escalate to their managing partner.

Miguel: Last thing — the error rate on the search service is at 2.1%, above our 1% SLO. Someone should investigate this week.

Sarah: Let's put that on the sprint board and assign it to the on-call rotation. Due this Friday, please.

Miguel: Will do.`,
  },
  {
    title: "Weekly check-in",
    transcript: `Anna (Team Lead): Quick check-in, two topics only.

Ben (Marketing): The Q3 campaign draft needs final approval before we can send it to the printer. The print deadline is Friday.

Anna: Noted — I'll review the draft Friday morning and leave comments in the doc.

Cleo (Support): We're getting complaints about the new checkout flow. Someone should look at the error logs before Thursday's release.

Anna: Ben, can you take the error logs? Let's say by Thursday noon.

Ben: Sure, I'll do it.

Cleo: Also the FAQ page needs an update with the new pricing. I can do it by next Tuesday.

Anna: Perfect, thanks Cleo. That's all for today.`,
  },
];

const DOCUMENTS: { title: string; text: string }[] = [
  {
    title: "Master Services Agreement",
    text: `MASTER SERVICES AGREEMENT

This Agreement is entered into as of the Effective Date between Provider Corp ("Provider") and Client Inc ("Client").

1. TERM. This Agreement shall commence on the Effective Date and continue for an initial term of twenty-four (24) months, renewing automatically for successive twelve (12) month periods unless either party provides written notice of non-renewal at least sixty (60) days prior to the end of the then-current term.

2. FEES AND PAYMENT. Client shall pay all invoiced amounts within thirty (30) days of receipt of a valid invoice. Late payments accrue interest at 1.5% per month.

3. LIABILITY. Provider shall indemnify and hold harmless Client against any and all claims, damages, and liabilities arising from Provider's gross negligence or willful misconduct. EXCEPT FOR THE FOREGOING, PROVIDER'S TOTAL LIABILITY SHALL NOT EXCEED THE FEES PAID BY CLIENT IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM. IN NO EVENT SHALL PROVIDER BE LIABLE FOR INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES.

4. TERMINATION. Either party may terminate for material breach upon thirty (30) days written notice.

5. GOVERNING LAW. This Agreement shall be governed by the laws of the State of Delaware, without regard to conflict of law principles.`,
  },
  {
    title: "Employee Social Media Policy",
    text: `EMPLOYEE HANDBOOK — SOCIAL MEDIA POLICY (EXCERPT)

Purpose. This policy governs the use of social media by all employees of the Company.

1. Confidentiality. Employees must not disclose, share, or comment on confidential company information, unreleased products, financial results, or customer data on any social media platform.

2. Company Systems. The Company reserves the right to monitor company-provided systems and accounts, including usage of social media during working hours on company devices.

3. Consequences. Violations of this policy may result in disciplinary action up to and including termination of employment, and may also carry legal consequences where applicable.

4. Personal Accounts. When identifying yourself as a Company employee, you must make it clear that views expressed are your own and do not represent the Company.

5. Media Inquiries. All media inquiries must be routed to the Communications team. Do not respond directly.`,
  },
  {
    title: "Q3 Offsite Planning",
    text: `TEAM UPDATE — Q3 OFFSITE PLANNING

Hi team,

Quick update on the Q3 offsite planning. We've booked the venue for September 12–13 at the lakeside conference center. Agenda highlights:

- Day 1: Strategy review, roadmap sessions, and a workshop on our new team rituals.
- Day 2: Lightning talks, team lunch, and an afternoon of outdoor activities.

Catering will have vegetarian and halal options. Travel reimbursement forms are due by August 15 — link in the team calendar.

If you have dietary restrictions or accessibility needs, reply to this email by end of next week.

See you there!`,
  },
  {
    title: "Privacy Notice — Data Processing",
    text: `PRIVACY NOTICE — DATA PROCESSING

This notice describes how we process personal data in accordance with the GDPR.

We collect personal data including names, email addresses, and usage analytics. Data is encrypted at rest and in transit. Access to personal data is restricted to authorized personnel on a need-to-know basis.

In the event of a security breach affecting personal data, we will notify the supervisory authority within 72 hours and affected data subjects without undue delay.

Data subjects may exercise their rights of access, rectification, erasure, and portability by contacting our Data Protection Officer at dpo@example.com.

International data transfers rely on Standard Contractual Clauses approved by the European Commission.`,
  },
  {
    title: "Team Lunch Invite",
    text: `Team lunch this Friday! We're trying the new ramen place downstairs at 12:30.

Vegetarian and vegan options available. Reply in the thread if you're joining so I can book the right table size.

Also a gentle reminder to submit your expense reports before month-end.

That's all — see you Friday!`,
  },
];

// ------------------------------------------------------------------ runner

async function post(path: string, body: unknown): Promise<any> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      return json.data;
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  throw new Error("unreachable");
}

async function patch(path: string, body: unknown): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json.data;
}

async function main() {
  console.log(`Seeding AI Projects Lab at ${BASE} …\n`);

  console.log("— Tickets");
  const tickets = [];
  for (const t of TICKETS) {
    const data = await post("/api/triage", t);
    tickets.push(data);
    console.log(
      `  ✓ ${data.category}/${data.urgency} (${Math.round(data.categoryConfidence * 100)}%) → ${data.queue}${data.needsReview ? "  [flagged for review]" : ""}`
    );
  }

  // Simulate a human reviewer confirming one low-confidence ticket.
  const flagged = tickets.find((t) => t.needsReview);
  if (flagged) {
    await patch("/api/triage", {
      id: flagged.id,
      category: flagged.category,
      urgency: flagged.urgency,
    });
    console.log(`  ✓ human reviewer confirmed ticket from "${flagged.customer}"`);
  }

  console.log("\n— Meetings");
  for (const m of MEETINGS) {
    const data = await post("/api/extract", m);
    console.log(`  ✓ "${data.title}": ${data.itemCount} action items`);
    for (const item of data.actionItems) {
      console.log(
        `      • ${item.task.slice(0, 60)}${item.task.length > 60 ? "…" : ""} — ${item.owner ?? "unassigned"}, ${item.deadline ?? "no deadline"}`
      );
    }
  }

  console.log("\n— Documents");
  const docs = [];
  for (const d of DOCUMENTS) {
    const data = await post("/api/compliance", { text: d.text, title: d.title });
    docs.push(data);
    console.log(
      `  ✓ ${data.riskLevel} risk / ${data.category} (${Math.round(data.confidence * 100)}%)${data.needsReview ? "  [flagged for review]" : ""}`
    );
  }

  // Simulate a compliance reviewer approving a flagged document.
  const flaggedDoc = docs.find((d) => d.needsReview);
  if (flaggedDoc) {
    await patch("/api/compliance", {
      id: flaggedDoc.id,
      riskLevel: flaggedDoc.riskLevel,
    });
    console.log(`  ✓ human reviewer approved "${flaggedDoc.title}"`);
  }

  const stats = await (await fetch(`${BASE}/api/stats`)).json();
  console.log("\n— Final stats:");
  console.log(JSON.stringify(stats.data, null, 2));
  console.log("\nSeed complete ✔");
}

main().catch((err) => {
  console.error("Seed failed:", err.message);
  console.error("Is the dev server running? Start it with: bun run dev");
  process.exit(1);
});
