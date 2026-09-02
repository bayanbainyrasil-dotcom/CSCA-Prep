/**
 * The curriculum blueprint seed lives in `functions/src/blueprint-seed.ts` so the
 * trusted server owns it: the import callable reads its own copy rather than
 * accepting 105 requirement rows from a browser. This re-export exists for the
 * tests, and deliberately for nothing else — no application code imports it, so
 * the seed never reaches the shipped bundle.
 */
export {
  BLUEPRINT_CELL_SEED,
  BLUEPRINT_CELLS_BY_SUBJECT,
  BLUEPRINT_SEED_VERSION,
} from '../../functions/src/blueprint-seed';
