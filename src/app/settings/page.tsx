"use client";

import { useEffect, useState } from "react";
import { WorkspaceLayout } from "@/components/workspace-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Shield, Zap, Database, Key, CheckCircle2, AlertCircle } from "lucide-react";

const API = "http://localhost:8765/api/v1";

type Toast = { ok: boolean; msg: string } | null;

interface Settings {
  scope_cidr: string;
  scope_excluded: string;
  model_provider: string;
  model_name: string;
  api_key: string;
}

const PROVIDERS = ["Anthropic (Claude)", "OpenAI (GPT)", "Local (Ollama)"];
const MODELS = ["claude-sonnet-5", "claude-opus-4-8", "claude-haiku-4-5", "claude-sonnet-4-6"];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    scope_cidr: "",
    scope_excluded: "",
    model_provider: "Anthropic (Claude)",
    model_name: "claude-sonnet-5",
    api_key: "",
  });
  const [connected, setConnected] = useState<boolean | null>(null);
  const [toast, setToast] = useState<Toast>(null);

  useEffect(() => {
    fetch(`${API}/health`)
      .then((r) => setConnected(r.ok))
      .catch(() => setConnected(false));

    fetch(`${API}/settings`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setSettings(data); })
      .catch(() => {});
  }, []);

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 3000);
  }

  async function save(patch: Partial<Settings>) {
    const merged = { ...settings, ...patch };
    setSettings(merged);
    try {
      const r = await fetch(`${API}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(merged),
      });
      showToast(r.ok, r.ok ? "Saved" : "Failed to save");
    } catch {
      showToast(false, "Backend unreachable");
    }
  }

  return (
    <WorkspaceLayout title="Settings">
      <div className="space-y-6 max-w-2xl">

        {toast && (
          <div className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
            toast.ok
              ? "bg-green-50 border-green-200 text-green-700"
              : "bg-red-50 border-red-200 text-red-700"
          }`}>
            {toast.ok
              ? <CheckCircle2 className="h-4 w-4 shrink-0" />
              : <AlertCircle className="h-4 w-4 shrink-0" />}
            {toast.msg}
          </div>
        )}

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Scope</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Targets outside this scope will be blocked from tool execution.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Target range / CIDR</label>
              <Input
                className="h-9 font-mono text-sm"
                placeholder="192.168.1.0/24"
                value={settings.scope_cidr}
                onChange={(e) => set("scope_cidr", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Excluded hosts</label>
              <Input
                className="h-9 font-mono text-sm"
                placeholder="192.168.1.1, 192.168.1.2"
                value={settings.scope_excluded}
                onChange={(e) => set("scope_excluded", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Comma-separated IPs or ranges</p>
            </div>
            <Button size="sm" onClick={() => save({ scope_cidr: settings.scope_cidr, scope_excluded: settings.scope_excluded })}>
              Save scope
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">AI model</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Provider and model used for the assistant.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Provider</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
                value={settings.model_provider}
                onChange={(e) => set("model_provider", e.target.value)}
              >
                {PROVIDERS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Model</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
                value={settings.model_name}
                onChange={(e) => set("model_name", e.target.value)}
              >
                {MODELS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <Button size="sm" onClick={() => save({ model_provider: settings.model_provider, model_name: settings.model_name })}>
              Save model
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">API key</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Stored in the backend settings file.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Anthropic API key</label>
              <Input
                className="h-9 font-mono text-sm"
                type="password"
                placeholder="sk-ant-…"
                value={settings.api_key}
                onChange={(e) => set("api_key", e.target.value)}
              />
            </div>
            <Button size="sm" onClick={() => save({ api_key: settings.api_key })}>
              Save key
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Backend</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">API server</p>
                <p className="text-xs text-muted-foreground font-mono">http://localhost:8765</p>
              </div>
              {connected === null ? (
                <Badge variant="outline" className="text-xs">Checking…</Badge>
              ) : connected ? (
                <Badge variant="outline" className="text-xs bg-green-50 text-green-600 border-green-100">Connected</Badge>
              ) : (
                <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-100">Disconnected</Badge>
              )}
            </div>
            <Separator />
            <p className="text-xs text-muted-foreground">
              Start the backend with:{" "}
              <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">
                poetry run vantage-core
              </code>
            </p>
          </CardContent>
        </Card>

      </div>
    </WorkspaceLayout>
  );
}
