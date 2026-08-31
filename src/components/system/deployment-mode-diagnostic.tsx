import { Cloud, HardDrive } from 'lucide-react';
import { deploymentDiagnostic } from '@/lib/deployment';

export function DeploymentModeDiagnostic() {
  if (!import.meta.env.DEV) return null;
  const cloud = deploymentDiagnostic.deploymentMode === 'firebase';
  const Icon = cloud ? Cloud : HardDrive;
  return (
    <aside
      className="fixed bottom-3 left-3 z-[100] flex items-center gap-2 rounded-xl border bg-background/95 px-3 py-2 text-[0.68rem] font-semibold text-muted-foreground shadow-float backdrop-blur"
      data-testid="deployment-mode-diagnostic"
      aria-label="Development deployment mode"
    >
      <Icon className="h-3.5 w-3.5" />
      DEV · {cloud ? 'Firebase cloud' : 'Local demo'} · App Check {deploymentDiagnostic.appCheck}
    </aside>
  );
}
