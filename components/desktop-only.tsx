import type { ReactNode } from "react";

export function DesktopOnly({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-3 px-8 text-center md:hidden">
        <p className="font-mono text-xs tracking-[0.2em] text-emerald-500/70 uppercase">
          Card Table
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-emerald-50">
          Desktop only
        </h1>
        <p className="max-w-sm text-sm leading-relaxed text-emerald-100/60">
          This table needs a wider screen. Open it on a laptop or desktop to
          play.
        </p>
      </div>
      <div className="hidden min-h-full flex-1 flex-col md:flex">{children}</div>
    </>
  );
}
