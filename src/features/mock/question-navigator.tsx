import { cn } from '@/lib/utils';

export interface NavigatorQuestion {
  id: string;
}

/** Shared by the local demo runner and the server-authoritative runner. */
export function QuestionNavigator({
  questions,
  answers,
  flagged,
  currentIndex,
  onSelect,
}: {
  questions: NavigatorQuestion[];
  answers: Record<string, string>;
  flagged: string[];
  currentIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div>
      <p className="data-label mb-3">Questions</p>
      <div className="grid grid-cols-8 gap-1.5 lg:grid-cols-6">
        {questions.map((question, index) => (
          <button
            key={question.id}
            onClick={() => onSelect(index)}
            aria-label={`Question ${index + 1}${answers[question.id] ? ', answered' : ', unanswered'}${flagged.includes(question.id) ? ', flagged' : ''}`}
            className={cn(
              'relative aspect-square min-h-9 rounded-lg border text-xs font-bold',
              index === currentIndex
                ? 'border-primary bg-primary text-primary-foreground'
                : answers[question.id]
                  ? 'border-success/20 bg-success/10 text-success'
                  : 'bg-card text-muted-foreground',
            )}
          >
            {index + 1}
            {flagged.includes(question.id) ? (
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-physics" />
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
