import { WorkspaceLayout } from "@/components/workspace-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Shield,
  AlertTriangle,
  Activity,
  Terminal,
  Clock,
  ChevronRight,
  TrendingUp,
} from "lucide-react";

const recentFindings = [
  { id: 1, title: "SSH default credentials", severity: "critical", host: "192.168.1.5", time: "2m ago" },
  { id: 2, title: "Open SMB shares", severity: "high", host: "192.168.1.5", time: "4m ago" },
  { id: 3, title: "HTTP without HTTPS redirect", severity: "medium", host: "192.168.1.5:80", time: "6m ago" },
  { id: 4, title: "Outdated OpenSSH version", severity: "low", host: "192.168.1.5:22", time: "8m ago" },
];

const severityConfig: Record<string, { label: string; className: string }> = {
  critical: { label: "Critical", className: "bg-red-100 text-red-700 border-red-200" },
  high: { label: "High", className: "bg-orange-100 text-orange-700 border-orange-200" },
  medium: { label: "Medium", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  low: { label: "Low", className: "bg-blue-100 text-blue-700 border-blue-200" },
};

const recentActivity = [
  { text: "nmap scan completed on 192.168.1.0/28", time: "2m ago", icon: Terminal },
  { text: "Assistant flagged weak SSH credentials", time: "4m ago", icon: AlertTriangle },
  { text: "Mission 'Corp pentest Q3' created", time: "1h ago", icon: Shield },
];

export default function DashboardPage() {
  return (
    <WorkspaceLayout
      title="Overview"
      actions={
        <Button size="sm">
          <Terminal className="h-4 w-4 mr-1.5" />
          New session
        </Button>
      }
    >
      <div className="space-y-6 max-w-6xl">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Active missions", value: "3", icon: Shield, sub: "+1 this week" },
            { label: "Open findings", value: "12", icon: AlertTriangle, sub: "3 critical" },
            { label: "Sessions today", value: "7", icon: Terminal, sub: "2 running" },
            { label: "Hosts scanned", value: "48", icon: Activity, sub: "Last 30 days" },
          ].map(({ label, value, icon: Icon, sub }) => (
            <Card key={label}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-2xl font-semibold mt-0.5">{value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                  </div>
                  <Icon className="h-4 w-4 text-muted-foreground mt-0.5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Recent findings</CardTitle>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground">
                  View all <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {recentFindings.map((f) => {
                  const sev = severityConfig[f.severity];
                  return (
                    <div
                      key={f.id}
                      className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Badge variant="outline" className={`text-xs shrink-0 ${sev.className}`}>
                          {sev.label}
                        </Badge>
                        <span className="truncate font-medium">{f.title}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-muted-foreground ml-4">
                        <span className="text-xs font-mono">{f.host}</span>
                        <span className="text-xs">{f.time}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Activity</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {recentActivity.map(({ text, time, icon: Icon }) => (
                  <div key={text} className="flex gap-3">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Icon className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs leading-snug">{text}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />{time}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4" />
                  Corp pentest Q3
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {[
                  { label: "Recon", pct: 90 },
                  { label: "Enumeration", pct: 60 },
                  { label: "Exploitation", pct: 25 },
                  { label: "Reporting", pct: 10 },
                ].map(({ label, pct }) => (
                  <div key={label} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium">{pct}%</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </WorkspaceLayout>
  );
}
