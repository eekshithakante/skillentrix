"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Loader2,
  Moon,
  Play,
  Sun,
  User,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  SAMPLE_DOCUMENTS,
  SAMPLE_TICKETS,
  SAMPLE_TRANSCRIPT,
} from "@/lib/samples";
import type {
  ApiResult,
  DocumentAnalysis,
  Extraction,
  Ticket,
} from "@/lib/types";

// ---------------------------------------------------------------- helpers

async function api<T>(url: string, body?: unknown): Promise<T | null> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const json = (await res.json()) as ApiResult<T>;
    if (!json.ok) {
      toast.error(json.error);
      return null;
    }
    return json.data;
  } catch {
    toast.error("Network error — please try again");
    return null;
  }
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

const urgencyStyle: Record<string, string> = {
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  critical: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

const riskStyle: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  high: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

function FlaggedNote() {
  return (
    <p className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
      <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
      Flagged for human review (low confidence)
    </p>
  );
}

// ---------------------------------------------------------------- theme

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="hidden size-4 dark:block" aria-hidden="true" />
      <Moon className="size-4 dark:hidden" aria-hidden="true" />
    </Button>
  );
}

// ---------------------------------------------------------------- demo 1

function TriageDemo() {
  const [text, setText] = useState("");
  const [sampleIdx, setSampleIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState<Ticket | null>(null);

  function loadSample() {
    const sample = SAMPLE_TICKETS[sampleIdx % SAMPLE_TICKETS.length];
    setText(sample.text);
    setSampleIdx((i) => i + 1);
    setTicket(null);
  }

  async function run() {
    if (text.trim().length < 10) {
      toast.error("Paste a ticket (at least 10 characters) or load a sample");
      return;
    }
    setLoading(true);
    setTicket(null);
    const data = await api<Ticket>("/api/triage", { text });
    if (data) setTicket(data);
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>1 · Ticket Triage</CardTitle>
        <CardDescription>
          Classify a support ticket by category and urgency, then route it to
          the right queue.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Label htmlFor="ticket-text">Ticket text</Label>
        <Textarea
          id="ticket-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste a customer support ticket here…"
          className="min-h-28 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={loadSample}>
            Load sample
          </Button>
          <Button
            size="sm"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={run}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Play className="size-4" aria-hidden="true" />
            )}
            {loading ? "Analyzing…" : "Run triage"}
          </Button>
        </div>

        {ticket && (
          <div className="space-y-2 rounded-lg border bg-muted/40 p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="capitalize">
                {ticket.category}
              </Badge>
              <span className="text-muted-foreground">
                {pct(ticket.categoryConfidence)}
              </span>
              <Badge className={`${urgencyStyle[ticket.urgency]} border-0 capitalize`}>
                {ticket.urgency}
              </Badge>
              <span className="text-muted-foreground">
                {pct(ticket.urgencyConfidence)}
              </span>
            </div>
            <p className="flex items-center gap-1.5">
              <ArrowRight className="size-3.5 text-emerald-600" aria-hidden="true" />
              <span className="text-muted-foreground">Routed to:</span>
              <span className="font-medium">{ticket.queue}</span>
            </p>
            {ticket.keyIndicators.length > 0 && (
              <p className="text-muted-foreground">
                Key indicators: {ticket.keyIndicators.join(" · ")}
              </p>
            )}
            {ticket.needsReview && <FlaggedNote />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------- demo 2

function ExtractorDemo() {
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Extraction | null>(null);

  async function run() {
    if (transcript.trim().length < 30) {
      toast.error("Paste a transcript (at least 30 characters) or load a sample");
      return;
    }
    setLoading(true);
    setResult(null);
    const data = await api<Extraction>("/api/extract", { transcript });
    if (data) setResult(data);
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>2 · Action-Item Extractor</CardTitle>
        <CardDescription>
          Turn a meeting transcript into structured action items with owner,
          deadline and confidence.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Label htmlFor="transcript">Meeting transcript</Label>
        <Textarea
          id="transcript"
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Paste a meeting transcript here…"
          className="min-h-28 font-mono text-xs"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setTranscript(SAMPLE_TRANSCRIPT);
              setResult(null);
            }}
          >
            Load sample
          </Button>
          <Button
            size="sm"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={run}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Play className="size-4" aria-hidden="true" />
            )}
            {loading ? "Extracting…" : "Extract action items"}
          </Button>
        </div>

        {result && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {result.actionItems.length} action item
              {result.actionItems.length === 1 ? "" : "s"} extracted
            </p>
            {result.actionItems.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border bg-muted/40 p-3 text-sm"
              >
                <p className="font-medium">{item.task}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <User className="size-3.5" aria-hidden="true" />
                    {item.owner ?? "unassigned"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="size-3.5" aria-hidden="true" />
                    {item.deadline ?? "no deadline"}
                  </span>
                  <span>{pct(item.confidence)} confident</span>
                </p>
                {item.warnings.length > 0 && (
                  <p className="mt-1 flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
                    {item.warnings.join(" · ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------- demo 3

function ComplianceDemo() {
  const [text, setText] = useState("");
  const [sampleIdx, setSampleIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [doc, setDoc] = useState<DocumentAnalysis | null>(null);

  function loadSample() {
    const sample = SAMPLE_DOCUMENTS[sampleIdx % SAMPLE_DOCUMENTS.length];
    setText(sample.text);
    setSampleIdx((i) => i + 1);
    setDoc(null);
  }

  async function run() {
    if (text.trim().length < 30) {
      toast.error("Paste a document (at least 30 characters) or load a sample");
      return;
    }
    setLoading(true);
    setDoc(null);
    const data = await api<DocumentAnalysis>("/api/compliance", { text });
    if (data) setDoc(data);
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>3 · Risk Classifier</CardTitle>
        <CardDescription>
          Classify a document by risk level and compliance category, with key
          terms for explainability.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Label htmlFor="doc-text">Document text</Label>
        <Textarea
          id="doc-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste a business document here…"
          className="min-h-28 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={loadSample}>
            Load sample
          </Button>
          <Button
            size="sm"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={run}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Play className="size-4" aria-hidden="true" />
            )}
            {loading ? "Classifying…" : "Classify risk"}
          </Button>
        </div>

        {doc && (
          <div className="space-y-2 rounded-lg border bg-muted/40 p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={`${riskStyle[doc.riskLevel]} border-0 capitalize`}>
                {doc.riskLevel} risk
              </Badge>
              <span className="text-muted-foreground">
                {doc.category} · {pct(doc.confidence)}
              </span>
            </div>
            {doc.summary && (
              <p className="italic text-muted-foreground">{doc.summary}</p>
            )}
            {doc.keyTerms.length > 0 && (
              <p className="text-muted-foreground">
                Key terms: {doc.keyTerms.join(" · ")}
              </p>
            )}
            {doc.similarDocuments.length > 0 && (
              <p className="text-muted-foreground">
                Similar documents: {doc.similarDocuments.join(", ")}
              </p>
            )}
            {doc.needsReview && <FlaggedNote />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------- page

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <h1 className="text-base font-semibold">AI Projects Lab</h1>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8 sm:px-6">
        <p className="text-sm text-muted-foreground">
          Three sample AI demos, running live — enter text or load a sample,
          then run.
        </p>
        <TriageDemo />
        <ExtractorDemo />
        <ComplianceDemo />
      </main>

      <footer className="mt-auto border-t">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-4 pb-[env(safe-area-inset-bottom)] text-xs text-muted-foreground sm:px-6">
          <span>AI Projects Lab — sample page · Next.js + LLM APIs</span>
          <a
            href="/ai-projects-lab.zip"
            download
            className="font-medium text-emerald-600 hover:underline dark:text-emerald-400"
          >
            Download project (.zip)
          </a>
        </div>
      </footer>
    </div>
  );
}
