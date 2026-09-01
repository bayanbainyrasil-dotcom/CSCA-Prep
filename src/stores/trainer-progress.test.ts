import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UserProfileSchema, UserSettingsSchema, type SyncEntityType } from '@/domain';
import { useAppStore } from './appStore';

/**
 * Proves the trainer progress round-trip the learner actually experiences:
 * a review is written through the local-first persistence port, and after a
 * reload — modelled here as a full store reset followed by hydration from what
 * that port stored — the interval, due date, lapse count and mastery are back.
 */

const NOW = '2026-09-10T08:00:00.000Z';

function profileFor(uid: string, explanationLanguage: 'en' | 'ru' | 'en-ru' | 'zh' = 'en-ru') {
  return UserProfileSchema.parse({
    uid,
    name: 'Learner',
    email: null,
    photoURL: null,
    createdAt: NOW,
    lastActiveAt: NOW,
    role: 'user',
    timezone: 'UTC',
    targetExam: 'CSCA',
    targetDate: null,
    preferredLanguage: explanationLanguage,
    onboardingCompleted: true,
    settings: UserSettingsSchema.parse({ explanationLanguage }),
    version: 1,
    updatedAt: NOW,
  });
}

/** Stands in for the Dexie-backed repository: same interface, in memory. */
function createFakeStore() {
  const saved = new Map<string, { entityType: SyncEntityType; entity: Record<string, unknown> }>();
  let syncCount = 0;
  return {
    saved,
    get syncCount() {
      return syncCount;
    },
    persistence: {
      save: (entityType: SyncEntityType, input: unknown) => {
        const entity = input as Record<string, unknown>;
        saved.set(`${entityType}:${String(entity.id)}`, { entityType, entity });
        return Promise.resolve(entity);
      },
      remove: () => Promise.resolve(),
      syncNow: () => {
        syncCount += 1;
        return Promise.resolve({ status: 'saved' as const, pendingCount: 0, lastSyncedAt: NOW, error: null });
      },
    },
    listOf(entityType: SyncEntityType) {
      return [...saved.values()].filter((record) => record.entityType === entityType).map((record) => record.entity);
    },
  };
}

let fake: ReturnType<typeof createFakeStore>;

beforeEach(() => {
  fake = createFakeStore();
  useAppStore.getState().configurePersistence(fake.persistence);
  useAppStore.getState().hydrate({ profile: profileFor('user-1') });
});

afterEach(() => {
  useAppStore.getState().resetUserState();
  useAppStore.getState().configurePersistence(null);
});

describe('vocabulary progress persistence', () => {
  it('survives a reload with its interval, due date and counters intact', async () => {
    await useAppStore.getState().reviewVocabulary('word-1', { isCorrect: true, confidence: 'sure' });
    await useAppStore.getState().reviewVocabulary('word-2', { isCorrect: false, confidence: 'guess' });

    const before = useAppStore.getState().vocabularyProgress;
    expect(Object.keys(before)).toHaveLength(2);
    expect(before['word-1']?.intervalDays).toBeGreaterThan(0);
    expect(before['word-2']?.lapses).toBe(1);

    // Reload.
    useAppStore.getState().resetUserState();
    expect(useAppStore.getState().vocabularyProgress).toEqual({});

    useAppStore.getState().hydrate({
      profile: profileFor('user-1'),
      vocabularyProgress: fake.listOf('vocabulary-progress'),
    });

    const after = useAppStore.getState().vocabularyProgress;
    expect(after['word-1']).toEqual(before['word-1']);
    expect(after['word-2']).toEqual(before['word-2']);
  });

  it('writes through the sync path so a cloud session picks it up', async () => {
    await useAppStore.getState().reviewVocabulary('word-1', { isCorrect: true, confidence: 'sure' });
    expect(fake.saved.has('vocabulary-progress:user-1:vocab:word-1')).toBe(true);
    expect(fake.syncCount).toBeGreaterThan(0);
  });

  it('accumulates across reviews rather than starting over', async () => {
    await useAppStore.getState().reviewVocabulary('word-1', { isCorrect: true, confidence: 'sure' });
    await useAppStore.getState().reviewVocabulary('word-1', { isCorrect: true, confidence: 'sure' });
    const progress = useAppStore.getState().vocabularyProgress['word-1'];
    expect(progress?.repetitions).toBe(2);
    expect(progress?.correctCount).toBe(2);
    expect(progress?.version).toBe(3);
  });
});

describe('formula progress persistence', () => {
  it('survives a reload with its score, attempts and interval intact', async () => {
    await useAppStore.getState().reviewFormula('formula-1', { isCorrect: true, confidence: 'sure' });
    await useAppStore.getState().reviewFormula('formula-1', { isCorrect: false, confidence: 'guess' });

    const before = useAppStore.getState().formulaProgress['formula-1'];
    expect(before?.attempts).toBe(2);
    expect(before?.lapses).toBe(1);

    useAppStore.getState().resetUserState();
    useAppStore.getState().hydrate({
      profile: profileFor('user-1'),
      formulaProgress: fake.listOf('formula-progress'),
    });

    expect(useAppStore.getState().formulaProgress['formula-1']).toEqual(before);
  });
});

describe('owner isolation', () => {
  it('scopes progress records to the signed-in user, so a demo session cannot inherit cloud progress', async () => {
    await useAppStore.getState().reviewVocabulary('word-1', { isCorrect: true, confidence: 'sure' });
    const demoRecordKeys = [...fake.saved.keys()];
    expect(demoRecordKeys).toEqual(['vocabulary-progress:user-1:vocab:word-1']);

    useAppStore.getState().resetUserState();
    useAppStore.getState().hydrate({ profile: profileFor('google-uid-2') });
    await useAppStore.getState().reviewVocabulary('word-1', { isCorrect: true, confidence: 'sure' });

    expect([...fake.saved.keys()].sort()).toEqual([
      'vocabulary-progress:google-uid-2:vocab:word-1',
      'vocabulary-progress:user-1:vocab:word-1',
    ]);
    expect(useAppStore.getState().vocabularyProgress['word-1']?.userId).toBe('google-uid-2');
    expect(useAppStore.getState().vocabularyProgress['word-1']?.repetitions).toBe(1);
  });

  it('refuses to record a review with no signed-in learner', async () => {
    useAppStore.getState().resetUserState();
    await expect(
      useAppStore.getState().reviewVocabulary('word-1', { isCorrect: true, confidence: 'sure' }),
    ).rejects.toThrow(/Sign in/i);
  });
});

describe('changing the explanation language', () => {
  it('leaves recorded progress untouched', async () => {
    await useAppStore.getState().reviewVocabulary('word-1', { isCorrect: true, confidence: 'sure' });
    const before = useAppStore.getState().vocabularyProgress['word-1'];

    await useAppStore.getState().updateSettings({ explanationLanguage: 'ru' });

    expect(useAppStore.getState().settings.explanationLanguage).toBe('ru');
    expect(useAppStore.getState().vocabularyProgress['word-1']).toEqual(before);
  });
});
