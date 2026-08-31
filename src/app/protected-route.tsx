import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/auth-provider';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="mx-auto max-w-5xl space-y-4 p-6"><Skeleton className="h-14 w-2/3" /><Skeleton className="h-72 w-full" /></div>;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (!user.onboardingCompleted && location.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}
