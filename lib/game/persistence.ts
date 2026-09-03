import type { GameMachineConfig } from "./machine/types";

const STORAGE_PREFIX = "card-table:session:";

export type PersistedGame = {
  version: 1;
  presetId: string | null;
  machine: GameMachineConfig;
  actorSnapshot: unknown;
};

function storageKey(id: string): string {
  return `${STORAGE_PREFIX}${id}`;
}

function isPersistedGame(value: unknown): value is PersistedGame {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === 1 &&
    (v.presetId === null || typeof v.presetId === "string") &&
    v.machine !== null &&
    typeof v.machine === "object" &&
    "actorSnapshot" in v
  );
}

export function savePersistedGame(id: string, payload: PersistedGame): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(id), JSON.stringify(payload));
  } catch {
    // Quota / private mode — ignore.
  }
}

export function loadPersistedGame(id: string): PersistedGame | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(id));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isPersistedGame(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function removePersistedGame(id: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(storageKey(id));
  } catch {
    // Ignore.
  }
}
