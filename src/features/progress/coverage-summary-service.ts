/**
 * Client side of the learner-facing coverage read.
 *
 * Three things matter here and nothing else does.
 *
 * 1. The response is parsed with a `.strict()` schema. If a future server ever
 *    starts returning a reviewer name or a question id on this path, parsing
 *    fails loudly instead of quietly putting private data into a React tree.
 * 2. A successful read is cached, so a learner who opens the progress page
 *    offline still sees the last real figures. The cache is returned with
 *    `stale: true`, and the panel says so on screen. It is never presented as
 *    current.
 * 3. When there is no coverage to read — no Firebase on this deployment, the
 *    call failing, the response not matching the schema — the caller gets an
 *    error. It does not get an estimate, and it does not get zeros: "nothing is
 *    verified" and "we could not find out" are different statements, and only
 *    one of them is true here.
 */
import { httpsCallable } from 'firebase/functions';
import { z } from 'zod';
import { functions, isFirebaseConfigured } from '@/lib/firebase';
import type { CoverageCellSummary } from './coverage-confidence';

const CoverageSummaryCellSchema = z
  .object({
    id: z.string().min(1),
    subject: z.enum(['mathematics', 'physics']),
    status: z.enum(['covered', 'partial', 'unverified', 'empty']),
    totalItems: z.number().int().min(0),
    demoItems: z.number().int().min(0),
    publicKeyItems: z.number().int().min(0),
  })
  .strict();

const CoverageSummarySchema = z
  .object({
    generatedAt: z.string().min(1),
    outOf: z
      .object({
        total: z.number().int().min(0),
        mathematics: z.number().int().min(0),
        physics: z.number().int().min(0),
      })
      .strict(),
    cells: z.array(CoverageSummaryCellSchema),
  })
  .strict();

export type CoverageSummary = z.infer<typeof CoverageSummarySchema>;

export interface CoverageSummaryResult {
  summary: CoverageSummary;
  cells: CoverageCellSummary[];
  /** True when this came from the cache rather than from a live read. */
  stale: boolean;
}

const CACHE_KEY = 'csca.coverage-summary.v1';

export function readCachedCoverageSummary(): CoverageSummary | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = CoverageSummarySchema.safeParse(JSON.parse(raw) as unknown);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function writeCachedCoverageSummary(summary: CoverageSummary): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(CACHE_KEY, JSON.stringify(summary));
  } catch {
    /* Storage can be full or disabled. A missing cache is not an error. */
  }
}

/**
 * Reads coverage, falling back to the cache only when the live read fails.
 *
 * A cached answer is never preferred over a live one, because a stale
 * denominator is the kind of number a learner would plan around.
 */
export async function fetchCoverageSummary(): Promise<CoverageSummaryResult> {
  try {
    if (!isFirebaseConfigured || !functions) {
      throw new Error('This deployment has no coverage service.');
    }
    const call = httpsCallable(functions, 'getCoverageSummary');
    const response = await call({});
    const summary = CoverageSummarySchema.parse(response.data);
    writeCachedCoverageSummary(summary);
    return { summary, cells: summary.cells, stale: false };
  } catch (cause) {
    const cached = readCachedCoverageSummary();
    if (cached) return { summary: cached, cells: cached.cells, stale: true };
    throw cause instanceof Error ? cause : new Error('Coverage could not be read.');
  }
}
