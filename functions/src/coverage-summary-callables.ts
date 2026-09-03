/**
 * The one coverage read a signed-in learner is allowed to make.
 *
 * `getBlueprintCoverage` is an administrator's tool: it returns reviewer names,
 * review dates, source references, known limitations, per-cell issue lists and
 * the ids of orphaned questions. None of that belongs on a learner's progress
 * page, so this is a separate callable rather than a relaxed permission check on
 * that one.
 *
 * What it returns is structure and counts: the blueprint cell id, its subject,
 * the coverage status the engine computed, and how many items of each kind sit
 * in the cell. No question, no answer, no reviewer identity, no free text. The
 * private `questionSolutions` documents are not read at all on this path.
 *
 * The numbers are recomputed from the published bank on every call, the same
 * way the administrator report and the publication gate do. There is no second
 * coverage formula here — this file calls `evaluateBlueprintCoverage` and maps
 * its output to a narrower shape.
 */
import { onCall } from "firebase-functions/v2/https";

import { evaluateBlueprintCoverage } from "./blueprint-engine";
import { loadBlueprintState } from "./blueprint-callables";
import { enforceRateLimit, monitored, parseInput, requireAuth } from "./callable";
import { CoverageSummarySchema } from "./schemas";

const learnerCallableOptions = {
  enforceAppCheck: true,
  cors: true,
} as const;

export interface CoverageSummaryCell {
  id: string;
  subject: "mathematics" | "physics";
  status: "covered" | "partial" | "unverified" | "empty";
  totalItems: number;
  demoItems: number;
  publicKeyItems: number;
}

export interface CoverageSummaryResponse {
  generatedAt: string;
  outOf: { total: number; mathematics: number; physics: number };
  cells: CoverageSummaryCell[];
}

export const getCoverageSummary = onCall(
  learnerCallableOptions,
  monitored("getCoverageSummary", async (request): Promise<CoverageSummaryResponse> => {
    const principal = requireAuth(request);
    parseInput(CoverageSummarySchema, request.data);
    // A progress page reads this on open and on an explicit retry. Sixty an hour
    // leaves room for both and for a second device, and stops a client loop from
    // turning one learner into a full read of the question bank every second.
    await enforceRateLimit("getCoverageSummary", principal.uid, 60, 60 * 60);

    const { cells, items } = await loadBlueprintState({ answerLabels: false });
    const coverage = evaluateBlueprintCoverage(cells, items);

    return {
      generatedAt: new Date().toISOString(),
      outOf: {
        total: cells.length,
        mathematics: cells.filter((cell) => cell.subject === "mathematics").length,
        physics: cells.filter((cell) => cell.subject === "physics").length,
      },
      cells: coverage.cells.map((entry) => ({
        id: entry.cell.id,
        subject: entry.cell.subject,
        status: entry.status,
        totalItems: entry.totalItems,
        demoItems: entry.demoItems,
        publicKeyItems: entry.publicKeyItems,
      })),
    };
  }),
);
