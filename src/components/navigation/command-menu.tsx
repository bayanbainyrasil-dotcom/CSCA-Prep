import { useEffect, useMemo, useState } from 'react';
import { Command } from 'cmdk';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { primaryNav } from './nav-items';

const topics = [
  ['Newton’s laws', '/physics?topic=newton-laws'],
  ['Kinematics', '/physics?topic=kinematics'],
  ['Electric circuits', '/physics?topic=circuits'],
  ['Quadratic functions', '/mathematics?topic=quadratic-functions'],
  ['Logarithms', '/mathematics?topic=logarithms'],
  ['Trigonometry', '/mathematics?topic=trigonometry'],
  ['Formula: F = ma', '/formulas?formula=newton-second-law'],
  ['Word: magnitude', '/vocabulary?q=magnitude'],
] as const;

export function CommandMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [onOpenChange, open]);

  const items = useMemo(
    () => [
      ...primaryNav.map(({ label, path, icon }) => ({ label, path, icon })),
      ...topics.map(([label, path]) => ({ label, path, icon: Search })),
    ],
    [],
  );

  const select = (path: string) => {
    void navigate(path);
    onOpenChange(false);
    setQuery('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Search CSCA Prep" description="Find a topic, lesson, formula, word or tool." className="p-0 sm:p-0">
        <Command className="overflow-hidden rounded-b-xl border-t" shouldFilter>
          <div className="flex items-center gap-3 border-b px-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Try “Newton” or “magnitude”"
              className="h-14 w-full bg-transparent text-sm placeholder:text-muted-foreground"
            />
          </div>
          <Command.List className="scrollbar-none max-h-80 overflow-y-auto p-2">
            <Command.Empty className="px-3 py-10 text-center text-sm text-muted-foreground">
              No result yet. Try a subject or a formula name.
            </Command.Empty>
            <Command.Group heading="Jump to" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:text-muted-foreground">
              {items.map(({ label, path, icon: Icon }) => (
                <Command.Item
                  key={`${label}-${path}`}
                  value={label}
                  onSelect={() => select(path)}
                  className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-sm aria-selected:bg-secondary"
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {label}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
