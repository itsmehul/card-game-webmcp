"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  getPreset,
  listPresets,
  type SessionMode,
} from "@/lib/game";

interface GameCatalogProps {
  onStart: (id: string, mode: SessionMode) => void;
}

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
} as const;

const item = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 220, damping: 24 },
  },
} as const;

export function GameCatalog({ onStart }: GameCatalogProps) {
  const presets = listPresets();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-2xl space-y-3"
      >
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
      </motion.div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-2"
      >
        {presets.map((entry) => {
          const full = getPreset(entry.id);
          const bots = full?.botCount ?? 2;
          return (
            <motion.article
              key={entry.id}
              variants={item}
              whileHover={{ y: -6, scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
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
            </motion.article>
          );
        })}
      </motion.div>

      <motion.aside
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="rounded-xl border border-dashed border-emerald-700/40 bg-emerald-950/20 px-5 py-4"
      >
        <p className="max-w-2xl text-sm leading-relaxed text-emerald-100/70">
          <span className="font-semibold text-emerald-200">Not on the list?</span>{" "}
          Ask an agent to invent a custom game — it has the playbook via WebMCP.
        </p>
      </motion.aside>
    </div>
  );
}
