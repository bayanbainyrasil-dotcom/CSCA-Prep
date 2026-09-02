import { useCallback, useEffect, useState } from 'react';
import { collection, getCountFromServer } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { AlertTriangle, BarChart3, Database, Download, FileUp, KeyRound, Library, ShieldCheck, Users } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeading } from '@/components/layout/page-heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FieldLabel, Input } from '@/components/ui/field';
import { useAuth } from '@/features/auth/auth-provider';
import { BlueprintCoverageDashboard } from '@/features/blueprint/coverage-dashboard';
import { fetchBlueprintCoverage, type CoverageCell } from '@/features/blueprint/blueprint-service';
import { EMPTY_DRAFT, QuestionEditor, type QuestionDraftValue } from '@/features/blueprint/question-editor';
import { ImportPanel } from '@/features/blueprint/import-panel';
import { ReviewQueue } from '@/features/blueprint/review-queue';
import { BLUEPRINT_SEED_VERSION, PUBLIC_SEED_VERSION } from '../../functions/src/seed-versions';
import { auth, firestore, functions } from '@/lib/firebase';

export default function AdminPage() {
  const { user, isDemo } = useAuth();
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [cells, setCells] = useState<CoverageCell[]>([]);
  const [draft, setDraft] = useState<QuestionDraftValue>(EMPTY_DRAFT);
  const [refreshToken, setRefreshToken] = useState(0);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!isAdmin || !firestore) return;
    const database = firestore;
    void Promise.all(
      ['questions', 'lessons', 'topics', 'users'].map(
        async (name) => [name, (await getCountFromServer(collection(database, name))).data().count] as const,
      ),
    ).then((entries) => setCounts(Object.fromEntries(entries)));
  }, [isAdmin, refreshToken]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    void fetchBlueprintCoverage()
      .then((report) => { if (!cancelled) setCells(report.cells); })
      .catch(() => { if (!cancelled) setCells([]); });
    return () => { cancelled = true; };
  }, [isAdmin, refreshToken]);

  const bootstrap = async () => {
    if (!functions) return;
    setPending(true);
    try {
      const call = httpsCallable(functions, 'bootstrapAdmin');
      await call({ code });
      await auth?.currentUser?.getIdToken(true);
      toast.success('Administrator access assigned. Refreshing credentials…');
      window.setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bootstrap failed');
    } finally {
      setPending(false);
    }
  };

  /**
   * Imports the draft. The callable stores it as `pending-review` whatever is
   * sent, so "save as draft" and "submit for review" differ only in the bank
   * status, never in whether the item counts as verified.
   */
  const importQuestion = useCallback(
    async (status: 'draft' | 'published') => {
      if (!functions) return;
      const cell = cells.find((entry) => entry.id === draft.cellId);
      if (!cell || draft.questionType === '') {
        toast.error('Choose a blueprint cell and a question type first.');
        return;
      }
      setPending(true);
      try {
        const question = {
          subject: cell.subject,
          module: cell.module,
          topicId: cell.topicId,
          skill: cell.skill,
          difficulty: draft.difficulty,
          language: draft.language,
          question: draft.question,
          ...(draft.questionTranslation.trim() === '' ? {} : { questionTranslation: draft.questionTranslation }),
          options: draft.options.map((text, index) => ({ id: String.fromCharCode(97 + index), text })),
          correctAnswer: String.fromCharCode(97 + draft.correctIndex),
          solution: draft.solution,
          shortSolution: draft.shortSolution,
          explanation: draft.explanation.trim() === '' ? draft.shortSolution : draft.explanation,
          formulas: [],
          vocabulary: [],
          commonMistakes: [],
          estimatedTime: 60,
          sourceType: 'original-csca-style' as const,
          sourceNote: draft.sourceReference,
          tags: ['admin-authored'],
          status,
          demo: false,
          cellId: draft.cellId,
          questionType: draft.questionType,
        };
        const call = httpsCallable(functions, 'importQuestionBank');
        const items = [{ id: draft.id, expectedVersion: 0, question }];
        await call({ dryRun: true, items });
        await call({ dryRun: false, items });
        toast.success('Saved as pending review. A named reviewer must approve it before it counts.');
        setDraft(EMPTY_DRAFT);
        setRefreshToken((value) => value + 1);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Import failed');
      } finally {
        setPending(false);
      }
    },
    [cells, draft],
  );

  const exportBank = async () => {
    if (!functions) return;
    const call = httpsCallable(functions, 'exportQuestionBank');
    const response = await call({ pageSize: 100 });
    downloadJson(response.data, 'csca-question-bank.json');
  };

  if (isDemo) {
    return (
      <LockedAdmin
        title="Cloud administration is unavailable"
        description="Connect Firebase, deploy the protected Functions, then sign in with Google to bootstrap the owner."
      />
    );
  }

  if (!isAdmin) {
    return (
      <div>
        <PageHeading
          eyebrow="Protected administration"
          title="Set up the first owner."
          description="This one-time action calls a replay-protected server function. The setup code is never stored in the React bundle."
        />
        <Card className="mx-auto max-w-xl border-physics/25"><CardContent className="p-6 sm:p-8">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-physics/15 text-amber-700 dark:text-physics">
            <KeyRound className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2 className="mt-6 font-display text-2xl font-semibold">Administrator bootstrap</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Only the first verified Google account can claim ownership. After success, the bootstrap locks permanently.
          </p>
          <FieldLabel className="mt-6" htmlFor="bootstrap-code">Initial setup code</FieldLabel>
          <Input
            id="bootstrap-code"
            type="password"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Enter server-configured code"
          />
          <Button className="mt-4 w-full" disabled={!code || pending} onClick={() => void bootstrap()}>
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />{pending ? 'Verifying…' : 'Claim owner access'}
          </Button>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeading
        eyebrow="Administration"
        title="Content and system control."
        description="Sensitive actions are validated by App Check, custom claims and server-side Zod schemas."
        actions={<Badge variant="success"><ShieldCheck className="h-3 w-3" aria-hidden="true" />Admin claim verified</Badge>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {([
          [Library, 'Questions', counts.questions ?? 0],
          [FileUp, 'Lessons', counts.lessons ?? 0],
          [Database, 'Topics', counts.topics ?? 0],
          [Users, 'Users', counts.users ?? 0],
        ] as const).map(([Icon, label, value]) => (
          <Card key={label}><CardContent className="p-5">
            <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
            <p className="mt-4 font-display text-3xl font-semibold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="mt-5"><BlueprintCoverageDashboard /></div>

      <ImportPanel
        blueprintSeedVersion={BLUEPRINT_SEED_VERSION}
        publicSeedVersion={PUBLIC_SEED_VERSION}
        onImported={() => setRefreshToken((value) => value + 1)}
      />

      <ReviewQueue onReviewed={() => setRefreshToken((value) => value + 1)} />

      <div className="content-grid mt-5">
        <div className="lg:col-span-8">
          <QuestionEditor
            cells={cells}
            value={draft}
            onChange={setDraft}
            pending={pending}
            onSaveDraft={() => void importQuestion('draft')}
            onSubmitForReview={() => void importQuestion('published')}
          />
        </div>
        <aside className="space-y-4 lg:col-span-4">
          <Card><CardContent className="p-5">
            <BarChart3 className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 className="mt-4 font-display text-lg font-semibold">Question bank</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Export includes private solutions and is available to admins only.
            </p>
            <Button variant="outline" className="mt-5 w-full" onClick={() => void exportBank()}>
              <Download className="h-4 w-4" aria-hidden="true" />Export JSON
            </Button>
          </CardContent></Card>
          <Card className="border-physics/25 bg-physics/[0.05]"><CardContent className="p-5">
            <AlertTriangle className="h-5 w-5 text-amber-700 dark:text-physics" aria-hidden="true" />
            <h2 className="mt-4 font-display text-lg font-semibold">Content integrity</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Correct answers and solutions are stored outside the public question documents, production grading runs
              server-side, and an import can never declare itself verified.
            </p>
          </CardContent></Card>
        </aside>
      </div>
    </div>
  );
}

function LockedAdmin({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <PageHeading eyebrow="Protected administration" title={title} description={description} />
      <Card><CardContent className="p-10 text-center">
        <ShieldCheck className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden="true" />
        <p className="mt-4 text-sm text-muted-foreground">
          No client-side password or administrator bypass is available.
        </p>
      </CardContent></Card>
    </div>
  );
}

function downloadJson(value: unknown, name: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
