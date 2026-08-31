import { useMemo } from 'react';
import { ArrowLeft, CheckCircle2, Clock3, Target, TriangleAlert, XCircle } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeading } from '@/components/layout/page-heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { buildMockQuestions, MockResultSchema, resultKey, type MockSubject } from '@/features/mock/mock-data';
import { useAuth } from '@/features/auth/auth-provider';

export default function MockResultsPage() {
  const { user } = useAuth();
  const ownerId = user?.uid ?? 'anonymous';
  const params = useParams();
  const subject: MockSubject = params.subject === 'mathematics' ? 'mathematics' : 'physics';
  const result = useMemo(() => { try { const raw = localStorage.getItem(resultKey(ownerId, subject)); if (!raw) return null; const parsed = MockResultSchema.safeParse(JSON.parse(raw) as unknown); return parsed.success ? parsed.data : null; } catch { return null; } }, [ownerId, subject]);
  const questions = useMemo(() => buildMockQuestions(subject), [subject]);
  if (!result) return <div><PageHeading title="No submitted mock found." description="Complete a mock exam to see analysis." /><Button asChild><Link to="/mock"><ArrowLeft className="h-4 w-4" /> Mock exams</Link></Button></div>;
  const accuracy = Math.round((result.correct / 48) * 100);
  const topicMap = new Map<string,{total:number;correct:number}>();
  questions.forEach((question) => { const row = topicMap.get(question.module) ?? { total: 0, correct: 0 }; row.total += 1; if (result.answers[question.id] === question.correctAnswer) row.correct += 1; topicMap.set(question.module,row); });
  const chartData = [...topicMap.entries()].map(([topic,row]) => ({ topic, score: Math.round(row.correct / row.total * 100) }));
  return <div><PageHeading eyebrow="Post-exam analysis" title={`${accuracy}% · ${result.correct} of 48 correct`} description="This practice analysis separates knowledge gaps from skipped items and points to the next study block." actions={<Badge variant="outline">Practice mock</Badge>} /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{([[CheckCircle2,result.correct,'Correct','text-success'],[XCircle,result.wrong,'Wrong','text-destructive'],[TriangleAlert,result.skipped,'Skipped','text-amber-700 dark:text-physics'],[Clock3,`${Math.floor(result.durationSeconds/60)}m`,'Time used','text-primary']] as const).map(([Icon,value,label,color]) => <Card key={label}><CardContent className="p-5"><Icon className={`h-5 w-5 ${color}`} /><p className="mt-4 font-display text-3xl font-semibold tracking-tight">{value}</p><p className="text-xs text-muted-foreground">{label}</p></CardContent></Card>)}</div><div className="content-grid mt-5"><Card className="lg:col-span-8"><CardContent className="p-5 sm:p-6"><h2 className="font-display text-xl font-semibold tracking-tight">Score by topic</h2><div className="mt-5 h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ left: -20 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="topic" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" /><YAxis domain={[0,100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" /><Tooltip cursor={{ fill: 'hsl(var(--secondary))' }} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 14 }} /><Bar dataKey="score" fill="hsl(var(--primary))" radius={[7,7,0,0]} /></BarChart></ResponsiveContainer></div></CardContent></Card><Card className="lg:col-span-4"><CardContent className="p-5 sm:p-6"><Target className="h-5 w-5 text-primary" /><h2 className="mt-4 font-display text-xl font-semibold tracking-tight">Suggested repair</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Start with the lowest topic score, do one bilingual lesson, then retry five similar parameterized questions tomorrow.</p><Button className="mt-5 w-full" asChild><Link to="/practice/session?mode=weak-topics">Start weak-topic practice</Link></Button><Button variant="ghost" className="mt-2 w-full" asChild><Link to="/mock">Back to mocks</Link></Button></CardContent></Card></div></div>;
}
