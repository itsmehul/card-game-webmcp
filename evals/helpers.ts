/**
 * Shared helpers for eval suites.
 *
 * Following the Chrome AI Evals guide, each evaluator returns a structured
 * result with status ("PASS" | "FAIL"), the criterion tested, and an
 * optional rationale explaining why it failed.
 */

export interface EvalResult {
  criterion: string;
  status: "PASS" | "FAIL";
  rationale?: string;
}

/** Convenience: build a PASS result. */
export function pass(criterion: string): EvalResult {
  return { criterion, status: "PASS" };
}

/** Convenience: build a FAIL result with rationale. */
export function fail(criterion: string, rationale: string): EvalResult {
  return { criterion, status: "FAIL", rationale };
}

/** Run a battery of eval functions and return all results. */
export function runEvals(
  results: EvalResult[],
): { passed: number; failed: number; results: EvalResult[] } {
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  return { passed, failed, results };
}
