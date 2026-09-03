"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

export function WebMCPStatus() {
  const [supported, setSupported] = useState(false);
  const [toolCount, setToolCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const ctx = document.modelContext;
      if (!ctx) {
        if (!cancelled) {
          setSupported(false);
          setToolCount(0);
        }
        return;
      }
      if (!cancelled) setSupported(true);
      try {
        const tools = await ctx.getTools();
        if (!cancelled) setToolCount(tools.length);
      } catch {
        if (!cancelled) setToolCount(0);
      }
    }

    refresh();
    const id = window.setInterval(refresh, 2000);
    const onChange = () => refresh();
    document.modelContext?.addEventListener?.("toolchange", onChange);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.modelContext?.removeEventListener?.("toolchange", onChange);
    };
  }, []);

  return (
    <div className="flex items-center gap-2">
      <Badge
        variant={supported ? "default" : "muted"}
        icon={supported ? "hub" : "cloud_off"}
        iconFilled={supported}
      >
        {supported ? `WebMCP · ${toolCount} tools` : "WebMCP unavailable"}
      </Badge>
      <Script
        src="https://cdn.jsdelivr.net/npm/@mcp-b/webmcp-local-relay@latest/dist/browser/embed.js"
        strategy="afterInteractive"
      />
    </div>
  );
}
