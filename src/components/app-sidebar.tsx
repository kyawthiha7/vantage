"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import {
  LayoutDashboard,
  Terminal,
  Bot,
  Cpu,
  AlertTriangle,
  FileText,
  Settings,
  Shield,
  ChevronDown,
  Plus,
  MessageSquare,
  Activity,
} from "lucide-react";
import { useAgentContext } from "@/contexts/agent-context";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/terminal", label: "Terminal", icon: Terminal },
  { href: "/agent", label: "Agent", icon: Cpu },
  { href: "/assistant", label: "Assistant", icon: Bot },
  { href: "/findings", label: "Findings", icon: AlertTriangle, badge: 3 },
  { href: "/reports", label: "Reports", icon: FileText },
];

interface ChatSession {
  session_id: string;
  title: string;
  created_at: string;
}

function ChatsSection() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeSessionId = searchParams.get("s") ?? null;
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  useEffect(() => {
    fetch("/api/v1/chat/sessions")
      .then((r) => (r.ok ? r.json() : []))
      .then(setSessions)
      .catch(() => {});
  }, [pathname, activeSessionId]);

  function newChat() {
    const id = `chat_${Date.now().toString(16)}`;
    router.push(`/assistant?s=${id}`);
  }

  return (
    <SidebarGroup>
      <div className="flex items-center justify-between px-2 mb-1">
        <SidebarGroupLabel className="p-0 h-auto text-xs">Chats</SidebarGroupLabel>
        <button
          onClick={newChat}
          className="flex h-5 w-5 items-center justify-center rounded hover:bg-sidebar-accent text-muted-foreground hover:text-foreground transition-colors"
          title="New chat"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
      <SidebarMenu>
        {sessions.length === 0 && (
          <SidebarMenuItem>
            <span className="px-2 py-1 text-xs text-muted-foreground/60">No chats yet</span>
          </SidebarMenuItem>
        )}
        {sessions.map((s) => (
          <SidebarMenuItem key={s.session_id}>
            <SidebarMenuButton
              isActive={activeSessionId === s.session_id}
              render={<Link href={`/assistant?s=${s.session_id}`} />}
              className="text-xs"
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{s.title}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}

function AgentRunsSection() {
  const { pastRuns } = useAgentContext();
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeRunId = searchParams.get("r") ?? null;

  return (
    <SidebarGroup>
      <div className="flex items-center justify-between px-2 mb-1">
        <SidebarGroupLabel className="p-0 h-auto text-xs">Agent Runs</SidebarGroupLabel>
        <button
          onClick={() => router.push("/agent")}
          className="flex h-5 w-5 items-center justify-center rounded hover:bg-sidebar-accent text-muted-foreground hover:text-foreground transition-colors"
          title="New run"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
      <SidebarMenu>
        {pastRuns.length === 0 && (
          <SidebarMenuItem>
            <span className="px-2 py-1 text-xs text-muted-foreground/60">No runs yet</span>
          </SidebarMenuItem>
        )}
        {pastRuns.map((r) => (
          <SidebarMenuItem key={r.id}>
            <SidebarMenuButton
              isActive={activeRunId === r.id}
              render={<Link href={`/agent?r=${r.id}`} />}
              className="text-xs"
            >
              <Activity className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate flex-1">{r.goal}</span>
              {r.status === "error" && (
                <span className="text-[10px] text-red-500 shrink-0">err</span>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground">
            <Shield className="h-4 w-4 text-background" />
          </div>
          <span className="font-semibold text-sm tracking-tight">Vantage</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarMenu>
            {navItems.map(({ href, label, icon: Icon, badge }) => (
              <SidebarMenuItem key={href}>
                <SidebarMenuButton
                  isActive={pathname === href}
                  render={<Link href={href} />}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                  {badge && (
                    <Badge variant="secondary" className="ml-auto text-xs h-5 min-w-5 px-1.5">
                      {badge}
                    </Badge>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarSeparator />

        <Suspense>
          <ChatsSection />
        </Suspense>

        <SidebarSeparator />

        <Suspense>
          <AgentRunsSection />
        </Suspense>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton isActive={pathname === "/settings"} render={<Link href="/settings" />}>
              <Settings className="h-4 w-4" />
              Settings
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent outline-none">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  J
                </div>
                <span>Joe</span>
                <ChevronDown className="ml-auto h-3 w-3 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-48">
                <DropdownMenuItem>Profile</DropdownMenuItem>
                <DropdownMenuItem>Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
