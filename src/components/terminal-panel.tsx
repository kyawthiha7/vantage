"use client";

import { useEffect, useRef } from "react";

interface Props {
  className?: string;
  sessionId: string;
}

const WS_URL = (id: string) => `ws://localhost:8765/api/v1/ws/terminal/${id}`;

export function TerminalPanel({ className, sessionId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");
      await import("@xterm/xterm/css/xterm.css");

      if (cancelled || !containerRef.current) return;

      const term = new Terminal({
        theme: {
          background: "#faf9f7",
          foreground: "#1a1a18",
          cursor: "#555550",
          selectionBackground: "#c8c6c0",
          black: "#1a1a18",       brightBlack: "#666660",
          red: "#c0392b",         brightRed: "#e74c3c",
          green: "#27ae60",       brightGreen: "#2ecc71",
          yellow: "#b7860e",      brightYellow: "#d4a017",
          blue: "#2980b9",        brightBlue: "#3498db",
          magenta: "#8e44ad",     brightMagenta: "#9b59b6",
          cyan: "#16a085",        brightCyan: "#1abc9c",
          white: "#888884",       brightWhite: "#1a1a18",
        },
        fontFamily: '"Geist Mono", "Cascadia Code", monospace',
        fontSize: 13,
        lineHeight: 1.5,
        cursorBlink: true,
        scrollback: 5000,
      });

      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(containerRef.current);
      fit.fit();

      if (cancelled) { term.dispose(); return; }

      let ws: WebSocket | null = null;
      let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

      function connect() {
        if (cancelled) return;
        ws = new WebSocket(WS_URL(sessionId));
        ws.binaryType = "arraybuffer";

        ws.onopen = () => {
          if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
          ws!.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
        };

        ws.onmessage = (e) => {
          const data = e.data instanceof ArrayBuffer ? new Uint8Array(e.data) : e.data;
          term.write(data as Uint8Array);
        };

        ws.onerror = () => { /* onclose fires next */ };

        ws.onclose = () => {
          if (!cancelled) {
            term.writeln("\r\n\x1b[2m[reconnecting in 2s…]\x1b[0m");
            reconnectTimer = setTimeout(connect, 2000);
          }
        };
      }

      term.onData((data) => {
        if (ws?.readyState === WebSocket.OPEN) ws.send(new TextEncoder().encode(data));
      });

      const observer = new ResizeObserver(() => {
        fit.fit();
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
        }
      });
      observer.observe(containerRef.current!);

      connect();

      cleanupRef.current = () => {
        cancelled = true;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        observer.disconnect();
        ws?.close();
        term.dispose();
      };
    }

    run();

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return <div ref={containerRef} className={className} style={{ height: "100%" }} />;
}
