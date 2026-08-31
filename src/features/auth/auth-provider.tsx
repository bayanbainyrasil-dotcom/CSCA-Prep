import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { User } from 'firebase/auth';
import { z } from 'zod';
import { auth, firebaseReady, firestore, functions, isFirebaseConfigured } from '@/lib/firebase';

export interface SessionUser {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  role: 'user' | 'admin';
  onboardingCompleted: boolean;
  timezone: string;
  targetDate: string | null;
  preferredLanguage: 'en' | 'ru' | 'en-ru' | 'zh';
  profileVersion: number;
  settings: Record<string, unknown>;
  createdAt: string;
  lastActiveAt: string;
}

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  isDemo: boolean;
  signIn: () => Promise<void>;
  signOutUser: () => Promise<void>;
  completeOnboarding: (input: OnboardingInput) => Promise<void>;
}

export interface OnboardingInput {
  targetDate: string;
  mathLevel: 'foundation' | 'basic' | 'intermediate';
  physicsLevel: 'new' | 'foundation' | 'basic' | 'intermediate';
  preferredLanguage: 'en' | 'ru' | 'bilingual';
  dailyAvailableMinutes: number;
}

const roleSchema = z.enum(['user', 'admin']);
const profileAccessSchema = z.object({
  role: roleSchema.optional(),
  onboarding: z.object({ completed: z.boolean().optional() }).passthrough().optional(),
  timezone: z.string().optional(),
  targetDate: z.unknown().optional(),
  preferredLanguage: z.enum(['en', 'ru', 'en-ru', 'zh']).optional(),
  version: z.number().int().positive().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.unknown().optional(),
  lastActiveAt: z.unknown().optional(),
}).passthrough();
const AuthContext = createContext<AuthContextValue | null>(null);
const SESSION_CACHE_PREFIX = 'csca-session-v1-';

const demoUser: SessionUser = {
  uid: 'demo-local-user',
  name: 'Nurasyl',
  email: 'demo@local.invalid',
  role: 'user',
  onboardingCompleted: true,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  targetDate: '2026-12-05',
  preferredLanguage: 'en-ru',
  profileVersion: 1,
  settings: {},
  createdAt: '2026-08-12T00:00:00.000Z',
  lastActiveAt: new Date().toISOString(),
};

function toLocalDate(value: unknown): string | null {
  if (typeof value === 'string' && Number.isFinite(Date.parse(value))) return new Date(value).toISOString().slice(0, 10);
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
  }
  return null;
}

function toIsoDateTime(value: unknown): string | null {
  if (typeof value === 'string' && Number.isFinite(Date.parse(value))) return new Date(value).toISOString();
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }
  return null;
}

async function mapFirebaseUser(firebaseUser: User): Promise<SessionUser> {
  await firebaseReady;
  if (!firestore || !functions) throw new Error('Firebase services are unavailable.');
  const [{ doc, getDoc, getDocFromCache }, { httpsCallable }] = await Promise.all([
    import('firebase/firestore'),
    import('firebase/functions'),
  ]);
  const profileRef = doc(firestore, 'users', firebaseUser.uid);
  let existing;
  try {
    if (typeof navigator === 'undefined' || navigator.onLine) {
      const ensureProfile = httpsCallable(functions, 'ensureUserProfile');
      await ensureProfile({
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        targetExam: 'CSCA',
      });
      existing = await getDoc(profileRef);
    } else {
      existing = await getDocFromCache(profileRef);
    }
  } catch (error) {
    try {
      existing = await getDocFromCache(profileRef);
    } catch {
      throw error;
    }
  }
  if (!existing.exists()) throw new Error('The authenticated profile could not be loaded.');

  const token = await firebaseUser.getIdTokenResult().catch(() => null);
  const access = profileAccessSchema.safeParse(existing.data());
  const profileRole = access?.success ? access.data.role : undefined;
  const isAdmin = token?.claims.admin === true || token?.claims.role === 'admin' || profileRole === 'admin';
  const onboardingCompleted = access.success && access.data.onboarding?.completed === true;

  const session: SessionUser = {
    uid: firebaseUser.uid,
    name: firebaseUser.displayName ?? 'CSCA learner',
    email: firebaseUser.email ?? '',
    ...(firebaseUser.photoURL ? { photoURL: firebaseUser.photoURL } : {}),
    role: isAdmin ? 'admin' : 'user',
    onboardingCompleted,
    timezone: access.success ? (access.data.timezone ?? 'UTC') : 'UTC',
    targetDate: access.success ? toLocalDate(access.data.targetDate) : null,
    preferredLanguage: access.success ? (access.data.preferredLanguage ?? 'en-ru') : 'en-ru',
    profileVersion: access.success ? (access.data.version ?? 1) : 1,
    settings: access.success ? (access.data.settings ?? {}) : {},
    createdAt: access.success ? (toIsoDateTime(access.data.createdAt) ?? new Date().toISOString()) : new Date().toISOString(),
    lastActiveAt: access.success ? (toIsoDateTime(access.data.lastActiveAt) ?? new Date().toISOString()) : new Date().toISOString(),
  };
  localStorage.setItem(`${SESSION_CACHE_PREFIX}${firebaseUser.uid}`, JSON.stringify(session));
  return session;
}

function readCachedSession(firebaseUser: User): SessionUser | null {
  try {
    const raw = localStorage.getItem(`${SESSION_CACHE_PREFIX}${firebaseUser.uid}`);
    if (!raw) return null;
    const parsed = z.object({
      uid: z.literal(firebaseUser.uid),
      name: z.string(),
      email: z.string(),
      photoURL: z.string().optional(),
      role: roleSchema,
      onboardingCompleted: z.boolean(),
      timezone: z.string(),
      targetDate: z.string().nullable(),
      preferredLanguage: z.enum(['en', 'ru', 'en-ru', 'zh']),
      profileVersion: z.number().int().positive(),
      settings: z.record(z.string(), z.unknown()),
      createdAt: z.string(),
      lastActiveAt: z.string(),
    }).strict().safeParse(JSON.parse(raw) as unknown);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(isFirebaseConfigured ? null : demoUser);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    void firebaseReady
      .then(async () => {
        if (!auth || cancelled) return;
        const { onAuthStateChanged } = await import('firebase/auth');
        if (cancelled) return;
        unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
          if (!firebaseUser) {
            setUser(null);
            setLoading(false);
            return;
          }
          void mapFirebaseUser(firebaseUser)
            .then(setUser)
            .catch(() => setUser(readCachedSession(firebaseUser)))
            .finally(() => setLoading(false));
        });
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const signIn = useCallback(async () => {
    if (!auth) {
      if (isFirebaseConfigured) await firebaseReady;
    }
    if (!auth) {
      setUser(demoUser);
      return;
    }
    const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = await import('firebase/auth');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    if (window.matchMedia('(max-width: 767px)').matches) {
      await signInWithRedirect(auth, provider);
      return;
    }
    await signInWithPopup(auth, provider);
  }, []);

  const completeOnboarding = useCallback(async (input: OnboardingInput) => {
    if (!user) throw new Error('Sign in before completing onboarding.');
    const preferredLanguage = input.preferredLanguage === 'bilingual' ? 'en-ru' : input.preferredLanguage;
    if (functions) {
      const { httpsCallable } = await import('firebase/functions');
      const ensureProfile = httpsCallable(functions, 'ensureUserProfile');
      await ensureProfile({
        targetDate: new Date(`${input.targetDate}T00:00:00.000Z`).toISOString(),
        preferredLanguage,
        onboarding: {
          mathLevel: input.mathLevel,
          physicsLevel: input.physicsLevel,
          dailyAvailableMinutes: input.dailyAvailableMinutes,
          completed: true,
        },
      });
    }
    setUser((current) => current ? {
      ...current,
      onboardingCompleted: true,
      targetDate: input.targetDate,
      preferredLanguage,
      profileVersion: current.profileVersion + 1,
    } : current);
  }, [user]);

  const signOutUser = useCallback(async () => {
    if (!auth) {
      setUser(demoUser);
      return;
    }
    const { useAppStore } = await import('@/stores');
    useAppStore.getState().resetUserState();
    setUser(null);
    const { signOut } = await import('firebase/auth');
    await signOut(auth);
  }, []);

  const value = useMemo(
    () => ({ user, loading, isDemo: !isFirebaseConfigured, signIn, signOutUser, completeOnboarding }),
    [completeOnboarding, loading, signIn, signOutUser, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider.');
  return value;
}
