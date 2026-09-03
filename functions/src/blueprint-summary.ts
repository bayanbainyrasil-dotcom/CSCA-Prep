/**
 * How many blueprint cells exist, and nothing else.
 *
 * The seed itself must not reach the browser — it carries the authored slice's
 * answer keys, and `src/features/blueprint/content-leak-contract.test.ts`
 * enforces that. But a learner-facing coverage panel needs a denominator, and a
 * count is structure, not content.
 *
 * Same pattern as `seed-versions.ts`: a data-free module the client may import.
 * `src/features/progress/coverage-confidence.test.ts` asserts these numbers
 * still equal the real seed, so they cannot drift.
 */

export interface BlueprintCellCounts {
  total: number;
  mathematics: number;
  physics: number;
}

export const BLUEPRINT_CELL_COUNTS: BlueprintCellCounts = {
  total: 109,
  mathematics: 47,
  physics: 62,
};
