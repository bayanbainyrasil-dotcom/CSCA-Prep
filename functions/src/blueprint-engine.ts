/**
 * Pure blueprint logic, shared by the trusted server and the web app.
 *
 * This module deliberately has no dependencies — no Zod, no Firestore — for the
 * same reason `mock-engine.ts` has none: it is compiled by both toolchains, and
 * the web unit tests exercise exactly the code the server runs. The Zod schemas
 * that validate this data live beside each toolchain's own version of Zod.
 */

export type BlueprintSubject = "mathematics" | "physics";

export type BlueprintQuestionType =
  | "concept-recognition"
  | "single-step-calculation"
  | "multi-step-calculation"
  | "formula-selection"
  | "unit-conversion"
  | "graph-reading"
  | "estimation"
  | "word-problem";

export type BlueprintExamMode = "diagnostic" | "practice" | "mock";

/**
 * `demo` and `draft` give generated placeholder material an honest home, and
 * `pending-review` is where authored content waits: it has passed the automatic
 * checks but no human has read it, so it is not coverage.
 */
export type VerificationStatus =
  | "demo"
  | "draft"
  | "pending-review"
  | "unverified"
  | "author-checked"
  | "reviewer-verified";

export type BlueprintSourceType =
  | "official-outline"
  | "original-csca-style"
  | "template-generated"
  | "diagnostic";

export type BlueprintLanguage = "en" | "ru" | "zh";

export interface BlueprintCell {
  id: string;
  subject: BlueprintSubject;
  module: string;
  topicId: string;
  topic: string;
  skillId: string;
  skill: string;
  microSkillId: string;
  microSkill: string;
  prerequisiteCellIds: string[];
  difficultyLevels: number[];
  questionTypes: BlueprintQuestionType[];
  minimumItems: number;
  supportedLanguages: BlueprintLanguage[];
  allowedExamModes: BlueprintExamMode[];
  verificationStatus: VerificationStatus;
  sourceType: BlueprintSourceType;
  sourceReference: string;
  reviewer: string | null;
  reviewedAt: string | null;
  knownLimitations: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface BlueprintQuestionRecord {
  questionId: string;
  cellId: string | null;
  subject: BlueprintSubject;
  topicId: string;
  difficulty: number;
  questionType: BlueprintQuestionType;
  language: BlueprintLanguage;
  status: "draft" | "published" | "archived";
  demo: boolean;
  verificationStatus: VerificationStatus;
  sourceType: BlueprintSourceType;
  sourceReference: string;
  reviewer: string | null;
  reviewedAt: string | null;
  correctAnswerLabel: string;
  knownLimitations: string;
  /** Bumped by every content write. */
  contentVersion: number;
  /** The content version a reviewer actually read. */
  verifiedContentVersion: number | null;
  /**
   * True when the item's answer key has been published somewhere public — for
   * example the seed committed to this repository. Such an item is legitimate
   * practice material and can never back a confidential mock, because the answers
   * are already readable by anyone.
   */
  publicAnswerKey: boolean;
}

/** A mode whose questions must not have a published answer key. */
export function isConfidentialMode(mode: BlueprintExamMode | undefined): boolean {
  return mode === "mock";
}

export function countsAsVerifiedCoverage(
  cell: BlueprintCell,
  item: BlueprintQuestionRecord,
  options: { mode?: BlueprintExamMode } = {},
): boolean {
  // An item whose answer key is public cannot secure a confidential exam, however
  // carefully it was reviewed.
  if (isConfidentialMode(options.mode) && item.publicAnswerKey) return false;
  return (
    item.cellId === cell.id &&
    item.status === 'published' &&
    !item.demo &&
    item.verificationStatus === 'reviewer-verified' &&
    item.reviewer !== null &&
    item.reviewedAt !== null &&
    // A review certifies the words a reviewer read. Editing the question after
    // that leaves the record verified-looking but stale, so it stops counting
    // until it has been reviewed again at its current version.
    item.verifiedContentVersion !== null &&
    item.verifiedContentVersion === item.contentVersion &&
    item.subject === cell.subject &&
    item.topicId === cell.topicId &&
    cell.questionTypes.includes(item.questionType) &&
    cell.difficultyLevels.includes(item.difficulty)
  );
}

export interface QuestionMappingDraft {
  subject: BlueprintSubject;
  topicId: string;
  questionType: BlueprintQuestionType;
  difficulty: number;
  language: BlueprintLanguage;
  /** The exam modes this item is intended for, when the author declares them. */
  intendedModes?: BlueprintExamMode[];
}

export interface MappingProblem {
  code: string;
  message: string;
}

/**
 * Checks that a question actually answers the requirement it claims.
 *
 * The server runs this on every import, so a mis-mapped item is refused rather
 * than published and later reported as a coverage gap nobody can explain. The
 * admin editor runs the same function to show the same messages before saving.
 */
export function validateQuestionAgainstCell(
  cell: BlueprintCell | undefined,
  draft: QuestionMappingDraft,
  cellId: string,
): MappingProblem[] {
  if (!cell) {
    return [{ code: "unknown-cell", message: `Blueprint cell ${cellId} does not exist.` }];
  }

  const problems: MappingProblem[] = [];
  if (draft.subject !== cell.subject) {
    problems.push({
      code: "subject-mismatch",
      message: `This cell covers ${cell.subject}, but the question is ${draft.subject}.`,
    });
  }
  if (draft.topicId !== cell.topicId) {
    problems.push({
      code: "topic-mismatch",
      message: `This cell covers topic ${cell.topicId}, but the question is filed under ${draft.topicId}.`,
    });
  }
  if (!cell.questionTypes.includes(draft.questionType)) {
    problems.push({
      code: "question-type-not-allowed",
      message: `This cell asks for ${cell.questionTypes.join(" or ")}, not ${draft.questionType}.`,
    });
  }
  if (!cell.difficultyLevels.includes(draft.difficulty)) {
    problems.push({
      code: "difficulty-not-allowed",
      message: `This cell asks for difficulty ${cell.difficultyLevels.join(" or ")}, not ${draft.difficulty}.`,
    });
  }
  if (!cell.supportedLanguages.includes(draft.language)) {
    problems.push({
      code: "language-not-supported",
      message: `This cell supports ${cell.supportedLanguages.join(", ")}, not ${draft.language}.`,
    });
  }
  for (const mode of draft.intendedModes ?? []) {
    if (!cell.allowedExamModes.includes(mode)) {
      problems.push({
        code: "mode-not-allowed",
        message: `This cell is not allowed in ${mode} mode.`,
      });
    }
  }
  return problems;
}

export type CellCoverageStatus = 'covered' | 'partial' | 'unverified' | 'empty';

export interface CellCoverage {
  cell: BlueprintCell;
  /** Items claiming this cell, whatever their state. */
  totalItems: number;
  /** Items that actually count. Never entered by hand. */
  verifiedItems: number;
  demoItems: number;
  /** Items whose answer key is already public. */
  publicKeyItems: number;
  /** True when a reviewed item was excluded because this mode is confidential. */
  excludedForMode: boolean;
  languages: BlueprintLanguage[];
  missingLanguages: BlueprintLanguage[];
  missingDifficulties: number[];
  missingQuestionTypes: BlueprintQuestionType[];
  status: CellCoverageStatus;
  /** Why this cell is not `covered`, in words a reviewer can act on. */
  reasons: string[];
}

export type IssueSeverity = 'blocker' | 'warning';

export interface BlueprintIssue {
  code: string;
  severity: IssueSeverity;
  message: string;
  cellId?: string;
  questionId?: string;
}

export interface BlueprintCoverage {
  cells: CellCoverage[];
  totals: Record<CellCoverageStatus, number>;
  verifiedCells: number;
  gaps: CellCoverage[];
  issues: BlueprintIssue[];
  danglingPrerequisites: { cellId: string; missing: string[] }[];
  prerequisiteCycles: string[][];
  /** Published bank items that no blueprint cell claims. */
  orphanQuestionIds: string[];
}

function statusFor(cell: BlueprintCell, coverage: Omit<CellCoverage, 'status' | 'reasons' | 'cell'>): {
  status: CellCoverageStatus;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (coverage.totalItems === 0) {
    return { status: 'empty', reasons: ['No question has been authored for this cell.'] };
  }
  if (coverage.verifiedItems === 0) {
    if (coverage.excludedForMode) {
      reasons.push(
        `${coverage.publicKeyItems} reviewed item${coverage.publicKeyItems === 1 ? '' : 's'} here ${coverage.publicKeyItems === 1 ? 'has' : 'have'} a published answer key, so ${coverage.publicKeyItems === 1 ? 'it is' : 'they are'} practice material and cannot secure a confidential exam.`,
      );
      return { status: 'unverified', reasons };
    }
    reasons.push(
      `${coverage.totalItems} authored${coverage.demoItems > 0 ? ` (${coverage.demoItems} demo)` : ''}, none reviewer-verified.`,
    );
    return { status: 'unverified', reasons };
  }
  if (coverage.verifiedItems < cell.minimumItems) {
    reasons.push(`${coverage.verifiedItems} of ${cell.minimumItems} verified items.`);
  }
  if (coverage.missingLanguages.length > 0) {
    reasons.push(`Missing ${coverage.missingLanguages.join(', ')}.`);
  }
  if (coverage.missingDifficulties.length > 0) {
    reasons.push(`No verified item at difficulty ${coverage.missingDifficulties.join(', ')}.`);
  }
  if (coverage.missingQuestionTypes.length > 0) {
    reasons.push(`No verified ${coverage.missingQuestionTypes.join(', ')} item.`);
  }
  return { status: reasons.length > 0 ? 'partial' : 'covered', reasons };
}

/** Finds prerequisite ids that name no cell, and any cycle among prerequisites. */
export function analysePrerequisites(cells: BlueprintCell[]): {
  dangling: { cellId: string; missing: string[] }[];
  cycles: string[][];
} {
  const byId = new Map(cells.map((cell) => [cell.id, cell]));
  const dangling: { cellId: string; missing: string[] }[] = [];
  for (const cell of cells) {
    const missing = cell.prerequisiteCellIds.filter((id) => !byId.has(id));
    if (missing.length > 0) dangling.push({ cellId: cell.id, missing });
  }

  const cycles: string[][] = [];
  const state = new Map<string, 'visiting' | 'done'>();
  const stack: string[] = [];

  const visit = (id: string): void => {
    const current = state.get(id);
    if (current === 'done') return;
    if (current === 'visiting') {
      const start = stack.indexOf(id);
      if (start !== -1) cycles.push([...stack.slice(start), id]);
      return;
    }
    state.set(id, 'visiting');
    stack.push(id);
    for (const next of byId.get(id)?.prerequisiteCellIds ?? []) {
      if (byId.has(next)) visit(next);
    }
    stack.pop();
    state.set(id, 'done');
  };

  for (const cell of cells) visit(cell.id);
  return { dangling, cycles };
}

/** Skew in which option letter is correct, which a learner can otherwise exploit. */
export function answerDistributionSkew(items: BlueprintQuestionRecord[]): {
  counts: Record<string, number>;
  skewed: boolean;
  dominantLabel: string | null;
} {
  const counts: Record<string, number> = {};
  for (const item of items) counts[item.correctAnswerLabel] = (counts[item.correctAnswerLabel] ?? 0) + 1;
  const total = items.length;
  const entries = Object.entries(counts).sort(([, left], [, right]) => right - left);
  const dominant = entries[0];
  // Below 10 items the distribution is not informative, so it is not reported.
  const skewed = total >= 10 && dominant !== undefined && dominant[1] / total > 0.5;
  return { counts, skewed, dominantLabel: skewed ? (dominant?.[0] ?? null) : null };
}

export function difficultyDistributionSkew(items: BlueprintQuestionRecord[]): {
  counts: Record<string, number>;
  skewed: boolean;
} {
  const counts: Record<string, number> = {};
  for (const item of items) counts[String(item.difficulty)] = (counts[String(item.difficulty)] ?? 0) + 1;
  const total = items.length;
  const largest = Math.max(0, ...Object.values(counts));
  return { counts, skewed: total >= 10 && largest / total > 0.6 };
}

export interface EvaluateBlueprintOptions {
  /** Modes that must reach full coverage before the blueprint is publishable. */
  requiredModes?: BlueprintExamMode[];
  /**
   * The mode this report is for. In a confidential mode, items with a published
   * answer key are excluded from verified coverage and reported as such.
   */
  mode?: BlueprintExamMode;
}

export function evaluateBlueprintCoverage(
  cells: BlueprintCell[],
  items: BlueprintQuestionRecord[],
  options: EvaluateBlueprintOptions = {},
): BlueprintCoverage {
  const issues: BlueprintIssue[] = [];
  const byId = new Map<string, BlueprintCell>();
  for (const cell of cells) {
    if (byId.has(cell.id)) {
      issues.push({ code: 'duplicate-cell-id', severity: 'blocker', cellId: cell.id, message: `Duplicate blueprint cell id ${cell.id}.` });
    }
    byId.set(cell.id, cell);
  }

  const seenQuestionIds = new Set<string>();
  for (const item of items) {
    if (seenQuestionIds.has(item.questionId)) {
      issues.push({ code: 'duplicate-question-id', severity: 'blocker', questionId: item.questionId, message: `Duplicate question id ${item.questionId}.` });
    }
    seenQuestionIds.add(item.questionId);
  }

  const itemsByCell = new Map<string, BlueprintQuestionRecord[]>();
  const orphanQuestionIds: string[] = [];
  for (const item of items) {
    if (item.cellId === null || !byId.has(item.cellId)) {
      if (item.status === 'published' && !item.demo) {
        orphanQuestionIds.push(item.questionId);
        issues.push({
          code: 'question-without-cell',
          severity: 'blocker',
          questionId: item.questionId,
          message: `${item.questionId} is published but belongs to no blueprint cell.`,
        });
      }
      continue;
    }
    const list = itemsByCell.get(item.cellId) ?? [];
    list.push(item);
    itemsByCell.set(item.cellId, list);
  }

  const totals: Record<CellCoverageStatus, number> = { covered: 0, partial: 0, unverified: 0, empty: 0 };

  const coverage = cells.map((cell) => {
    const cellItems = itemsByCell.get(cell.id) ?? [];
    const verified = cellItems.filter((item) => countsAsVerifiedCoverage(cell, item, { mode: options.mode }));
    const demoItems = cellItems.filter((item) => item.demo).length;
    const publicKeyItems = cellItems.filter((item) => item.publicAnswerKey).length;
    const excludedForMode =
      isConfidentialMode(options.mode) &&
      cellItems.some(
        (item) => item.publicAnswerKey && countsAsVerifiedCoverage(cell, item, {}),
      );

    for (const item of cellItems) {
      if (item.subject !== cell.subject) {
        issues.push({ code: 'question-subject-mismatch', severity: 'blocker', cellId: cell.id, questionId: item.questionId, message: `${item.questionId} is ${item.subject} but its cell is ${cell.subject}.` });
      }
      if (item.topicId !== cell.topicId) {
        issues.push({ code: 'question-topic-mismatch', severity: 'blocker', cellId: cell.id, questionId: item.questionId, message: `${item.questionId} is filed under topic ${item.topicId} but its cell covers ${cell.topicId}.` });
      }
      if (item.verificationStatus === 'reviewer-verified' && item.sourceType === 'template-generated' && item.sourceReference.trim() === '') {
        issues.push({ code: 'unchecked-source', severity: 'warning', cellId: cell.id, questionId: item.questionId, message: `${item.questionId} is generated and verified but records no source reference.` });
      }
    }

    const languages = [...new Set(verified.map((item) => item.language))].sort() as BlueprintLanguage[];
    const missingLanguages = cell.supportedLanguages.filter((language) => !languages.includes(language));
    const verifiedDifficulties = new Set(verified.map((item) => item.difficulty));
    const missingDifficulties = cell.difficultyLevels.filter((level) => !verifiedDifficulties.has(level));
    const verifiedTypes = new Set(verified.map((item) => item.questionType));
    const missingQuestionTypes = cell.questionTypes.filter((type) => !verifiedTypes.has(type));

    const partial = {
      totalItems: cellItems.length,
      verifiedItems: verified.length,
      demoItems,
      publicKeyItems,
      excludedForMode,
      languages,
      missingLanguages,
      missingDifficulties,
      missingQuestionTypes,
    };
    const { status, reasons } = statusFor(cell, partial);
    totals[status] += 1;
    return { cell, ...partial, status, reasons } satisfies CellCoverage;
  });

  const { dangling, cycles } = analysePrerequisites(cells);
  for (const entry of dangling) {
    issues.push({ code: 'orphan-prerequisite', severity: 'blocker', cellId: entry.cellId, message: `${entry.cellId} requires ${entry.missing.join(', ')}, which does not exist.` });
  }
  for (const cycle of cycles) {
    issues.push({ code: 'prerequisite-cycle', severity: 'blocker', cellId: cycle[0] ?? '', message: `Prerequisite cycle: ${cycle.join(' -> ')}.` });
  }

  for (const mode of options.requiredModes ?? []) {
    const modeCells = coverage.filter((entry) => entry.cell.allowedExamModes.includes(mode));
    if (modeCells.length === 0) {
      issues.push({ code: 'mode-has-no-cells', severity: 'blocker', message: `No blueprint cell is allowed in ${mode} mode.` });
      continue;
    }
    const uncovered = modeCells.filter((entry) => entry.status !== 'covered');
    if (uncovered.length > 0) {
      issues.push({
        code: 'insufficient-mode-coverage',
        severity: 'blocker',
        message: `${uncovered.length} of ${modeCells.length} ${mode} cells are not covered.`,
      });
    }
  }

  const verifiedItems = items.filter((item) => {
    const cell = item.cellId ? byId.get(item.cellId) : undefined;
    return cell ? countsAsVerifiedCoverage(cell, item, { mode: options.mode }) : false;
  });
  const answerSkew = answerDistributionSkew(verifiedItems);
  if (answerSkew.skewed) {
    issues.push({ code: 'answer-distribution-skew', severity: 'warning', message: `Over half of verified items have "${answerSkew.dominantLabel}" as the correct option.` });
  }
  const difficultySkew = difficultyDistributionSkew(verifiedItems);
  if (difficultySkew.skewed) {
    issues.push({ code: 'difficulty-distribution-skew', severity: 'warning', message: 'Over 60% of verified items sit at one difficulty level.' });
  }

  return {
    cells: coverage,
    totals,
    verifiedCells: totals.covered,
    gaps: coverage.filter((entry) => entry.status !== 'covered'),
    issues,
    danglingPrerequisites: dangling,
    prerequisiteCycles: cycles,
    orphanQuestionIds,
  };
}

export interface ExamPublicationRequest {
  subject: BlueprintSubject;
  mode: BlueprintExamMode;
  cellIds: string[];
}

export interface PublicationDecision {
  allowed: boolean;
  /** Every reason publication is refused. Empty when allowed. */
  blockers: string[];
}

/**
 * The publication gate.
 *
 * A mock may not be published while any cell it draws from is empty, unverified,
 * short of its minimum, or not allowed in that exam mode. This is what stops a
 * score being presented as readiness while the blueprint has holes.
 */
export function canPublishExam(
  coverage: BlueprintCoverage,
  request: ExamPublicationRequest,
): PublicationDecision {
  const byId = new Map(coverage.cells.map((entry) => [entry.cell.id, entry]));
  const blockers: string[] = [];

  if (request.cellIds.length === 0) {
    blockers.push('The exam does not reference any blueprint cell.');
  }
  if (new Set(request.cellIds).size !== request.cellIds.length) {
    blockers.push('The exam references the same blueprint cell more than once.');
  }

  for (const cellId of request.cellIds) {
    const entry = byId.get(cellId);
    if (!entry) {
      blockers.push(`${cellId}: not a blueprint cell.`);
      continue;
    }
    if (entry.cell.subject !== request.subject) {
      blockers.push(`${cellId}: belongs to ${entry.cell.subject}, not ${request.subject}.`);
    }
    if (!entry.cell.allowedExamModes.includes(request.mode)) {
      blockers.push(`${cellId}: not allowed in ${request.mode} mode.`);
    }
    if (entry.status !== 'covered') {
      blockers.push(`${cellId}: ${entry.reasons.join(' ')}`);
    }
  }

  const relevant = new Set(request.cellIds);
  for (const cycle of coverage.prerequisiteCycles) {
    if (cycle.some((id) => relevant.has(id))) blockers.push(`Prerequisite cycle: ${cycle.join(' -> ')}.`);
  }
  for (const entry of coverage.danglingPrerequisites) {
    if (relevant.has(entry.cellId)) blockers.push(`${entry.cellId}: prerequisite ${entry.missing.join(', ')} does not exist.`);
  }
  for (const issue of coverage.issues) {
    if (issue.severity !== 'blocker') continue;
    if (issue.cellId && !relevant.has(issue.cellId)) continue;
    if (!issue.cellId && issue.code !== 'question-without-cell') blockers.push(issue.message);
  }

  return { allowed: blockers.length === 0, blockers: [...new Set(blockers)] };
}

export interface DistributionReport {
  byTopic: Record<string, number>;
  byDifficulty: Record<string, number>;
  byQuestionType: Record<string, number>;
  byModule: Record<string, number>;
}

/** Distribution of a selected set of cells, for the composition tests. */
export function describeDistribution(cells: BlueprintCell[]): DistributionReport {
  const count = (values: string[]): Record<string, number> => {
    const result: Record<string, number> = {};
    for (const value of values) result[value] = (result[value] ?? 0) + 1;
    return result;
  };
  return {
    byTopic: count(cells.map((cell) => cell.topicId)),
    byDifficulty: count(cells.flatMap((cell) => cell.difficultyLevels.map(String))),
    byQuestionType: count(cells.flatMap((cell) => cell.questionTypes)),
    byModule: count(cells.map((cell) => cell.module)),
  };
}

/** Cells a learner must repair first, given the cells they are failing. */
export function prerequisiteRepairPath(cells: BlueprintCell[], failingCellIds: string[]): string[] {
  const byId = new Map(cells.map((cell) => [cell.id, cell]));
  const seen = new Set<string>();
  const path: string[] = [];

  const walk = (id: string, guard: Set<string>): void => {
    if (guard.has(id)) return;
    guard.add(id);
    for (const prerequisite of byId.get(id)?.prerequisiteCellIds ?? []) {
      if (!byId.has(prerequisite)) continue;
      walk(prerequisite, guard);
      if (!seen.has(prerequisite)) {
        seen.add(prerequisite);
        path.push(prerequisite);
      }
    }
  };

  for (const id of failingCellIds) walk(id, new Set());
  return path;
}


/** Small deterministic PRNG so the same seed always yields the same exam. */
function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash || 0x9e3779b9;
}

export function createBlueprintRandom(seed: string): () => number {
  let state = hashSeed(seed);
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x1_0000_0000;
  };
}

export interface ExamCompositionSpec {
  subject: BlueprintSubject;
  mode: BlueprintExamMode;
  questionCount: number;
  language: BlueprintLanguage;
  /** Optional target share per difficulty level, e.g. `{ 1: 0.2, 3: 0.5 }`. */
  difficultyMix?: Partial<Record<number, number>>;
  /** Cells to draw from. Defaults to every cell allowed in this mode and subject. */
  cellIds?: string[];
  seed: string;
}

export interface ComposedQuestion {
  questionId: string;
  cellId: string;
  topicId: string;
  difficulty: number;
  questionType: BlueprintQuestionType;
  language: BlueprintLanguage;
}

export type ExamCompositionResult =
  | { ok: true; questions: ComposedQuestion[]; usedCellIds: string[] }
  | {
      ok: false;
      error: 'insufficient-verified-coverage';
      /** How many verified items are available against how many are needed. */
      available: number;
      required: number;
      shortfallByCell: { cellId: string; available: number }[];
      message: string;
    };

function eligibleItemsByCell(
  cells: BlueprintCell[],
  items: BlueprintQuestionRecord[],
  spec: ExamCompositionSpec,
): Map<string, BlueprintQuestionRecord[]> {
  const wanted = new Set(spec.cellIds ?? cells.map((cell) => cell.id));
  const result = new Map<string, BlueprintQuestionRecord[]>();

  for (const cell of cells) {
    if (!wanted.has(cell.id)) continue;
    if (cell.subject !== spec.subject) continue;
    if (!cell.allowedExamModes.includes(spec.mode)) continue;

    const eligible = items.filter(
      (item) =>
        item.language === spec.language && countsAsVerifiedCoverage(cell, item, { mode: spec.mode }),
    );
    result.set(cell.id, eligible);
  }
  return result;
}

/** Round-robin across cells so no single cell can dominate a short exam. */
function orderedDraw(
  byCell: Map<string, BlueprintQuestionRecord[]>,
  random: () => number,
  count: number,
): { questions: BlueprintQuestionRecord[]; usedCellIds: string[] } {
  const pools = new Map<string, BlueprintQuestionRecord[]>();
  for (const [cellId, items] of byCell) {
    // Shuffle deterministically so the same seed always yields the same exam.
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      const left = shuffled[index]!;
      shuffled[index] = shuffled[swap]!;
      shuffled[swap] = left;
    }
    pools.set(cellId, shuffled);
  }

  const cellOrder = [...pools.keys()].sort();
  const questions: BlueprintQuestionRecord[] = [];
  const usedCellIds = new Set<string>();
  const taken = new Set<string>();

  let progressed = true;
  while (questions.length < count && progressed) {
    progressed = false;
    for (const cellId of cellOrder) {
      if (questions.length >= count) break;
      const pool = pools.get(cellId);
      const next = pool?.find((item) => !taken.has(item.questionId));
      if (!next) continue;
      taken.add(next.questionId);
      questions.push(next);
      usedCellIds.add(cellId);
      progressed = true;
    }
  }

  return { questions, usedCellIds: [...usedCellIds].sort() };
}

export function composeExam(
  cells: BlueprintCell[],
  items: BlueprintQuestionRecord[],
  spec: ExamCompositionSpec,
): ExamCompositionResult {
  const byCell = eligibleItemsByCell(cells, items, spec);
  const available = [...byCell.values()].reduce((total, list) => total + list.length, 0);

  if (available < spec.questionCount) {
    const shortfallByCell = [...byCell.entries()]
      .map(([cellId, list]) => ({ cellId, available: list.length }))
      .filter((entry) => entry.available === 0)
      .sort((left, right) => left.cellId.localeCompare(right.cellId));

    return {
      ok: false,
      error: 'insufficient-verified-coverage',
      available,
      required: spec.questionCount,
      shortfallByCell,
      message:
        `Only ${available} verified ${spec.language} ${spec.subject} ${spec.mode} questions exist; ` +
        `${spec.questionCount} are required. ${shortfallByCell.length} blueprint ${shortfallByCell.length === 1 ? 'cell has' : 'cells have'} none.`,
    };
  }

  const random = createBlueprintRandom(spec.seed);
  const drawn = orderedDraw(byCell, random, spec.questionCount);

  return {
    ok: true,
    questions: drawn.questions.map((item) => ({
      questionId: item.questionId,
      cellId: item.cellId!,
      topicId: item.topicId,
      difficulty: item.difficulty,
      questionType: item.questionType,
      language: item.language,
    })),
    usedCellIds: drawn.usedCellIds,
  };
}
