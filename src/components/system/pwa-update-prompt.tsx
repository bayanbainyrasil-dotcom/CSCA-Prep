import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';

export function PwaUpdatePrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div className="fixed bottom-24 left-1/2 z-[70] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-2xl border bg-card p-3 shadow-float lg:bottom-6">
      <p className="min-w-0 flex-1 text-sm font-semibold">A new CSCA Prep version is ready.</p>
      <Button size="sm" onClick={() => void updateServiceWorker(true)}>Update</Button>
      <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>Later</Button>
    </div>
  );
}
