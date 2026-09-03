/**
 * Official-outline review.
 *
 * A separate question from content verification, and deliberately so. Content
 * verification asks "is this question correct?"; outline review asks "does this
 * blueprint cell correspond to something the current official CSCA materials
 * actually require?" A cell can be perfectly well authored and still describe a
 * requirement that no longer exists.
 *
 * The two must not be confused, so nothing in this module can make a cell count
 * as verified coverage. `countsAsVerifiedCoverage` in blueprint-engine.ts does
 * not read anything defined here, and a test asserts that.
 *
 * No official material is ever stored. What is stored is a link, dated metadata
 * about the document, and the reviewer's own short description in their own
 * words — the fields are length-bounded and there is deliberately no field
 * capable of holding a copied extract.
 */

export type OutlineReviewStatus =
  | "unreviewed"
  | "matches-source"
  | "difference-found"
  | "needs-specialist"
  | "superseded";

export const OUTLINE_REVIEW_STATUSES: OutlineReviewStatus[] = [
  "unreviewed",
  "matches-source",
  "difference-found",
  "needs-specialist",
  "superseded",
];

/** Statuses that require the reviewer to say what the difference is. */
export const STATUSES_REQUIRING_NOTE: OutlineReviewStatus[] = [
  "difference-found",
  "needs-specialist",
  "superseded",
];

export interface OutlineReviewRecord {
  cellId: string;
  status: OutlineReviewStatus;
  /** Where the reviewer looked. A link, never the material itself. */
  sourceUrl: string | null;
  sourceTitle: string | null;
  sourceEdition: string | null;
  /** The publication date printed on the source document. */
  sourcePublishedAt: string | null;
  /** When a human last compared this cell against that source. Server-stamped. */
  lastCheckedAt: string | null;
  /** Server-stamped from the authenticated caller. A client cannot set this. */
  reviewer: string | null;
  reviewerUid: string | null;
  reviewedAt: string | null;
  /** The reviewer's own words about what differs. Never a quotation. */
  differenceNote: string;
  /** The reviewer's own one-line description of what the source requires. */
  ownSummary: string;
  /** The cell version this judgement was made against. */
  reviewedCellVersion: number | null;
  version: number;
}

export const EMPTY_OUTLINE_REVIEW: Omit<OutlineReviewRecord, "cellId"> = {
  status: "unreviewed",
  sourceUrl: null,
  sourceTitle: null,
  sourceEdition: null,
  sourcePublishedAt: null,
  lastCheckedAt: null,
  reviewer: null,
  reviewerUid: null,
  reviewedAt: null,
  differenceNote: "",
  ownSummary: "",
  reviewedCellVersion: null,
  version: 0,
};

/**
 * A review is current only while the cell it judged is unchanged. Editing a
 * cell after review silently invalidates the judgement, exactly as editing a
 * question after approval invalidates its verification.
 */
export function outlineReviewIsCurrent(
  record: OutlineReviewRecord | null | undefined,
  cellVersion: number,
): boolean {
  if (!record) return false;
  if (record.status === "unreviewed") return false;
  return record.reviewedCellVersion !== null && record.reviewedCellVersion === cellVersion;
}

/** A confirmation is only a confirmation while it is current and says "matches". */
export function outlineIsConfirmed(
  record: OutlineReviewRecord | null | undefined,
  cellVersion: number,
): boolean {
  return outlineReviewIsCurrent(record, cellVersion) && record!.status === "matches-source";
}

export interface OutlineProblem {
  code: string;
  message: string;
}

/** What a submitted review must contain before the server will store it. */
export function validateOutlineReview(input: {
  status: OutlineReviewStatus;
  sourceUrl?: string | null;
  sourceTitle?: string | null;
  sourcePublishedAt?: string | null;
  differenceNote?: string;
  ownSummary?: string;
}): OutlineProblem[] {
  const problems: OutlineProblem[] = [];

  if (!OUTLINE_REVIEW_STATUSES.includes(input.status)) {
    problems.push({ code: "unknown-status", message: `${String(input.status)} is not an outline review status.` });
    return problems;
  }

  if (input.status === "unreviewed") {
    problems.push({ code: "cannot-record-unreviewed", message: "Recording a review cannot set the status back to unreviewed." });
  }

  // Every judgement except "needs a specialist" rests on a named, dated source.
  if (input.status !== "needs-specialist") {
    if (!input.sourceUrl || input.sourceUrl.trim() === "") {
      problems.push({ code: "source-url-required", message: "A source link is required, so the judgement can be re-checked." });
    }
    if (!input.sourceTitle || input.sourceTitle.trim() === "") {
      problems.push({ code: "source-title-required", message: "Name the document that was read." });
    }
    if (!input.sourcePublishedAt || !/^\d{4}-\d{2}-\d{2}$/.test(input.sourcePublishedAt)) {
      problems.push({ code: "source-date-required", message: "Record the source's publication date as YYYY-MM-DD." });
    }
  }

  if (STATUSES_REQUIRING_NOTE.includes(input.status) && (input.differenceNote ?? "").trim().length < 10) {
    problems.push({
      code: "difference-note-required",
      message: "Say, in your own words, what differs or what a specialist has to settle.",
    });
  }

  return problems;
}

export interface OutlineSummary {
  total: number;
  unreviewed: number;
  matchesSource: number;
  differenceFound: number;
  needsSpecialist: number;
  superseded: number;
  /** Reviews invalidated because the cell changed after they were made. */
  stale: number;
  /** Cells whose outline is currently confirmed against a dated source. */
  confirmed: number;
}

export function summariseOutlineReviews(
  cells: { id: string; version: number }[],
  records: Map<string, OutlineReviewRecord>,
): OutlineSummary {
  const summary: OutlineSummary = {
    total: cells.length,
    unreviewed: 0,
    matchesSource: 0,
    differenceFound: 0,
    needsSpecialist: 0,
    superseded: 0,
    stale: 0,
    confirmed: 0,
  };

  for (const cell of cells) {
    const record = records.get(cell.id);
    if (!record || record.status === "unreviewed") {
      summary.unreviewed += 1;
      continue;
    }
    if (!outlineReviewIsCurrent(record, cell.version)) {
      summary.stale += 1;
      continue;
    }
    if (record.status === "matches-source") summary.matchesSource += 1;
    if (record.status === "difference-found") summary.differenceFound += 1;
    if (record.status === "needs-specialist") summary.needsSpecialist += 1;
    if (record.status === "superseded") summary.superseded += 1;
    if (outlineIsConfirmed(record, cell.version)) summary.confirmed += 1;
  }

  return summary;
}

// --- The required-area checklist -------------------------------------------

/**
 * The subject areas that must be present and explicitly confirmed rather than
 * inferred from a broad topic name. Each is matched against a cell's module,
 * topic, skill and micro-skill text.
 *
 * An area matching zero cells is a coverage gap: reviewing the existing cells
 * can never confirm a requirement that has no cell at all.
 */
export interface RequiredArea {
  id: string;
  subject: "mathematics" | "physics";
  label: string;
  pattern: RegExp;
  /** Why this area is called out separately rather than trusted to a broad topic. */
  note: string;
}

export const REQUIRED_AREAS: RequiredArea[] = [
  { id: "math-sets-inequalities", subject: "mathematics", label: "Sets and inequalities", pattern: /\bset\b|sets|inequalit/i, note: "" },
  { id: "math-functions", subject: "mathematics", label: "Functions", pattern: /function/i, note: "" },
  { id: "math-sequences", subject: "mathematics", label: "Sequences and series", pattern: /sequence|progression|series/i, note: "" },
  { id: "math-derivatives", subject: "mathematics", label: "Derivatives", pattern: /derivat|differenti/i, note: "" },
  { id: "math-analytic-geometry", subject: "mathematics", label: "Analytic geometry", pattern: /analytic|coordinate geometry|conic|circle|parabola|ellipse|hyperbola/i, note: "" },
  { id: "math-vectors", subject: "mathematics", label: "Vectors", pattern: /vector/i, note: "" },
  { id: "math-complex", subject: "mathematics", label: "Complex numbers", pattern: /complex/i, note: "" },
  {
    id: "math-solid-geometry",
    subject: "mathematics",
    label: "Solid geometry",
    pattern: /solid geometry|polyhedr|prism|pyramid|cylinder|cone|sphere|surface area|volume/i,
    note: "Matched no cell in the 2026-09-03 seed. Plane geometry is present; three-dimensional figures are not.",
  },
  { id: "math-probability-statistics", subject: "mathematics", label: "Probability, statistics and the normal distribution", pattern: /probabilit|statistic|normal distribution|variance|standard deviation/i, note: "" },

  { id: "phys-mechanics", subject: "physics", label: "Mechanics", pattern: /mechanic|motion|force|newton|momentum|kinematic/i, note: "" },
  { id: "phys-electromagnetism", subject: "physics", label: "Electromagnetism", pattern: /electric|magnet|circuit|current|charge|induction/i, note: "" },
  {
    id: "phys-kinetic-theory",
    subject: "physics",
    label: "Kinetic theory of gases",
    pattern: /kinetic theory|molecular|rms|root mean square|boltzmann|mean kinetic energy/i,
    note: "Matched no cell. The ideal gas relation is present as a macroscopic law; the molecular model behind it is not.",
  },
  { id: "phys-ideal-gas", subject: "physics", label: "Ideal gas", pattern: /ideal gas|gas law/i, note: "" },
  { id: "phys-first-law", subject: "physics", label: "First law of thermodynamics", pattern: /first law/i, note: "" },
  { id: "phys-reflection-refraction", subject: "physics", label: "Reflection and refraction", pattern: /reflect|refract/i, note: "" },
  {
    id: "phys-interference",
    subject: "physics",
    label: "Interference",
    pattern: /interferen/i,
    note: "Matched only phys-waves-wave-behaviour, where it is one of four behaviours under a minimumItems of 3, so the cell can be covered without a single interference item.",
  },
  {
    id: "phys-diffraction",
    subject: "physics",
    label: "Diffraction",
    pattern: /diffract/i,
    note: "Matched no cell. The word does not occur anywhere in the blueprint seed.",
  },
  { id: "phys-photoelectric", subject: "physics", label: "Photoelectric effect", pattern: /photoelectric|photon|work function/i, note: "" },
  { id: "phys-atomic-nuclear", subject: "physics", label: "Atomic and nuclear physics", pattern: /atomic|nucle|radioactiv|isotope|decay/i, note: "" },
];

export interface AreaCoverage {
  area: RequiredArea;
  cellIds: string[];
  /** True when no cell mentions the area at all: a gap, not merely unreviewed. */
  missing: boolean;
  /** True when the only match is a cell covering several distinct behaviours. */
  bundledOnly: boolean;
}

export function checkRequiredAreas(
  cells: { id: string; subject: string; module: string; topic: string; skill: string; microSkill: string }[],
): AreaCoverage[] {
  return REQUIRED_AREAS.map((area) => {
    const matches = cells.filter(
      (cell) =>
        cell.subject === area.subject &&
        area.pattern.test([cell.module, cell.topic, cell.skill, cell.microSkill].join(" ")),
    );
    // A single match whose micro-skill lists three or more comma-separated
    // behaviours is a bundle, not a dedicated requirement.
    const bundledOnly =
      matches.length === 1 && (matches[0]!.microSkill.match(/,/g) ?? []).length >= 2;
    return { area, cellIds: matches.map((cell) => cell.id), missing: matches.length === 0, bundledOnly };
  });
}
