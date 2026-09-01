import { useEffect, useState } from 'react';
import { ArrowRight, Calculator, CheckCircle2, Clock3, FlaskConical, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeading } from '@/components/layout/page-heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  isServerMockAvailable,
  listPublishedMockExams,
  type PublishedMockExam,
} from '@/features/mock/mock-service';

const exams = [
  { subject: 'mathematics', title: 'Mathematics Mock', description: 'Algebra, functions, geometry, probability and statistics.', icon: Calculator, tone: 'bg-primary/10 text-primary' },
  { subject: 'physics', title: 'Physics Mock', description: 'Mechanics, electricity, waves, thermal and modern physics.', icon: FlaskConical, tone: 'bg-physics/15 text-amber-700 dark:text-physics' },
] as const;

export default function MockPage() {
  const serverMocks = useServerMocks();

  if (serverMocks.available) {
    return (
      <div>
        <PageHeading eyebrow="Full mock exams" title="Prove what survives under time." description="Strict exam conditions. Questions, timing and grading are owned by the server; solutions unlock after you submit." />
        {serverMocks.loading ? (
          <p className="text-sm text-muted-foreground" role="status">Loading published mock exams…</p>
        ) : serverMocks.exams.length === 0 ? (
          <Card><CardContent className="p-6">
            <h2 className="font-display text-xl font-semibold tracking-tight">No published mock exam yet</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              A mock becomes available once its blueprint is complete and published. Until then, practice and the diagnostic remain the accurate measures.
            </p>
          </CardContent></Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {serverMocks.exams.map((exam) => (
              <Card key={exam.id}><CardContent className="p-6 sm:p-7">
                <div className="flex items-start justify-between">
                  <span className={`grid h-12 w-12 place-items-center rounded-2xl ${exam.subject === 'mathematics' ? 'bg-primary/10 text-primary' : 'bg-physics/15 text-amber-700 dark:text-physics'}`}>
                    {exam.subject === 'mathematics' ? <Calculator className="h-5 w-5" /> : <FlaskConical className="h-5 w-5" />}
                  </span>
                  <Badge variant="outline">{exam.demo ? 'Sample blueprint' : 'Server-graded'}</Badge>
                </div>
                <h2 className="mt-6 font-display text-2xl font-semibold tracking-tight">{exam.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{exam.instructions}</p>
                <div className="mt-5 flex flex-wrap gap-4 border-y py-4 text-xs font-semibold text-muted-foreground">
                  <span className="flex items-center gap-1.5"><Clock3 className="h-4 w-4" />{exam.durationMinutes} minutes</span>
                  <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" />Saved on the server</span>
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" />{exam.questionCount} questions</span>
                </div>
                <Button className="mt-5 w-full justify-between" asChild>
                  <Link to={`/mock/${exam.subject}/active?exam=${encodeURIComponent(exam.id)}`}>Review instructions &amp; start <ArrowRight className="h-4 w-4" /></Link>
                </Button>
              </CardContent></Card>
            ))}
          </div>
        )}
        <p className="mt-5 text-center text-xs text-muted-foreground">These practice exams are original CSCA-style items. They are not official CSCA questions.</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeading eyebrow="Full mock exams" title="Prove what survives under time." description="Strict exam conditions: English only, 48 questions, 60 minutes, no hints, translation or formulas." actions={<Badge variant="outline">Local demo</Badge>} />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">{[['48','questions'],['60','minutes'],['1','subject per mock']].map(([value,label]) => <Card key={label}><CardContent className="p-5 text-center"><p className="font-display text-3xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></CardContent></Card>)}</div>
      <div className="grid gap-4 lg:grid-cols-2">
        {exams.map(({ subject, title, description, icon: Icon, tone }) => (
          <Card key={subject}><CardContent className="p-6 sm:p-7"><div className="flex items-start justify-between"><span className={`grid h-12 w-12 place-items-center rounded-2xl ${tone}`}><Icon className="h-5 w-5" /></span><Badge variant="outline">Local demo</Badge></div><h2 className="mt-6 font-display text-2xl font-semibold tracking-tight">{title}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p><div className="mt-5 flex flex-wrap gap-4 border-y py-4 text-xs font-semibold text-muted-foreground"><span className="flex items-center gap-1.5"><Clock3 className="h-4 w-4" />60 minutes</span><span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" />Autosaved</span><span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" />Post-exam analysis</span></div><Button className="mt-5 w-full justify-between" variant={subject === 'mathematics' ? 'default' : 'outline'} asChild><Link to={`/mock/${subject}/active`}>Review instructions & start <ArrowRight className="h-4 w-4" /></Link></Button></CardContent></Card>
        ))}
      </div>
      <p className="mt-5 text-center text-xs text-muted-foreground">Local demo: these questions are generated in your browser from open templates and scored on this device. They are not official CSCA questions, and the score is not a server-verified exam result.</p>
    </div>
  );
}

interface ServerMockState {
  available: boolean;
  loading: boolean;
  exams: PublishedMockExam[];
}

/** Published blueprints come from Firestore; the browser never invents one. */
function useServerMocks(): ServerMockState {
  const available = isServerMockAvailable();
  const [loading, setLoading] = useState(available);
  const [publishedExams, setPublishedExams] = useState<PublishedMockExam[]>([]);

  useEffect(() => {
    if (!available) return;
    let cancelled = false;
    void listPublishedMockExams()
      .then((published) => { if (!cancelled) setPublishedExams(published); })
      .catch(() => { if (!cancelled) setPublishedExams([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [available]);

  return { available, loading, exams: publishedExams };
}
