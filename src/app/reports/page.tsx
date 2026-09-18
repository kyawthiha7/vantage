"use client";

import { useState, useEffect } from "react";
import { WorkspaceLayout } from "@/components/workspace-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FileText, Download, Plus, Clock } from "lucide-react";

interface Report {
  id: string;
  title: string;
  findings: number;
  status: "draft" | "final";
  updated: string;
}

const LS_KEY = "vantage_reports";

function loadReports(): Report[] {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) return JSON.parse(saved) as Report[];
  } catch {}
  return [];
}

function saveReports(reports: Report[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(reports)); } catch {}
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  useEffect(() => {
    setReports(loadReports());
  }, []);

  function createReport() {
    const t = title.trim();
    if (!t) return;
    const report: Report = {
      id: `r_${Date.now().toString(16)}`,
      title: t,
      findings: 0,
      status: "draft",
      updated: "just now",
    };
    const updated = [report, ...reports];
    setReports(updated);
    saveReports(updated);
    setTitle("");
    setOpen(false);
  }

  async function downloadReport(report: Report) {
    let findings: Array<{
      title: string; severity: string; host: string;
      description: string; evidence: string; status: string;
    }> = [];
    try {
      const r = await fetch("/api/v1/findings");
      if (r.ok) findings = await r.json();
    } catch {}

    const severityOrder = ["critical", "high", "medium", "low", "info"];
    const sorted = [...findings].sort(
      (a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)
    );

    const date = new Date().toISOString().split("T")[0];
    const lines: string[] = [
      `# ${report.title}`,
      ``,
      `**Date:** ${date}  `,
      `**Status:** ${report.status === "final" ? "Final" : "Draft"}  `,
      `**Findings:** ${sorted.length}`,
      ``,
      `---`,
      ``,
      `## Executive Summary`,
      ``,
      `This report documents ${sorted.length} finding(s) identified during the engagement.`,
      ``,
      `---`,
      ``,
      `## Findings`,
      ``,
    ];

    if (sorted.length === 0) {
      lines.push(`_No findings recorded._`);
    } else {
      sorted.forEach((f, i) => {
        lines.push(`### ${i + 1}. ${f.title}`);
        lines.push(``);
        lines.push(`| Field | Value |`);
        lines.push(`|-------|-------|`);
        lines.push(`| **Severity** | ${f.severity.toUpperCase()} |`);
        if (f.host) lines.push(`| **Host** | \`${f.host}\` |`);
        lines.push(`| **Status** | ${f.status} |`);
        lines.push(``);
        if (f.description) {
          lines.push(`**Description**`);
          lines.push(``);
          lines.push(f.description);
          lines.push(``);
        }
        if (f.evidence) {
          lines.push(`**Evidence**`);
          lines.push(``);
          lines.push("```");
          lines.push(f.evidence);
          lines.push("```");
          lines.push(``);
        }
        lines.push(`---`);
        lines.push(``);
      });
    }

    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function toggleStatus(id: string) {
    const updated = reports.map((r) =>
      r.id === id ? { ...r, status: r.status === "draft" ? ("final" as const) : ("draft" as const) } : r
    );
    setReports(updated);
    saveReports(updated);
  }

  return (
    <WorkspaceLayout
      title="Reports"
      actions={
        <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New report
        </Button>
      }
    >
      <div className="space-y-3 max-w-3xl">
        {reports.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
            <FileText className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">No reports yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create a report to compile findings into a deliverable.
            </p>
            <Button size="sm" className="mt-4 gap-1.5" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> New report
            </Button>
          </div>
        )}
        {reports.map((r) => (
          <Card key={r.id} className="hover:bg-muted/20 transition-colors">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{r.title}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                  <span>{r.findings} findings</span>
                  <span>·</span>
                  <Clock className="h-3 w-3" />
                  {r.updated}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => toggleStatus(r.id)}>
                  <Badge
                    variant="outline"
                    className={
                      r.status === "final"
                        ? "text-xs bg-green-50 text-green-700 border-green-100 cursor-pointer hover:bg-green-100"
                        : "text-xs bg-yellow-50 text-yellow-700 border-yellow-100 cursor-pointer hover:bg-yellow-100"
                    }
                  >
                    {r.status === "final" ? "Final" : "Draft"}
                  </Badge>
                </button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => downloadReport(r)} title="Download as Markdown">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New report</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label htmlFor="report-title" className="text-sm font-medium">Title</label>
              <Input
                id="report-title"
                placeholder="e.g. Corp pentest Q3 — Executive summary"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createReport()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={createReport} disabled={!title.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkspaceLayout>
  );
}
