"use client";

import { useState } from "react";
import { WorkspaceLayout } from "@/components/workspace-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Download, Search, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";

type Severity = "critical" | "high" | "medium" | "low" | "info";

interface Finding {
  id: string;
  title: string;
  severity: Severity;
  host: string;
  port?: string;
  status: "open" | "resolved" | "accepted";
  description: string;
  evidence?: string;
  time: string;
}

const findings: Finding[] = [
  {
    id: "f1",
    title: "SSH default credentials accepted",
    severity: "critical",
    host: "192.168.1.5",
    port: "22",
    status: "open",
    description:
      "The SSH service accepted the default username/password combination 'admin:admin'. This allows unauthenticated remote code execution as the admin user.",
    evidence: "$ ssh admin@192.168.1.5 # password: admin\nWelcome to Ubuntu 22.04.3 LTS",
    time: "2m ago",
  },
  {
    id: "f2",
    title: "Open SMB shares accessible without authentication",
    severity: "high",
    host: "192.168.1.5",
    port: "445",
    status: "open",
    description: "SMB shares are accessible without credentials, exposing sensitive internal files.",
    time: "4m ago",
  },
  {
    id: "f3",
    title: "HTTP service without HTTPS redirect",
    severity: "medium",
    host: "192.168.1.5",
    port: "80",
    status: "open",
    description: "The web server serves content over unencrypted HTTP with no redirect to HTTPS.",
    time: "6m ago",
  },
  {
    id: "f4",
    title: "Outdated OpenSSH version (8.9p1)",
    severity: "low",
    host: "192.168.1.5",
    port: "22",
    status: "open",
    description: "OpenSSH 8.9p1 has known low-severity vulnerabilities. Upgrade to 9.x.",
    time: "8m ago",
  },
  {
    id: "f5",
    title: "SSH server banner disclosure",
    severity: "info",
    host: "192.168.1.5",
    port: "22",
    status: "accepted",
    description: "SSH banner reveals OS and software version, which may aid fingerprinting.",
    time: "10m ago",
  },
];

const severityConfig: Record<Severity, { label: string; className: string; order: number }> = {
  critical: { label: "Critical", className: "bg-red-100 text-red-700 border-red-200", order: 0 },
  high: { label: "High", className: "bg-orange-100 text-orange-700 border-orange-200", order: 1 },
  medium: { label: "Medium", className: "bg-yellow-100 text-yellow-700 border-yellow-200", order: 2 },
  low: { label: "Low", className: "bg-blue-100 text-blue-700 border-blue-200", order: 3 },
  info: { label: "Info", className: "bg-gray-100 text-gray-600 border-gray-200", order: 4 },
};

const statusConfig = {
  open: { label: "Open", className: "bg-red-50 text-red-600 border-red-100" },
  resolved: { label: "Resolved", className: "bg-green-50 text-green-700 border-green-100" },
  accepted: { label: "Accepted", className: "bg-gray-50 text-gray-500 border-gray-100" },
};

export default function FindingsPage() {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>("f1");

  const filtered = findings.filter(
    (f) =>
      f.title.toLowerCase().includes(search.toLowerCase()) ||
      f.host.includes(search)
  );

  const counts = findings.reduce(
    (acc, f) => { acc[f.severity] = (acc[f.severity] || 0) + 1; return acc; },
    {} as Record<string, number>
  );

  return (
    <WorkspaceLayout
      title="Findings"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Add finding
          </Button>
        </div>
      }
    >
      <div className="space-y-4 max-w-4xl">
        {/* Summary pills */}
        <div className="flex gap-2 flex-wrap">
          {(["critical", "high", "medium", "low", "info"] as Severity[]).map((s) => {
            const cfg = severityConfig[s];
            const count = counts[s] || 0;
            return (
              <Badge key={s} variant="outline" className={`text-xs gap-1.5 ${cfg.className}`}>
                {cfg.label} <span className="font-semibold">{count}</span>
              </Badge>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 h-9"
            placeholder="Search findings…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Findings list */}
        <div className="space-y-2">
          {filtered.map((f) => {
            const sev = severityConfig[f.severity];
            const stat = statusConfig[f.status];
            const isOpen = expanded === f.id;

            return (
              <Card key={f.id} className="overflow-hidden">
                <button
                  className="w-full text-left"
                  onClick={() => setExpanded(isOpen ? null : f.id)}
                >
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <Badge variant="outline" className={`text-xs shrink-0 ${sev.className}`}>
                      {sev.label}
                    </Badge>
                    <span className="text-sm font-medium flex-1 truncate">{f.title}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-mono text-muted-foreground">
                        {f.host}{f.port ? `:${f.port}` : ""}
                      </span>
                      <Badge variant="outline" className={`text-xs ${stat.className}`}>
                        {stat.label}
                      </Badge>
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <CardContent className="px-4 pb-4 pt-0 border-t">
                    <div className="pt-3 space-y-3">
                      <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                      {f.evidence && (
                        <div className="rounded-md bg-muted/60 border px-3 py-2">
                          <p className="text-xs text-muted-foreground mb-1 font-medium">Evidence</p>
                          <pre className="text-xs font-mono whitespace-pre-wrap">{f.evidence}</pre>
                        </div>
                      )}
                      <div className="flex items-center gap-2 pt-1">
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                          <ExternalLink className="h-3 w-3" /> View full
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
                          Mark resolved
                        </Button>
                        <span className="ml-auto text-xs text-muted-foreground">{f.time}</span>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </WorkspaceLayout>
  );
}
