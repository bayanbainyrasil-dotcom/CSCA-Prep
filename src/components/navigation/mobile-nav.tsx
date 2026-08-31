import { NavLink } from 'react-router-dom';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { mobileLearn, mobileMore, primaryNav } from './nav-items';

const dashboard = primaryNav[0]!;
const practice = primaryNav.find((item) => item.path === '/practice')!;
const progress = primaryNav.find((item) => item.path === '/progress')!;
const items = [dashboard, mobileLearn, practice, progress, mobileMore];

export function MobileNav() {
  return (
    <nav aria-label="Mobile navigation" className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t bg-card/90 px-2 pt-1 backdrop-blur-2xl lg:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {items.map(({ label, path, icon: Icon, end }, index) => {
          const isPrimary = index === 2;
          return (
            <NavLink
              key={path}
              to={path}
              end={end}
              aria-label={isPrimary ? 'Start practice' : label}
              className={({ isActive }) => cn(
                'relative flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl text-[0.62rem] font-bold text-muted-foreground',
                isActive && !isPrimary ? 'text-primary' : '',
              )}
            >
              {isPrimary ? (
                <span className="-mt-6 grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-float"><Play className="ml-0.5 h-5 w-5 fill-current" /></span>
              ) : <Icon className="h-5 w-5" />}
              <span>{isPrimary ? 'Practice' : label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
