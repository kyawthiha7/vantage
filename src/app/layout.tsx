import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ChatProvider } from "@/contexts/chat-context";
import { AgentProvider } from "@/contexts/agent-context";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Vantage",
  description: "Security testing workbench",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="bg-background">
        <TooltipProvider delayDuration={300}>
          <ChatProvider><AgentProvider>{children}</AgentProvider></ChatProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
