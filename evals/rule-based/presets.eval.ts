/**
 * Rule-based evals for game presets.
 *
 * These evals verify that every preset in the catalog:
 *  - Loads without error
 *  - Has an XState machine
 *  - Produces a valid session via the actor
 *  - Has required fields (name, instructions, initial controls)
 *  - Configures zones correctly for its game type
 */

import { describe, it, expect } from "vitest";
import {
  listPresets,
  listPresetIds,
  getPreset,
  isKnownPreset,
  createFromPreset,
  startPresetWithActor,
} from "@/lib/game/presets";
import { pass, fail, runEvals, type EvalResult } from "../helpers";

function evalPresetCatalog(): EvalResult[] {
  const results: EvalResult[] = [];
  const presets = listPresets();
  const ids = listPresetIds();

  results.push(
    presets.length > 0
      ? pass("catalog_not_empty")
      : fail("catalog_not_empty", "No presets in catalog"),
  );

  results.push(
    ids.length === presets.length
      ? pass("catalog_ids_match_entries")
      : fail("catalog_ids_match_entries", `${ids.length} ids vs ${presets.length} entries`),
  );

  for (const entry of presets) {
    results.push(
      entry.id && entry.name && entry.summary
        ? pass(`catalog_entry_${entry.id}_complete`)
        : fail(`catalog_entry_${entry.id}_complete`, "Missing id, name, or summary"),
    );
  }

  const uniqueIds = new Set(ids);
  results.push(
    uniqueIds.size === ids.length
      ? pass("catalog_no_duplicate_ids")
      : fail("catalog_no_duplicate_ids", `${ids.length - uniqueIds.size} duplicate ids`),
  );

  return results;
}

function evalPresetSession(presetId: string): EvalResult[] {
  const results: EvalResult[] = [];
  const preset = getPreset(presetId);

  if (!preset) {
    return [fail(`preset_${presetId}_exists`, `Preset "${presetId}" not found`)];
  }

  results.push(pass(`preset_${presetId}_exists`));

  results.push(
    preset.machine?.initial && preset.machine?.states
      ? pass(`preset_${presetId}_has_machine`)
      : fail(`preset_${presetId}_has_machine`, "Missing machine.initial/states"),
  );

  let session;
  try {
    const started = startPresetWithActor(presetId);
    session = started.session;
    started.actor.stop();
    results.push(pass(`preset_${presetId}_creates_session`));
  } catch (e) {
    return [
      ...results,
      fail(`preset_${presetId}_creates_session`, `Error: ${e}`),
    ];
  }

  results.push(
    session.name.length > 0
      ? pass(`preset_${presetId}_has_name`)
      : fail(`preset_${presetId}_has_name`, "Empty name"),
  );

  results.push(
    (session.instructions?.length ?? 0) > 0
      ? pass(`preset_${presetId}_has_instructions`)
      : fail(`preset_${presetId}_has_instructions`, "No instructions provided"),
  );

  results.push(
    session.legalActions.length > 0
      ? pass(`preset_${presetId}_actionable`)
      : fail(
          `preset_${presetId}_actionable`,
          `No controls projected from machine (phase=${session.phase})`,
        ),
  );

  results.push(
    session.players.length >= 2
      ? pass(`preset_${presetId}_min_players`)
      : fail(`preset_${presetId}_min_players`, `Only ${session.players.length} players`),
  );

  results.push(
    session.players.some((p) => p.id === "human")
      ? pass(`preset_${presetId}_has_human`)
      : fail(`preset_${presetId}_has_human`, "No human player"),
  );

  return results;
}

describe("Rule-based evals: Preset catalog", () => {
  it("catalog is valid", () => {
    const { failed, results } = runEvals(evalPresetCatalog());
    for (const r of results) {
      expect(r.status, r.rationale ?? r.criterion).toBe("PASS");
    }
    expect(failed).toBe(0);
  });

  it("isKnownPreset returns true for all catalog entries", () => {
    for (const id of listPresetIds()) {
      expect(isKnownPreset(id)).toBe(true);
    }
  });

  it("isKnownPreset returns false for unknown ids", () => {
    expect(isKnownPreset("totally-fake-game")).toBe(false);
  });
});

describe("Rule-based evals: Each preset creates a valid session", () => {
  for (const id of listPresetIds()) {
    it(`preset: ${id}`, () => {
      const { failed, results } = runEvals(evalPresetSession(id));
      for (const r of results) {
        expect(r.status, r.rationale ?? r.criterion).toBe("PASS");
      }
      expect(failed).toBe(0);
    });
  }
});

describe("Rule-based evals: Preset-specific invariants", () => {
  it("Texas Hold'em has chips enabled", () => {
    const session = createFromPreset("texas-holdem");
    expect(session.chips).not.toBeNull();
  });

  it("War has capture zone enabled", () => {
    const session = createFromPreset("war");
    expect(session.enabledZones.capture).toBe(true);
  });

  it("Go Fish has capture zone enabled for books", () => {
    const session = createFromPreset("go-fish");
    expect(session.enabledZones.capture).toBe(true);
  });

  it("Blackjack has chips enabled", () => {
    const session = createFromPreset("blackjack");
    expect(session.chips).not.toBeNull();
  });
});
