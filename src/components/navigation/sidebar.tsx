import { NavLink } from 'react-router-dom';
import { Search, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { adminNav, primaryNav } from './nav-items';
import { useAuth } from '@/features/auth/auth-provider';

export function Sidebar({ onSearch }: { onSearch: () => void }) {
  const { user, isDemo } = useAuth();
  const navItems = user?.role === 'admin' ? [...primaryNav, adminNav] : primaryNav;

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[258px] flex-col border-r bg-card/75 px-3 pb-4 pt-5 backdrop-blur-2xl lg:flex">
      <NavLink to="/" className="mb-6 flex items-center gap-3 px-3">
        <span className="grid h-10 w-10 place-items-center rounded-[0.9rem] bg-foreground text-background shadow-sm">
          <Zap className="h-4 w-4" aria-hidden="true" />
        </span>
        <span>
          <span className="block font-display text-base font-semibold tracking-[-0.03em]">CSCA Prep</span>
          <span className="block text-[0.65rem] font-bold uppercase tracking-[0.16em] text-muted-foreground">84-day system</span>
        </span>
      </NavLink>

      <Button variant="outline" onClick={onSearch} className="mb-4 w-full justify-between px-3 text-muted-foreground">
        <span className="flex items-center gap-2"><Search className="h-4 w-4" /> Search</span>
        <kbd className="rounded-md border bg-secondary px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold text-foreground">Ctrl K</kbd>
      </Button>

      <nav aria-label="Main navigation" className="scrollbar-none min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {navItems.map(({ label, path, icon: Icon, end }) => (
          <NavLink
            key={path}
            to={path}
            end={end}
            className={({ isActive }) => cn(
              'flex min-h-10 items-center gap-3 rounded-xl px-3 text-[0.82rem] font-semibold transition-colors',
              isActive ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
            )}
          >
            <Icon className="h-[17px] w-[17px]" aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-4 rounded-xl border bg-background/70 p-3.5">
        <div className="mb-2 flex items-center justify-between">
          <span className="data-label">Current phase</span>
          {isDemo ? <Badge variant="warning">Demo</Badge> : <Badge variant="success">Live</Badge>}
        </div>
        <p className="text-sm font-semibold">Foundation sprint</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Day 18 of 84 · Build the base before exam speed.</p>
      </div>
    </aside>
  );
}
