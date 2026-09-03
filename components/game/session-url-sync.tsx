"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { gameStore, useGameSession } from "@/lib/game";

type HydrateStatus = "idle" | "loading" | "ready" | "missing";

/**
 * Keeps the URL in sync with the active session id and hydrates from
 * localStorage when landing on /game/[id].
 */
export function SessionUrlSync({
  routeSessionId,
  children,
}: {
  /** Present when rendered under /game/[id]. */
  routeSessionId?: string;
  children: ReactNode;
}) {
  const session = useGameSession();
  const pathname = usePathname();
  const router = useRouter();
  const [hydrateStatus, setHydrateStatus] = useState<HydrateStatus>(() =>
    routeSessionId ? "loading" : "idle",
  );

  // Hydrate only when the route id changes — not when the session is cleared.
  useEffect(() => {
    if (!routeSessionId) {
      setHydrateStatus("idle");
      return;
    }

    if (gameStore.getSnapshot()?.id === routeSessionId) {
      setHydrateStatus("ready");
      return;
    }

    setHydrateStatus("loading");
    const ok = gameStore.hydrate(routeSessionId);
    setHydrateStatus(ok ? "ready" : "missing");
  }, [routeSessionId]);

  // Push / replace URL when session appears or ends.
  useEffect(() => {
    if (session) {
      const target = `/game/${session.id}`;
      if (pathname !== target) {
        router.replace(target);
      }
      return;
    }
    if (!pathname.startsWith("/game/")) return;
    if (hydrateStatus === "loading" || hydrateStatus === "missing") return;
    router.replace("/");
  }, [session, pathname, router, hydrateStatus]);

  if (routeSessionId && hydrateStatus === "loading" && !session) {
    return (
      <div className="flex h-dvh min-h-0 flex-1 flex-col items-center justify-center gap-2 bg-[#0b1f14] px-8 text-center">
        <p className="font-mono text-xs tracking-[0.2em] text-emerald-500/70 uppercase">
          Card Table
        </p>
        <p className="text-sm text-emerald-100/60">Restoring session…</p>
      </div>
    );
  }

  if (routeSessionId && hydrateStatus === "missing" && !session) {
    return (
      <div className="flex h-dvh min-h-0 flex-1 flex-col items-center justify-center gap-4 bg-[#0b1f14] px-8 text-center">
        <p className="font-mono text-xs tracking-[0.2em] text-emerald-500/70 uppercase">
          Card Table
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-emerald-50">
          Session not found
        </h1>
        <p className="max-w-sm text-sm leading-relaxed text-emerald-100/60">
          No saved game for{" "}
          <span className="font-mono text-emerald-200/80">{routeSessionId}</span>.
          It may have ended or never been stored in this browser.
        </p>
        <Link
          href="/"
          className="rounded-md border border-emerald-800/60 bg-emerald-950/40 px-4 py-2 text-sm text-emerald-100 transition-colors hover:border-emerald-600/60 hover:bg-emerald-900/40"
        >
          Back to catalog
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
