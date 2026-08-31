import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
export default function NotFoundPage(){return <div className="grid min-h-[70dvh] place-items-center text-center"><div><p className="data-label">404 · route not found</p><h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">This path is outside the roadmap.</h1><p className="mt-2 text-sm text-muted-foreground">Return to the dashboard for your next recommended step.</p><Button className="mt-6" asChild><Link to="/"><ArrowLeft className="h-4 w-4"/>Dashboard</Link></Button></div></div>;}
