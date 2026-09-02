/**
 * The public practice seed lives in `functions/src/public-question-seed.ts` so
 * the trusted server owns it: the import callable reads its own copy and the
 * browser sends only a seed version. This re-export exists for the tests, and
 * deliberately for nothing else — no application code imports it, so the answer
 * keys never reach the shipped bundle.
 */
export {
  AUTHORED_SLICE_CELL_IDS,
  DRAFT_QUESTION_SEED,
  PUBLIC_SEED_ALLOWED_MODES,
  PUBLIC_SEED_VERSION,
  type DraftOption,
  type DraftQuestion,
} from '../../functions/src/public-question-seed';
