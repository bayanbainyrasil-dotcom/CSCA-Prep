/**
 * Who may open a teaching slice.
 *
 * The content of both slices is authored and unreviewed. Showing it to an
 * ordinary learner on a production deployment would present unverified material
 * as if it were exam preparation, which is the one thing this product must not
 * do. Showing it to nobody would mean the person who has to review it cannot
 * read it in place.
 *
 * So access is decided here, once, and the answer carries the label the screen
 * must display. The decision never depends on the lesson's own `status`: draft
 * stays draft, and `resolveLesson` still refuses to return it as published.
 */

export type SliceAudience =
  /** A local demo or development build. Everything is already labelled unofficial. */
  | 'demo'
  /** A signed-in administrator on a real deployment: this is a review preview. */
  | 'admin'
  /** Everyone else on a real deployment. */
  | 'learner';

export type SliceAccessReason = 'demo-preview' | 'admin-preview' | 'awaiting-review' | 'unknown-cell';

export interface SliceAccess {
  allowed: boolean;
  reason: SliceAccessReason;
  /** Shown on the screen. Never empty when access is allowed. */
  label: string;
  note: string;
}

export function sliceAudience(input: { isDemo: boolean; role: 'user' | 'admin' | undefined }): SliceAudience {
  if (input.isDemo) return 'demo';
  return input.role === 'admin' ? 'admin' : 'learner';
}

export function sliceAccess(input: {
  cellId: string;
  knownCellIds: readonly string[];
  audience: SliceAudience;
}): SliceAccess {
  if (!input.knownCellIds.includes(input.cellId)) {
    return {
      allowed: false,
      reason: 'unknown-cell',
      label: 'Not found',
      note: 'No teaching slice exists for this blueprint cell.',
    };
  }

  if (input.audience === 'demo') {
    return {
      allowed: true,
      reason: 'demo-preview',
      label: 'Awaiting human review',
      note: 'This material was written for the app and no subject-matter reviewer has read it yet. It is here so the path can be tried end to end; it is not verified exam preparation and does not count toward coverage.',
    };
  }

  if (input.audience === 'admin') {
    return {
      allowed: true,
      reason: 'admin-preview',
      label: 'Review preview — awaiting human review',
      note: 'You are seeing unreviewed content because you are signed in as an administrator. Approve or reject it in the review queue; until then it stays hidden from learners and counts toward no coverage.',
    };
  }

  return {
    allowed: false,
    reason: 'awaiting-review',
    label: 'Coming soon',
    note: 'This topic is being written and is waiting for a subject-matter review. It will open once a reviewer has approved it. Nothing unreviewed is shown as study material.',
  };
}
