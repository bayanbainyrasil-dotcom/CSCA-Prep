/**
 * The progress page's coverage block, with its data.
 *
 * The page itself stays presentational; this component owns the one network
 * read and the three states it can end in. It is separate from the panel so the
 * panel can be tested with fixtures and this container can be tested with a
 * stubbed service.
 *
 * "Studied" comes from the learner's own slice progress, which is the only
 * record in this app that is keyed by blueprint cell. It is not inferred from
 * practice attempts: a practice question carries a topic, not a blueprint
 * requirement, so counting those cells would mean guessing. The definition on
 * screen says exactly that, so the number is never read as total study.
 */
import { useEffect, useMemo, useState } from 'react';
import { BLUEPRINT_CELL_COUNTS } from '../../../functions/src/blueprint-summary';
import { useAppStore } from '@/stores';
import { coverageConfidence, type CoverageConfidence } from './coverage-confidence';
import { CoverageConfidencePanel } from './coverage-confidence-panel';
import { fetchCoverageSummary, type CoverageSummaryResult } from './coverage-summary-service';

export function CoverageConfidenceCard() {
  const profile = useAppStore((state) => state.profile);
  const sliceProgress = useAppStore((state) => state.sliceProgress);
  const russian = (profile?.settings.explanationLanguage ?? 'en-ru') !== 'en';

  const [result, setResult] = useState<CoverageSummaryResult | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchCoverageSummary()
      .then((next) => { if (!cancelled) { setResult(next); setFailed(false); } })
      .catch(() => { if (!cancelled) { setResult(null); setFailed(true); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reloadToken]);

  // A cell the learner has opened at all counts as started. Stage records only
  // exist once a stage is completed, so an id here is real recorded work.
  const studiedCellIds = useMemo(() => Object.keys(sliceProgress), [sliceProgress]);

  const confidence: CoverageConfidence | null = useMemo(() => {
    if (!result) return null;
    return coverageConfidence({
      counts: result.summary.outOf,
      cells: result.cells,
      studiedCellIds,
      generatedAt: result.summary.generatedAt,
      stale: result.stale,
    });
  }, [result, studiedCellIds]);

  return (
    <CoverageConfidencePanel
      state={loading ? 'loading' : failed || !confidence ? 'error' : 'ready'}
      confidence={confidence}
      russian={russian}
      documentedTotal={BLUEPRINT_CELL_COUNTS.total}
      onRetry={() => { setLoading(true); setReloadToken((token) => token + 1); }}
    />
  );
}
