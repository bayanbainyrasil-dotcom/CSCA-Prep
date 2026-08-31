import { useState } from 'react';
import { ChevronDown, Moon, Search, Sun } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { SyncIndicator } from '@/components/system/sync-indicator';
import { useAuth } from '@/features/auth/auth-provider';
import { useTheme } from '@/features/theme/theme-provider';

export function AppHeader({ onSearch }: { onSearch: () => void }) {
  const { user, signOutUser, isDemo } = useAuth();
  const { theme, setTheme } = useTheme();
  const [pending, setPending] = useState(false);

  const signOut = async () => {
    setPending(true);
    try { await signOutUser(); } finally { setPending(false); }
  };

  return (
    <header className="safe-top sticky top-0 z-20 flex h-[calc(60px+env(safe-area-inset-top))] items-center justify-between border-b bg-background/80 px-4 backdrop-blur-xl sm:px-6 lg:ml-[258px] lg:h-[72px] lg:px-8 lg:pt-0">
      <div className="flex items-center gap-3">
        <span className="font-display text-base font-semibold tracking-tight lg:hidden">CSCA</span>
        <SyncIndicator className="hidden sm:inline-flex" />
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Button variant="ghost" size="icon" onClick={onSearch} aria-label="Search"><Search className="h-4 w-4" /></Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle color theme"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button variant="ghost" className="gap-2 px-2 sm:px-3">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">{user?.name.slice(0, 1) ?? 'N'}</span>
              <span className="hidden max-w-28 truncate text-sm sm:inline">{user?.name ?? 'Learner'}</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={8} className="z-50 min-w-56 rounded-xl border bg-card p-1.5 shadow-float">
              <div className="px-3 py-2">
                <p className="text-sm font-semibold">{user?.name}</p>
                <p className="truncate text-xs text-muted-foreground">{isDemo ? 'Saved on this device' : user?.email}</p>
              </div>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Item asChild><Link to="/settings" className="block cursor-pointer rounded-lg px-3 py-2 text-sm outline-none hover:bg-secondary">Settings</Link></DropdownMenu.Item>
              {!isDemo ? (
                <DropdownMenu.Item disabled={pending} onSelect={() => void signOut()} className="cursor-pointer rounded-lg px-3 py-2 text-sm outline-none hover:bg-secondary">Sign out</DropdownMenu.Item>
              ) : null}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
