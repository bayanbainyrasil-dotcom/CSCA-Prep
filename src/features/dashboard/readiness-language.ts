/**
 * How readiness is allowed to be described to a learner.
 *
 * The number is a weighted blend of mastery, accuracy and speed against content
 * that has not been calibrated against any real exam outcome. It is useful for
 * deciding what to study next and useless as a prediction, so every place that
 * shows it says so in the same words — a caveat that drifts between screens is
 * a caveat a learner stops reading.
 *
 * Until there is calibration data, it stays an internal planning metric. The
 * test beside this file refuses the vocabulary of prediction.
 */

export const READINESS_EYEBROW = 'Internal metric';

export const READINESS_CAVEAT =
  'A planning signal from mastery, accuracy and speed — not an official CSCA score.';

/**
 * The longer form, for a screen that shows readiness over time. A trend implies
 * a trajectory, so it says plainly what the trajectory is and is not.
 */
export const READINESS_HISTORY_CAVEAT =
  'This trend is a planning signal, not a predicted result. It is calculated from your own answers against content that has not been calibrated against real CSCA outcomes, so it shows whether your practice is moving, not what you would score.';

/**
 * Words that would turn an uncalibrated blend into a claim about the exam.
 * Exported so the test and any future screen check against one list.
 */
export const FORBIDDEN_READINESS_CLAIMS = [
  /\bpredicted score\b/i,
  /\bpredicts? your\b/i,
  /\bpass (?:probability|chance|rate)\b/i,
  /\bchance of passing\b/i,
  /\blikely to (?:pass|score)\b/i,
  /\bexpected score\b/i,
  /\bguarantee/i,
  /\byou will (?:pass|score)\b/i,
  /\bofficial (?:score|result)\b/i,
];
