// /api/stats — Dashboard aggregates computed from the database.
import { db } from "@/lib/db";
import {
  RISK_LEVELS,
  TICKET_CATEGORIES,
  TICKET_URGENCIES,
  type LabStats,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [
      ticketsTotal,
      ticketsNeedingReview,
      categoryGroups,
      urgencyGroups,
      avgConfidence,
      meetingsTotal,
      actionItemsTotal,
      actionItemsDone,
      documentsTotal,
      documentsFlagged,
      riskGroups,
    ] = await Promise.all([
      db.ticket.count(),
      db.ticket.count({ where: { needsReview: true, reviewed: false } }),
      db.ticket.groupBy({ by: ["category"], _count: { _all: true } }),
      db.ticket.groupBy({ by: ["urgency"], _count: { _all: true } }),
      db.ticket.aggregate({ _avg: { categoryConfidence: true } }),
      db.meetingExtraction.count(),
      db.actionItem.count(),
      db.actionItem.count({ where: { status: "done" } }),
      db.documentAnalysis.count(),
      db.documentAnalysis.count({ where: { needsReview: true, reviewed: false } }),
      db.documentAnalysis.groupBy({ by: ["riskLevel"], _count: { _all: true } }),
    ]);

    const ticketsByCategory: Record<string, number> = {};
    for (const c of TICKET_CATEGORIES) ticketsByCategory[c] = 0;
    for (const g of categoryGroups) {
      if (ticketsByCategory[g.category] !== undefined) {
        ticketsByCategory[g.category] = g._count._all;
      }
    }

    const ticketsByUrgency: Record<string, number> = {};
    for (const u of TICKET_URGENCIES) ticketsByUrgency[u] = 0;
    for (const g of urgencyGroups) {
      if (ticketsByUrgency[g.urgency] !== undefined) {
        ticketsByUrgency[g.urgency] = g._count._all;
      }
    }

    const documentsByRisk: Record<string, number> = {};
    for (const r of RISK_LEVELS) documentsByRisk[r] = 0;
    for (const g of riskGroups) {
      if (documentsByRisk[g.riskLevel] !== undefined) {
        documentsByRisk[g.riskLevel] = g._count._all;
      }
    }

    const avgValue = avgConfidence._avg.categoryConfidence;
    const avgCategoryConfidence =
      avgValue === null ? 0 : Math.round(avgValue * 100) / 100;

    const stats: LabStats = {
      ticketsTotal,
      ticketsNeedingReview,
      ticketsByCategory,
      ticketsByUrgency,
      avgCategoryConfidence,
      meetingsTotal,
      actionItemsTotal,
      actionItemsDone,
      documentsTotal,
      documentsFlagged,
      documentsByRisk,
    };
    return Response.json({ ok: true, data: stats });
  } catch {
    return Response.json(
      { ok: false, error: "Failed to compute stats" },
      { status: 500 }
    );
  }
}
