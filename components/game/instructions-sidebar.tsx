"use client";

import { useState } from "react";
import { MaterialIcon } from "@/components/ui/material-icon";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { NarrationEntry } from "@/lib/game";

type SidebarId = "instructions" | "log";

const RAIL: Array<{
  id: SidebarId;
  label: string;
  icon: "menu_book" | "receipt_long";
  panelId: string;
}> = [
  {
    id: "instructions",
    label: "How to play",
    icon: "menu_book",
    panelId: "instructions-panel",
  },
  {
    id: "log",
    label: "Game log",
    icon: "receipt_long",
    panelId: "game-log-panel",
  },
];

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
        className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-emerald-900/60 bg-emerald-950/50 py-3"
        aria-label="Sidebars"
      >
        {RAIL.map((item, index) => (
          <div key={item.id} className="contents">
            {index > 0 && <div className="my-2 h-px w-6 bg-emerald-900/70" />}
            <RailButton
              label={item.label}
              icon={item.icon}
              pressed={active === item.id}
              controls={item.panelId}
              onClick={() => select(item.id)}
            />
          </div>
        ))}
      </nav>

      {active === "instructions" && (
        <aside
          id="instructions-panel"
          className="flex h-full w-72 min-h-0 flex-col overflow-hidden border-r border-emerald-900/60 bg-emerald-950/40"
        >
          <div className="flex h-11 shrink-0 items-center gap-2 border-b border-emerald-900/50 px-3 text-emerald-100">
            <MaterialIcon name="menu_book" size="sm" />
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
            <MaterialIcon name="receipt_long" size="sm" />
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

function RailButton({
  label,
  icon,
  pressed,
  controls,
  onClick,
}: {
  label: string;
  icon: "menu_book" | "receipt_long";
  pressed: boolean;
  controls: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      aria-controls={controls}
      aria-expanded={pressed}
      title={label}
      onClick={onClick}
      className={cn(
        "flex size-10 items-center justify-center rounded-lg transition-colors",
        pressed
          ? "bg-amber-500/15 text-amber-300"
          : "text-emerald-400/80 hover:bg-emerald-900/50 hover:text-emerald-100",
      )}
    >
      <MaterialIcon name={icon} size="sm" filled={pressed} />
    </button>
  );
}
