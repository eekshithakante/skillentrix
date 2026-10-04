// Sample content for the three demos (imported by frontend only).

export interface TicketSample {
  label: string;
  customer: string;
  channel: "email" | "chat" | "web" | "phone";
  text: string;
}

export const SAMPLE_TICKETS: TicketSample[] = [
  {
    label: "Duplicate charge (billing / high)",
    customer: "Dana Whitfield",
    channel: "email",
    text: "Hi, I was charged twice for my subscription this month — the $49 charge appeared two times on my card statement on March 3rd. I need a refund for the duplicate charge as soon as possible, this is really frustrating. The invoice number is #INV-8841. My account email is dana.w@example.com.",
  },
  {
    label: "Outage report (technical / critical)",
    customer: "Marcus Chen",
    channel: "chat",
    text: "URGENT: Our production dashboard has been returning 500 errors since the latest update went out. None of my team members can log in and the API calls are timing out. We are losing sales every minute this stays down. This needs to be fixed immediately!",
  },
  {
    label: "Password reset (account / medium)",
    customer: "Priya Natarajan",
    channel: "web",
    text: "I can't reset my password — the reset email never arrives no matter how many times I request it. I've tried three times over the last hour. I also want to change the email address on my account since I left my previous company.",
  },
  {
    label: "Feature request (product / low)",
    customer: "Sam Okafor",
    channel: "web",
    text: "Just wanted to say I love the new export feature! Would it be possible to add CSV export in addition to PDF? Also a dark mode for the reports page would be great. Keep up the good work!",
  },
  {
    label: "Vague issue (hard to classify)",
    customer: "Anonymous",
    channel: "phone",
    text: "Hey, so the thing isn't working again. It did this last week too. Can someone look at it? Not sure what page, maybe the one I always use.",
  },
];

export const SAMPLE_TRANSCRIPT = `Sarah (PM): Alright, let's kick off. Quick recap — we shipped the pricing page redesign last Tuesday and conversions are up 4%.

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

Miguel: Will do.`;

export interface DocumentSample {
  label: string;
  text: string;
}

export const SAMPLE_DOCUMENTS: DocumentSample[] = [
  {
    label: "Master Services Agreement (legal)",
    text: `MASTER SERVICES AGREEMENT

This Agreement is entered into as of the Effective Date between Provider Corp ("Provider") and Client Inc ("Client").

1. TERM. This Agreement shall commence on the Effective Date and continue for an initial term of twenty-four (24) months, renewing automatically for successive twelve (12) month periods unless either party provides written notice of non-renewal at least sixty (60) days prior to the end of the then-current term.

2. FEES AND PAYMENT. Client shall pay all invoiced amounts within thirty (30) days of receipt of a valid invoice. Late payments accrue interest at 1.5% per month.

3. LIABILITY. Provider shall indemnify and hold harmless Client against any and all claims, damages, and liabilities arising from Provider's gross negligence or willful misconduct. EXCEPT FOR THE FOREGOING, PROVIDER'S TOTAL LIABILITY SHALL NOT EXCEED THE FEES PAID BY CLIENT IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM. IN NO EVENT SHALL PROVIDER BE LIABLE FOR INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES.

4. TERMINATION. Either party may terminate for material breach upon thirty (30) days written notice.

5. GOVERNING LAW. This Agreement shall be governed by the laws of the State of Delaware, without regard to conflict of law principles.`,
  },
  {
    label: "HR Social Media Policy (policy)",
    text: `EMPLOYEE HANDBOOK — SOCIAL MEDIA POLICY (EXCERPT)

Purpose. This policy governs the use of social media by all employees of the Company.

1. Confidentiality. Employees must not disclose, share, or comment on confidential company information, unreleased products, financial results, or customer data on any social media platform.

2. Company Systems. The Company reserves the right to monitor company-provided systems and accounts, including usage of social media during working hours on company devices.

3. Consequences. Violations of this policy may result in disciplinary action up to and including termination of employment, and may also carry legal consequences where applicable.

4. Personal Accounts. When identifying yourself as a Company employee, you must make it clear that views expressed are your own and do not represent the Company.

5. Media Inquiries. All media inquiries must be routed to the Communications team. Do not respond directly.`,
  },
  {
    label: "Q3 Offsite Planning (internal comms)",
    text: `TEAM UPDATE — Q3 OFFSITE PLANNING

Hi team,

Quick update on the Q3 offsite planning. We've booked the venue for September 12–13 at the lakeside conference center. Agenda highlights:

- Day 1: Strategy review, roadmap sessions, and a workshop on our new team rituals.
- Day 2: Lightning talks, team lunch, and an afternoon of outdoor activities.

Catering will have vegetarian and halal options. Travel reimbursement forms are due by August 15 — link in the team calendar.

If you have dietary restrictions or accessibility needs, reply to this email by end of next week.

See you there!`,
  },
];
