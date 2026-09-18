"use client";

import dynamic from "next/dynamic";
import { WorkspaceLayout } from "@/components/workspace-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Circle } from "lucide-react";
import { useState } from "react";

const TerminalPanel = dynamic(
  () => import("@/components/terminal-panel").then((m) => m.TerminalPanel),
  { ssr: false }
);

const initialSessions = [
  { id: "1", name: "recon-192.168", active: true },
  { id: "2", name: "enum-smb", active: false },
];

export default function TerminalPage() {
  const [sessions, setSessions] = useState(initialSessions);
  const [activeId, setActiveId] = useState("1");

  const addSession = () => {
    const id = String(Date.now());
    setSessions((s) => [...s, { id, name: `session-${s.length + 1}`, active: false }]);
    setActiveId(id);
  };

  const removeSession = (id: string) => {
    setSessions((s) => {
      const next = s.filter((s) => s.id !== id);
      if (activeId === id && next.length > 0) setActiveId(next[next.length - 1].id);
      return next;
    });
  };

  return (
    <WorkspaceLayout
      title="Terminal"
      actions={
        <Badge variant="outline" className="text-xs gap-1 text-green-700 border-green-200 bg-green-50">
          <Circle className="h-2 w-2 fill-green-500 text-green-500" />
          Connected
        </Badge>
      }
    >
      <div className="flex flex-col gap-3 h-[calc(100vh-8rem)]">
        {/* Tab bar */}
        <div className="flex items-center gap-1 border-b pb-3">
          {sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => setActiveId(s.id)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs cursor-pointer transition-colors select-none ${
                activeId === s.id
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <span className="font-mono">{s.name}</span>
              {sessions.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); removeSession(s.id); }}
                  className="ml-1 rounded hover:opacity-70"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 ml-1" onClick={addSession}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Terminal */}
        <div className="flex-1 rounded-lg border overflow-hidden bg-[#faf9f7]">
          <TerminalPanel className="h-full w-full p-2" sessionId={activeId} />
        </div>
      </div>
    </WorkspaceLayout>
  );
}
