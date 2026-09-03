import { beforeEach, describe, expect, it } from 'vitest';
import * as backend from '../../../functions/src/index';
import { resetFirestore, listDocuments, readDocument, seedDocument } from '@/test/firebase/firestore';
import { deletedUserIds, resetAuthDouble } from '@/test/firebase/functions';
import type { CallableOptions, CallableRequest, TestableCallable } from '@/test/firebase/functions';

/**
 * Security properties of the callable layer, exercised against the real handlers.
 *
 * Scope, stated plainly: this proves what the *server code* refuses. It does not
 * prove what the *Firestore rules engine* refuses — that needs the emulator,
 * which cannot be downloaded in this environment (dl.google.com and
 * storage.googleapis.com are blocked, and no jar is cached). The rules are
 * covered separately by a source-contract test, which is weaker still. Both
 * remain on the release gate as emulator work.
 */

const ADMIN = { uid: 'admin-1', token: { admin: true, email: 'admin@example.test' } };
const LEARNER = { uid: 'learner-1', token: { email: 'learner@example.test' } };

type AnyCallable = TestableCallable<Record<string, unknown>, unknown>;

function callableEntries(): [string, AnyCallable][] {
  return Object.entries(backend as unknown as Record<string, unknown>)
    .filter(([, value]) => typeof value === 'function' && '__options' in (value as object))
    .map(([name, value]) => [name, value as AnyCallable]);
}

function run<R>(callable: unknown, data: Record<string, unknown>, auth: CallableRequest['auth'] | null): Promise<R> {
  const request = { data, ...(auth === null ? {} : { auth }) } as CallableRequest<Record<string, unknown>>;
  return (callable as TestableCallable<Record<string, unknown>, R>).__handler(request);
}

async function refusalOf(promise: Promise<unknown>): Promise<{ code: string; message: string }> {
  try {
    await promise;
  } catch (cause) {
    const error = cause as { code?: string; message?: string };
    return { code: error.code ?? '', message: error.message ?? '' };
  }
  throw new Error('Expected a refusal, but the call succeeded.');
}

beforeEach(() => {
  resetFirestore();
  resetAuthDouble();
});

describe('every callable the backend exports', () => {
  const entries = callableEntries();

  it('is discovered, so this sweep cannot silently cover nothing', () => {
    expect(entries.length).toBeGreaterThanOrEqual(20);
  });

  it('enforces App Check, without exception', () => {
    const unenforced = entries
      .filter(([, callable]) => (callable.__options as CallableOptions).enforceAppCheck !== true)
      .map(([name]) => name);
    expect(unenforced).toEqual([]);
  });

  it('additionally consumes the token on every call that changes trusted state', () => {
    // Consuming the token is replay protection and costs a round trip, so it is
    // reserved for infrequent, consequential calls rather than applied to reads
    // and answer saves. Enforcement above is the universal property; this is the
    // stronger one, and the list of who gets it must not quietly shrink.
    const mustConsume = [
      'bootstrapAdmin', 'setUserRole', 'deleteMyAccount', 'resetMyProgress',
      'setContentVerification', 'upsertBlueprintCell', 'publishMockExam',
      'importBlueprintDraft', 'importPublicQuestionSeed', 'importPrivateQuestions',
      'recordOutlineReview',
    ];
    const missing = mustConsume.filter((name) => {
      const found = entries.find(([entryName]) => entryName === name);
      return !found || (found[1].__options as CallableOptions).consumeAppCheckToken !== true;
    });
    expect(missing).toEqual([]);
  });

  it('refuses an anonymous caller', async () => {
    const accepted: string[] = [];
    for (const [name, callable] of entries) {
      try {
        await run(callable, {}, null);
        accepted.push(name);
      } catch (cause) {
        void cause;
      }
    }
    expect(accepted).toEqual([]);
  });
});

describe('a learner cannot promote themselves', () => {
  it('is refused by setUserRole, for themselves and for anyone else', async () => {
    expect((await refusalOf(run(backend.setUserRole, { uid: 'learner-1', role: 'admin' }, LEARNER))).code).toBe('permission-denied');
    expect((await refusalOf(run(backend.setUserRole, { uid: 'learner-2', role: 'admin' }, LEARNER))).code).toBe('permission-denied');
  });

  it('is refused by every administrator-only callable, as an authorization refusal', async () => {
    const adminOnly = [
      'setUserRole', 'setContentVerification', 'upsertBlueprintCell', 'publishMockExam',
      'importBlueprintDraft', 'importPublicQuestionSeed', 'importPrivateQuestions',
      'importQuestionBank', 'exportQuestionBank', 'getBlueprintCoverage',
      'recordOutlineReview', 'readOutlineReviews',
    ] as const;
    const wrong: string[] = [];
    for (const name of adminOnly) {
      try {
        await run((backend as unknown as Record<string, unknown>)[name], {}, LEARNER);
        wrong.push(`${name} (succeeded)`);
      } catch (cause) {
        const code = (cause as { code?: string }).code;
        if (code !== 'permission-denied') wrong.push(`${name} (refused with ${String(code)})`);
      }
    }
    expect(wrong).toEqual([]);
  });
});

describe('rate limits', () => {
  it('refuse once the window is spent, and are keyed per identity', async () => {
    let refused = '';
    for (let index = 0; index < 302; index += 1) {
      try {
        await run(backend.readOutlineReviews, {}, ADMIN);
      } catch (cause) {
        refused = (cause as { code?: string }).code ?? '';
        break;
      }
    }
    expect(refused).toBe('resource-exhausted');

    // A different identity is unaffected: the counter is keyed on action and uid.
    await expect(run(backend.readOutlineReviews, {}, { uid: 'admin-2', token: { admin: true } })).resolves.toBeTruthy();
  });
});

describe('account actions touch only the caller', () => {
  function seedTwoLearners(): void {
    for (const uid of ['learner-1', 'learner-2']) {
      seedDocument('users', uid, { uid, name: 'x' });
      seedDocument(`users/${uid}/attempts`, 'a1', { questionId: 'q1', ownerId: uid });
      seedDocument(`users/${uid}/notes`, 'n1', { text: 'mine', ownerId: uid });
    }
  }

  it('resetMyProgress clears the caller and leaves the other learner untouched', async () => {
    seedTwoLearners();

    await run(backend.resetMyProgress, { confirmation: 'RESET' }, LEARNER);

    expect(listDocuments('users/learner-1/attempts')).toHaveLength(0);
    expect(listDocuments('users/learner-2/attempts')).toHaveLength(1);
    expect(listDocuments('users/learner-2/notes')).toHaveLength(1);
    expect(readDocument('users', 'learner-1')).toBeDefined();
  });

  it('deleteMyAccount refuses a stale sign-in and deletes nothing', async () => {
    seedTwoLearners();
    const stale = { uid: 'learner-1', token: { email: 'learner@example.test', auth_time: 1 } };

    const failure = await refusalOf(run(backend.deleteMyAccount, { confirmation: 'DELETE' }, stale));

    expect(failure.code).toBe('failed-precondition');
    expect(failure.message).toMatch(/Sign in again/i);
    expect(readDocument('users', 'learner-1')).toBeDefined();
    expect(listDocuments('users/learner-1/attempts')).toHaveLength(1);
  });

  it('deleteMyAccount with a fresh sign-in removes only the caller', async () => {
    seedTwoLearners();
    const fresh = { uid: 'learner-1', token: { email: 'learner@example.test', auth_time: Math.floor(Date.now() / 1000) } };

    await run(backend.deleteMyAccount, { confirmation: 'DELETE' }, fresh);

    expect(readDocument('users', 'learner-1')).toBeUndefined();
    expect(listDocuments('users/learner-1/attempts')).toHaveLength(0);
    expect(readDocument('users', 'learner-2')).toBeDefined();
    expect(listDocuments('users/learner-2/notes')).toHaveLength(1);
    // Exactly one sign-in removed, and it is the caller's.
    expect(deletedUserIds).toEqual(['learner-1']);
  });
});

describe('the audit trail', () => {
  it('records administrator actions without reviewer notes or learner free text', async () => {
    seedDocument('blueprintCells', 'c1', { subject: 'mathematics', module: 'M', topic: 'T', skill: 'S', microSkill: 'm', version: 1 });

    await run(backend.recordOutlineReview, {
      cellId: 'c1',
      status: 'difference-found',
      expectedCellVersion: 1,
      sourceUrl: 'https://example.edu/outline.pdf',
      sourceTitle: 'Outline',
      sourceEdition: null,
      sourcePublishedAt: '2026-01-15',
      differenceNote: 'REVIEWER-NOTE-TOKEN differs in scope.',
      ownSummary: 'OWN-SUMMARY-TOKEN',
      ownWordsAttested: true,
    }, ADMIN);

    const serialised = JSON.stringify(listDocuments('_auditLogs'));
    for (const token of ['REVIEWER-NOTE-TOKEN', 'OWN-SUMMARY-TOKEN']) {
      expect(serialised, token).not.toContain(token);
    }
    expect(serialised).toContain('blueprint.outlineReviewed');
  });
});
