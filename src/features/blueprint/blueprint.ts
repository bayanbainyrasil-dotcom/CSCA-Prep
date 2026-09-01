import { z } from 'zod';

/**
 * The curriculum blueprint.
 *
 * A large number of generated variations is not coverage. The diagnostic and the
 * mock were built from four templates, which made 48 questions look like an exam
 * while measuring one skill. The blueprint states, cell by cell, what the exam
 * requires; coverage is then computed from the real published question bank, so
 * a gap is visible instead of hidden behind a question count.
 *
 * Nothing here asserts that any material is official CSCA content. Every cell and
 * every item records where it came from and whether a named human checked it on a
 * named date. Generated and demo material can never count as verified coverage.
 */

export const BlueprintSubjectSchema = z.enum(['mathematics', 'physics']);
export type BlueprintSubject = z.infer<typeof BlueprintSubjectSchema>;

export const BlueprintQuestionTypeSchema = z.enum([
  'concept-recognition',
  'single-step-calculation',
  'multi-step-calculation',
  'formula-selection',
  'unit-conversion',
  'graph-reading',
  'estimation',
  'word-problem',
]);
export type BlueprintQuestionType = z.infer<typeof BlueprintQuestionTypeSchema>;

export const BlueprintExamModeSchema = z.enum(['diagnostic', 'practice', 'mock']);
export type BlueprintExamMode = z.infer<typeof BlueprintExamModeSchema>;

/**
 * `demo` and `draft` exist so generated placeholder material has an honest home.
 * Only `reviewer-verified` counts toward coverage.
 */
export const VerificationStatusSchema = z.enum([
  'demo',
  'draft',
  'unverified',
  'author-checked',
  'reviewer-verified',
]);
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;

export const BlueprintSourceTypeSchema = z.enum([
  'official-outline',
  'original-csca-style',
  'template-generated',
  'diagnostic',
]);
export type BlueprintSourceType = z.infer<typeof BlueprintSourceTypeSchema>;

export const BlueprintLanguageSchema = z.enum(['en', 'ru', 'zh']);
export type BlueprintLanguage = z.infer<typeof BlueprintLanguageSchema>;

const IdField = z.string().trim().min(1).max(160);
const NameField = z.string().trim().min(1).max(200);
const IsoField = z.string().trim().min(10).max(40);

/** One requirement of the curriculum: the smallest thing a learner is asked to do. */
export const BlueprintCellSchema = z
  .object({
    id: IdField,
    subject: BlueprintSubjectSchema,
    module: NameField,
    topicId: IdField,
    topic: NameField,
    skillId: IdField,
    skill: NameField,
    microSkillId: IdField,
    microSkill: NameField,
    /** Cell ids that must be secure before this one is taught. */
    prerequisiteCellIds: z.array(IdField).max(20),
    difficultyLevels: z.array(z.number().int().min(1).max(5)).min(1).max(5),
    questionTypes: z.array(BlueprintQuestionTypeSchema).min(1).max(8),
    /** Verified items required before this cell counts as covered. */
    minimumItems: z.number().int().min(1).max(50),
    supportedLanguages: z.array(BlueprintLanguageSchema).min(1),
    allowedExamModes: z.array(BlueprintExamModeSchema).min(1),
    /** Whether the requirement itself has been checked, not whether it has items. */
    verificationStatus: VerificationStatusSchema,
    sourceType: BlueprintSourceTypeSchema,
    /** Where this requirement came from, in words a reviewer can follow up. */
    sourceReference: z.string().trim().max(500),
    reviewer: z.string().trim().min(1).max(160).nullable(),
    reviewedAt: IsoField.nullable(),
    knownLimitations: z.string().max(2_000).default(''),
    version: z.number().int().positive(),
    createdAt: IsoField,
    updatedAt: IsoField,
  })
  .strict()
  .superRefine((cell, context) => {
    if (cell.verificationStatus === 'reviewer-verified' && (!cell.reviewer || !cell.reviewedAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reviewer'],
        message: 'A reviewer-verified blueprint cell must name its reviewer and review date',
      });
    }
    if (new Set(cell.difficultyLevels).size !== cell.difficultyLevels.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['difficultyLevels'],
        message: 'Difficulty levels must not repeat',
      });
    }
    if (new Set(cell.questionTypes).size !== cell.questionTypes.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['questionTypes'],
        message: 'Question types must not repeat',
      });
    }
    if (cell.prerequisiteCellIds.includes(cell.id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['prerequisiteCellIds'],
        message: 'A cell cannot be its own prerequisite',
      });
    }
  });
export type BlueprintCell = z.infer<typeof BlueprintCellSchema>;

/**
 * One item as it exists in the published question bank, with the provenance that
 * lets a reviewer trust or reject it. This is the only input to coverage; no
 * coverage number is ever entered by hand.
 */
export const BlueprintQuestionRecordSchema = z
  .object({
    questionId: IdField,
    /** `null` for a bank item that no blueprint cell claims. */
    cellId: IdField.nullable(),
    subject: BlueprintSubjectSchema,
    topicId: IdField,
    difficulty: z.number().int().min(1).max(5),
    questionType: BlueprintQuestionTypeSchema,
    language: BlueprintLanguageSchema,
    status: z.enum(['draft', 'published', 'archived']),
    demo: z.boolean(),
    verificationStatus: VerificationStatusSchema,
    sourceType: BlueprintSourceTypeSchema,
    sourceReference: z.string().trim().max(500),
    reviewer: z.string().trim().min(1).max(160).nullable(),
    reviewedAt: IsoField.nullable(),
    /** The option id of the correct answer, used to detect answer-key skew. */
    correctAnswerLabel: z.string().trim().min(1).max(32),
    knownLimitations: z.string().max(2_000).default(''),
  })
  .strict()
  .superRefine((item, context) => {
    if (item.verificationStatus === 'reviewer-verified' && (!item.reviewer || !item.reviewedAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reviewer'],
        message: 'A reviewer-verified item must name its reviewer and review date',
      });
    }
    if (item.demo && item.verificationStatus === 'reviewer-verified') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['verificationStatus'],
        message: 'Demo material cannot be reviewer-verified',
      });
    }
  });
export type BlueprintQuestionRecord = z.infer<typeof BlueprintQuestionRecordSchema>;

/**
 * Whether one bank item counts toward a cell. Every clause is a way real content
 * has been mistaken for coverage before: demo material, generated material no one
 * read, an item filed under the wrong topic, or one at a difficulty the cell does
 * not ask for.
 */
export function countsAsVerifiedCoverage(cell: BlueprintCell, item: BlueprintQuestionRecord): boolean {
  return (
    item.cellId === cell.id &&
    item.status === 'published' &&
    !item.demo &&
    item.verificationStatus === 'reviewer-verified' &&
    item.reviewer !== null &&
    item.reviewedAt !== null &&
    item.subject === cell.subject &&
    item.topicId === cell.topicId &&
    cell.questionTypes.includes(item.questionType) &&
    cell.difficultyLevels.includes(item.difficulty)
  );
}

export type CellCoverageStatus = 'covered' | 'partial' | 'unverified' | 'empty';

export interface CellCoverage {
  cell: BlueprintCell;
  /** Items claiming this cell, whatever their state. */
  totalItems: number;
  /** Items that actually count. Never entered by hand. */
  verifiedItems: number;
  demoItems: number;
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
    const verified = cellItems.filter((item) => countsAsVerifiedCoverage(cell, item));
    const demoItems = cellItems.filter((item) => item.demo).length;

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
    return cell ? countsAsVerifiedCoverage(cell, item) : false;
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
