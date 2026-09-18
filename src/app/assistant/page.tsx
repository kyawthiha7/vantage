"use client";

import { useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { WorkspaceLayout } from "@/components/workspace-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, User, Check, X, Terminal, AlertTriangle, Send, Loader2 } from "lucide-react";
import { useChatContext, ChatMessage as Message } from "@/contexts/chat-context";
import { useState } from "react";

function parseToolCall(text: string): { tool: string; command: string } | null {
  const match = text.match(/<tool_call>([\s\S]*?)<\/tool_call>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function ApprovalCard({
  approval,
  onApprove,
  onDeny,
}: {
  approval: NonNullable<Message["approval"]>;
  onApprove: () => void;
  onDeny: () => void;
}) {
  return (
    <div className="mt-2 rounded-lg border bg-muted/40 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/60">
        <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium">Tool — {approval.tool}</span>
        {approval.status === "approved" && !approval.output && (
          <Badge variant="outline" className="ml-auto text-xs bg-blue-50 text-blue-700 border-blue-200 gap-1">
            <Loader2 className="h-2.5 w-2.5 animate-spin" /> Running
          </Badge>
        )}
        {approval.status === "approved" && approval.output && (
          <Badge variant="outline" className="ml-auto text-xs bg-green-50 text-green-700 border-green-200">Done</Badge>
        )}
        {approval.status === "denied" && (
          <Badge variant="outline" className="ml-auto text-xs bg-red-50 text-red-700 border-red-200">Denied</Badge>
        )}
      </div>
      <div className="px-3 py-2 border-b">
        <code className="text-xs font-mono break-all">{approval.command}</code>
      </div>
      {approval.status === "pending" && (
        <div className="flex gap-2 px-3 py-2">
          <Button size="sm" className="h-7 text-xs gap-1" onClick={onApprove}>
            <Check className="h-3 w-3" /> Approve
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={onDeny}>
            <X className="h-3 w-3" /> Deny
          </Button>
        </div>
      )}
      {approval.output && (
        <div className="px-3 py-2">
          <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap max-h-48 overflow-auto leading-relaxed">{approval.output}</pre>
        </div>
      )}
    </div>
  );
}

function MessageBubble({
  msg,
  onApprove,
  onDeny,
}: {
  msg: Message;
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
}) {
  const isUser = msg.role === "user";
  const displayText = msg.content.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "").trim();

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted mt-0.5">
        {isUser ? <User className="h-3.5 w-3.5 text-muted-foreground" /> : <Bot className="h-3.5 w-3.5 text-muted-foreground" />}
      </div>
      <div className={`max-w-[80%] space-y-1 ${isUser ? "items-end" : ""}`}>
        {(displayText || msg.pending) && (
          <div className={`rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${isUser ? "bg-foreground text-background rounded-tr-sm" : "bg-muted/60 border rounded-tl-sm"}`}>
            {displayText || (msg.pending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />)}
          </div>
        )}
        {msg.approval && (
          <ApprovalCard
            approval={msg.approval}
            onApprove={() => onApprove(msg.id)}
            onDeny={() => onDeny(msg.id)}
          />
        )}
      </div>
    </div>
  );
}

function AssistantPage() {
  const searchParams = useSearchParams();
  const SESSION_ID = searchParams.get("s") ?? "default";

  const { messages, streaming, setMessages, setStreaming } = useChatContext();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([]);
    fetch(`/api/v1/chat/${SESSION_ID}/history`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: { id: number; role: string; content: string }[]) => {
        if (rows.length > 0) {
          setMessages(rows.map((r) => ({ id: String(r.id), role: r.role as "user" | "assistant", content: r.content })));
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [SESSION_ID]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const streamClaude = async (apiMessages: { role: string; content: string }[]) => {
    const assistantId = String(Date.now());
    setMessages((m) => [...m, { id: assistantId, role: "assistant", content: "", pending: true }]);
    setStreaming(true);
    let accumulated = "";
    try {
      const res = await fetch("/api/v1/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: SESSION_ID, messages: apiMessages }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const { text } = JSON.parse(data);
            accumulated += text;
            setMessages((m) => m.map((msg) =>
              msg.id === assistantId ? { ...msg, content: accumulated, pending: false } : msg
            ));
          } catch {}
        }
      }
      const toolCall = parseToolCall(accumulated);
      if (toolCall) {
        setMessages((m) => m.map((msg) =>
          msg.id === assistantId
            ? { ...msg, approval: { tool: toolCall.tool, command: toolCall.command, status: "pending" } }
            : msg
        ));
      }
    } catch {
      setMessages((m) => m.map((msg) =>
        msg.id === assistantId
          ? { ...msg, content: "Could not reach backend.", pending: false }
          : msg
      ));
    } finally {
      setStreaming(false);
    }
  };

  const handleApprove = async (id: string) => {
    const target = messages.find((m) => m.id === id);
    if (!target?.approval) return;
    const { command } = target.approval;

    // Mark as running
    setMessages((m) => m.map((msg) =>
      msg.id === id ? { ...msg, approval: { ...msg.approval!, status: "approved" } } : msg
    ));

    // Execute the command
    let output = "";
    try {
      const r = await fetch("/api/v1/chat/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      });
      output = r.ok ? (await r.json()).output : "Execution failed.";
    } catch {
      output = "Backend unreachable.";
    }

    // Show output in the card
    setMessages((m) => m.map((msg) =>
      msg.id === id ? { ...msg, approval: { ...msg.approval!, output } } : msg
    ));

    // Stream Claude's follow-up with the output as context
    const apiMessages = messages
      .filter((m) => !m.pending)
      .map((m) => ({ role: m.role, content: m.content }));
    apiMessages.push({ role: "user", content: `Tool output:\n\`\`\`\n${output}\n\`\`\`` });
    await streamClaude(apiMessages);
  };

  const handleDeny = (id: string) => {
    setMessages((m) => m.map((msg) =>
      msg.id === id && msg.approval ? { ...msg, approval: { ...msg.approval, status: "denied" } } : msg
    ));
  };

  const send = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    const userMsg: Message = { id: String(Date.now()), role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    const apiMessages = [...messages, userMsg]
      .filter((m) => !m.pending)
      .map((m) => ({ role: m.role, content: m.content }));
    await streamClaude(apiMessages);
  };

  const pendingCount = messages.filter((m) => m.approval?.status === "pending").length;

  return (
    <WorkspaceLayout
      title="Assistant"
      actions={
        pendingCount > 0 ? (
          <Badge variant="outline" className="text-xs gap-1.5 text-orange-700 border-orange-200 bg-orange-50">
            <AlertTriangle className="h-3 w-3" />
            {pendingCount} pending approval
          </Badge>
        ) : null
      }
    >
      <div className="flex flex-col h-full max-w-3xl mx-auto">
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4 py-2">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} onApprove={handleApprove} onDeny={handleDeny} />
            ))}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <div className="border-t pt-4 mt-4">
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
              placeholder="Ask the assistant…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              disabled={streaming}
            />
            <Button size="sm" onClick={send} disabled={!input.trim() || streaming}>
              {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Tool calls require your approval before running.</p>
        </div>
      </div>
    </WorkspaceLayout>
  );
}

// useSearchParams requires Suspense in Next.js App Router
import { Suspense } from "react";
export default function AssistantPageWrapper() {
  return (
    <Suspense>
      <AssistantPage />
    </Suspense>
  );
}
