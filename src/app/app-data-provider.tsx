import { useEffect, type ReactNode } from 'react';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { getSeedContent } from '@/data';
import {
  FormulaSchema,
  LessonSchema,
  TopicSchema,
  UserProfileSchema,
  UserSettingsSchema,
  VocabularyEntrySchema,
  type Attempt,
  type SyncEntityType,
  type UserProfile,
} from '@/domain';
import { persistLocalProfile, useAuth, type SessionUser } from '@/features/auth/auth-provider';
import { firestore, functions } from '@/lib/firebase';
import { getCscaDatabase } from '@/lib/persistence/database';
import { LocalFirstRepository } from '@/lib/persistence/repository';
import { SyncEngine } from '@/lib/persistence/syncEngine';
import { useAppStore } from '@/stores';
import { buildAdaptiveDailyPlan } from '@/lib/adaptive';

const DeviceIdSchema = z.string().regex(/^device-[A-Za-z0-9_-]{8,40}$/);
const DEVICE_KEY = 'csca-device-id-v1';

export function getDeviceId() {
  const parsed = DeviceIdSchema.safeParse(localStorage.getItem(DEVICE_KEY));
  if (parsed.success) return parsed.data;
  const value = `device-${nanoid(16)}`;
  localStorage.setItem(DEVICE_KEY, value);
  return value;
}

function createProfile(input: SessionUser): UserProfile {
  const now = new Date().toISOString();
  return UserProfileSchema.parse({
    uid: input.uid,
    name: input.name,
    email: input.email || null,
    photoURL: input.photoURL ?? null,
    createdAt: input.createdAt,
    lastActiveAt: input.lastActiveAt,
    role: input.role,
    timezone: input.timezone,
    targetExam: 'CSCA',
    targetDate: input.targetDate,
    preferredLanguage: input.preferredLanguage,
    onboardingCompleted: input.onboardingCompleted,
    settings: UserSettingsSchema.parse(input.settings),
    version: input.profileVersion,
    updatedAt: now,
  });
}

function localDateKey(timezone: string): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '00';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

async function loadLocal(repository: LocalFirstRepository, profile: UserProfile) {
  const types: SyncEntityType[] = ['attempt', 'mistake', 'mastery', 'daily-plan', 'mock-attempt', 'vocabulary-progress', 'formula-progress', 'note', 'bookmark'];
  const values = await Promise.all(types.map((type) => repository.list(type)));
  const byType = Object.fromEntries(types.map((type, index) => [type, values[index] ?? []]));
  const plans = byType['daily-plan'] ?? [];
  const today = localDateKey(profile.timezone);
  const todayPlan = plans
    .filter((item) => (item as { date?: string }).date === today)
    .sort((left, right) => String((right as { updatedAt?: string }).updatedAt).localeCompare(String((left as { updatedAt?: string }).updatedAt)))
    .at(0) ?? null;
  useAppStore.getState().hydrate({
    profile,
    attempts: byType.attempt,
    mistakes: byType.mistake,
    masteries: byType.mastery,
    dailyPlan: todayPlan,
    activeMock: byType['mock-attempt']?.find((item) => (item as { status?: string }).status === 'in-progress') ?? null,
    activePractice: null,
    notes: byType.note,
    bookmarks: byType.bookmark,
  });
  if (!todayPlan) {
    const state = useAppStore.getState();
    const generated = buildAdaptiveDailyPlan({
      userId: profile.uid,
      date: today,
      timezone: profile.timezone,
      targetMinutes: profile.settings.dailyStudyMinutes,
      topics: state.topics,
      masteries: Object.values(state.masteries),
      dueEnglishReviewCount: state.vocabulary.length,
    });
    const stableBlockId = (kind: string, topicIds: string[]) => {
      const source = `${kind}:${topicIds.join(':') || 'general'}`;
      let hash = 5381;
      for (const character of source) hash = ((hash << 5) + hash) ^ character.charCodeAt(0);
      return `plan-${kind}-${(hash >>> 0).toString(36)}`;
    };
    const plan = {
      ...generated,
      blocks: generated.blocks.map((block) => ({ ...block, id: stableBlockId(block.kind, block.topicIds) })),
    };
    await state.setDailyPlan(plan, true);
  }
}

function firestoreDateToIso(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return value;
}

async function loadPublishedContent(repository: LocalFirstRepository) {
  if (!firestore) return;
  const { collection, getDocs, limit, query, where } = await import('firebase/firestore');
  const database = firestore;
  const definitions = [
    { collectionName: 'topics', type: 'topic' as const, schema: TopicSchema },
    { collectionName: 'lessons', type: 'lesson' as const, schema: LessonSchema },
    { collectionName: 'vocabulary', type: 'vocabulary' as const, schema: VocabularyEntrySchema },
    { collectionName: 'formulas', type: 'formula' as const, schema: FormulaSchema },
  ];
  const loaded: Record<string, unknown[]> = {};
  try {
    await Promise.all(definitions.map(async (definition) => {
      const snapshot = await getDocs(query(
        collection(database, definition.collectionName),
        where('status', '==', 'published'),
        limit(500),
      ));
      const items = snapshot.docs.flatMap((item) => {
        const data = Object.fromEntries(Object.entries(item.data()).filter(([key]) => key !== 'updatedBy'));
        const normalized = {
          ...data,
          id: item.id,
          createdAt: firestoreDateToIso(data.createdAt),
          updatedAt: firestoreDateToIso(data.updatedAt),
        };
        const parsed = definition.schema.safeParse(normalized);
        return parsed.success ? [parsed.data] : [];
      });
      loaded[definition.type] = items;
      await Promise.all(items.map((item) => repository.cacheContent(definition.type, item)));
    }));
  } catch {
    await Promise.all(definitions.map(async (definition) => {
      loaded[definition.type] = await repository.listCachedContent(definition.type);
    }));
  }
  useAppStore.getState().loadContent({
    topics: loaded.topic ?? [],
    lessons: loaded.lesson ?? [],
    vocabulary: loaded.vocabulary ?? [],
    formulas: loaded.formula ?? [],
  });
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { user, isDemo } = useAuth();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let stopSync: (() => void) | undefined;
    let stopQueuedGradeFlush: (() => void) | undefined;
    let readyForBackgroundHydration = false;
    const database = getCscaDatabase();
    const repository = new LocalFirstRepository(database, user.uid, getDeviceId());
    const seed = getSeedContent({ includeDemo: isDemo });
    const profile = createProfile(user);

    useAppStore.getState().loadContent({
      topics: seed.topics,
      lessons: seed.lessons,
      questions: seed.questions,
      formulas: seed.formulas,
      vocabulary: seed.vocabulary,
    });

    const initialize = async () => {
      let engine: SyncEngine | undefined;
      if (firestore && functions && !isDemo) {
        const [{ httpsCallable }, { createFirestoreSyncAdapter }] = await Promise.all([
          import('firebase/functions'),
          import('@/lib/persistence/firebaseAdapter'),
        ]);
        const gradeQuestion = httpsCallable(functions, 'gradeQuestion');
        const remote = createFirestoreSyncAdapter(firestore, user.uid, {
          gradeAttempt: async (attempt: Attempt) => {
            if (!attempt.selectedAnswer) throw new Error('A selected answer is required for grading.');
            const response = await gradeQuestion({
              questionId: attempt.questionId,
              selectedAnswer: attempt.selectedAnswer,
              deviceId: attempt.deviceId,
              confidence: attempt.confidence,
              ...(attempt.errorType ? { errorType: attempt.errorType } : {}),
              hintUsed: attempt.hintUsed,
              englishComprehension: attempt.englishComprehension,
              startedAt: attempt.startedAt,
              answeredAt: attempt.answeredAt,
              elapsedMs: Math.round(attempt.durationSeconds * 1_000),
              idempotencyKey: attempt.id,
              mode: attempt.mode,
            });
            if (!response.data || typeof response.data !== 'object' || !('record' in response.data)) {
              throw new Error('The grading service returned an invalid record.');
            }
            return (response.data as { record: unknown }).record;
          },
        });
        engine = new SyncEngine(database, remote, user.uid, getDeviceId(), {
          onStatusChange: (snapshot) => {
            useAppStore.getState().setSyncStatus(snapshot);
            if (snapshot.status === 'saved' && !cancelled && readyForBackgroundHydration) void loadLocal(repository, profile);
          },
        });
      }

      useAppStore.getState().configurePersistence({
        save: (type, entity, options) => repository.save(type, entity, options),
        remove: (type, id, options) => repository.remove(type, id, options),
        saveProfile: async (nextProfile) => {
          if (isDemo) {
            persistLocalProfile(nextProfile);
            return;
          }
          if (!functions) return;
          const { httpsCallable } = await import('firebase/functions');
          const ensureProfile = httpsCallable(functions, 'ensureUserProfile');
          await ensureProfile({
            timezone: nextProfile.timezone,
            targetExam: nextProfile.targetExam,
            ...(nextProfile.targetDate ? { targetDate: new Date(`${nextProfile.targetDate}T00:00:00.000Z`).toISOString() } : {}),
            preferredLanguage: nextProfile.preferredLanguage,
            settings: nextProfile.settings,
            onboarding: { completed: nextProfile.onboardingCompleted },
          });
        },
        ...(engine ? { syncNow: () => engine.sync() } : {}),
        ...(engine ? {
          pauseSync: async () => {
            stopSync?.();
            stopSync = undefined;
            await engine.sync();
          },
          resumeSync: () => {
            if (!cancelled && !stopSync) stopSync = engine.start({ intervalMs: 30_000 });
          },
        } : {}),
      });
      if (!isDemo) await loadPublishedContent(repository);
      if (engine) {
        const flushQueuedGrades = async () => {
          if (cancelled || !navigator.onLine) return;
          try {
            const { flushPendingQuestionGrades } = await import('@/features/practice/question-service');
            const flushed = await flushPendingQuestionGrades(user.uid);
            if (flushed > 0) await engine.sync();
          } catch {
            // The queue is intentionally retained and retried on the next online event.
          }
        };
        await flushQueuedGrades();
        await engine.sync();
        const onOnline = () => { void flushQueuedGrades(); };
        window.addEventListener('online', onOnline);
        stopQueuedGradeFlush = () => window.removeEventListener('online', onOnline);
      }
      await loadLocal(repository, profile);
      readyForBackgroundHydration = true;
      if (engine && !cancelled) stopSync = engine.start({ intervalMs: 30_000 });
    };

    void initialize();
    return () => {
      cancelled = true;
      stopSync?.();
      stopQueuedGradeFlush?.();
      useAppStore.getState().configurePersistence(null);
      useAppStore.getState().resetUserState();
    };
  }, [isDemo, user]);

  return children;
}
