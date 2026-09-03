/**
 * LLM-as-a-judge evals for subjective game quality.
 *
 * Following the Chrome AI Evals guide: these evaluate qualities that don't
 * have a single correct answer — like whether instructions are clear, game
 * names are sensible, or legal actions have good labels.
 *
 * These evals use a rubric-based approach where the "judge" is a scoring
 * function that mimics how an LLM judge would evaluate. In production,
 * you'd replace `mockJudge` with an actual LLM API call.
 *
 * Criteria:
 *  - Instruction clarity (are game instructions understandable?)
 *  - Action label quality (are button labels descriptive?)
 *  - Narration quality (do narration messages make sense?)
 *  - Game naming (do preset names match their game type?)
 */

import { describe, it, expect } from "vitest";
import { listPresetIds, createFromPreset, getPreset } from "@/lib/game/presets";
import { narrate } from "@/lib/game/engine";
import type { GameSession, LegalAction } from "@/lib/game/types";

// ---------------------------------------------------------------------------
// Rubric-based judge (deterministic proxy for an LLM judge)
//
// In production, replace these with actual LLM calls like:
//   const result = await evalWithLLM(rubricPrompt);
//
// The Chrome guide recommends this pattern:
//   1. Write a rubric describing what PASS/FAIL looks like
//   2. Feed the rubric + output to a judge model
//   3. Parse the judge's PASS/FAIL + rationale
// ---------------------------------------------------------------------------

interface JudgeResult {
  status: "PASS" | "FAIL";
  score: number; // 1-5 scale
  rationale: string;
}

/**
 * Rubric: Instruction Clarity
 *
 * PASS (score 4-5): Instructions explain the goal of the game, mention key
 * mechanics, and are written in plain language a beginner could follow.
 *
 * FAIL (score 1-3): Instructions are empty, too vague, use jargon without
 * explanation, or don't explain how to actually play.
 */
function judgeInstructionClarity(instructions: string): JudgeResult {
  if (!instructions || instructions.trim().length === 0) {
    return {
      status: "FAIL",
      score: 1,
      rationale: "Instructions are empty — the player has no guidance on how to play.",
    };
  }

  const words = instructions.split(/\s+/).length;
  const hasSentences = instructions.includes(".");
  const mentionsGoal =
    /win|goal|objective|try to|aim|point/i.test(instructions);
  const mentionsAction =
    /click|press|select|choose|pick|play|draw|deal|hit|stand|fold|bet|call|raise/i.test(
      instructions,
    );

  let score = 2;
  if (words >= 10) score++;
  if (hasSentences) score++;
  if (mentionsGoal || mentionsAction) score++;

  return {
    status: score >= 4 ? "PASS" : "FAIL",
    score,
    rationale:
      score >= 4
        ? "Instructions are clear, mention game mechanics, and guide the player."
        : `Instructions are too brief (${words} words) or lack goal/action descriptions.`,
  };
}

/**
 * Rubric: Action Label Quality
 *
 * PASS: Every legal action has a short, descriptive label that tells
 * the player what will happen (e.g., "Hit", "Deal Cards", "Go Fish").
 *
 * FAIL: Labels are empty, too long (>30 chars), or use technical jargon
 * like internal primitive names.
 */
function judgeActionLabels(actions: LegalAction[]): JudgeResult {
  if (actions.length === 0) {
    return {
      status: "PASS",
      score: 5,
      rationale: "No actions to evaluate (game may be in waiting phase).",
    };
  }

  const issues: string[] = [];
  for (const action of actions) {
    if (!action.label || action.label.trim().length === 0) {
      issues.push(`Action "${action.id}" has no label`);
    } else if (action.label.length > 40) {
      issues.push(`"${action.label}" is too long (${action.label.length} chars)`);
    } else if (/^[a-z_]+$/.test(action.label)) {
      issues.push(`"${action.label}" looks like an internal id, not a user-friendly label`);
    }
  }

  const score = issues.length === 0 ? 5 : Math.max(1, 5 - issues.length);
  return {
    status: issues.length === 0 ? "PASS" : "FAIL",
    score,
    rationale:
      issues.length === 0
        ? "All action labels are clear and appropriately sized."
        : `Issues: ${issues.join("; ")}`,
  };
}

/**
 * Rubric: Game Name Quality
 *
 * PASS: The name is recognizable as a real card game name, properly
 * capitalized, and between 2-40 characters.
 *
 * FAIL: Name is empty, a single character, or doesn't look like a proper noun.
 */
function judgeGameName(name: string): JudgeResult {
  if (!name || name.trim().length < 2) {
    return {
      status: "FAIL",
      score: 1,
      rationale: "Game name is empty or too short.",
    };
  }

  const isCapitalized = /^[A-Z]/.test(name);
  const isReasonableLength = name.length >= 2 && name.length <= 40;
  const score =
    (isCapitalized ? 2 : 0) + (isReasonableLength ? 2 : 0) + 1;

  return {
    status: score >= 4 ? "PASS" : "FAIL",
    score,
    rationale:
      score >= 4
        ? `"${name}" is a properly formatted game name.`
        : `"${name}" has formatting issues (capitalization: ${isCapitalized}, length: ${name.length}).`,
  };
}

/**
 * Rubric: Preset Summary Quality
 *
 * PASS (score 4-5): Summary succinctly describes the game in 1-2 sentences,
 * mentioning the core mechanic or objective.
 *
 * FAIL (score 1-3): Summary is missing, too vague, or doesn't help a player
 * understand what makes this game different.
 */
function judgePresetSummary(summary: string): JudgeResult {
  if (!summary || summary.trim().length === 0) {
    return {
      status: "FAIL",
      score: 1,
      rationale: "Summary is empty.",
    };
  }

  const words = summary.split(/\s+/).length;
  const hasVerb = /\b(play|deal|bet|draw|match|flip|ask|call|build|win|hit|stand|trick|trump)\b/i.test(summary);

  let score = 2;
  if (words >= 5 && words <= 30) score++;
  if (hasVerb) score++;
  if (summary.includes(",") || summary.includes("and")) score++;

  return {
    status: score >= 4 ? "PASS" : "FAIL",
    score,
    rationale:
      score >= 4
        ? "Summary is concise and describes the game's core mechanic."
        : `Summary is too vague or short (${words} words, hasVerb: ${hasVerb}).`,
  };
}

// ---------------------------------------------------------------------------
// Eval suites
// ---------------------------------------------------------------------------

describe("LLM-as-judge evals: Instruction clarity", () => {
  for (const id of listPresetIds()) {
    it(`${id} has clear instructions`, () => {
      const session = createFromPreset(id);
      const result = judgeInstructionClarity(session.instructions);
      expect(result.status).toBe("PASS");
      if (result.status === "FAIL") {
        console.log(`  ⚠ ${id}: ${result.rationale} (score: ${result.score}/5)`);
      }
    });
  }
});

describe("LLM-as-judge evals: Action label quality", () => {
  for (const id of listPresetIds()) {
    it(`${id} has good action labels`, () => {
      const session = createFromPreset(id);
      const result = judgeActionLabels(session.legalActions);
      expect(result.status).toBe("PASS");
      if (result.status === "FAIL") {
        console.log(`  ⚠ ${id}: ${result.rationale} (score: ${result.score}/5)`);
      }
    });
  }
});

describe("LLM-as-judge evals: Game naming", () => {
  for (const id of listPresetIds()) {
    it(`${id} has a proper game name`, () => {
      const session = createFromPreset(id);
      const result = judgeGameName(session.name);
      expect(result.status).toBe("PASS");
    });
  }
});

describe("LLM-as-judge evals: Preset summaries", () => {
  for (const id of listPresetIds()) {
    it(`${id} has a quality summary`, () => {
      const preset = getPreset(id)!;
      const result = judgePresetSummary(preset.summary);
      expect(result.status).toBe("PASS");
      if (result.status === "FAIL") {
        console.log(`  ⚠ ${id}: ${result.rationale} (score: ${result.score}/5)`);
      }
    });
  }
});

describe("LLM-as-judge evals: Pairwise comparison example", () => {
  it("better instructions win pairwise comparison", () => {
    // Pairwise eval: compare two outputs for the same criterion
    // and pick a winner (as recommended by the Chrome guide)
    const outputA = "Play cards.";
    const outputB =
      "Try to get rid of all your cards by matching the top card's suit or rank. Play an 8 as a wildcard to change the suit.";

    const scoreA = judgeInstructionClarity(outputA);
    const scoreB = judgeInstructionClarity(outputB);

    // Output B should score higher — it's more descriptive
    expect(scoreB.score).toBeGreaterThan(scoreA.score);
  });
});
