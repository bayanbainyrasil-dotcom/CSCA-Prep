import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';

const AppDataRuntime = lazy(() => import('@/app/app-data-provider').then((module) => ({ default: module.AppDataProvider })));

/** Starts persistence and sync without holding back the first visible application frame. */
export function AppDataBoundary({ children }: { children: ReactNode }) {
  const [startRuntime, setStartRuntime] = useState(false);

  useEffect(() => {
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(() => setStartRuntime(true), { timeout: 1_000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = globalThis.setTimeout(() => setStartRuntime(true), 0);
    return () => globalThis.clearTimeout(id);
  }, []);

  return <>{children}{startRuntime ? <Suspense fallback={null}><AppDataRuntime>{null}</AppDataRuntime></Suspense> : null}</>;
}
