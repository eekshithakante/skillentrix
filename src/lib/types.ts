// Shared types for AI Projects Lab — used by both frontend and backend.

export type TicketCategory = "billing" | "technical" | "account" | "product";
export type TicketUrgency = "low" | "medium" | "high" | "critical";
export type RiskLevel = "low" | "medium" | "high";
export type ActionItemStatus = "open" | "done";
export type TicketChannel = "email" | "chat" | "web" | "phone";

export const TICKET_CATEGORIES: TicketCategory[] = [
  "billing",
  "technical",
  "account",
  "product",
];

export const TICKET_URGENCIES: TicketUrgency[] = [
  "low",
  "medium",
  "high",
  "critical",
];

export const RISK_LEVELS: RiskLevel[] = ["low", "medium", "high"];

export const COMPLIANCE_CATEGORIES = [
  "Financial",
  "Legal & Contracts",
  "HR & Policy",
  "Data Privacy & Security",
  "Vendor & Procurement",
  "General Business",
] as const;

export interface Ticket {
  id: string;
  text: string;
  customer: string | null;
  channel: string | null;
  category: TicketCategory;
  categoryConfidence: number; // 0–1
  urgency: TicketUrgency;
  urgencyConfidence: number; // 0–1
  queue: string;
  keyIndicators: string[];
  needsReview: boolean;
  reviewed: boolean;
  createdAt: string;
}

export interface ActionItem {
  id: string;
  extractionId: string;
  task: string;
  owner: string | null;
  deadline: string | null; // ISO date or natural-language string
  confidence: number; // 0–1
  status: ActionItemStatus;
  warnings: string[];
}

export interface Extraction {
  id: string;
  title: string;
  itemCount: number;
  createdAt: string;
  actionItems: ActionItem[];
}

export interface DocumentAnalysis {
  id: string;
  title: string;
  excerpt: string; // first ~160 chars of source text (full text never returned)
  riskLevel: RiskLevel;
  category: string;
  confidence: number; // 0–1
  summary: string;
  keyTerms: string[];
  similarDocuments: string[]; // titles of similar past documents
  needsReview: boolean;
  reviewed: boolean;
  createdAt: string;
}

export interface LabStats {
  ticketsTotal: number;
  ticketsNeedingReview: number;
  ticketsByCategory: Record<string, number>;
  ticketsByUrgency: Record<string, number>;
  avgCategoryConfidence: number; // 0–1
  meetingsTotal: number;
  actionItemsTotal: number;
  actionItemsDone: number;
  documentsTotal: number;
  documentsFlagged: number;
  documentsByRisk: Record<string, number>;
}

// API envelope
export interface ApiOk<T> {
  ok: true;
  data: T;
}

export interface ApiErr {
  ok: false;
  error: string;
}

export type ApiResult<T> = ApiOk<T> | ApiErr;

export const REVIEW_CONFIDENCE_THRESHOLD = 0.7;
