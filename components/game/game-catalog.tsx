"use client";

import { Button } from "@/components/ui/button";
import {
  getPreset,
  listPresets,
  type SessionMode,
} from "@/lib/game";

interface GameCatalogProps {
  onStart: (id: string, mode: SessionMode) => void;
}

export function GameCatalog({ onStart }: GameCatalogProps) {
  const presets = listPresets();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-10">
      <div className="max-w-2xl space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-400/80">
          Choose a table
        </p>
        <h2 className="font-serif text-3xl tracking-tight text-emerald-50 sm:text-4xl">
          Pick a card game — or invent one with your agent
        </h2>
        <p className="text-base leading-relaxed text-emerald-200/75">
          Start a preset from the catalog below, or ask a connected coding agent
          over WebMCP to create a game that isn&apos;t listed yet. Agents should
          download the{" "}
          <a
            href="/skills/card-table/SKILL.md"
            download="card-table-SKILL.md"
            className="text-amber-300 underline decoration-amber-700/80 underline-offset-2 hover:text-amber-200"
          >
            card-table skill
          </a>{" "}
          instead of loading every tool description.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {presets.map((entry) => {
          const full = getPreset(entry.id);
          const bots = full?.botCount ?? 2;
          return (
            <article
              key={entry.id}
              className="group flex flex-col gap-4 rounded-xl border border-emerald-800/70 bg-linear-to-br from-emerald-950/80 to-emerald-950/30 p-5 shadow-[inset_0_1px_0_rgba(167,243,208,0.06)] transition hover:border-amber-500/40 hover:shadow-[0_0_0_1px_rgba(245,158,11,0.15)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <h3 className="text-lg font-semibold text-emerald-50">
                    {entry.name}
                  </h3>
                  <p className="text-sm leading-relaxed text-emerald-300/70">
                    {entry.summary}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-emerald-800/80 bg-emerald-950/60 px-2.5 py-1 text-xs text-emerald-400/90">
                  You + {bots} bot{bots === 1 ? "" : "s"}
                </span>
              </div>
              <div className="mt-auto flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => onStart(entry.id, "practice")}
                >
                  Play
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onStart(entry.id, "tutorial")}
                >
                  Tutorial
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      <aside className="rounded-xl border border-dashed border-amber-600/40 bg-amber-950/20 px-5 py-6">
        <h3 className="text-base font-semibold text-amber-200">
          Ask an agent for a new game
        </h3>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-amber-100/70">
          Not on the list? Point the agent at{" "}
          <a
            href="/skills/card-table/SKILL.md"
            className="font-medium text-amber-100 underline decoration-amber-700/80 underline-offset-2"
          >
            /skills/card-table/SKILL.md
          </a>
          , then tell it to call{" "}
          <code className="rounded bg-amber-950/60 px-1.5 py-0.5 font-mono text-xs text-amber-100">
            create_game
          </code>{" "}
          with a custom name, zones,{" "}
          <code className="rounded bg-amber-950/60 px-1.5 py-0.5 font-mono text-xs text-amber-100">
            legalActions
          </code>
          , and{" "}
          <code className="rounded bg-amber-950/60 px-1.5 py-0.5 font-mono text-xs text-amber-100">
            instructions
          </code>
          — or use{" "}
          <code className="rounded bg-amber-950/60 px-1.5 py-0.5 font-mono text-xs text-amber-100">
            list_presets
          </code>{" "}
          first to see what already exists. Omit{" "}
          <code className="rounded bg-amber-950/60 px-1.5 py-0.5 font-mono text-xs text-amber-100">
            preset
          </code>{" "}
          when inventing something new.
        </p>
      </aside>
    </div>
  );
}
