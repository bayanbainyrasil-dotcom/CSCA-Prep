import { CloudOff, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function OfflinePage(){return <div className="grid min-h-[70dvh] place-items-center text-center"><div><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-muted-foreground"><CloudOff className="h-6 w-6"/></span><h1 className="mt-6 font-display text-3xl font-semibold tracking-tight">You’re offline, not stopped.</h1><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Cached lessons, questions, notes and the active session remain available. Progress will sync automatically after reconnection.</p><Button className="mt-6" asChild><Link to="/"><Home className="h-4 w-4"/>Open dashboard</Link></Button></div></div>;}
