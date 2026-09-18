"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type MessageRole = "assistant" | "user";
type ApprovalStatus = "pending" | "approved" | "denied";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  pending?: boolean;
  approval?: {
    tool: string;
    command: string;
    status: ApprovalStatus;
    output?: string;
  };
}

interface ChatContextValue {
  messages: ChatMessage[];
  streaming: boolean;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setStreaming: React.Dispatch<React.SetStateAction<boolean>>;
  clearMessages: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content: "Connected. Set your scope in Settings, then ask me anything about the engagement.",
};

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [streaming, setStreaming] = useState(false);

  const clearMessages = useCallback(() => setMessages([WELCOME]), []);

  return (
    <ChatContext.Provider value={{ messages, streaming, setMessages, setStreaming, clearMessages }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used inside ChatProvider");
  return ctx;
}
