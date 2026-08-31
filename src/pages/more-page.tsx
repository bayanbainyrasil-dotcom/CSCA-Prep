import { Bookmark, CalendarDays, ClipboardCheck, Languages, Library, NotebookPen, Settings, Sigma, BrainCircuit, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeading } from '@/components/layout/page-heading';
import { Card, CardContent } from '@/components/ui/card';

const items = [
  ['Roadmap', '/roadmap', CalendarDays], ['Mock exams', '/mock', ClipboardCheck], ['Vocabulary', '/vocabulary', Languages],
  ['Formula trainer', '/formulas', Library], ['Mental math', '/mental-math', BrainCircuit], ['Mistakes', '/mistakes', NotebookPen],
  ['Diagnostic', '/diagnostic', Target], ['Bookmarks', '/bookmarks', Bookmark], ['Mathematics', '/mathematics', Sigma], ['Settings', '/settings', Settings],
] as const;

export default function MorePage() {
  return <div><PageHeading eyebrow="More" title="Your full preparation toolkit." /><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{items.map(([label, path, Icon]) => <Link key={path} to={path} className="group"><Card className="h-full transition-transform group-hover:-translate-y-0.5"><CardContent className="p-5"><Icon className="h-5 w-5 text-primary" /><p className="mt-5 font-display font-semibold tracking-tight">{label}</p></CardContent></Card></Link>)}</div></div>;
}
