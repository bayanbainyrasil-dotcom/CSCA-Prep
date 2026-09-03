import { AlertTriangle, CircleHelp, LoaderCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  blueprintSizeNote,
  CATEGORY_DEFINITION,
  CONFIDENCE_DISCLAIMER,
  type ConfidenceCategory,
  type CoverageConfidence,
} from './coverage-confidence';

/**
 * Four counts, side by side, never added up.
 *
 * The temptation with a panel like this is a single ring showing "68% ready".
 * That number would be a blend of one thing the learner controls, one thing only
 * a reviewer controls, and one thing that is an absence of evidence — and it
 * would read as a prediction. So there is no total here, no percentage, and no
 * arithmetic a reader could mistake for one.
 */

export interface CoverageConfidencePanelProps {
  state: 'loading' | 'ready' | 'error';
  confidence: CoverageConfidence | null;
  russian: boolean;
  /** Size of the blueprint this repository documents, for an honest comparison. */
  documentedTotal?: number;
  onRetry?: () => void;
}

const ORDER: ConfidenceCategory[] = ['studied', 'reviewerApproved', 'demoOnly', 'notMeasured'];

const HEADING: Record<ConfidenceCategory, { en: string; ru: string }> = {
  studied: { en: 'Studied by you', ru: 'Изучено вами' },
  reviewerApproved: { en: 'Approved by a reviewer', ru: 'Одобрено рецензентом' },
  demoOnly: { en: 'Demo or practice only', ru: 'Только демо или практика' },
  notMeasured: { en: 'Not measured', ru: 'Не измерено' },
};

function value(confidence: CoverageConfidence, category: ConfidenceCategory): number {
  return confidence[category];
}

export function CoverageConfidencePanel({ state, confidence, russian, documentedTotal, onRetry }: CoverageConfidencePanelProps) {
  const pick = (text: { en: string; ru: string }) => (russian ? text.ru : text.en);
  const sizeNote =
    confidence && documentedTotal !== undefined ? blueprintSizeNote(confidence.outOf, documentedTotal) : null;

  return (
    <Card className="mt-4"><CardContent className="p-5 sm:p-6">
      <p className="data-label">{russian ? 'Что известно' : 'What is known'}</p>
      <h2 className="mt-1 font-display text-xl font-semibold tracking-tight">
        {russian ? 'Четыре разных вопроса' : 'Four different questions'}
      </h2>
      <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">{pick(CONFIDENCE_DISCLAIMER)}</p>

      {state === 'loading' ? (
        <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          {russian ? 'Читаем текущее покрытие…' : 'Reading the current coverage…'}
        </p>
      ) : null}

      {state === 'error' ? (
        <div className="mt-5" role="alert">
          <p className="flex items-start gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {russian
              ? 'Покрытие сейчас недоступно. Показывать приблизительное значение вместо настоящего было бы хуже, чем не показывать ничего.'
              : 'Coverage is unavailable right now. Showing an approximate figure instead of the real one would be worse than showing nothing.'}
          </p>
          {onRetry ? (
            <button type="button" onClick={onRetry} className="tap-target mt-3 rounded-xl border px-4 text-sm font-semibold hover:border-primary">
              {russian ? 'Попробовать снова' : 'Try again'}
            </button>
          ) : null}
        </div>
      ) : null}

      {state === 'ready' && confidence ? (
        <>
          {confidence.stale ? (
            <p className="mt-4 flex items-start gap-2 rounded-xl border border-physics/40 bg-physics/[0.06] p-3 text-xs" role="status">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 dark:text-physics" aria-hidden="true" />
              {russian
                ? 'Показаны сохранённые данные — они могут быть устаревшими.'
                : 'Showing saved figures — these may be out of date.'}
            </p>
          ) : null}

          <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {ORDER.map((category) => (
              <div key={category} className="rounded-2xl border p-4">
                <dt className="text-sm font-semibold">{pick(HEADING[category])}</dt>
                <dd className="mt-1 font-display text-2xl font-semibold tracking-tight">
                  <span className="sr-only">{pick(HEADING[category])}: </span>
                  {value(confidence, category)}
                  <span className="text-base font-normal text-muted-foreground"> / {confidence.outOf}</span>
                </dd>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{pick(CATEGORY_DEFINITION[category])}</p>
              </div>
            ))}
          </dl>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
              <caption className="sr-only">{russian ? 'По предметам' : 'By subject'}</caption>
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="p-2 font-semibold">{russian ? 'Предмет' : 'Subject'}</th>
                  {ORDER.map((category) => (
                    <th key={category} scope="col" className="p-2 font-semibold">{pick(HEADING[category])}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {confidence.bySubject.map((subject) => (
                  <tr key={subject.subject} className="border-b last:border-0">
                    <th scope="row" className="p-2 font-semibold">
                      {subject.subject === 'mathematics' ? (russian ? 'Математика' : 'Mathematics') : (russian ? 'Физика' : 'Physics')}
                    </th>
                    {ORDER.map((category) => (
                      <td key={category} className="p-2">
                        {subject[category]} <span className="text-muted-foreground">/ {subject.outOf}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {confidence.reviewerApproved === 0 ? (
            <p className="mt-4 flex items-start gap-2 text-sm" role="status">
              <CircleHelp className="h-4 w-4 shrink-0" aria-hidden="true" />
              {russian
                ? 'Пока ни одна ячейка не одобрена рецензентом, поэтому защищённый пробный экзамен недоступен. Практика и изучение это число не меняют — его меняет только человеческая проверка.'
                : 'No cell is reviewer-approved yet, so the secure mock exam is unavailable. Practising and studying do not move that number; only a human review does.'}
            </p>
          ) : null}

          {sizeNote ? <p className="mt-4 text-xs text-muted-foreground">{pick(sizeNote)}</p> : null}

          <p className="mt-4 text-xs text-muted-foreground">
            {confidence.generatedAt
              ? `${russian ? 'Обновлено' : 'Updated'}: ${new Date(confidence.generatedAt).toLocaleString(russian ? 'ru' : 'en')}`
              : russian ? 'Время обновления неизвестно.' : 'Update time unknown.'}
          </p>
        </>
      ) : null}
    </CardContent></Card>
  );
}
