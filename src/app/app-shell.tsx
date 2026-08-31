import { lazy, Suspense, useCallback, useState } from 'react';
import { Outlet, ScrollRestoration } from 'react-router-dom';
import { Sidebar } from '@/components/navigation/sidebar';
import { MobileNav } from '@/components/navigation/mobile-nav';
import { AppHeader } from '@/components/navigation/app-header';

const CommandMenu = lazy(() => import('@/components/navigation/command-menu').then((module) => ({ default: module.CommandMenu })));

export function AppShell() {
  const [searchOpen, setSearchOpen] = useState(false);
  const openSearch = useCallback(() => setSearchOpen(true), []);

  return (
    <div className="min-h-dvh">
      <Sidebar onSearch={openSearch} />
      <AppHeader onSearch={openSearch} />
      <main id="main-content" className="px-4 pb-28 pt-5 sm:px-6 sm:pt-7 lg:ml-[258px] lg:px-8 lg:pb-12">
        <div className="mx-auto w-full max-w-[1440px]"><Outlet /></div>
      </main>
      <MobileNav />
      {searchOpen ? <Suspense fallback={null}><CommandMenu open onOpenChange={setSearchOpen} /></Suspense> : null}
      <ScrollRestoration />
    </div>
  );
}
