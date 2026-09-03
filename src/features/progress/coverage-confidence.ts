/**
 * Four different questions a learner might mean by "how far along am I?", kept
 * apart on purpose.
 *
 * - **Studied**: what this learner has actually worked on. Their own record.
 * - **Reviewer-approved**: what a subject-matter reviewer has approved, from
 *   `evaluateBlueprintCoverage` and nothing else.
 * - **Demo or practice-only**: material that exists but can never back a secure
 *   mock, because its answers are public or it is demo content.
 * - **Not measured**: everything left.
 *
 * They are deliberately never added together. A single blended number is what
 * turns "you have practised a lot" into "you are ready", which is the claim this
 * product cannot make. There is no total score here and no way to compute one
 * from what this module returns.
 *
 * Pure: it takes an already-computed coverage report and the learner's own
 * record, and does arithmetic. It contains no second coverage formula.
 */
import type { BlueprintCellCounts } from '../../../functions/src/blueprint-summary';

export type ConfidenceCategory = 'studied' | 'reviewerApproved' | 'demoOnly' | 'notMeasured';

export interface CategoryCount {
  category: ConfidenceCategory;
  cells: number;
  outOf: number;
}

export interface SubjectConfidence {
  subject: 'mathematics' | 'physics';
  outOf: number;
  studied: number;
  reviewerApproved: number;
  demoOnly: number;
  notMeasured: number;
}

export interface CoverageConfidence {
  outOf: number;
  studied: number;
  reviewerApproved: number;
  demoOnly: number;
  notMeasured: number;
  bySubject: SubjectConfidence[];
  /** When the underlying coverage report was produced, or null if unknown. */
  generatedAt: string | null;
  /** True when the figures came from a cache rather than a live read. */
  stale: boolean;
}

/** The shape this module needs from a coverage report. Nothing more is read. */
export interface CoverageCellSummary {
  id: string;
  subject: 'mathematics' | 'physics';
  /** From `evaluateBlueprintCoverage`. Only `covered` counts as approved. */
  status: 'covered' | 'partial' | 'unverified' | 'empty';
  /** Items whose answer key is public: practice only, never a secure mock. */
  publicKeyItems: number;
  demoItems: number;
  totalItems: number;
}

export interface ConfidenceInput {
  counts: BlueprintCellCounts;
  cells: readonly CoverageCellSummary[];
  /** Blueprint cell ids this learner has answered at least one question in. */
  studiedCellIds: readonly string[];
  generatedAt?: string | null;
  stale?: boolean;
}

function emptySubject(subject: 'mathematics' | 'physics', outOf: number): SubjectConfidence {
  return { subject, outOf, studied: 0, reviewerApproved: 0, demoOnly: 0, notMeasured: outOf };
}

/**
 * Counts each category independently.
 *
 * A cell can be studied and unapproved at once, or approved and never opened, so
 * the categories overlap by design and must not be summed. Only `notMeasured` is
 * a remainder, and it is a remainder of *evidence*, not of the other three: a
 * cell is unmeasured when nothing at all is known about it.
 */
export function coverageConfidence(input: ConfidenceInput): CoverageConfidence {
  const studied = new Set(input.studiedCellIds);
  const subjects: Record<'mathematics' | 'physics', SubjectConfidence> = {
    mathematics: emptySubject('mathematics', input.counts.mathematics),
    physics: emptySubject('physics', input.counts.physics),
  };

  for (const cell of input.cells) {
    const target = subjects[cell.subject];
    if (!target) continue;

    if (studied.has(cell.id)) target.studied += 1;
    // `covered` is the only status `evaluateBlueprintCoverage` gives a cell whose
    // items are reviewer-verified, current and complete. Nothing else counts.
    if (cell.status === 'covered') target.reviewerApproved += 1;
    // Material that exists but cannot secure a mock. Counted only when the cell
    // is not approved, so an approved cell is never also reported as demo-only.
    else if (cell.publicKeyItems > 0 || cell.demoItems > 0) target.demoOnly += 1;
  }

  for (const subject of Object.values(subjects)) {
    const known = new Set<string>();
    for (const cell of input.cells) {
      if (cell.subject !== subject.subject) continue;
      if (cell.status === 'covered' || cell.totalItems > 0 || studied.has(cell.id)) known.add(cell.id);
    }
    subject.notMeasured = Math.max(0, subject.outOf - known.size);
  }

  const list = [subjects.mathematics, subjects.physics];
  return {
    outOf: input.counts.total,
    studied: list.reduce((total, entry) => total + entry.studied, 0),
    reviewerApproved: list.reduce((total, entry) => total + entry.reviewerApproved, 0),
    demoOnly: list.reduce((total, entry) => total + entry.demoOnly, 0),
    notMeasured: list.reduce((total, entry) => total + entry.notMeasured, 0),
    bySubject: list,
    generatedAt: input.generatedAt ?? null,
    stale: input.stale === true,
  };
}

/** Plain-language definitions, so no screen has to invent its own wording. */
export const CATEGORY_DEFINITION: Record<ConfidenceCategory, { en: string; ru: string }> = {
  studied: {
    en: 'Blueprint topics you have started in a guided teaching slice. This is your own record of work, not a judgement of what you know. Answers given in ordinary practice are not counted here, because a single practice question is not yet mapped to a blueprint requirement.',
    ru: 'Темы плана, которые вы начали в учебном срезе. Это запись вашей работы, а не оценка знаний. Ответы в обычной практике здесь не учитываются: отдельный вопрос практики пока не сопоставлен с требованием плана.',
  },
  reviewerApproved: {
    en: 'Topics where a subject-matter reviewer has approved enough questions to cover the requirement. Nothing you do can move this number.',
    ru: 'Темы, где специалист-рецензент одобрил достаточно вопросов, чтобы закрыть требование. Ваши действия это число не меняют.',
  },
  demoOnly: {
    en: 'Topics that have material, but only demo content or questions whose answers are public. Useful for practice; never used in a secure mock exam.',
    ru: 'Темы с материалом, но только демонстрационным или с публичными ответами. Годится для практики и никогда не используется в защищённом пробном экзамене.',
  },
  notMeasured: {
    en: 'Topics with no questions and no work from you yet. Nothing is known about them either way.',
    ru: 'Темы без вопросов и без вашей работы. О них пока ничего не известно.',
  },
};

/**
 * Shown when the deployment's blueprint is not the documented one.
 *
 * The denominator on this panel is what the deployment actually publishes, not
 * what the repository documents. When those differ, the difference is the
 * interesting fact, so it is said out loud rather than hidden behind a number
 * that silently changed size.
 */
export function blueprintSizeNote(deployedTotal: number, documentedTotal: number): { en: string; ru: string } | null {
  if (deployedTotal === documentedTotal) return null;
  return {
    en: `This deployment publishes ${deployedTotal} blueprint requirements. The documented blueprint has ${documentedTotal}.`,
    ru: `В этой среде опубликовано ${deployedTotal} требований плана. В задокументированном плане их ${documentedTotal}.`,
  };
}

export const CONFIDENCE_DISCLAIMER = {
  en: 'These are four separate counts, not one score. They are not added together, and none of them is a predicted result.',
  ru: 'Это четыре отдельных счётчика, а не один балл. Они не складываются, и ни один из них не является прогнозом результата.',
};
