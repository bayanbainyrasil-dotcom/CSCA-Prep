import { Check, CloudOff, LoaderCircle } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { cn } from '@/lib/utils';

export type SyncState = 'saved' | 'saving' | 'syncing';

export function SyncIndicator({ state = 'saved', className }: { state?: SyncState; className?: string }) {
  const online = useNetworkStatus();
  const content = !online
    ? { icon: CloudOff, label: 'Offline — saved locally' }
    : state === 'saved'
      ? { icon: Check, label: 'Saved' }
      : { icon: LoaderCircle, label: state === 'saving' ? 'Saving…' : 'Syncing…' };
  const Icon = content.icon;

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground', className)} role="status">
      <Icon className={cn('h-3.5 w-3.5', online && state !== 'saved' ? 'animate-spin' : '')} />
      {content.label}
    </span>
  );
}
