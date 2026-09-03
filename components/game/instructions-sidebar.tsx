"use client";

import { useState } from "react";
import { BookOpen, ScrollText } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { NarrationEntry } from "@/lib/game";

type SidebarId = "instructions" | "log";

export function TableSidebars({
  logs,
  instructions,
}: {
  logs: NarrationEntry[];
  instructions: string;
}) {
  const [active, setActive] = useState<SidebarId | null>("log");

  function select(id: SidebarId) {
    setActive((current) => (current === id ? null : id));
  }

  return (
    <div className="flex h-full min-h-0 shrink-0 self-stretch overflow-hidden">
      <nav
        className="flex w-12 shrink-0 flex-col items-center border-r border-emerald-900/60 bg-emerald-950/50 py-3"
        aria-label="Sidebars"
      >
        <RailLabel
          label="How to play"
          pressed={active === "instructions"}
          controls="instructions-panel"
          onClick={() => select("instructions")}
        />
        <div className="my-3 h-px w-6 bg-emerald-900/70" />
        <RailLabel
          label="Game log"
          pressed={active === "log"}
          controls="game-log-panel"
          onClick={() => select("log")}
        />
      </nav>

      {active === "instructions" && (
        <aside
          id="instructions-panel"
          className="flex h-full w-72 min-h-0 flex-col overflow-hidden border-r border-emerald-900/60 bg-emerald-950/40"
        >
          <div className="flex h-11 shrink-0 items-center gap-2 border-b border-emerald-900/50 px-3 text-emerald-100">
            <BookOpen className="size-4 shrink-0" aria-hidden />
            <span className="font-medium">How to play</span>
          </div>
          <ScrollArea className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {instructions.trim() ? (
              <p className="whitespace-pre-wrap leading-relaxed text-emerald-200/90">
                {instructions}
              </p>
            ) : (
              <p className="text-sm text-emerald-700">
                Waiting for the agent to write instructions.
              </p>
            )}
          </ScrollArea>
        </aside>
      )}

      {active === "log" && (
        <aside
          id="game-log-panel"
          className="flex h-full w-72 min-h-0 flex-col overflow-hidden border-r border-emerald-900/60 bg-emerald-950/30"
        >
          <div className="flex h-11 shrink-0 items-center gap-2 border-b border-emerald-900/50 px-3 text-emerald-100">
            <ScrollText className="size-4 shrink-0" aria-hidden />
            <span className="font-medium">Game log</span>
          </div>
          <ScrollArea className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {logs.length === 0 ? (
              <p className="text-sm text-emerald-700">No narration yet.</p>
            ) : (
              <ol className="relative space-y-0 border-l border-emerald-800/70 pl-3">
                {logs
                  .slice()
                  .reverse()
                  .map((n, i) => (
                    <li key={n.id} className="relative pb-3 last:pb-0">
                      <span
                        aria-hidden
                        className={cn(
                          "absolute top-1.5 left-[-0.97rem] size-2 rounded-full ring-2 ring-emerald-950",
                          i === 0
                            ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.55)]"
                            : "bg-emerald-600/80",
                        )}
                      />
                      <time
                        dateTime={new Date(n.at).toISOString()}
                        className="mb-0.5 block font-mono text-[0.65rem] tracking-wide text-emerald-500/90"
                      >
                        {formatLogTime(n.at)}
                      </time>
                      <p
                        className={cn(
                          "text-sm leading-snug",
                          i === 0
                            ? "font-medium text-amber-100/95"
                            : "text-emerald-200/80",
                        )}
                      >
                        {n.text}
                      </p>
                    </li>
                  ))}
              </ol>
            )}
          </ScrollArea>
        </aside>
      )}
    </div>
  );
}

function formatLogTime(at: number) {
  return new Date(at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function RailLabel({
  label,
  pressed,
  controls,
  onClick,
}: {
  label: string;
  pressed: boolean;
  controls: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-controls={controls}
      aria-expanded={pressed}
      onClick={onClick}
      className={cn(
        "flex max-h-40 flex-1 items-center justify-center px-1 text-[0.7rem] font-semibold tracking-[0.2em]",
        pressed
          ? "text-amber-300"
          : "text-emerald-400/80 hover:text-emerald-100",
      )}
    >
      <span style={{ writingMode: "vertical-rl" }}>{label}</span>
    </button>
  );
}
