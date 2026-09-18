"use client";

import { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from "react";

export type StepStatus = "done" | "running" | "waiting" | "pending" | "denied";

export interface Step {
  id: string;
  label: string;
  detail?: string;
  status: StepStatus;
  output?: string;
  toolCall?: { tool: string; command: string; status: "waiting" | "approved" | "denied" };
  finding?: { severity: "critical" | "high" | "medium" | "low" | "info"; title: string };
}

export interface AgentRun {
  id: string;
  goal: string;
  status: "running" | "paused" | "done" | "error";
  steps: Step[];
}

interface AgentContextValue {
  run: AgentRun | null;
  pastRuns: AgentRun[];
  pendingStepId: string | null;
  startRun: (goal: string) => Promise<void>;
  approve: () => Promise<void>;
  deny: () => Promise<void>;
  stopRun: () => Promise<void>;
  clearRun: () => void;
  loadPastRun: (id: string) => void;
}

const AgentContext = createContext<AgentContextValue | null>(null);

const LS_KEY = "vantage_agent_runs";

function loadStoredRuns(): AgentRun[] {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch {}
  return [];
}

function saveStoredRuns(runs: AgentRun[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(runs.slice(0, 30))); } catch {}
}

export function AgentProvider({ children }: { children: ReactNode }) {
  const [run, setRun] = useState<AgentRun | null>(null);
  const [pastRuns, setPastRuns] = useState<AgentRun[]>([]);
  const [pendingStepId, setPendingStepId] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const runIdRef = useRef<string | null>(null);

  useEffect(() => {
    setPastRuns(loadStoredRuns());
  }, []);

  const updateStep = useCallback((stepId: string, patch: Partial<Step>) => {
    setRun((r) => {
      if (!r) return r;
      return { ...r, steps: r.steps.map((s) => s.id === stepId ? { ...s, ...patch } : s) };
    });
  }, []);

  const startRun = useCallback(async (goal: string) => {
    esRef.current?.close();

    const res = await fetch("/api/v1/agent/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal }),
    });
    if (!res.ok) return;
    const { run_id } = await res.json();
    runIdRef.current = run_id;

    setRun({ id: run_id, goal, status: "running", steps: [] });
    setPendingStepId(null);

    // EventSource must bypass the Next.js proxy — Next.js buffers chunked responses and breaks SSE
    const es = new EventSource(`http://localhost:8765/api/v1/agent/runs/${run_id}/stream`);
    esRef.current = es;

    es.onmessage = (e) => {
      const event = JSON.parse(e.data);

      if (event.type === "step_added") {
        setRun((r) => r ? { ...r, steps: [...r.steps, event.step] } : r);
        if (event.step.status === "waiting") setPendingStepId(event.step.id);
      } else if (event.type === "step_updated") {
        if (event.tool_status) {
          setRun((r) => {
            if (!r) return r;
            return {
              ...r, steps: r.steps.map((s) => {
                if (s.id !== event.step_id) return s;
                return {
                  ...s,
                  status: event.status,
                  output: event.output ?? s.output,
                  toolCall: s.toolCall ? { ...s.toolCall, status: event.tool_status } : s.toolCall,
                };
              }),
            };
          });
        } else {
          const patch: Partial<Step> = { status: event.status };
          if (event.output !== undefined) patch.output = event.output;
          updateStep(event.step_id, patch);
        }
      } else if (event.type === "tool_approval_required") {
        setPendingStepId(event.step_id);
      } else if (event.type === "done") {
        setRun((r) => {
          const updated = r ? { ...r, status: "done" as const } : r;
          if (updated) {
            setPastRuns((prev) => {
              const next = [updated, ...prev.filter((p) => p.id !== updated.id)];
              saveStoredRuns(next);
              return next;
            });
          }
          return updated;
        });
        setPendingStepId(null);
        es.close();
      } else if (event.type === "error") {
        setRun((r) => {
          const updated = r ? { ...r, status: "error" as const } : r;
          if (updated) {
            setPastRuns((prev) => {
              const next = [updated, ...prev.filter((p) => p.id !== updated.id)];
              saveStoredRuns(next);
              return next;
            });
          }
          return updated;
        });
        es.close();
      }
    };
  }, [updateStep]);

  const approve = useCallback(async () => {
    const id = runIdRef.current;
    if (!id) return;
    setPendingStepId(null);
    await fetch(`/api/v1/agent/runs/${id}/approve`, { method: "POST" });
  }, []);

  const deny = useCallback(async () => {
    const id = runIdRef.current;
    if (!id) return;
    setPendingStepId(null);
    await fetch(`/api/v1/agent/runs/${id}/deny`, { method: "POST" });
  }, []);

  const stopRun = useCallback(async () => {
    esRef.current?.close();
    const id = runIdRef.current;
    if (id) await fetch(`/api/v1/agent/runs/${id}`, { method: "DELETE" });
    setRun(null);
    setPendingStepId(null);
    runIdRef.current = null;
  }, []);

  const clearRun = useCallback(() => {
    setRun(null);
    setPendingStepId(null);
  }, []);

  const loadPastRun = useCallback((id: string) => {
    const found = loadStoredRuns().find((r) => r.id === id);
    if (found) setRun(found);
  }, []);

  useEffect(() => () => { esRef.current?.close(); }, []);

  return (
    <AgentContext.Provider value={{ run, pastRuns, pendingStepId, startRun, approve, deny, stopRun, clearRun, loadPastRun }}>
      {children}
    </AgentContext.Provider>
  );
}

export function useAgentContext() {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error("useAgentContext must be used inside AgentProvider");
  return ctx;
}
