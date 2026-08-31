import { ArrowRight, FlaskConical, Sigma } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeading } from '@/components/layout/page-heading';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function LearnPage() {
  return (
    <div>
      <PageHeading eyebrow="Learn" title="Choose a model to build." description="Every lesson moves from a simple bilingual idea to a timed CSCA-style question." />
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="overflow-hidden border-primary/20 bg-primary/[0.04]"><CardContent className="p-6 sm:p-8"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Sigma className="h-5 w-5" /></span><h2 className="mt-6 font-display text-3xl font-semibold tracking-tight">Mathematics</h2><p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">Rebuild algebra and functions, then connect methods under time.</p><Button className="mt-6" asChild><Link to="/mathematics">Open topic map <ArrowRight className="h-4 w-4" /></Link></Button></CardContent></Card>
        <Card className="overflow-hidden border-physics/25 bg-physics/[0.05]"><CardContent className="p-6 sm:p-8"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-physics/15 text-amber-600 dark:text-physics"><FlaskConical className="h-5 w-5" /></span><h2 className="mt-6 font-display text-3xl font-semibold tracking-tight">Physics</h2><p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">See the diagram, name the quantities and only then choose a formula.</p><Button variant="outline" className="mt-6" asChild><Link to="/physics">Open topic map <ArrowRight className="h-4 w-4" /></Link></Button></CardContent></Card>
      </div>
    </div>
  );
}
