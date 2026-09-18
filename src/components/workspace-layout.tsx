"use client";

import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";

export function WorkspaceLayout({
  children,
  title,
  actions,
}: {
  children: React.ReactNode;
  title: string;
  actions?: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center border-b px-4 gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <h1 className="text-sm font-medium">{title}</h1>
          {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
        </header>
        <div className="overflow-y-auto p-4" style={{ height: "calc(100vh - 3.5rem)" }}>{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
