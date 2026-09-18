"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { WorkspaceLayout } from "@/components/workspace-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Play, Square, Check, X, ChevronDown, ChevronRight,
  Terminal, Globe, Search, FileText, Loader2, Bot, AlertTriangle, Zap,
} from "lucide-react";
import { useAgentContext, type Step } from "@/contexts/agent-context";

const severityColor: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-blue-100 text-blue-700 border-blue-200",
  info: "bg-gray-100 text-gray-700 border-gray-200",
};

const presets = [
  { label: "Enumerate all services", desc: "Port scan, banner grab, fingerprint", icon: Search },
  { label: "Web app recon", desc: "Dir bust, headers, tech fingerprint", icon: Globe },
  { label: "Credential audit", desc: "SSH, FTP, SMB default cred check", icon: Zap },
  { label: "Draft report", desc: "Compile open findings into a report", icon: FileText },
];

function StepRow({
  step, expanded, onToggle, onApprove, onDeny,
}: {
  step: Step;
  expanded: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onDeny: () => void;
}) {
  const icon = {
    done: <Check className="h-3.5 w-3.5 text-green-600" />,
    running: <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />,
    waiting: <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />,
    pending: <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30" />,
    denied: <X className="h-3.5 w-3.5 text-red-500" />,
  }[step.status];

  const hasDetail = step.detail || step.toolCall || step.output;

  const isWaitingApproval = step.status === "waiting" && step.toolCall?.status === "waiting";

  return (
    <div className={`rounded-lg border overflow-hidden ${isWaitingApproval ? "border-orange-300 bg-orange-50/60" : ""}`}>
      {/* Always-visible row */}
      <button
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
        onClick={onToggle}
      >
        <div className="flex h-5 w-5 shrink-0 items-center justify-center">{icon}</div>
        <span className={`text-sm flex-1 truncate ${step.status === "pending" ? "text-muted-foreground" : ""}`}>
          {step.label}
        </span>
        {step.finding && (
          <Badge variant="outline" className={`text-xs shrink-0 ${severityColor[step.finding.severity]}`}>
            {step.finding.severity}
          </Badge>
        )}
        {hasDetail && (
          expanded
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Approval bar — always visible when waiting, no expand needed */}
      {isWaitingApproval && (
        <div className="px-3 py-2.5 border-t border-orange-200 bg-background">
          <div className="rounded-md border overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/40 border-b">
              <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium font-mono flex-1 truncate">{step.toolCall!.command}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="text-xs text-muted-foreground flex-1">Run this command?</span>
              <Button size="sm" className="h-7 text-xs gap-1" onClick={(e) => { e.stopPropagation(); onApprove(); }}>
                <Check className="h-3 w-3" /> Approve
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={(e) => { e.stopPropagation(); onDeny(); }}>
                <X className="h-3 w-3" /> Deny
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Expanded detail (output, history) */}
      {expanded && hasDetail && (
        <div className="px-3 pb-3 border-t space-y-2">
          {step.detail && (
            <p className="text-xs text-muted-foreground pt-2 leading-relaxed whitespace-pre-wrap">{step.detail}</p>
          )}
          {step.toolCall && !isWaitingApproval && (
            <div className="rounded-md bg-background border overflow-hidden mt-2">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/40 border-b">
                <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">{step.toolCall.tool}</span>
                {step.toolCall.status === "approved" && (
                  <Badge variant="outline" className="ml-auto text-xs bg-green-50 text-green-700 border-green-200">Approved</Badge>
                )}
                {step.toolCall.status === "denied" && (
                  <Badge variant="outline" className="ml-auto text-xs bg-red-50 text-red-700 border-red-200">Denied</Badge>
                )}
              </div>
              <div className="px-3 py-2">
                <code className="text-xs font-mono break-all">{step.toolCall.command}</code>
              </div>
              {step.output && (
                <div className="px-3 pb-2 border-t">
                  <pre className="text-xs font-mono text-muted-foreground pt-2 whitespace-pre-wrap max-h-48 overflow-auto">{step.output}</pre>
                </div>
              )}
            </div>
          )}
          {step.output && isWaitingApproval && (
            <pre className="text-xs font-mono text-muted-foreground pt-2 whitespace-pre-wrap max-h-48 overflow-auto">{step.output}</pre>
          )}
        </div>
      )}
    </div>
  );
}

function AgentPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const runParam = searchParams.get("r");
  const { run, pendingStepId, startRun, approve, deny, stopRun, clearRun, loadPastRun } = useAgentContext();
  const [goalInput, setGoalInput] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  // Load a past run when ?r=<id> is in the URL
  useEffect(() => {
    if (runParam && (!run || run.id !== runParam)) {
      loadPastRun(runParam);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runParam]);

  const progress = run
    ? Math.round((run.steps.filter((s) => s.status === "done" || s.status === "denied").length / Math.max(run.steps.length, 1)) * 100)
    : 0;

  return (
    <WorkspaceLayout
      title="Agent"
      actions={
        <div className="flex items-center gap-2">
          {pendingStepId && (
            <Badge variant="outline" className="text-xs gap-1.5 text-orange-700 border-orange-200 bg-orange-50">
              <AlertTriangle className="h-3 w-3" /> Waiting for approval
            </Badge>
          )}
          {run && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={stopRun}>
              <Square className="h-3.5 w-3.5" /> Stop
            </Button>
          )}
        </div>
      }
    >
      <div className="max-w-3xl space-y-4">
        {!run && (
          <div className="space-y-4">
            <div className="rounded-lg border p-5 space-y-3">
              <div className="flex items-start gap-3">
                <Bot className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-medium">What should the agent do?</p>
                  <textarea
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-none"
                    rows={3}
                    placeholder="e.g. Enumerate all services on 192.168.1.5 and identify vulnerabilities"
                    value={goalInput}
                    onChange={(e) => setGoalInput(e.target.value)}
                  />
                  <Button
                    size="sm"
                    className="gap-1.5"
                    disabled={!goalInput.trim()}
                    onClick={() => startRun(goalInput.trim())}
                  >
                    <Play className="h-3.5 w-3.5" /> Start run
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {presets.map(({ label, desc, icon: Icon }) => (
                <button
                  key={label}
                  onClick={() => { setGoalInput(label); startRun(label); }}
                  className="rounded-lg border p-3 text-left hover:bg-muted/40 transition-colors"
                >
                  <Icon className="h-4 w-4 text-muted-foreground mb-2" />
                  <p className="text-xs font-medium leading-snug">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {run && (
          <>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">Goal</p>
                    <p className="text-sm font-medium leading-relaxed">{run.goal}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`shrink-0 text-xs ${
                      run.status === "running" ? "bg-blue-50 text-blue-700 border-blue-200"
                      : run.status === "done" ? "bg-green-50 text-green-700 border-green-200"
                      : run.status === "error" ? "bg-red-50 text-red-700 border-red-200"
                      : "bg-orange-50 text-orange-700 border-orange-200"
                    }`}
                  >
                    {run.status === "running" && <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />}
                    {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
                  </Badge>
                </div>
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-1.5" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Steps</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                    {run.steps.length === 0 && (
                      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Planning…
                      </div>
                    )}
                    {run.steps.map((step) => (
                      <StepRow
                        key={step.id}
                        step={step}
                        expanded={expanded === step.id}
                        onToggle={() => setExpanded(expanded === step.id ? null : step.id)}
                        onApprove={approve}
                        onDeny={deny}
                      />
                    ))}
                  </div>
              </CardContent>
            </Card>

            {(run.status === "done" || run.status === "error") && (
              <Button variant="outline" size="sm" onClick={() => { clearRun(); setGoalInput(""); router.push("/agent"); }}>
                Start another run
              </Button>
            )}
          </>
        )}
      </div>
    </WorkspaceLayout>
  );
}

export default function AgentPageWrapper() {
  return (
    <Suspense>
      <AgentPage />
    </Suspense>
  );
}
